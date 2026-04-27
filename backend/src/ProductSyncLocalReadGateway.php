<?php

declare(strict_types=1);

class ProductSyncLocalReadGateway
{
    private PDO $conn;

    public function __construct(Database $localDatabase)
    {
        $this->conn = $localDatabase->getConnection();
    }

    public function readLocalSnapshot(array $data, int|string $userId): array
    {
        try {
            $target = $this->getActiveOfflineTargetMapping();

            if (!$target) {
                return [
                    'message' => 'NoBusinessUnit',
                    'target' => null,
                    'selected_pricing_codes' => [],
                    'offline_existing_pricing_codes' => [],
                    'offline_products' => [],
                    'offline_pricing_rows' => [],
                ];
            }

            $busunitCode = (string) ($target['busunitcode'] ?? '');
            $busunitName = (string) ($target['busunit_name'] ?? '');

            if ($busunitCode === '') {
                return [
                    'message' => 'NoBusinessUnit',
                    'target' => null,
                    'selected_pricing_codes' => [],
                    'offline_existing_pricing_codes' => [],
                    'offline_products' => [],
                    'offline_pricing_rows' => [],
                ];
            }

            $requestedPricingCodes = $this->extractSelectedPricingCodes($data);
            $allOfflinePricingCodes = $this->getAllOfflinePricingCodes();

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = $allOfflinePricingCodes;
            }

            $offlineProducts = $this->getOfflineProducts($busunitCode);
            $offlinePricingRows = $this->getOfflinePricingRows($requestedPricingCodes);

            return [
                'message' => 'Success',
                'target' => [
                    'busunitcode' => $busunitCode,
                    'busunit_name' => $busunitName,
                ],
                'selected_pricing_codes' => $requestedPricingCodes,
                'offline_existing_pricing_codes' => $allOfflinePricingCodes,
                'offline_products' => $offlineProducts,
                'offline_pricing_rows' => $offlinePricingRows,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'target' => null,
                'selected_pricing_codes' => [],
                'offline_existing_pricing_codes' => [],
                'offline_products' => [],
                'offline_pricing_rows' => [],
            ];
        }
    }

    private function getActiveOfflineTargetMapping(): ?array
    {
        $stmt = $this->conn->query("
            SELECT
                Unit_Code AS busunitcode,
                Unit_Name AS busunit_name
            FROM tbl_main_business_units
            WHERE Status = 'Active'
              AND TRIM(COALESCE(Unit_Code, '')) <> ''
            ORDER BY ID ASC
            LIMIT 1
        ");

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'busunitcode' => (string) ($row['busunitcode'] ?? ''),
            'busunit_name' => (string) ($row['busunit_name'] ?? ''),
        ];
    }

    private function getAllOfflinePricingCodes(): array
    {
        $stmt = $this->conn->query("
            SELECT DISTINCT pricing_category
            FROM tbl_pricing_by_sales_type
            WHERE deletestatus = 'Active'
            ORDER BY pricing_category ASC
        ");

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_values(array_unique(array_filter(
            array_map(fn ($row) => trim((string) ($row['pricing_category'] ?? '')), $rows),
            fn ($v) => $v !== ''
        )));
    }

    private function extractSelectedPricingCodes(array $data): array
    {
        $codes = $data['pricing_codes'] ?? [];

        if (isset($data['pricing_codes']) && is_string($data['pricing_codes']) && trim($data['pricing_codes']) !== '') {
            return [trim($data['pricing_codes'])];
        }

        if (isset($data['pricing_codes[]'])) {
            $codes = $data['pricing_codes[]'];
        }

        if (!is_array($codes)) {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map(fn ($v) => trim((string) $v), $codes),
            fn ($v) => $v !== ''
        )));
    }

    private function getOfflineProducts(string $busunitCode): array
    {
        $stmt = $this->conn->prepare("
            SELECT
                product_id,
                category_code,
                unit_code,
                inventory_type,
                item_category,
                item_name,
                item_description,
                unit_of_measure,
                unit_cost,
                selling_price,
                vatable,
                item_brand,
                isDiscountable,
                status
            FROM tbl_inventory_products_masterlist
            WHERE category_code = :busunitcode
            ORDER BY item_name ASC, product_id ASC
        ");
        $stmt->execute([
            'busunitcode' => $busunitCode,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflinePricingRows(array $pricingCodes): array
    {
        if (count($pricingCodes) === 0) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($pricingCodes), '?'));

        $stmt = $this->conn->prepare("
            SELECT
                pricing_code,
                inv_code,
                cost_per_uom,
                srp,
                deletestatus
            FROM tbl_pricing_details
            WHERE pricing_code IN ($placeholders)
            ORDER BY pricing_code ASC, inv_code ASC
        ");

        foreach ($pricingCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}