<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosProductSearch.php';

// Run the endpoint's real parsing and SQL against isolated SQLite fixtures.
// Deliberately do not include the endpoint: that would load config.php and the
// application database. SQLite verifies query behavior, not MySQL query plans.
$endpoint = file_get_contents(__DIR__ . '/../api/get_pricing_selection.php');
if (!preg_match('/(\$category_code\s*=.*?)(?=\/\*[\s-]*3\. VALIDATION)/s', $endpoint, $inputBlock)
    || !preg_match('/(\$sqlSalesType\s*=.*?\$products\s*=\s*\$stmtProducts->fetchAll\(\);)/s', $endpoint, $queryBlock)) {
    throw new RuntimeException('Could not locate the production pricing input/query blocks.');
}

$completed = false;
register_shutdown_function(static function () use (&$completed): void {
    // Production validation branches call exit; those must fail this test,
    // rather than silently terminating it before its assertions execute.
    if (!$completed) {
        fwrite(STDERR, "Pricing pagination regression did not complete.\n");
        exit(1);
    }
});

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA automatic_index = OFF');

// The repository CSV headers verify the column names. Its masterlist CSV has
// existing conflict markers before the header, so find the actual seq header.
// Fixture types are intentionally minimal; no production schema is inferred.
foreach (['lkp_sales_type', 'tbl_pricing_by_sales_type', 'tbl_pricing_details', 'tbl_inventory_products_masterlist'] as $table) {
    $handle = fopen(__DIR__ . '/../../database/' . $table . '.csv', 'r');
    $columns = null;
    while (($row = fgetcsv($handle)) !== false) {
        if (($row[0] ?? null) === 'seq') {
            $columns = $row;
            break;
        }
    }
    fclose($handle);
    if (!$columns) {
        throw new RuntimeException('Missing verified CSV header for ' . $table);
    }
    $definitions = [];
    foreach ($columns as $column) {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column)) {
            throw new RuntimeException('Unexpected fixture column: ' . $column);
        }
        $type = $column === 'seq' ? 'INTEGER' : (in_array($column, ['cost_per_uom', 'srp'], true) ? 'REAL' : 'TEXT');
        $definitions[] = '"' . $column . '" ' . $type;
    }
    $pdo->exec('CREATE TABLE ' . $table . ' (' . implode(', ', $definitions) . ')');
}

$insert = static function (string $table, array $values) use ($pdo): void {
    $columns = array_keys($values);
    $stmt = $pdo->prepare('INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')');
    $stmt->execute(array_values($values));
};
$insert('lkp_sales_type', ['sales_type_id' => 'DINE', 'description' => 'DINE IN']);
$insert('lkp_sales_type', ['sales_type_id' => 'TAKE', 'description' => 'TAKE OUT']);
foreach ([['UNIT-A', 'DINE', 'PRICE-DINE'], ['UNIT-A', 'TAKE', 'PRICE-TAKE'], ['UNIT-B', 'DINE', 'PRICE-UNIT-B']] as [$unit, $salesType, $pricing]) {
    $insert('tbl_pricing_by_sales_type', ['busunitcode' => $unit, 'sales_type_id' => $salesType, 'pricing_category' => $pricing]);
}

$product = static function (string $id, array $overrides = []) use ($insert): void {
    $insert('tbl_inventory_products_masterlist', array_replace([
        'product_id' => $id, 'item_name' => '5 CHEESE 12"',
        'category_code' => 'CAT-A', 'unit_code' => 'UNIT-A',
        'item_category' => 'PIZZA', 'status' => 'Active', 'sku' => 'SKU-' . $id,
    ], $overrides));
};
$price = static function (string $id, string $category, int $seq, float $amount) use ($insert): void {
    $insert('tbl_pricing_details', [
        'seq' => $seq, 'inv_code' => $id, 'pricing_code' => $category,
        'cost_per_uom' => 100, 'srp' => $amount,
    ]);
};

// All names tie, and insertion order opposes product-ID order. A second price
// for the boundary product also tests the final seq tie-break across pages.
for ($index = 245; $index >= 1; $index--) {
    $id = sprintf('CHEESE-%03d', $index);
    $product($id);
    $price($id, 'PRICE-DINE', $index * 10 + 2, 700 + $index);
    $price($id, 'PRICE-TAKE', $index * 10 + 3, 800 + $index);
}
$price('CHEESE-200', 'PRICE-DINE', 2001, 1999);

foreach ([
    ['OTHER-CATEGORY', ['category_code' => 'CAT-B']],
    ['OTHER-UNIT', ['unit_code' => 'UNIT-B']],
    ['INACTIVE', ['status' => 'Inactive']],
] as [$id, $overrides]) {
    $product($id, $overrides);
    $price($id, 'PRICE-DINE', 9000, 9999);
}
$price('OTHER-UNIT', 'PRICE-UNIT-B', 9001, 123);
$product('TAKE-ONLY');
$price('TAKE-ONLY', 'PRICE-TAKE', 9002, 222);
$product('DRINK', ['item_name' => 'Scoped choice', 'item_category' => 'DRINKS']);
$price('DRINK', 'PRICE-DINE', 9003, 80);

