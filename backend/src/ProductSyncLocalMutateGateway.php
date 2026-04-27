<?php

declare(strict_types=1);

class ProductSyncLocalMutateGateway
{
    private PDO $conn;

    public function __construct(Database $localDatabase)
    {
        $this->conn = $localDatabase->getConnection();
    }

    public function applyExportPayload(array $data, int|string $userId): array
    {
        $target = $data['target'] ?? [];
        $busunitCode = trim((string) ($target['busunitcode'] ?? ''));
        $rows = $data['rows'] ?? [];
        $salesTypes = $data['sales_types'] ?? [];
        $pricingMappings = $data['pricing_mappings'] ?? [];

        if ($busunitCode === '') {
            return [
                'message' => 'MissingTargetMapping',
            ];
        }

        if (!is_array($rows)) {
            $rows = [];
        }

        if (!is_array($salesTypes)) {
            $salesTypes = [];
        }

        if (!is_array($pricingMappings)) {
            $pricingMappings = [];
        }

        $affected = 0;
        $insertedProducts = 0;
        $updatedPrices = 0;
        $inactivatedProducts = 0;
        $syncedSalesTypes = 0;
        $syncedSalesTypeMappings = 0;

        try {
            $this->conn->beginTransaction();

            $this->deleteAllOfflinePricingBySalesType();
            $this->deleteAllOfflineSalesTypes();

            $syncedSalesTypes = $this->insertOfflineSalesTypes($salesTypes);
            $syncedSalesTypeMappings = $this->insertOfflinePricingBySalesTypeMappings($pricingMappings, $userId);

            foreach ($rows as $row) {
                $productId = trim((string) ($row['product_id'] ?? ''));
                $pricingCode = trim((string) ($row['pricing_code'] ?? ''));
                $online = $row['online'] ?? [];
                $action = trim((string) ($row['action'] ?? ''));

                if ($productId === '') {
                    continue;
                }

                if ($action === 'new_product') {
                    if (!is_array($online) || !$online || $pricingCode === '') {
                        continue;
                    }

                    $productAffected = $this->upsertOfflineProduct($productId, $busunitCode, $online);
                    $pricingAffected = $this->upsertOfflinePricing($productId, $pricingCode, $online, $userId);

                    $affected += $productAffected + $pricingAffected;
                    $insertedProducts++;
                    continue;
                }

                if ($action === 'price_change') {
                    if (!is_array($online) || !$online || $pricingCode === '') {
                        continue;
                    }

                    $productAffected = $this->upsertOfflineProduct($productId, $busunitCode, $online);
                    $pricingAffected = $this->upsertOfflinePricing($productId, $pricingCode, $online, $userId);

                    $affected += $productAffected + $pricingAffected;
                    $updatedPrices++;
                    continue;
                }

                if ($action === 'inactive_product') {
                    $productAffected = $this->setOfflineProductInactive($productId);
                    $pricingAffected = $this->setAllOfflinePricingInactive($productId, $userId);

                    $affected += $productAffected + $pricingAffected;
                    $inactivatedProducts++;
                    continue;
                }
            }

            $this->conn->commit();

            $totalOps = $affected + $syncedSalesTypes + $syncedSalesTypeMappings;

            return [
                'message' => 'Success',
                'affected_rows' => $totalOps,
                'summary_message' => "Synced {$totalOps} operation(s). Sales types: {$syncedSalesTypes}, BU pricing mappings: {$syncedSalesTypeMappings}, new products: {$insertedProducts}, price changes: {$updatedPrices}, inactivated: {$inactivatedProducts}.",
            ];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function deleteAllOfflineSalesTypes(): void
    {
        $this->conn->exec("DELETE FROM lkp_sales_type");
    }

    private function deleteAllOfflinePricingBySalesType(): void
    {
        $this->conn->exec("DELETE FROM tbl_pricing_by_sales_type");
    }

    private function insertOfflineSalesTypes(array $rows): int
    {
        if (count($rows) === 0) {
            return 0;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO lkp_sales_type (
                sales_type_id,
                description,
                deletestatus,
                usertracker,
                createdtime
            ) VALUES (
                :sales_type_id,
                :description,
                :deletestatus,
                :usertracker,
                :createdtime
            )
        ");

        $count = 0;

        foreach ($rows as $row) {
            $salesTypeId = trim((string) ($row['sales_type_id'] ?? ''));
            if ($salesTypeId === '') {
                continue;
            }

            $stmt->execute([
                'sales_type_id' => $salesTypeId,
                'description' => (string) ($row['description'] ?? ''),
                'deletestatus' => (string) ($row['deletestatus'] ?? 'Active'),
                'usertracker' => (string) ($row['usertracker'] ?? ''),
                'createdtime' => $this->normalizeDateTimeOrNow($row['createdtime'] ?? null),
            ]);

            $count += $stmt->rowCount();
        }

        return $count;
    }

    private function insertOfflinePricingBySalesTypeMappings(array $rows, int|string $userId): int
    {
        if (count($rows) === 0) {
            return 0;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO tbl_pricing_by_sales_type (
                busunitcode,
                sales_type_id,
                pricing_category,
                deletestatus,
                usertracker,
                createdtime
            ) VALUES (
                :busunitcode,
                :sales_type_id,
                :pricing_category,
                :deletestatus,
                :usertracker,
                :createdtime
            )
        ");

        $count = 0;

        foreach ($rows as $row) {
            $busunitCode = trim((string) ($row['busunitcode'] ?? ''));
            $salesTypeId = trim((string) ($row['sales_type_id'] ?? ''));
            $pricingCategory = trim((string) ($row['pricing_category'] ?? ''));

            if ($busunitCode === '' || $salesTypeId === '' || $pricingCategory === '') {
                continue;
            }

            $stmt->execute([
                'busunitcode' => $busunitCode,
                'sales_type_id' => $salesTypeId,
                'pricing_category' => $pricingCategory,
                'deletestatus' => (string) ($row['deletestatus'] ?? 'Active'),
                'usertracker' => (string) ($row['usertracker'] ?? (string) $userId),
                'createdtime' => $this->normalizeDateTimeOrNow($row['createdtime'] ?? null),
            ]);

            $count += $stmt->rowCount();
        }

        return $count;
    }

    private function upsertOfflineProduct(string $productId, string $busunitCode, array $online): int
    {
        $resolvedCategoryCode = $this->getCategoryCodeByBusunitCode($busunitCode);

        $checkStmt = $this->conn->prepare("
            SELECT seq
            FROM tbl_inventory_products_masterlist
            WHERE product_id = :product_id
            LIMIT 1
        ");
        $checkStmt->execute([
            'product_id' => $productId,
        ]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $sql = "
                UPDATE tbl_inventory_products_masterlist
                SET
                    category_code = :category_code,
                    unit_code = :unit_code,
                    inventory_type = :inventory_type,
                    item_category = :item_category,
                    item_name = :item_name,
                    item_description = :item_description,
                    unit_of_measure = :unit_of_measure,
                    unit_cost = :unit_cost,
                    selling_price = :selling_price,
                    vatable = :vatable,
                    item_brand = :item_brand,
                    isDiscountable = :isDiscountable,
                    status = 'Active'
                WHERE product_id = :product_id
            ";
        } else {
            $sql = "
                INSERT INTO tbl_inventory_products_masterlist (
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
                    beginning_inventory,
                    actual_count,
                    remaining_count,
                    safety_stock,
                    reordering_point,
                    status
                ) VALUES (
                    :product_id,
                    :category_code,
                    :unit_code,
                    :inventory_type,
                    :item_category,
                    :item_name,
                    :item_description,
                    :unit_of_measure,
                    :unit_cost,
                    :selling_price,
                    :vatable,
                    :item_brand,
                    :isDiscountable,
                    0,
                    0,
                    0,
                    0,
                    0,
                    'Active'
                )
            ";
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            'product_id' => $productId,
            'category_code' => $resolvedCategoryCode,
            'unit_code' => $busunitCode,
            'inventory_type' => (string) ($online['inventory_type'] ?? 'PRODUCT'),
            'item_category' => (string) ($online['item_category'] ?? ''),
            'item_name' => (string) ($online['item_name'] ?? ''),
            'item_description' => (string) ($online['item_description'] ?? $online['item_name'] ?? ''),
            'unit_of_measure' => (string) ($online['unit_of_measure'] ?? ''),
            'unit_cost' => (float) ($online['unit_cost'] ?? 0),
            'selling_price' => (float) ($online['selling_price'] ?? 0),
            'vatable' => $this->normalizeYesNoFromTaxType((string) ($online['vatable'] ?? '')),
            'item_brand' => (string) ($online['item_brand'] ?? ''),
            'isDiscountable' => $this->normalizeYesNo((string) ($online['isDiscountable'] ?? 'No')),
        ]);

        return $stmt->rowCount();
    }

    private function getCategoryCodeByBusunitCode(string $busunitCode): string
    {
        $stmt = $this->conn->prepare("
            SELECT Category_Code
            FROM tbl_main_business_units
            WHERE Unit_Code = :unit_code
            LIMIT 1
        ");
        $stmt->execute([
            'unit_code' => $busunitCode,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return trim((string) ($row['Category_Code'] ?? ''));
    }

    private function upsertOfflinePricing(
        string $productId,
        string $pricingCode,
        array $online,
        int|string $userId
    ): int {
        $checkStmt = $this->conn->prepare("
            SELECT seq
            FROM tbl_pricing_details
            WHERE inv_code = :inv_code
              AND pricing_code = :pricing_code
            LIMIT 1
        ");
        $checkStmt->execute([
            'inv_code' => $productId,
            'pricing_code' => $pricingCode,
        ]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $sql = "
                UPDATE tbl_pricing_details
                SET
                    cost_per_uom = :cost_per_uom,
                    srp = :srp,
                    deletestatus = 'Active',
                    usertracker = :usertracker
                WHERE inv_code = :inv_code
                  AND pricing_code = :pricing_code
            ";

            $params = [
                'pricing_code' => $pricingCode,
                'inv_code' => $productId,
                'cost_per_uom' => (float) ($online['unit_cost'] ?? 0),
                'srp' => (float) ($online['selling_price'] ?? 0),
                'usertracker' => (string) $userId,
            ];
        } else {
            $sql = "
                INSERT INTO tbl_pricing_details (
                    pricing_code,
                    inv_code,
                    cost_per_uom,
                    srp,
                    deletestatus,
                    usertracker,
                    createdtime
                ) VALUES (
                    :pricing_code,
                    :inv_code,
                    :cost_per_uom,
                    :srp,
                    'Active',
                    :usertracker,
                    :createdtime
                )
            ";

            $params = [
                'pricing_code' => $pricingCode,
                'inv_code' => $productId,
                'cost_per_uom' => (float) ($online['unit_cost'] ?? 0),
                'srp' => (float) ($online['selling_price'] ?? 0),
                'usertracker' => (string) $userId,
                'createdtime' => date('Y-m-d H:i:s'),
            ];
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->rowCount();
    }

    private function setOfflineProductInactive(string $productId): int
    {
        $stmt = $this->conn->prepare("
            UPDATE tbl_inventory_products_masterlist
            SET status = 'Inactive'
            WHERE product_id = :product_id
        ");
        $stmt->execute([
            'product_id' => $productId,
        ]);

        return $stmt->rowCount();
    }

    private function setAllOfflinePricingInactive(string $productId, int|string $userId): int
    {
        $stmt = $this->conn->prepare("
            UPDATE tbl_pricing_details
            SET
                deletestatus = 'Inactive',
                usertracker = :usertracker
            WHERE inv_code = :inv_code
        ");
        $stmt->execute([
            'inv_code' => $productId,
            'usertracker' => (string) $userId,
        ]);

        return $stmt->rowCount();
    }

    private function normalizeYesNo(string $value): string
    {
        return mb_strtolower(trim($value)) === 'yes' ? 'Yes' : 'No';
    }

    private function normalizeYesNoFromTaxType(string $value): string
    {
        $v = mb_strtolower(trim($value));
        return in_array($v, ['vatable', 'yes', 'y', 'true', '1'], true) ? 'Yes' : 'No';
    }

    private function normalizeDateTimeOrNow(mixed $value): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return date('Y-m-d H:i:s');
        }

        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d H:i',
            'n/j/Y H:i',
            'n/j/Y G:i',
            'n/j/Y H:i:s',
            'n/j/Y G:i:s',
            'm/d/Y H:i',
            'm/d/Y G:i',
            'm/d/Y H:i:s',
            'm/d/Y G:i:s',
        ];

        foreach ($formats as $format) {
            $dt = DateTime::createFromFormat($format, $raw);
            if ($dt instanceof DateTime) {
                return $dt->format('Y-m-d H:i:s');
            }
        }

        $ts = strtotime($raw);
        if ($ts !== false) {
            return date('Y-m-d H:i:s', $ts);
        }

        return date('Y-m-d H:i:s');
    }
}