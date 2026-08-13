<?php

declare(strict_types=1);

class ProductSyncWebExportGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function buildExportPayload(array $data, int|string $userId): array
    {
        try {
            $busunitCode = trim((string) ($data['busunitcode'] ?? ''));
            $rows = $data['rows'] ?? [];
            $selectedPricingCodes = $data['selected_pricing_codes'] ?? [];

            if ($busunitCode === '') {
                return [
                    'message' => 'MissingBusunitCode',
                ];
            }

            if (!is_array($rows) || count($rows) === 0) {
                return [
                    'message' => 'NoRows',
                ];
            }

            if (!is_array($selectedPricingCodes)) {
                $selectedPricingCodes = [];
            }

            $normalizedRows = [];

            foreach ($rows as $row) {
                $productId = trim((string) ($row['product_id'] ?? ''));
                $pricingCode = trim((string) ($row['pricing_code'] ?? ''));
                $action = trim((string) ($row['action'] ?? ''));

                if ($productId === '' || $pricingCode === '' || $action === '') {
                    continue;
                }

                $rowKey = $this->pairKey($productId, $pricingCode);

                $normalizedRows[$rowKey] = [
                    'row_key' => $rowKey,
                    'product_id' => $productId,
                    'pricing_code' => $pricingCode,
                    'action' => $action,
                ];
            }

            if (count($normalizedRows) === 0) {
                return [
                    'message' => 'NoRows',
                ];
            }

            $salesTypes = $this->getWebSalesTypes();
            $pricingMappings = $this->getWebPricingBySalesTypePerBu($busunitCode);

            $webPricingCodes = array_values(array_unique(array_filter(
                array_map(fn ($row) => trim((string) ($row['pricing_category'] ?? '')), $pricingMappings),
                fn ($v) => $v !== ''
            )));

            if (count($selectedPricingCodes) === 0) {
                $selectedPricingCodes = $webPricingCodes;
            }

            $selectedPricingCodes = array_values(array_unique(array_filter(
                array_map(fn ($v) => trim((string) $v), $selectedPricingCodes),
                fn ($v) => $v !== ''
            )));

            $webSourceRows = $this->getOnlineSourceRows($selectedPricingCodes);
            $webMap = [];

            foreach ($webSourceRows as $row) {
                $productId = trim((string) ($row['product_id'] ?? ''));
                $pricingCode = trim((string) ($row['pricing_code'] ?? ''));

                if ($productId === '' || $pricingCode === '') {
                    continue;
                }

                $webMap[$this->pairKey($productId, $pricingCode)] = $row;
            }

            $exportRows = [];

            foreach ($normalizedRows as $rowKey => $baseRow) {
                $action = $baseRow['action'];
                $webRow = $webMap[$rowKey] ?? null;

                $exportRows[] = [
                    'row_key' => $rowKey,
                    'product_id' => $baseRow['product_id'],
                    'pricing_code' => $baseRow['pricing_code'],
                    'action' => $action,
                    'online' => $webRow ? [
                        'product_id' => (string) ($webRow['product_id'] ?? ''),
                        'pricing_code' => (string) ($webRow['pricing_code'] ?? ''),
                        'pricing_label' => (string) ($webRow['pricing_label'] ?? ''),
                        'item_name' => (string) ($webRow['item_name'] ?? ''),
                        'item_category' => (string) ($webRow['item_category'] ?? ''),
                        'unit_of_measure' => (string) ($webRow['unit_of_measure'] ?? ''),
                        'unit_value' => (string) ($webRow['unit_value'] ?? ''),
                        'unit_cost' => isset($webRow['unit_cost']) ? (float) $webRow['unit_cost'] : 0,
                        'selling_price' => isset($webRow['selling_price']) ? (float) $webRow['selling_price'] : 0,
                        'inventory_type' => (string) ($webRow['inventory_type'] ?? 'PRODUCT'),
                        'vatable' => (string) ($webRow['vatable'] ?? ''),
                        'expiry_days' => (int) ($webRow['expiry_days'] ?? 0),
                        'item_brand' => (string) ($webRow['item_brand'] ?? ''),
                        'isDiscountable' => (string) ($webRow['isDiscountable'] ?? 'No'),
                    ] : null,
                ];
            }

            return [
                'message' => 'Success',
                'target' => [
                    'busunitcode' => $busunitCode,
                ],
                'sales_types' => $salesTypes,
                'pricing_mappings' => $pricingMappings,
                'rows' => $exportRows,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function getWebSalesTypes(): array
    {
        $stmt = $this->conn->prepare("
            SELECT
                seq,
                sales_type_id,
                description,
                deletestatus,
                usertracker,
                createdtime
            FROM lkp_sales_type
            WHERE deletestatus = 'Active'
            ORDER BY description ASC, sales_type_id ASC
        ");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getWebPricingBySalesTypePerBu(string $busunitCode): array
    {
        $stmt = $this->conn->prepare("
            SELECT
                seq,
                busunitcode,
                sales_type_id,
                pricing_category,
                deletestatus,
                usertracker,
                createdtime
            FROM tbl_pricing_by_sales_type_per_bu
            WHERE busunitcode = :busunitcode
              AND deletestatus = 'Active'
            ORDER BY sales_type_id ASC, pricing_category ASC
        ");

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOnlineSourceRows(array $pricingCodes): array
    {
        if (count($pricingCodes) === 0) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($pricingCodes), '?'));

        $sql = "
            SELECT
                p.build_code AS product_id,
                p.productcode,
                p.build_code,
                p.`desc` AS item_name,
                p.category AS item_category,
                p.uom AS unit_of_measure,
                p.uomval AS unit_value,
                pd.cost_per_uom AS unit_cost,
                pd.srp AS selling_price,
                p.level AS inventory_type,
                p.tax_type AS vatable,
                p.expiry_days,
                p.brandcode AS item_brand,
                p.isdiscountable AS isDiscountable,
                pd.pricing_code,
                COALESCE(pc.pricing_code, pd.pricing_code) AS pricing_label
            FROM tbl_pricing_details pd
            INNER JOIN lkp_build_of_products p
                ON p.build_code = pd.inv_code
               AND p.deletestatus = 'Active'
            LEFT JOIN lkp_pricing_code pc
                ON pc.uuid = pd.pricing_code
               AND pc.deletestatus = 'Active'
            WHERE pd.deletestatus = 'Active'
              AND pd.pricing_code IN ($placeholders)
            ORDER BY pd.pricing_code ASC, p.`desc` ASC
        ";

        $stmt = $this->conn->prepare($sql);

        foreach ($pricingCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function pairKey(string $productId, string $pricingCode): string
    {
        return $productId . '||' . $pricingCode;
    }
}