<?php

declare(strict_types=1);

class ProductSyncReadGateway
{
    private PDO $localConn;
    private PDO $webConn;

    public function __construct(Database $localDatabase, Database $webDatabase)
    {
        $this->localConn = $localDatabase->getConnection();
        $this->webConn = $webDatabase->getConnection();
    }

    public function readReconciliationData(array $data, int|string $userId): array
    {
        try {
            $target = $this->getActiveOfflineTargetMapping();

            if (!$target) {
                return [
                    'message' => 'NoBusinessUnit',
                    'target' => null,
                    'pricing_options' => [],
                    'selected_pricing_codes' => [],
                    'offline_existing_pricing_codes' => [],
                    'offline_only_pricing_codes' => [],
                    'online_only_pricing_codes' => [],
                    'busunit_sales_type_pricing_rows' => [],
                    'busunit_mapped_pricing_codes' => [],
                    'rows' => [],
                ];
            }

            $busunitCode = (string) ($target['busunitcode'] ?? '');
            $busunitName = (string) ($target['busunit_name'] ?? '');

            if ($busunitCode === '') {
                return [
                    'message' => 'NoBusinessUnit',
                    'target' => null,
                    'pricing_options' => [],
                    'selected_pricing_codes' => [],
                    'offline_existing_pricing_codes' => [],
                    'offline_only_pricing_codes' => [],
                    'online_only_pricing_codes' => [],
                    'busunit_sales_type_pricing_rows' => [],
                    'busunit_mapped_pricing_codes' => [],
                    'rows' => [],
                ];
            }

            $pricingOptions = $this->getOnlinePricingOptions();
            $allOfflinePricingCodes = $this->getAllOfflinePricingCodes();

            $busunitSalesTypePricingRows = $this->getOnlineBusunitSalesTypePricingRows($busunitCode);
            $busunitMappedPricingCodes = $this->extractMappedPricingCodesFromBusunitRows($busunitSalesTypePricingRows);

            $onlinePricingCodes = array_values(array_unique(array_map(
                fn ($row) => (string) ($row['pricing_code'] ?? ''),
                $pricingOptions
            )));

            $requestedPricingCodes = $this->extractSelectedPricingCodes($data);

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = $busunitMappedPricingCodes;
            }

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = array_values(array_intersect(
                    $onlinePricingCodes,
                    $allOfflinePricingCodes
                ));
            }

            if (count($requestedPricingCodes) === 0) {
                $requestedPricingCodes = $onlinePricingCodes;
            }

            $requestedPricingCodes = array_values(array_unique(array_filter(
                array_map(fn ($v) => trim((string) $v), $requestedPricingCodes),
                fn ($v) => $v !== ''
            )));

            $offlineOnlyPricingCodes = array_values(array_diff(
                $allOfflinePricingCodes,
                $onlinePricingCodes
            ));

            $onlineOnlyPricingCodes = array_values(array_diff(
                $onlinePricingCodes,
                $allOfflinePricingCodes
            ));

            $webRows = $this->getOnlineSourceRows($requestedPricingCodes);
            $offlineProducts = $this->getOfflineProducts($busunitCode);
            $offlinePricing = $this->getOfflinePricingRows($requestedPricingCodes);

            $offlineProductMap = [];
            foreach ($offlineProducts as $row) {
                $productId = (string) ($row['product_id'] ?? '');
                if ($productId !== '') {
                    $offlineProductMap[$productId] = $row;
                }
            }

            $offlinePricingMap = [];
            foreach ($offlinePricing as $row) {
                $invCode = (string) ($row['inv_code'] ?? '');
                $pricingCode = (string) ($row['pricing_code'] ?? '');

                if ($invCode !== '' && $pricingCode !== '') {
                    $offlinePricingMap[$this->pairKey($invCode, $pricingCode)] = $row;
                }
            }

            $pricingLabels = [];
            foreach ($pricingOptions as $opt) {
                $pricingLabels[(string) ($opt['pricing_code'] ?? '')] = (string) ($opt['pricing_label'] ?? '');
            }

            $rows = [];
            $seen = [];

