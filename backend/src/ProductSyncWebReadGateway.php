<?php

declare(strict_types=1);

class ProductSyncWebReadGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function readWebSnapshot(array $data, int|string $userId): array
    {
        try {
            $busunitCode = trim((string) ($data['busunitcode'] ?? ''));

            if ($busunitCode === '') {
                return [
                    'message' => 'MissingBusunitCode',
                    'pricing_options' => [],
                    'selected_pricing_codes' => [],
                    'busunit_sales_type_pricing_rows' => [],
                    'busunit_mapped_pricing_codes' => [],
                    'web_rows' => [],
                    'busunit_names' => [],
                ];
            }

            $pricingOptions = $this->getOnlinePricingOptions();
            $busunitSalesTypePricingRows = $this->getOnlineBusunitSalesTypePricingRows($busunitCode);
            $busunitMappedPricingCodes = $this->extractMappedPricingCodesFromBusunitRows($busunitSalesTypePricingRows);
            $requestedPricingCodes = $this->extractSelectedPricingCodes($data);

            $allOnlinePricingCodes = array_values(array_unique(array_filter(
                array_map(fn ($row) => trim((string) ($row['pricing_code'] ?? '')), $pricingOptions),
                fn ($v) => $v !== ''
            )));

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = $busunitMappedPricingCodes;
            }

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = $allOnlinePricingCodes;
            }

            $webRows = $this->getOnlineSourceRows($requestedPricingCodes);

            return [
                'message' => 'Success',
                'pricing_options' => $pricingOptions,
                'selected_pricing_codes' => $requestedPricingCodes,
                'busunit_sales_type_pricing_rows' => $busunitSalesTypePricingRows,
                'busunit_mapped_pricing_codes' => $busunitMappedPricingCodes,
                'web_rows' => $webRows,
                'busunit_names' => $this->getBusunitNames([$busunitCode]),
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'pricing_options' => [],
                'selected_pricing_codes' => [],
                'busunit_sales_type_pricing_rows' => [],
                'busunit_mapped_pricing_codes' => [],
                'web_rows' => [],
                'busunit_names' => [],
            ];
        }
    }

    private function getOnlinePricingOptions(): array
    {
        $sql = "
            SELECT DISTINCT
                pd.pricing_code,
                COALESCE(pc.pricing_code, pd.pricing_code) AS pricing_label
            FROM tbl_pricing_details pd
            LEFT JOIN lkp_pricing_code pc
                ON pc.uuid = pd.pricing_code
               AND pc.deletestatus = 'Active'
            WHERE pd.deletestatus = 'Active'
            ORDER BY pricing_label ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOnlineBusunitSalesTypePricingRows(string $busunitCode): array
    {
        $sql = "
            SELECT
                m.busunitcode,
                m.sales_type_id,
                COALESCE(st.description, m.sales_type_id) AS sales_type_description,
                m.pricing_category AS pricing_code,
                COALESCE(pc.pricing_code, m.pricing_category) AS pricing_label,
                m.deletestatus,
                m.usertracker,
                m.createdtime
            FROM tbl_pricing_by_sales_type_per_bu m
            LEFT JOIN lkp_sales_type st
                ON st.sales_type_id = m.sales_type_id
               AND st.deletestatus = 'Active'
            LEFT JOIN lkp_pricing_code pc
                ON pc.uuid = m.pricing_category
               AND pc.deletestatus = 'Active'
            WHERE m.busunitcode = :busunitcode
              AND m.deletestatus = 'Active'
            ORDER BY sales_type_description ASC, pricing_label ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function extractMappedPricingCodesFromBusunitRows(array $rows): array
    {
        return array_values(array_unique(array_filter(
            array_map(fn ($row) => trim((string) ($row['pricing_code'] ?? '')), $rows),
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

    private function getBusunitNames(array $busunitCodes): array
    {
        $busunitCodes = array_values(array_unique(array_filter(
            array_map(fn ($v) => trim((string) $v), $busunitCodes),
            fn ($v) => $v !== ''
        )));

        if (count($busunitCodes) === 0) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($busunitCodes), '?'));

        $sql = "
            SELECT busunitcode, name
            FROM lkp_busunits
            WHERE busunitcode IN ($placeholders)
        ";

        $stmt = $this->conn->prepare($sql);

        foreach ($busunitCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }

        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $map = [];

        foreach ($rows as $row) {
            $map[(string) ($row['busunitcode'] ?? '')] = (string) ($row['name'] ?? '');
        }

        return $map;
    }
}