$execute = static function (array $input) use ($pdo, $inputBlock, $queryBlock): array {
    eval($inputBlock[1]);
    eval($queryBlock[1]);
    return compact('products', 'limit', 'offset', 'pricing_category');
};
$defaults = [
    'category_code' => 'CAT-A', 'unit_code' => 'UNIT-A',
    'sales_type' => 'DINE IN', 'search' => '5 cheese', 'limit' => 200,
];
$request = static function (array $overrides = []) use ($execute, $defaults): array {
    return $execute(array_replace($defaults, $overrides));
};
$checks = 0;
$same = static function ($actual, $expected, string $label) use (&$checks): void {
    $checks++;
    if ($actual !== $expected) {
        throw new RuntimeException($label . ': expected ' . json_encode($expected) . ', got ' . json_encode($actual));
    }
};

$first = $request();
$second = $request(['offset' => '200']);
$same(count($first['products']), 200, 'First page uses the requested cap');
$same(count($second['products']), 46, 'Offset retrieves every remaining pricing row');
$same($second['offset'], 200, 'String offsets are parsed as integers');
$same($first['products'][199]['product_id'], 'CHEESE-200', 'Product-ID order stays stable when names tie');
$same((float)$first['products'][199]['selling_price'], 1999.0, 'Lower seq comes before a tied product at the page boundary');
$same($second['products'][0]['product_id'], 'CHEESE-200', 'The second page resumes inside a tied product');
$same((float)$second['products'][0]['selling_price'], 900.0, 'Higher seq remains on the next page');
$expectedIds = [];
for ($index = 1; $index <= 245; $index++) {
    $expectedIds[] = sprintf('CHEESE-%03d', $index);
    if ($index === 200) {
        $expectedIds[] = 'CHEESE-200';
    }
}
$same(array_column(array_merge($first['products'], $second['products']), 'product_id'), $expectedIds, 'Pages contain no skipped/repeated rows and exclude inactive, other-business and other-pricing records');
$same($request(['offset' => 400])['products'], [], 'An exhausted page is empty');
$same($request(['offset' => -50])['products'], $first['products'], 'Negative offsets start at the first page');
$same($request(['offset' => -50])['offset'], 0, 'Negative offset metadata is normalized');
$same(count($request(['limit' => 999])['products']), 200, 'The existing maximum page size is preserved');
$same(count($request(['limit' => 0])['products']), 50, 'Invalid page limits retain the default');
$withoutPagination = $defaults;
unset($withoutPagination['limit']);
$implicitFirst = $execute($withoutPagination);
$same(count($implicitFirst['products']), 50, 'Existing callers without pagination retain fifty results');
$same($implicitFirst['offset'], 0, 'Existing callers default to offset zero');

$lookup = $request([
    'codes' => [' CHEESE-010 ', 'CHEESE-020', 'CHEESE-010', '', 'INACTIVE', 'OTHER-CATEGORY', 'OTHER-UNIT'],
    'search' => 'does not match', 'item_category' => 'does not match', 'offset' => 200, 'limit' => 1,
]);
$same(array_column($lookup['products'], 'product_id'), ['CHEESE-010', 'CHEESE-020'], 'Code repricing bypasses menu filters while preserving active/business scope');
$same($lookup['offset'], 0, 'Code lookup resets offset');
$same($lookup['limit'], 5, 'Code lookup deduplicates codes and chooses its own limit');
$same((float)$lookup['products'][0]['selling_price'], 710.0, 'Dine-in lookup keeps its mapped price');
$take = $request(['sales_type' => 'TAKE OUT', 'codes' => ['CHEESE-010']]);
$same($take['pricing_category'], 'PRICE-TAKE', 'Sales type resolves the correct pricing category');
$same(count($take['products']), 1, 'Alternate sales type does not return both prices');
$same((float)$take['products'][0]['selling_price'], 810.0, 'Alternate sales type returns its own price');
$otherUnit = $request(['unit_code' => 'UNIT-B']);
$same(array_column($otherUnit['products'], 'product_id'), ['OTHER-UNIT'], 'A different unit only sees its own products');
$same((float)$otherUnit['products'][0]['selling_price'], 123.0, 'Pricing-category lookup uses the requested business unit');
$same(array_column($request(['category_code' => 'CAT-B'])['products'], 'product_id'), ['OTHER-CATEGORY'], 'Category-code filtering remains scoped');
$same(array_column($request(['search' => '', 'item_category' => 'DRINKS'])['products'], 'product_id'), ['DRINK'], 'Ordinary category browsing still filters products');
$same(array_column($request(['search' => 'choice', 'item_category' => 'PIZZA'])['products'], 'product_id'), ['DRINK'], 'Text search still spans menu categories');

$completed = true;
echo 'Pricing variant pagination: ' . $checks . " endpoint assertions passed.\n";
