<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/PosOrderProductGroups.php';
require_once dirname(__DIR__) . '/src/ShiftSalesSyncLocalExportGateway.php';

final class Database
{
    public function __construct(private PDO $connection) {}
    public function getConnection(): PDO { return $this->connection; }
}

// Only run against an explicitly supplied disposable server. This script creates
// and removes one random fixture database; it never reads application config.
$dsn = getenv('PRODUCT_GROUP_TEST_DSN');
if (!$dsn) { echo "SKIP: set PRODUCT_GROUP_TEST_DSN to a disposable server.\n"; exit(0); }
$user = getenv('PRODUCT_GROUP_TEST_USER') ?: 'root';
$pass = getenv('PRODUCT_GROUP_TEST_PASS') ?: '';
$db = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
$schema = 'restaurant_groups_test_' . bin2hex(random_bytes(5));
$reportSchema = $schema . '_report';
$checks = 0;
$assert = static function (bool $value, string $message) use (&$checks): void { $checks++; if (!$value) throw new RuntimeException($message); };
$reject = static function (callable $action, string $message) use ($assert): void {
    try { $action(); } catch (InvalidArgumentException $error) { $assert(true, $message); return; }
    $assert(false, $message);
};

try {
    $db->exec("CREATE DATABASE `$schema` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db->exec("USE `$schema`");
    $db->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    $service = new PosOrderProductGroups($db);
    $ordinary = [['product_id' => 'A', 'sales_quantity' => 1, 'selling_price' => 300.01]];
    $assert($service->prepareItems($ordinary, 'CAT', 'UNIT', 'Dine in') === $ordinary, 'Ordinary orders make no grouping-table request.');
    $assert($service->annotateProducts($ordinary) === $ordinary && $service->groupProducts('CAT', 'UNIT', 'P1') === [], 'Missing migration leaves catalog unchanged.');
    $migration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_groups.sql');
    $db->exec($migration); $db->exec($migration);
    $service = new PosOrderProductGroups($db);
    $assert($service->isInstalled(), 'Local migration is repeatable.');
    $db->exec("CREATE TABLE tbl_inventory_products_masterlist (seq INT AUTO_INCREMENT PRIMARY KEY,product_id VARCHAR(64),category_code VARCHAR(64),unit_code VARCHAR(64),item_name VARCHAR(100),unit_of_measure VARCHAR(32),sku VARCHAR(64),unit_cost DECIMAL(18,4),selling_price DECIMAL(18,4),vatable VARCHAR(20),isDiscountable VARCHAR(20),status VARCHAR(20)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE tbl_pricing_details (seq INT AUTO_INCREMENT PRIMARY KEY,inv_code VARCHAR(64),pricing_code VARCHAR(64),srp DECIMAL(18,4),cost_per_uom DECIMAL(18,4),deletestatus VARCHAR(20)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE lkp_sales_type (sales_type_id VARCHAR(64),description VARCHAR(100),deletestatus VARCHAR(20)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE tbl_pricing_by_sales_type (busunitcode VARCHAR(64),sales_type_id VARCHAR(64),pricing_category VARCHAR(64),deletestatus VARCHAR(20)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE tbl_pos_transactions_detailed (ID BIGINT AUTO_INCREMENT PRIMARY KEY,transaction_id VARCHAR(64),Category_Code VARCHAR(64),Unit_Code VARCHAR(64),product_id VARCHAR(64),sku VARCHAR(64),sales_quantity DECIMAL(18,4),landing_cost DECIMAL(18,4),unit_cost DECIMAL(18,4),selling_price DECIMAL(18,4),vatable VARCHAR(20),isDiscountable VARCHAR(20),order_status VARCHAR(20)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("INSERT INTO tbl_inventory_products_masterlist (product_id,category_code,unit_code,item_name,unit_of_measure,sku,unit_cost,selling_price,vatable,isDiscountable,status) VALUES
        ('A','CAT','UNIT','Sample A','PC','A',100,300.01,'Yes','Yes','Active'),
        ('B','CAT','UNIT','Sample B','PC','B',120,400.01,'Yes','No','Active'),
        ('C','CAT','OTHER','Other unit item','PC','C',1,10,'Yes','Yes','Active')");
    $db->exec("INSERT INTO tbl_pricing_details (inv_code,pricing_code,srp,cost_per_uom,deletestatus) VALUES ('A','P1',300.01,100,'Active'),('B','P1',400.01,120,'Active'),('A','P2',500,100,'Active'),('B','P2',600,120,'Active')");
    $db->exec("INSERT INTO lkp_sales_type VALUES ('ST1','Dine in','Active'),('ST2','Delivery','Active'); INSERT INTO tbl_pricing_by_sales_type VALUES ('UNIT','ST1','P1','Active'),('UNIT','ST2','P2','Active')");
    $db->exec("INSERT INTO tbl_pos_product_groups (build_code,enabled,group_name,size_name,variant_name,allow_half,allow_half_and_half) VALUES ('A',1,'Sample group','Large','Variant A',1,1),('B',1,'Sample group','Large','Variant B',1,1),('C',1,'Other group','Large','Other variant',1,1)");
    $catalog = $service->groupProducts('CAT', 'UNIT', 'P1');
    $assert(count($catalog) === 2 && $catalog[0]['product_group']['enabled'], 'Catalog includes every variant for the selected unit with mixed source collations.');
    $assert(!array_key_exists('group_alias', $catalog[0]), 'A terminal without the optional alias migration omits alias metadata.');
    $item = static function (string $portion = 'half_and_half', int $count = 1): array {
        $variants = $portion === 'half_and_half' ? ['A', 'B'] : ['A'];
        return ['product_id' => 'A', 'sales_quantity' => $count, 'selling_price' => ['whole' => 300.01, 'half' => 150.01, 'half_and_half' => 350.01][$portion],
            'vatable' => 'Yes', 'isDiscountable' => 'Yes', 'group_selection' => ['selection_id' => 'fixture-selection-1', 'group_name' => 'Sample group', 'size' => 'Large',
                'portion' => $portion, 'variants' => $variants, 'unit_count' => $count, 'pricing_category' => 'P1']];
    };
    foreach (['whole' => [300.01, 1], 'half' => [150.01, .5], 'half_and_half' => [350.01, 1]] as $portion => [$amount, $quantity]) {
        $parts = $service->prepareItems([$item($portion)], 'CAT', 'UNIT', 'Dine in');
        $assert(abs(array_sum(array_map(static fn ($p) => $p['sales_quantity'] * $p['selling_price'], $parts)) - $amount) < .001, "$portion total is exact.");
        $assert(array_sum(array_column($parts, 'sales_quantity')) == $quantity, "$portion stock quantity uses original variants.");
    }
    $parts = $service->prepareItems([$item('half_and_half', 3)], 'CAT', 'UNIT', 'Dine in');
    $assert($parts[0]['sales_quantity'] === 1.5 && $parts[1]['sales_quantity'] === 1.5, 'Two variants use half recipes for each of three units.');
    $assert(abs(array_sum(array_map(static fn ($p) => $p['sales_quantity'] * $p['selling_price'], $parts)) - 1050.03) < .001, 'Odd cents round per unit before multiplying.');
    $assert($parts[0]['isDiscountable'] === 'No' && $parts[1]['isDiscountable'] === 'No', 'A non-discountable constituent protects the whole group.');
    $assert($parts[0]['unit_cost'] === 100.0 && $parts[1]['unit_cost'] === 120.0, 'Use each variant current cost.');
    $parts = $service->prepareItems([$item()], 'CAT', 'UNIT', 'Dine in');
    $store = static function (array $parts, string $transaction) use ($db, $service): array {
        $ids = [];
        $statement = $db->prepare('INSERT INTO tbl_pos_transactions_detailed (transaction_id,Category_Code,Unit_Code,product_id,sku,sales_quantity,landing_cost,unit_cost,selling_price,vatable,isDiscountable,order_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach ($parts as $part) {
            $statement->execute([$transaction,'CAT','UNIT',$part['product_id'],$part['sku'],$part['sales_quantity'],$part['landing_cost'],$part['unit_cost'],$part['selling_price'],$part['vatable'],$part['isDiscountable'],'Pending']);
            $id = (string) $db->lastInsertId(); $ids[] = $id;
            $service->storePart($id, $transaction, 'CAT', 'UNIT', $part);
        }
        return $ids;
    };
    $ids = $store($parts, 'TX1');
    $read = $service->annotateLines($db->query("SELECT * FROM tbl_pos_transactions_detailed WHERE transaction_id='TX1' ORDER BY ID")->fetchAll(PDO::FETCH_ASSOC));
    $assert(count($read) === 2 && $read[0]['group_selection']['variants'] === ['A','B'] && str_contains($read[0]['item_name'], '[1/2: Variant A]'), 'Saved read keeps both variants and original line labels.');
    $service->assertBillingPrices([['databaseID' => $ids[0], 'selling_price' => $parts[0]['selling_price']]], 'TX1','CAT','UNIT');
    $assert(true, 'Unchanged grouped prices remain billable.');
    $reject(fn () => $service->assertBillingPrices([['databaseID' => $ids[0], 'selling_price' => 1]], 'TX1','CAT','UNIT'), 'Billing cannot alter one half independently.');
    $reject(fn () => $service->assertTransferSupported(['TX1']), 'A partial transfer cannot lose a saved group.');
    $db->exec("UPDATE tbl_pricing_details SET srp=999 WHERE inv_code='A' AND pricing_code='P1'; UPDATE tbl_pos_product_groups SET variant_name='Renamed' WHERE build_code='A'");
    $unchanged = $service->prepareItems([$item()], 'CAT', 'UNIT', 'Dine in', 'TX1');
    $assert((float) $unchanged[0]['selling_price'] === 300.02 && str_contains($unchanged[0]['group_line_label'], 'Variant A'), 'Untouched recalled items keep their as-sold price and name.');
    $reject(fn () => $service->prepareItems([$item()], 'CAT', 'UNIT', 'Delivery', 'TX1'), 'Changing service type cannot reuse the old saved price.');
    $forged = $item(); $forged['group_selection']['variants'] = ['A'];
    $reject(fn () => $service->prepareItems([$forged], 'CAT', 'UNIT', 'Dine in', 'TX1'), 'Forged saved selection cannot borrow original prices.');
    $reject(fn () => $service->prepareItems([$item('half_and_half', 2)], 'CAT', 'UNIT', 'Dine in', 'TX1'), 'A changed quantity must validate current price.');
    $db->beginTransaction();
    $service->clearOrder('TX1','CAT','UNIT');
    $db->exec("DELETE FROM tbl_pos_transactions_detailed WHERE transaction_id='TX1'");
    $store($unchanged,'TX1');
    $db->commit();
    $assert((int) $db->query("SELECT COUNT(*) FROM tbl_pos_product_group_selections WHERE transaction_id='TX1'")->fetchColumn() === 2, 'Order replacement deletes stale snapshots and saves both replacements atomically.');
    $db->beginTransaction(); $service->clearOrder('TX1','CAT','UNIT'); $db->rollBack();
    $assert((int) $db->query("SELECT COUNT(*) FROM tbl_pos_product_group_selections WHERE transaction_id='TX1'")->fetchColumn() === 2, 'Rollback preserves original group snapshots.');
    $db->exec("UPDATE tbl_pricing_details SET srp=300.01 WHERE inv_code='A' AND pricing_code='P1'; UPDATE tbl_pos_product_groups SET variant_name='Variant A' WHERE build_code='A'");
    $bad = $item(); $bad['selling_price'] = 1;
    $reject(fn () => $service->prepareItems([$bad], 'CAT','UNIT','Dine in'), 'Reject forged combined price.');
    $bad = $item(); $bad['group_selection']['variants'] = ['A','A'];
    $reject(fn () => $service->prepareItems([$bad], 'CAT','UNIT','Dine in'), 'Reject duplicate variants.');
    $bad = $item(); $bad['group_selection']['size'] = 'Small';
    $reject(fn () => $service->prepareItems([$bad], 'CAT','UNIT','Dine in'), 'Reject incompatible size.');
    $reject(fn () => $service->prepareItems([$item()], 'CAT','OTHER','Dine in'), 'Reject variants belonging to another unit.');
    $db->exec("UPDATE tbl_inventory_products_masterlist SET vatable='No' WHERE product_id='B'");
    $reject(fn () => $service->prepareItems([$item()], 'CAT','UNIT','Dine in'), 'Reject differing tax flags.');
    $db->exec("UPDATE tbl_inventory_products_masterlist SET vatable='Yes',unit_of_measure='KG' WHERE product_id='B'");
    $reject(fn () => $service->prepareItems([$item()], 'CAT','UNIT','Dine in'), 'Reject differing units.');
    $db->exec("UPDATE tbl_inventory_products_masterlist SET unit_of_measure='PC' WHERE product_id='B'; UPDATE tbl_pos_product_groups SET allow_half_and_half=0 WHERE build_code='B'");
    $reject(fn () => $service->prepareItems([$item()], 'CAT','UNIT','Dine in'), 'Reject disallowed mixed portion.');
    $db->exec("UPDATE tbl_pos_product_groups SET allow_half_and_half=1 WHERE build_code='B'; UPDATE tbl_pricing_details SET deletestatus='Inactive' WHERE inv_code='B' AND pricing_code='P1'");
    $reject(fn () => $service->prepareItems([$item()], 'CAT','UNIT','Dine in'), 'Reject missing active price.');
    $db->exec("UPDATE tbl_pricing_details SET deletestatus='Active' WHERE inv_code='B' AND pricing_code='P1'; INSERT INTO tbl_pricing_details (inv_code,pricing_code,srp,cost_per_uom,deletestatus) VALUES ('A','P1',300.01,100,'Active')");
    $reject(fn () => $service->prepareItems([$item()], 'CAT','UNIT','Dine in'), 'Reject duplicate active prices.');
    $db->exec('DELETE FROM tbl_pricing_details ORDER BY seq DESC LIMIT 1');
    $db->exec("UPDATE tbl_pricing_details SET srp=2.325 WHERE inv_code='A' AND pricing_code='P1'");
    $fractional = $item('half'); $fractional['selling_price'] = 1.16;
    $assert($service->prepareItems([$fractional], 'CAT','UNIT','Dine in')[0]['selling_price'] === 2.32, 'Legacy four-decimal prices round only after portioning.');
    $db->exec("UPDATE tbl_pricing_details SET srp=300.01 WHERE inv_code='A' AND pricing_code='P1'");
    $aliasMigration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_group_aliases.sql');
    $db->exec($aliasMigration); $db->exec($aliasMigration);
    $db->exec("INSERT INTO tbl_pos_product_group_aliases (source_build_code,canonical_build_code,size_id,enabled) VALUES ('OLD-A-HALF','A','',1),('OLD-A12','A','PGS-A12',1)");
    $aliasRows = [['product_id' => 'OLD-A-HALF','selling_price' => 150.01], ['product_id' => 'OLD-A12','selling_price' => 200], ['product_id' => 'A','selling_price' => 300.01]];
    $annotatedAliases = $service->annotateProducts($aliasRows);
    $assert($annotatedAliases[0]['group_alias'] === ['canonical_build_code' => 'A','size_id' => '', 'enabled' => true], 'A legacy alias supplies its canonical product without overwriting its original product ID or price.');
    $assert($annotatedAliases[0]['product_id'] === 'OLD-A-HALF' && $annotatedAliases[0]['selling_price'] === 150.01, 'Alias annotation leaves source product identity and ordinary price intact.');
    $assert($annotatedAliases[1]['group_alias']['size_id'] === 'PGS-A12' && $annotatedAliases[2]['group_alias'] === null, 'Sized alias carries its exact size, while unmapped products explicitly carry null.');
    $db->exec("UPDATE tbl_pos_product_group_aliases SET enabled=0 WHERE source_build_code='OLD-A-HALF'");
    $assert($service->annotateProducts($aliasRows)[0]['group_alias']['enabled'] === false, 'Disabled mappings stay visible to the client as disabled.');
    $oldSaved = [['ID' => 9999,'product_id' => 'OLD-A-HALF','selling_price' => 150.01,'sales_quantity' => 1]];
    $assert($service->annotateLines($oldSaved) === $oldSaved, 'Original saved ordinary sales never inherit current menu aliases.');
    if (preg_match('/unix_socket=([^;]+)/', $dsn, $match)) {
        $mysqli = new mysqli('localhost', $user, $pass, $schema, 0, $match[1]);
        $mysqli->set_charset('utf8mb4');
        $mysqliService = new PosOrderProductGroups($mysqli);
        $assert(count($mysqliService->prepareItems([$item()], 'CAT','UNIT','Dine in')) === 2, 'The update_order mysqli path validates and expands the same way as PDO.');
        $assert(count($mysqliService->annotateLines($read)) === 2, 'The mysqli receipt path reads metadata.');
        $assert($mysqliService->annotateProducts($aliasRows)[1]['group_alias']['size_id'] === 'PGS-A12', 'The mysqli catalog path returns the same size mapping metadata.');
        $mysqli->close();
    }
    $sizeMigration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_group_sizes.sql');
    $db->exec($sizeMigration); $db->exec($sizeMigration);
    $db->exec("INSERT INTO tbl_pos_product_group_sizes (size_id,build_code,size_name,enabled,recipe_configured,sort_order) VALUES
        ('PGS-A9','A','9 inch',1,1,0),('PGS-A12','A','12 inch',1,1,1),('PGS-A16','A','16 inch',1,0,2),('PGS-B12','B','12 inch',1,1,0)");
    $db->exec("INSERT INTO tbl_pos_product_group_size_prices (size_id,pricing_category,srp,cost_per_uom) VALUES
        ('PGS-A9','P1',200,60),('PGS-A12','P1',400.01,150),('PGS-A16','P1',600,200),('PGS-B12','P1',500.01,180),
        ('PGS-A12','P2',500.01,150),('PGS-B12','P2',600.01,180)");
    $db->exec("INSERT INTO tbl_pos_product_group_size_components (size_id,component_code,component_class,qty,description,uom,uomval,category,cost_per_uom) VALUES
        ('PGS-A12','RM-CHEESE','RM',100,'Cheese','G',1,'INGREDIENTS',0.5),('PGS-A12','RM-FRUIT','RM',60,'Fruit','G',1,'INGREDIENTS',0.8),
        ('PGS-B12','RM-CHEESE','RM',120,'Cheese','G',1,'INGREDIENTS',0.5),('PGS-B12','RM-MEAT','RM',70,'Meat','G',1,'INGREDIENTS',0.9)");
    $service = new PosOrderProductGroups($db);
    $sizes = $service->groupProducts('CAT','UNIT','P1');
    $assert(count($sizes) === 4 && count(array_unique(array_column($sizes, 'product_id'))) === 2, 'Multiple sizes keep the same two master product IDs.');
    $assert($sizes[0]['group_size_id'] === 'PGS-A9' && (float) $sizes[0]['selling_price'] === 200.0, 'Runtime sizes use their own price list amounts.');
    $sized = $item(); $sized['selling_price'] = 450.01;
    $sized['group_selection']['size'] = '12 inch';
    $sized['group_selection']['schema_version'] = 2;
    $sized['group_selection']['variant_options'] = [['product_id' => 'A','size_id' => 'PGS-A12'],['product_id' => 'B','size_id' => 'PGS-B12']];
    $sized['group_selection']['recipe_snapshot'] = ['components' => [['component_code' => 'FORGED','qty' => 999]]];
    $sizeParts = $service->prepareItems([$sized], 'CAT','UNIT','Dine in');
    $assert($sizeParts[0]['product_id'] === 'A' && $sizeParts[0]['sales_quantity'] === .5 && $sizeParts[1]['product_id'] === 'B', 'Sized mixed order uses original product IDs and fractional sale quantities.');
    $assert($sizeParts[0]['unit_cost'] === 150.0 && $sizeParts[1]['unit_cost'] === 180.0, 'Size prices carry independent cost.');
    $assert($sizeParts[0]['group_selection']['recipe_snapshot']['components'][0]['qty'] === 100.0
        && $sizeParts[1]['group_selection']['recipe_snapshot']['components'][0]['qty'] === 120.0, 'Each physical part freezes its own whole-size recipe instead of client ingredients.');
    $assert($sizeParts[0]['group_selection']['recipe_snapshot']['components'][0]['uom'] === 'G', 'Ingredient descriptors survive in the frozen snapshot.');
    $badSize = $sized; $badSize['group_selection']['variant_options'][0]['size_id'] = 'PGS-B12';
    $reject(fn () => $service->prepareItems([$badSize], 'CAT','UNIT','Dine in'), 'A size cannot be borrowed from another product.');
    $small = $item('half'); $small['selling_price'] = 100; $small['group_selection'] = array_merge($small['group_selection'],
        ['schema_version' => 2, 'size' => '9 inch', 'variant_options' => [['product_id' => 'A','size_id' => 'PGS-A9']]]);
    $smallPart = $service->prepareItems([$small], 'CAT','UNIT','Dine in')[0];
    $assert($smallPart['group_selection']['recipe_snapshot']['components'] === [], 'An explicitly configured empty recipe stays empty.');
    $unconfigured = $small; $unconfigured['selling_price'] = 300; $unconfigured['group_selection']['size'] = '16 inch';
    $unconfigured['group_selection']['variant_options'][0]['size_id'] = 'PGS-A16';
    $reject(fn () => $service->prepareItems([$unconfigured], 'CAT','UNIT','Dine in'), 'A size with no configured recipe is unavailable.');
    $sizeIds = $store($sizeParts, 'TX-SIZE');
    $db->exec("UPDATE tbl_pos_product_group_size_components SET qty=999 WHERE size_id='PGS-A12' AND component_code='RM-CHEESE'");
    $unchangedSize = $service->prepareItems([$sized], 'CAT','UNIT','Dine in','TX-SIZE');
    $assert((float) $unchangedSize[0]['group_selection']['recipe_snapshot']['components'][0]['qty'] === 100.0, 'Untouched saved size retains its original recipe after setup changes.');
    $more = $sized; $more['sales_quantity'] = 2; $more['group_selection']['unit_count'] = 2;
    $newParts = $service->prepareItems([$more], 'CAT','UNIT','Dine in','TX-SIZE');
    $assert($newParts[0]['group_selection']['recipe_snapshot']['components'][0]['qty'] === 999.0 && $newParts[0]['sales_quantity'] === 1.0, 'Changing quantity validates and freezes the current size recipe.');
    $delivery = $sized; $delivery['selling_price'] = 550.01; $delivery['group_selection']['pricing_category'] = 'P2';
    $assert(count($service->prepareItems([$delivery], 'CAT','UNIT','Delivery','TX-SIZE')) === 2, 'Changing service type validates size-specific prices for all variants.');

    $db->exec("CREATE DATABASE `$reportSchema` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $db->exec("CREATE TABLE `$reportSchema`.tbl_pos_report_transaction_map (source_transaction_id VARCHAR(64),report_transaction_id VARCHAR(64),Category_Code VARCHAR(64),Unit_Code VARCHAR(64))");
    $db->exec("INSERT INTO `$reportSchema`.tbl_pos_report_transaction_map VALUES ('TX-SIZE','REPORT-700','CAT','UNIT')");
    $exporter = new ShiftSalesSyncLocalExportGateway(new Database($db), $schema, $reportSchema);
    $attach = new ReflectionMethod($exporter, 'attachGroupSnapshots');
    $snapshotReadable = new ReflectionProperty($exporter, 'groupSnapshotsReadable');
    $sourceRows = $db->query("SELECT * FROM tbl_pos_transactions_detailed WHERE transaction_id='TX-SIZE' ORDER BY ID")->fetchAll(PDO::FETCH_ASSOC);
    $liveExport = $attach->invoke($exporter, $sourceRows, $schema);
    $assert($liveExport[0]['group_selection']['variant_options'][0]['size_id'] === 'PGS-A12', 'LIVE export carries size identity with physical rows.');
    $assert($snapshotReadable->getValue($exporter), 'Successful LIVE snapshot read permits the authoritative v2 dataset marker.');
    $reportRows = array_map(static fn ($row) => array_merge($row, ['transaction_id' => 'REPORT-700']), $sourceRows);
    $reportExport = $attach->invoke($exporter, $reportRows, $reportSchema);
    $assert((float) $reportExport[0]['group_selection']['recipe_snapshot']['components'][0]['qty'] === 100.0, 'REPORT export follows mapped transaction identity to the frozen primary recipe.');
    $assert($snapshotReadable->getValue($exporter), 'Successful REPORT mapping permits the authoritative v2 dataset marker.');
    $unrelated = $reportRows; $unrelated[0]['Unit_Code'] = 'OTHER';
    $reportFailure = static function (array $rows, array $refs = []) use ($attach, $exporter, $assert, $reportSchema): void {
        try { $attach->invoke($exporter, $rows, $reportSchema, $refs); $assert(false, 'Invalid report mapping must fail.'); }
        catch (RuntimeException $error) { $assert(str_contains($error->getMessage(), 'Refresh the report mirror'), 'Report mapping failures explain how to repair the export.'); }
    };
    $reportFailure($unrelated);
    $assert(!$snapshotReadable->getValue($exporter), 'A failed mapping must not authorize snapshot replacement.');
    $mismatched = $reportRows; $mismatched[0]['sales_quantity'] = 7;
    try { $attach->invoke($exporter, $mismatched, $reportSchema); $assert(false, 'Report mismatch should fail.'); }
    catch (RuntimeException $error) { $assert(str_contains($error->getMessage(), 'differs'), 'Stale report quantities must be repaired before sync.'); }
    $reportFailure(array_slice($reportRows, 0, 1));
    $reportFailure([], [['transaction_id' => 'REPORT-700', 'Category_Code' => 'CAT', 'Unit_Code' => 'UNIT']]);
    $db->exec("DELETE FROM `$reportSchema`.tbl_pos_report_transaction_map");
    $reportFailure($reportRows);
    $attach->invoke($exporter, [], $schema);
    $assert($snapshotReadable->getValue($exporter), 'An installed empty dataset marks an intentional deletion authoritatively.');
    $db->exec('RENAME TABLE tbl_pos_product_group_selections TO fixture_saved_groups');
    $assert($attach->invoke($exporter, $sourceRows, $schema) === $sourceRows && !$snapshotReadable->getValue($exporter), 'Old terminals omit the authoritative marker when the selection table is absent.');
    $db->exec('RENAME TABLE fixture_saved_groups TO tbl_pos_product_group_selections');
    $db->exec("RENAME TABLE `$reportSchema`.tbl_pos_report_transaction_map TO `$reportSchema`.fixture_hidden_report_map");
    $db->beginTransaction();
    $db->exec('DELETE FROM tbl_pos_product_group_selections');
    $assert($attach->invoke($exporter, $sourceRows, $reportSchema) === $sourceRows && $snapshotReadable->getValue($exporter), 'An unused grouping migration does not require a report map for ordinary sales.');
    $db->rollBack();
    $db->exec("RENAME TABLE `$reportSchema`.fixture_hidden_report_map TO `$reportSchema`.tbl_pos_report_transaction_map");
    $exportSource = file_get_contents(dirname(__DIR__) . '/src/ShiftSalesSyncLocalExportGateway.php');
    $assert(str_contains($exportSource, "['product_group_snapshots_version' => 2]") && str_contains($exportSource, '...$groupSnapshotMetadata'), 'The marker is included on each complete exported dataset.');
    $assert($service->prepareItems($ordinary, 'CAT','UNIT','Dine in') === $ordinary, 'Ordinary orders remain unchanged with grouping installed.');
    $db->exec('TRUNCATE TABLE tbl_pos_product_group_selections; TRUNCATE TABLE tbl_pos_transactions_detailed');
    $db->exec('ALTER TABLE tbl_pos_transactions_detailed MODIFY sales_quantity INT');
    $db->beginTransaction();
    $reject(fn () => $store($parts, 'LEGACY-QTY'), 'A legacy integer quantity column must refuse half units after readback.');
    $db->rollBack();
    $assert((int) $db->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn() === 0, 'Legacy quantity failure rolls the detail write back.');
    $db->exec('ALTER TABLE tbl_pos_transactions_detailed MODIFY sales_quantity DECIMAL(18,4), MODIFY selling_price INT');
    $db->beginTransaction();
    $reject(fn () => $store($parts, 'LEGACY-PRICE'), 'A legacy integer price column must refuse lost cents after readback.');
    $db->rollBack();
    $assert((int) $db->query('SELECT COUNT(*) FROM tbl_pos_product_group_selections')->fetchColumn() === 0, 'Legacy precision failures never leave partial snapshots.');
    echo "Restaurant product groups: $checks MySQL checks passed.\n";
} finally { $db->exec("DROP DATABASE IF EXISTS `$reportSchema`"); $db->exec("DROP DATABASE IF EXISTS `$schema`"); }
