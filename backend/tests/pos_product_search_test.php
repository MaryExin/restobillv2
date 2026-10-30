<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosProductSearch.php';

// Execute the real search predicate with native PDO parameters against isolated
// fixtures. No application database or configuration is accessed.
$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('CREATE TABLE products (
    product_id TEXT PRIMARY KEY,
    item_name TEXT,
    item_description TEXT,
    item_category TEXT,
    subcategory_item_category TEXT,
    sku TEXT,
    bar_code TEXT,
    unit_of_measure TEXT,
    inventory_type TEXT
)');
$pdo->exec('CREATE TABLE prices (inv_code TEXT)');
$insertProduct = $pdo->prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$insertPrice = $pdo->prepare('INSERT INTO prices VALUES (?)');
$fixtures = [
    ['P1', '5 Cheese', 'Five cheese blend', 'PIZZA', 'CLASSIC', 'PZ-005', null, 'PIECE', 'FINISHED'],
    ['P2', 'Large', null, 'PIZZA', '5 Cheese', 'PZ-LARGE', null, null, null],
    ['P3', 'Garlic Toast', 'Toasted with cheese', 'SIDES', null, null, null, null, null],
    ['P4', 'Tea', null, 'DRINKS', null, 'TEA-01', '000123', 'CUP', 'BEVERAGE'],
    ['P5', 'Null details', null, null, null, null, null, null, null],
    ['P6', '100% Cheese_!', null, null, null, null, null, null, null],
    ['P7', 'Zero barcode', null, null, null, null, '0', null, null],
];
foreach ($fixtures as $row) {
    $insertProduct->execute($row);
    $insertPrice->execute([$row[0]]);
}

$cases = [
    ['cheese', ['P1', 'P2', 'P3', 'P6']],
    ['CHEESE', ['P1', 'P2', 'P3', 'P6']],
    ['chee', ['P1', 'P2', 'P3', 'P6']],
    ['5 cheese', ['P1', 'P2']],
    ['cheese 5', ['P1', 'P2']],
    ["  cHeEsE \t 5 \n", ['P1', 'P2']],
    ['cheese pizza', ['P1', 'P2']],
    ['cheese large', ['P2']],
    ['toasted', ['P3']],
    ['classic', ['P1']],
    ['drinks', ['P4']],
    ['tea-01', ['P4']],
    ['00123', ['P4']],
    ['p4', ['P4']],
    ['cup beverage', ['P4']],
    ['cheese tea', []],
    ['does-not-exist', []],
    ['null', ['P5']],
    ['0 zero', ['P7']],
    ['100%', ['P6']],
    ['_', ['P6']],
    ['!', ['P6']],
    ["' OR 1=1 --", []],
    ['cheese cheese', ['P1', 'P2', 'P3', 'P6']],
];

foreach ($cases as [$search, $expected]) {
    $predicate = posProductSearchPredicate($search);
    preg_match_all('/:product_search_[a-z0-9_]+/', $predicate['sql'] . ' ' . $predicate['order_by'], $placeholders);
    if (count($placeholders[0]) !== count(array_unique($placeholders[0]))) {
        throw new RuntimeException('Search reused a named parameter.');
    }
    if (count($placeholders[0]) !== count($predicate['params'])) {
        throw new RuntimeException('Search parameter bindings do not match the SQL.');
    }
    $stmt = $pdo->prepare('SELECT T2.product_id FROM prices AS T1
        JOIN products AS T2 ON T1.inv_code = T2.product_id
        WHERE ' . $predicate['sql'] . ' ORDER BY T2.product_id');
    $matchingParams = $predicate['params'];
    unset($matchingParams[':product_search_exact_sku']);
    $stmt->execute($matchingParams);
    $actual = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if ($actual !== $expected) {
        throw new RuntimeException('Search ' . var_export($search, true) . ': expected '
            . json_encode($expected) . ', got ' . json_encode($actual));
    }
}

foreach (['', " \t\n "] as $empty) {
    if (posProductSearchPredicate($empty) !== ['sql' => '', 'params' => [], 'order_by' => 'T2.item_name ASC']) {
        throw new RuntimeException('Empty search must not add a product filter.');
    }
}

// Exact scanning must still work when a common category/inventory word would
// otherwise fill the 20-result scan limit ahead of an alphabetically later SKU.
for ($i = 0; $i < 25; $i++) {
    $id = 'BROAD-' . $i;
    $insertProduct->execute([$id, 'A product ' . $i, null, null, null, null, null, null, 'READY']);
    $insertPrice->execute([$id]);
}
$insertProduct->execute(['EXACT-SKU', 'Z Special', null, null, null, 'READY', null, null, null]);
$insertPrice->execute(['EXACT-SKU']);
$predicate = posProductSearchPredicate(' ready ');
$stmt = $pdo->prepare('SELECT T2.product_id FROM prices AS T1
    JOIN products AS T2 ON T1.inv_code = T2.product_id
    WHERE ' . $predicate['sql'] . ' ORDER BY ' . $predicate['order_by'] . ' LIMIT 20');
$stmt->execute($predicate['params']);
$results = $stmt->fetchAll(PDO::FETCH_COLUMN);
if (count($results) !== 20 || $results[0] !== 'EXACT-SKU') {
    throw new RuntimeException('Exact SKU must be found before broader matches fill the result limit.');
}

echo 'Product search: ' . count($cases) . " query cases, blank search, and exact-SKU priority passed.\n";