            foreach ($requestedPricingCodes as $pricingCode) {
                foreach ($webRows as $webRow) {
                    $currentPricingCode = (string) ($webRow['pricing_code'] ?? '');
                    if ($currentPricingCode !== $pricingCode) {
                        continue;
                    }

                    $productId = (string) ($webRow['product_id'] ?? '');
                    if ($productId === '') {
                        continue;
                    }

                    $rowKey = $this->pairKey($productId, $pricingCode);

                    $localProduct = $offlineProductMap[$productId] ?? null;
                    $localPricing = $offlinePricingMap[$rowKey] ?? null;

                    $diff = $this->buildDiff($webRow, $localProduct, $localPricing);
                    $action = $this->resolveAction(
                        true,
                        $localPricing !== null,
                        $localProduct !== null,
                        $diff
                    );

                    $rows[] = $this->buildRow(
                        $rowKey,
                        $productId,
                        $pricingCode,
                        $pricingLabels[$pricingCode] ?? $pricingCode,
                        $action,
                        true,
                        $localProduct !== null,
                        (string) ($localProduct['status'] ?? 'Missing'),
                        $webRow,
                        $localProduct,
                        $localPricing,
                        $diff,
                        false
                    );

                    $seen[$rowKey] = true;
                }
            }

            foreach ($requestedPricingCodes as $pricingCode) {
                foreach ($offlinePricingMap as $pairKey => $localPricing) {
                    if ((string) ($localPricing['pricing_code'] ?? '') !== $pricingCode) {
                        continue;
                    }

                    if (isset($seen[$pairKey])) {
                        continue;
                    }

                    [$productId] = explode('||', $pairKey);
                    $localProduct = $offlineProductMap[$productId] ?? null;

                    $rows[] = $this->buildRow(
                        $pairKey,
                        $productId,
                        $pricingCode,
                        $pricingLabels[$pricingCode] ?? $pricingCode,
                        'inactive_product',
                        false,
                        $localProduct !== null,
                        (string) ($localProduct['status'] ?? 'Active'),
                        null,
                        $localProduct,
                        $localPricing,
                        $this->buildDiff(null, $localProduct, $localPricing),
                        true
                    );

                    $seen[$pairKey] = true;
                }
            }

            usort($rows, function (array $a, array $b): int {
                $priority = [
                    'price_change' => 1,
                    'new_product' => 2,
                    'inactive_product' => 3,
                    'no_price_change' => 4,
                ];

                $aPriority = $priority[$a['action']] ?? 99;
                $bPriority = $priority[$b['action']] ?? 99;

                if ($aPriority !== $bPriority) {
                    return $aPriority <=> $bPriority;
                }

                if ((string) $a['pricing_code'] !== (string) $b['pricing_code']) {
                    return strcmp((string) $a['pricing_code'], (string) $b['pricing_code']);
                }

                return strcmp((string) $a['product_id'], (string) $b['product_id']);
            });

