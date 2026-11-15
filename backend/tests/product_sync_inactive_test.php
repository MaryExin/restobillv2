<?php

declare(strict_types=1);

// Product sync "Set Inactive": only the price row missing online is turned
// off; the product goes Inactive only when no Active price row is left, and
// the local read no longer lists price rows that are already Inactive.

require_once __DIR__ . '/../src/ProductSyncLocalMutateGateway.php';
require_once __DIR__ . '/../src/ProductSyncLocalReadGateway.php';

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("CREATE TABLE lkp_sales_type (sales_type_id TEXT, description TEXT, deletestatus TEXT, usertracker TEXT, createdtime TEXT)");
$pdo->exec("CREATE TABLE tbl_pricing_by_sales_type (sales_type_id TEXT, pricing_category TEXT, deletestatus TEXT, usertracker TEXT, createdtime TEXT)");
$pdo->exec("CREATE TABLE tbl_inventory_products_masterlist (product_id TEXT, status TEXT)");
$pdo->exec("CREATE TABLE tbl_pricing_details (pricing_code TEXT, inv_code TEXT, cost_per_uom REAL, srp REAL, deletestatus TEXT, usertracker TEXT)");
$pdo->exec("INSERT INTO tbl_inventory_products_masterlist VALUES ('P1','Active'), ('P2','Active'), ('P3','Active')");
$pdo->exec("INSERT INTO tbl_pricing_details VALUES
    ('DINE','P1',50,100,'Active',''), ('TAKE','P1',50,110,'Active',''),
    ('TAKE','P2',20,40,'Active',''),
    ('DINE','P3',20,40,'Inactive',''), ('TAKE','P3',20,40,'Active','')");

function withConnection(string $class, PDO $pdo): object
{
    $reflection = new ReflectionClass($class);
    $gateway = $reflection->newInstanceWithoutConstructor();
    $property = $reflection->getProperty('conn');
    $property->setAccessible(true);
    $property->setValue($gateway, $pdo);
    return $gateway;
}

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('Failed: ' . $message);
    }
    echo "ok - {$message}\n";
}

$read = withConnection(ProductSyncLocalReadGateway::class, $pdo);
$rowsMethod = (new ReflectionClass($read))->getMethod('getOfflinePricingRows');
$rowsMethod->setAccessible(true);
$rows = $rowsMethod->invoke($read, ['DINE', 'TAKE']);
$keys = array_map(fn ($r) => $r['inv_code'] . '/' . $r['pricing_code'], $rows);
sort($keys);
check($keys === ['P1/DINE', 'P1/TAKE', 'P2/TAKE', 'P3/TAKE'], 'local read lists Active price rows only (P3/DINE already Inactive is skipped)');

$mutate = withConnection(ProductSyncLocalMutateGateway::class, $pdo);
$result = $mutate->applyExportPayload([
    'target' => ['busunitcode' => 'BU-1'],
    'rows' => [
        ['product_id' => 'P1', 'pricing_code' => 'TAKE', 'action' => 'inactive_product'],
        ['product_id' => 'P2', 'pricing_code' => 'TAKE', 'action' => 'inactive_product'],
    ],
    'sales_types' => [],
    'pricing_mappings' => [],
], 'tester');
check(($result['message'] ?? '') === 'Success', 'sync applies: ' . ($result['error'] ?? $result['summary_message'] ?? ''));

$status = fn (string $id) => $pdo->query("SELECT status FROM tbl_inventory_products_masterlist WHERE product_id = '{$id}'")->fetchColumn();
$price = fn (string $id, string $code) => $pdo->query("SELECT deletestatus FROM tbl_pricing_details WHERE inv_code = '{$id}' AND pricing_code = '{$code}'")->fetchColumn();

check($price('P1', 'TAKE') === 'Inactive', 'P1 take-out price (missing online) is turned off');
check($price('P1', 'DINE') === 'Active', 'P1 dine-in price is untouched');
check($status('P1') === 'Active', 'P1 stays Active because it still has a price');
check($price('P2', 'TAKE') === 'Inactive', 'P2 only price is turned off');
check($status('P2') === 'Inactive', 'P2 goes Inactive because no price is left');
check($status('P3') === 'Active' && $price('P3', 'TAKE') === 'Active', 'untouched product P3 is unchanged');
check(strpos((string) $result['summary_message'], 'inactivated: 1') !== false, 'summary counts only products that went Inactive');
echo "product_sync_inactive_test: all checks passed\n";
