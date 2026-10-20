<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/ProductSyncWebReadGateway.php';
require_once dirname(__DIR__) . '/src/ProductSyncWebExportGateway.php';
require_once dirname(__DIR__) . '/src/ProductSyncLocalReadGateway.php';
require_once dirname(__DIR__) . '/src/ProductSyncLocalMutateGateway.php';

// Uses only two randomly named databases on the explicitly supplied scratch server.
class Database { public function __construct(private PDO $conn) {} public function getConnection(): PDO { return $this->conn; } }
$dsn = getenv('PRODUCT_GROUP_TEST_DSN');
if (!$dsn) { echo "SKIP: set PRODUCT_GROUP_TEST_DSN to a disposable MySQL server.\n"; exit(0); }
$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false];
$web = new PDO($dsn, getenv('PRODUCT_GROUP_TEST_USER') ?: 'root', getenv('PRODUCT_GROUP_TEST_PASS') ?: '', $options);
$local = new PDO($dsn, getenv('PRODUCT_GROUP_TEST_USER') ?: 'root', getenv('PRODUCT_GROUP_TEST_PASS') ?: '', $options);
$names = ['group_sync_web_' . bin2hex(random_bytes(4)), 'group_sync_local_' . bin2hex(random_bytes(4))];
$checks = 0;
$assert = static function (bool $pass, string $message) use (&$checks): void { $checks++; if (!$pass) throw new RuntimeException($message); };
$group = static fn (string $code, string $variant, bool $enabled = true): array => [
    'product_id' => $code, 'action' => 'group_change', 'online' => ['product_group' => [
        'name' => 'Pizza', 'enabled' => $enabled, 'allow_half' => true, 'allow_half_and_half' => true,
    ], 'group_size' => 'Large', 'group_variant' => $variant],
];
$configure = static function (array $rows) use ($web): void {
    $web->beginTransaction();
    try { (new ProductGroupSyncMetadata($web))->apply($rows, 'fixture'); $web->commit(); }
    catch (Throwable $error) { $web->rollBack(); throw $error; }
};
try {
    $localMigration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_groups.sql');
    // A central-only installation has the shared configuration table, but no
    // restaurant order-selection snapshots. Its central sales table is unrelated.
    $configMigration = explode('-- Apply to the restaurant terminal database.', $localMigration, 2)[0];
    foreach ([[$web, $names[0]], [$local, $names[1]]] as [$db, $name]) {
        $db->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; USE `$name`");
        $db->exec($configMigration);
        $db->exec("CREATE TABLE lkp_sales_type (seq INT AUTO_INCREMENT PRIMARY KEY,sales_type_id VARCHAR(64),description VARCHAR(100),deletestatus VARCHAR(20),usertracker VARCHAR(64),createdtime DATETIME) ENGINE=InnoDB");
        $db->exec("CREATE TABLE tbl_pricing_details (seq INT AUTO_INCREMENT PRIMARY KEY,pricing_code VARCHAR(64),inv_code VARCHAR(64),cost_per_uom DECIMAL(18,4),srp DECIMAL(18,4),deletestatus VARCHAR(20),usertracker VARCHAR(64),createdtime DATETIME) ENGINE=InnoDB");
    }
    $web->exec("CREATE TABLE lkp_build_of_products (build_code VARCHAR(64) PRIMARY KEY,productcode VARCHAR(64),`desc` VARCHAR(100),category VARCHAR(100),uom VARCHAR(20),uomval DECIMAL(18,4),level VARCHAR(20),tax_type VARCHAR(20),expiry_days INT,brandcode VARCHAR(64),isdiscountable VARCHAR(10),deletestatus VARCHAR(20)) ENGINE=InnoDB");
    $web->exec("CREATE TABLE lkp_pricing_code (uuid VARCHAR(64),pricing_code VARCHAR(100),deletestatus VARCHAR(20)) ENGINE=InnoDB");
    $web->exec("CREATE TABLE tbl_pricing_by_sales_type_per_bu (seq INT AUTO_INCREMENT PRIMARY KEY,busunitcode VARCHAR(64),sales_type_id VARCHAR(64),pricing_category VARCHAR(64),deletestatus VARCHAR(20),usertracker VARCHAR(64),createdtime DATETIME) ENGINE=InnoDB");
    $web->exec("CREATE TABLE lkp_busunits (busunitcode VARCHAR(64),name VARCHAR(100)) ENGINE=InnoDB");
    $web->exec("INSERT INTO lkp_build_of_products VALUES ('A','A','Hawaiian','PIZZA','PC',1,'ALL','VATABLE',1,'BR','Yes','Active'),('B','B','Pepperoni','PIZZA','PC',1,'ALL','VATABLE',1,'BR','Yes','Active'),('C','C','Water','DRINKS','PC',1,'ALL','VATABLE',1,'BR','Yes','Active')");
    $web->exec("INSERT INTO lkp_pricing_code VALUES ('P1','Dine in','Active'); INSERT INTO lkp_busunits VALUES ('BU1','Fixture Restaurant')");
    $web->exec("INSERT INTO lkp_sales_type (sales_type_id,description,deletestatus,usertracker,createdtime) VALUES ('ST1','Dine in','Active','fixture',NOW())");
    $web->exec("INSERT INTO tbl_pricing_by_sales_type_per_bu (busunitcode,sales_type_id,pricing_category,deletestatus,usertracker,createdtime) VALUES ('BU1','ST1','P1','Active','fixture',NOW())");
    $web->exec("INSERT INTO tbl_pricing_details (pricing_code,inv_code,cost_per_uom,srp,deletestatus) VALUES ('P1','A',100,400,'Active'),('P1','B',125,500,'Active'),('P1','C',20,40,'Active')");
    $local->exec("CREATE TABLE tbl_main_business_units (ID INT AUTO_INCREMENT PRIMARY KEY,Unit_Code VARCHAR(64),Unit_Name VARCHAR(100),Category_Code VARCHAR(100),Status VARCHAR(20)) ENGINE=InnoDB");
    $local->exec("INSERT INTO tbl_main_business_units (Unit_Code,Unit_Name,Category_Code,Status) VALUES ('BU1','Fixture Restaurant','Company label','Active')");
    $local->exec("CREATE TABLE tbl_pricing_by_sales_type (seq INT AUTO_INCREMENT PRIMARY KEY,busunitcode VARCHAR(64),sales_type_id VARCHAR(64),pricing_category VARCHAR(64),deletestatus VARCHAR(20),usertracker VARCHAR(64),createdtime DATETIME) ENGINE=InnoDB");
    $local->exec("CREATE TABLE tbl_inventory_products_masterlist (seq INT AUTO_INCREMENT PRIMARY KEY,product_id VARCHAR(64) UNIQUE,category_code VARCHAR(100),unit_code VARCHAR(64),inventory_type VARCHAR(30),item_category VARCHAR(100),item_name VARCHAR(100),item_description VARCHAR(100),unit_of_measure VARCHAR(20),unit_cost DECIMAL(18,4),selling_price DECIMAL(18,4),vatable VARCHAR(10),item_brand VARCHAR(64),isDiscountable VARCHAR(10),beginning_inventory DECIMAL(18,4),actual_count DECIMAL(18,4),remaining_count DECIMAL(18,4),safety_stock DECIMAL(18,4),reordering_point DECIMAL(18,4),status VARCHAR(20)) ENGINE=InnoDB");
    $configure([$group('A', 'Hawaiian'), $group('B', 'Pepperoni')]);
    $sourceRead = new ProductSyncWebReadGateway(new Database($web));
    $export = new ProductSyncWebExportGateway(new Database($web));
    $apply = new ProductSyncLocalMutateGateway(new Database($local));
    $read = new ProductSyncLocalReadGateway(new Database($local));
    $request = static fn (string $action, array $codes): array => ['busunitcode' => 'BU1', 'selected_pricing_codes' => ['P1'], 'rows' => array_map(static fn ($code) => ['product_id' => $code, 'pricing_code' => 'P1', 'action' => $action], $codes)];
    $snapshot = $sourceRead->readWebSnapshot(['busunitcode' => 'BU1'], 'fixture');
    $assert($snapshot['message'] === 'Success' && $snapshot['web_rows'][0]['product_group']['enabled'] === true, 'WEB preview includes grouping.');
    $payload = $export->buildExportPayload($request('new_product', ['A', 'B', 'C']), 'fixture');
    $assert($payload['message'] === 'Success' && $payload['rows'][0]['online']['group_variant'] === 'Hawaiian', 'Export preserves grouping.');
    $snapshot = $read->readLocalSnapshot([], 'fixture');
    $assert($snapshot['product_groups_installed'] === false, 'Central-only configuration does not report the POS migration as installed.');
    $result = $apply->applyExportPayload($payload, 'fixture');
    $assert($result['message'] === 'Failed' && str_contains($result['error'], 'local product-groups migration'), 'Missing POS snapshots reject enabled sync with the local migration instruction.');
    $assert((int) $local->query('SELECT COUNT(*) FROM tbl_inventory_products_masterlist')->fetchColumn() === 0, 'Missing POS snapshots reject sync before product writes.');
    $assert((int) $local->query('SELECT COUNT(*) FROM lkp_sales_type')->fetchColumn() === 0, 'Missing POS snapshots reject sync before sales-type writes.');
    $local->exec($localMigration);
    $result = $apply->applyExportPayload($payload, 'fixture');
    $assert($result['message'] === 'Success', 'Initial local sync succeeds: ' . json_encode($result));
    $snapshot = $read->readLocalSnapshot([], 'fixture');
    $assert($snapshot['product_groups_installed'] === true, 'The complete local migration enables grouping sync.');
    $assert(count($snapshot['offline_products']) === 3, 'Local reader scopes by unit_code despite a human-readable category_code.');
    $assert($snapshot['offline_products'][0]['product_group']['enabled'] === true, 'Local read shows the synced grouping.');
    $assert((float) $local->query("SELECT srp FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 400.0, 'Whole-product price remains the existing price-list SRP.');

    $configure([$group('A', 'Hawaiian', false)]);
    $local->exec("UPDATE tbl_inventory_products_masterlist SET item_name='Local retained name' WHERE product_id='A'");
    $result = $apply->applyExportPayload($export->buildExportPayload($request('group_change', ['A']), 'fixture'), 'fixture');
    $assert($result['message'] === 'Success' && (int) $local->query("SELECT enabled FROM tbl_pos_product_groups WHERE build_code='A'")->fetchColumn() === 0, 'Grouping-only sync disables a group.');
    $assert($local->query("SELECT item_name FROM tbl_inventory_products_masterlist WHERE product_id='A'")->fetchColumn() === 'Local retained name', 'Grouping-only sync does not rewrite product master fields.');

    $configure([$group('A', 'Hawaiian')]);
    $web->exec("UPDATE tbl_pricing_details SET srp=401 WHERE inv_code='A'");
    $local->exec('ALTER TABLE tbl_pricing_details ENGINE=MyISAM');
    $result = $apply->applyExportPayload($export->buildExportPayload($request('price_change', ['A']), 'fixture'), 'fixture');
    $assert($result['message'] === 'Failed' && str_contains($result['error'], 'transactional catalog update'), 'Enabled grouping needs transactional local catalog tables.');
    $assert((float) $local->query("SELECT srp FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 400.0, 'Engine preflight fails before a nontransactional price could change.');
    $assert((int) $local->query('SELECT COUNT(*) FROM lkp_sales_type')->fetchColumn() === 1, 'Preflight also precedes sales-type replacement.');
    $local->exec('ALTER TABLE tbl_pricing_details ENGINE=InnoDB');
    $local->exec('RENAME TABLE tbl_pos_product_groups TO fixture_hidden_groups');
    $result = $apply->applyExportPayload($export->buildExportPayload($request('price_change', ['A']), 'fixture'), 'fixture');
    $assert($result['message'] === 'Failed' && str_contains($result['error'], 'not installed'), 'Missing local migration rejects enabled groups.');
    $assert((float) $local->query("SELECT srp FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 400.0, 'Failed group sync rolls back the price update too.');
    $local->exec('RENAME TABLE fixture_hidden_groups TO tbl_pos_product_groups');
    $result = $apply->applyExportPayload($export->buildExportPayload($request('price_change', ['A']), 'fixture'), 'fixture');
    $assert($result['message'] === 'Success', 'Sync works after local migration is available.');
    $web->exec('RENAME TABLE tbl_pos_product_groups TO fixture_hidden_groups');
    $legacyPayload = $export->buildExportPayload($request('price_change', ['A']), 'fixture');
    $assert(!array_key_exists('product_group', $legacyPayload['rows'][0]['online']), 'A legacy source does not send a false ungroup instruction.');
    $assert($apply->applyExportPayload($legacyPayload, 'fixture')['message'] === 'Success', 'Legacy source price sync still succeeds.');
    $assert((int) $local->query("SELECT enabled FROM tbl_pos_product_groups WHERE build_code='A'")->fetchColumn() === 1, 'Legacy source preserves local grouping.');
    $web->exec('RENAME TABLE fixture_hidden_groups TO tbl_pos_product_groups');

    // The same one master now has three sizes; neither halves nor sizes become products.
    $sizeMigration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_group_sizes.sql');
    $web->exec($sizeMigration);
    $sizedGroup = $group('A', 'Hawaiian');
    $sizedGroup['online']['group_size'] = '';
    $sizedGroup['online']['group_sizes'] = array_map(static fn (int $size, int $index): array => [
        'size_id' => 'PGS-A' . $size, 'size_name' => $size . ' inch', 'enabled' => true, 'recipe_configured' => true, 'sort_order' => $index,
        'prices' => [['pricing_category' => 'P1', 'srp' => [9 => 200, 12 => 400, 16 => 600][$size], 'cost_per_uom' => [9 => 60, 12 => 110, 16 => 180][$size]]],
        'components' => [
            ['component_code' => 'RM-CHEESE', 'component_class' => 'RM', 'qty' => $size * 10, 'description' => 'Cheese', 'uom' => 'G', 'uomval' => 1, 'category' => 'INGREDIENTS', 'cost_per_uom' => .5],
            ['component_code' => 'RM-FRUIT', 'component_class' => 'RM', 'qty' => [9 => 20, 12 => 40, 16 => 80][$size], 'description' => 'Fruit', 'uom' => 'G', 'uomval' => 1, 'category' => 'INGREDIENTS', 'cost_per_uom' => .8],
        ],
    ], [9, 12, 16], [0, 1, 2]);
    $configure([$sizedGroup]);
    $web->exec("DELETE FROM tbl_pricing_details WHERE inv_code='A'");
    $local->exec("DELETE FROM tbl_pricing_details WHERE inv_code='A'");
    $snapshot = $sourceRead->readWebSnapshot(['busunitcode' => 'BU1'], 'fixture');
    $assert($snapshot['message'] === 'Success', 'Size-only WEB preview succeeds: ' . json_encode($snapshot));
    $webA = array_values(array_filter($snapshot['web_rows'], static fn ($row) => $row['product_id'] === 'A'));
    $assert(count($webA) === 1 && count($webA[0]['group_sizes']) === 3, 'Preview finds one Hawaiian with three sizes without a base-price row.');
    $assert(array_column($webA[0]['group_sizes'], 'size_name') === ['9 inch', '12 inch', '16 inch'], 'Editable size labels stay ordered.');
    $assert((int) $web->query("SELECT COUNT(*) FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 0, 'Preview does not manufacture an ordinary WEB price.');
    $sizePayload = $export->buildExportPayload($request('group_change', ['A']), 'fixture');
    $assert($sizePayload['message'] === 'Success' && count($sizePayload['rows'][0]['online']['group_sizes']) === 3, 'WEB export preserves every child size.');
    $assert($sizePayload['rows'][0]['online']['group_sizes'][2]['components'][1]['description'] === 'Fruit', 'WEB export preserves ingredient descriptors.');

    $local->exec("UPDATE tbl_inventory_products_masterlist SET item_name='Keep local product' WHERE product_id='A'; UPDATE lkp_sales_type SET description='Keep local sales type'");
    $missingSizePayload = $export->buildExportPayload($request('new_product', ['A']), 'fixture');
    $beforeMaster = $local->query('SELECT * FROM tbl_inventory_products_masterlist ORDER BY product_id')->fetchAll(PDO::FETCH_ASSOC);
    $beforeSalesTypes = $local->query('SELECT * FROM lkp_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC);
    $beforeMappings = $local->query('SELECT * FROM tbl_pricing_by_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC);
    $result = $apply->applyExportPayload($missingSizePayload, 'fixture');
    $assert($result['message'] === 'Failed' && str_contains($result['error'], 'product sizes update'), 'A missing size migration rejects the whole export before writing.');
    $assert($local->query('SELECT * FROM tbl_inventory_products_masterlist ORDER BY product_id')->fetchAll(PDO::FETCH_ASSOC) === $beforeMaster, 'Missing size tables preserve all existing product master rows.');
    $assert($local->query('SELECT * FROM lkp_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC) === $beforeSalesTypes
        && $local->query('SELECT * FROM tbl_pricing_by_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC) === $beforeMappings, 'Missing size tables preserve sales types and price-list mappings.');
    $assert((int) $local->query("SELECT COUNT(*) FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 0, 'Missing size tables cannot create a compatibility price before failure.');
    $local->exec($sizeMigration);
    $result = $apply->applyExportPayload($sizePayload, 'fixture');
    $assert($result['message'] === 'Success', 'Child size sync succeeds after the migration: ' . json_encode($result));
    $snapshot = $read->readLocalSnapshot([], 'fixture');
    $localA = array_values(array_filter($snapshot['offline_products'], static fn ($row) => $row['product_id'] === 'A'));
    $assert(count($snapshot['offline_products']) === 3 && count($localA) === 1 && count($localA[0]['group_sizes']) === 3, 'Local read keeps exactly one Hawaiian and the original three total masters.');
    $assert(array_map(static fn ($size) => (float) $size['prices'][0]['srp'], $localA[0]['group_sizes']) === [200.0, 400.0, 600.0], 'All three independent size prices reach local storage.');
    $assert(array_map(static fn ($size) => (float) $size['components'][0]['qty'], $localA[0]['group_sizes']) === [90.0, 120.0, 160.0], 'The ingredient quantities stay distinct for each size.');
    $assert($localA[0]['group_sizes'][1]['components'][0]['uom'] === 'G'
        && (float) $localA[0]['group_sizes'][1]['components'][0]['cost_per_uom'] === .5, 'Local ingredient units and unit costs are preserved.');
    $assert($localA[0]['item_name'] === 'Keep local product' && (int) $local->query("SELECT COUNT(*) FROM tbl_pricing_details WHERE inv_code='A'")->fetchColumn() === 0, 'Size-only sync leaves the master and absent ordinary price unchanged.');
    $localB = array_values(array_filter($snapshot['offline_products'], static fn ($row) => $row['product_id'] === 'B'))[0];
    $assert($localB['group_size'] === 'Large' && !array_key_exists('group_sizes', $localB), 'A different legacy grouped product keeps its original configuration.');

    $sizedGroup['online']['group_sizes'][0]['components'][0]['qty'] = 95;
    $sizedGroup['online']['group_sizes'][2]['size_name'] = '16 inch family';
    $configure([$sizedGroup]);
    $sizeChangePayload = $export->buildExportPayload($request('group_change', ['A']), 'fixture');
    $assert((float) $sizeChangePayload['rows'][0]['online']['selling_price'] === 200.0, 'A recipe-only change can retain the same summary price.');
    $assert($apply->applyExportPayload($sizeChangePayload, 'fixture')['message'] === 'Success', 'A size/recipe-only group_change sync succeeds.');
    $snapshot = $read->readLocalSnapshot([], 'fixture');
    $localA = array_values(array_filter($snapshot['offline_products'], static fn ($row) => $row['product_id'] === 'A'))[0];
    $assert((float) $localA['group_sizes'][0]['components'][0]['qty'] === 95.0 && $localA['group_sizes'][2]['size_name'] === '16 inch family', 'Size labels and recipes update without replacing the master product.');
    $assert((float) $localA['group_sizes'][0]['prices'][0]['srp'] === 200.0 && $localA['item_name'] === 'Keep local product', 'Size-only changes preserve prices and local master fields.');
    // Reversible old-product mappings travel in the same authoritative export.
    $aliasMigration = file_get_contents(dirname(__DIR__, 2) . '/database/2026-10-19_pos_product_group_aliases.sql');
    $web->exec($aliasMigration);
    $configure([['product_id'=>'C','action'=>'group_change','online'=>['group_alias'=>['canonical_build_code'=>'B','size_id'=>'','enabled'=>true]]]]);
    $aliasPayload=$export->buildExportPayload($request('group_change',['C']),'fixture');
    $assert($aliasPayload['rows'][0]['online']['group_alias']===['canonical_build_code'=>'B','size_id'=>'','enabled'=>true], 'WEB export includes legacy target mapping with explicit empty size ID.');
    $before=$local->query('SELECT * FROM lkp_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC);
    $result=$apply->applyExportPayload($aliasPayload,'fixture');
    $assert($result['message']==='Failed' && str_contains($result['error'],'aliases update'), 'Missing local alias migration rejects before writes.');
    $assert($local->query('SELECT * FROM lkp_sales_type ORDER BY seq')->fetchAll(PDO::FETCH_ASSOC)===$before, 'Alias preflight preserves sales types before any mutation.');
    $local->exec($aliasMigration);
    $result=$apply->applyExportPayload($aliasPayload,'fixture');
    $assert($result['message']==='Success', 'Alias-only grouping change syncs after installation.');
    $localC=array_values(array_filter($read->readLocalSnapshot([],'fixture')['offline_products'],static fn($row)=>$row['product_id']==='C'))[0];
    $assert($localC['group_alias']['canonical_build_code']==='B' && $localC['group_alias']['enabled']===true, 'Local preview reads synced alias metadata.');
    $assert((float)$local->query("SELECT srp FROM tbl_pricing_details WHERE inv_code='C'")->fetchColumn()===40.0 && (int)$local->query('SELECT COUNT(*) FROM tbl_inventory_products_masterlist')->fetchColumn()===3, 'Alias sync changes neither original price nor product count.');
    $configure([['product_id'=>'C','action'=>'group_change','online'=>['group_alias'=>['canonical_build_code'=>'A','size_id'=>'PGS-A12','enabled'=>true]]]]);
    $assert($apply->applyExportPayload($export->buildExportPayload($request('group_change',['C']),'fixture'),'fixture')['message']==='Success', 'An exact child-size target syncs too.');
    $assert($local->query("SELECT size_id FROM tbl_pos_product_group_aliases WHERE source_build_code='C'")->fetchColumn()==='PGS-A12', 'Local mapping keeps the selected stable size.');
    $web->exec('RENAME TABLE tbl_pos_product_group_aliases TO saved_aliases');
    $older=$export->buildExportPayload($request('group_change',['C']),'fixture');
    $assert(!array_key_exists('group_alias',$older['rows'][0]['online']), 'Older alias source omits the key rather than clearing it.');
    $assert($apply->applyExportPayload($older,'fixture')['message']==='Success' && (int)$local->query("SELECT enabled FROM tbl_pos_product_group_aliases WHERE source_build_code='C'")->fetchColumn()===1, 'A newer local POS preserves aliases when upstream omits them.');
    $web->exec('RENAME TABLE saved_aliases TO tbl_pos_product_group_aliases');
    $web->exec("DELETE FROM tbl_pos_product_group_aliases WHERE source_build_code='C'");
    $clear=$export->buildExportPayload($request('group_change',['C']),'fixture');
    $assert(array_key_exists('group_alias',$clear['rows'][0]['online']) && $clear['rows'][0]['online']['group_alias']===null, 'Installed source explicitly reports removed mapping.');
    $assert($apply->applyExportPayload($clear,'fixture')['message']==='Success' && (int)$local->query("SELECT enabled FROM tbl_pos_product_group_aliases WHERE source_build_code='C'")->fetchColumn()===0, 'Explicit mapping removal reaches the local catalog.');
    echo "Product group end-to-end sync: $checks checks passed.\n";
} finally {
    foreach ([$web, $local] as $db) if ($db->inTransaction()) $db->rollBack();
    foreach ($names as $name) $web->exec("DROP DATABASE IF EXISTS `$name`");
}