            return [
                'message' => 'Success',
                'target' => [
                    'busunitcode' => $busunitCode,
                    'busunit_name' => $busunitName,
                ],
                'pricing_options' => $pricingOptions,
                'selected_pricing_codes' => $requestedPricingCodes,
                'offline_existing_pricing_codes' => $allOfflinePricingCodes,
                'offline_only_pricing_codes' => $offlineOnlyPricingCodes,
                'online_only_pricing_codes' => $onlineOnlyPricingCodes,
                'busunit_sales_type_pricing_rows' => $busunitSalesTypePricingRows,
                'busunit_mapped_pricing_codes' => $busunitMappedPricingCodes,
                'rows' => $rows,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'target' => null,
                'pricing_options' => [],
                'selected_pricing_codes' => [],
                'offline_existing_pricing_codes' => [],
                'offline_only_pricing_codes' => [],
                'online_only_pricing_codes' => [],
                'busunit_sales_type_pricing_rows' => [],
                'busunit_mapped_pricing_codes' => [],
                'rows' => [],
            ];
        }
    }

    private function buildRow(
        string $rowKey,
        string $productId,
        string $pricingCode,
        string $pricingLabel,
        string $action,
        bool $onlinePresence,
        bool $offlinePresence,
        string $offlineStatus,
        ?array $onlineRow,
        ?array $localProduct,
        ?array $localPricing,
        array $diff,
        bool $offlineOnly
    ): array {
        return [
            'row_key' => $rowKey,
            'product_id' => $productId,
            'pricing_code' => $pricingCode,
            'pricing_label' => $pricingLabel,
            'action' => $action,
            'online_presence' => $onlinePresence,
            'offline_presence' => $offlinePresence,
            'offline_status' => $offlineStatus,
            'offline_only' => $offlineOnly,
            'online' => $onlineRow ? [
                'product_id' => $productId,
                'pricing_code' => $pricingCode,
                'pricing_label' => (string) ($onlineRow['pricing_label'] ?? $pricingLabel),
                'item_name' => (string) ($onlineRow['item_name'] ?? ''),
                'item_category' => (string) ($onlineRow['item_category'] ?? ''),
                'unit_of_measure' => (string) ($onlineRow['unit_of_measure'] ?? ''),
                'unit_value' => (string) ($onlineRow['unit_value'] ?? ''),
                'unit_cost' => isset($onlineRow['unit_cost']) ? (float) $onlineRow['unit_cost'] : null,
                'selling_price' => isset($onlineRow['selling_price']) ? (float) $onlineRow['selling_price'] : null,
                'inventory_type' => (string) ($onlineRow['inventory_type'] ?? 'PRODUCT'),
                'vatable' => (string) ($onlineRow['vatable'] ?? ''),
                'expiry_days' => (int) ($onlineRow['expiry_days'] ?? 0),
                'item_brand' => (string) ($onlineRow['item_brand'] ?? ''),
                'isDiscountable' => (string) ($onlineRow['isDiscountable'] ?? 'No'),
            ] : null,
            'offline' => [
                'item_name' => $localProduct['item_name'] ?? null,
                'item_category' => $localProduct['item_category'] ?? null,
                'unit_of_measure' => $localProduct['unit_of_measure'] ?? null,
                'unit_cost' => isset($localPricing['cost_per_uom']) ? (float) $localPricing['cost_per_uom'] : null,
                'selling_price' => isset($localPricing['srp']) ? (float) $localPricing['srp'] : null,
                'inventory_type' => $localProduct['inventory_type'] ?? null,
                'vatable' => $localProduct['vatable'] ?? null,
                'item_brand' => $localProduct['item_brand'] ?? null,
                'isDiscountable' => $localProduct['isDiscountable'] ?? null,
            ],
            'diff' => $diff,
        ];
    }

        private function getActiveOfflineTargetMapping(): ?array
        {
            $stmt = $this->localConn->query("
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
        $stmt = $this->localConn->query("
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

        $stmt = $this->webConn->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOnlineBusunitSalesTypePricingRows(string $busunitCode): array
    {
        if ($busunitCode === '') {
            return [];
        }

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

        $stmt = $this->webConn->prepare($sql);
        $stmt->execute([
            'busunitcode' => $busunitCode,
        ]);

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

        $stmt = $this->webConn->prepare($sql);
        foreach ($pricingCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineProducts(string $busunitCode): array
    {
        $stmt = $this->localConn->prepare("
            SELECT
                product_id,
                category_code,
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

        $stmt = $this->localConn->prepare("
            SELECT
                pricing_code,
                inv_code,
                cost_per_uom,
                srp,
                deletestatus
            FROM tbl_pricing_details
            WHERE pricing_code IN ($placeholders)
              AND deletestatus = 'Active'
        ");

        foreach ($pricingCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function buildDiff(?array $webRow, ?array $localProduct, ?array $localPricing): array
    {
        return [
            'price_changed' => !$this->sameNumber($webRow['selling_price'] ?? null, $localPricing['srp'] ?? null),
            'cost_changed' => !$this->sameNumber($webRow['unit_cost'] ?? null, $localPricing['cost_per_uom'] ?? null),
            'name_changed' => !$this->sameText($webRow['item_name'] ?? null, $localProduct['item_name'] ?? null),
            'category_changed' => !$this->sameText($webRow['item_category'] ?? null, $localProduct['item_category'] ?? null),
            'uom_changed' => !$this->sameText($webRow['unit_of_measure'] ?? null, $localProduct['unit_of_measure'] ?? null),
            'inventory_type_changed' => !$this->sameText($webRow['inventory_type'] ?? null, $localProduct['inventory_type'] ?? null),
            'vat_changed' => !$this->sameText($webRow['vatable'] ?? null, $localProduct['vatable'] ?? null),
            'brand_changed' => !$this->sameText($webRow['item_brand'] ?? null, $localProduct['item_brand'] ?? null),
            'discount_changed' => !$this->sameText($webRow['isDiscountable'] ?? null, $localProduct['isDiscountable'] ?? null),
        ];
    }

    private function resolveAction(
        bool $onlineExists,
        bool $localPricingExists,
        bool $localProductExists,
        array $diff
    ): string {
        if ($onlineExists && !$localPricingExists) {
            return 'new_product';
        }

        if (!$onlineExists && $localPricingExists) {
            return 'inactive_product';
        }

        if (($diff['price_changed'] ?? false) || ($diff['cost_changed'] ?? false)) {
            return 'price_change';
        }

        return 'no_price_change';
    }

    private function pairKey(string $productId, string $pricingCode): string
    {
        return $productId . '||' . $pricingCode;
    }

    private function sameText(mixed $a, mixed $b): bool
    {
        return mb_strtolower(trim((string) $a)) === mb_strtolower(trim((string) $b));
    }

    private function sameNumber(mixed $a, mixed $b, float $epsilon = 0.0001): bool
    {
        if ($a === null && $b === null) {
            return true;
        }

        if ($a === null || $b === null) {
            return false;
        }

        return abs((float) $a - (float) $b) < $epsilon;
    }
}