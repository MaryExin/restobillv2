<?php
declare(strict_types=1);

// Concurrent worker mode is restricted to this test's generated disposable DBs.
if (($argv[1] ?? '') === 'qr-worker') {
    $workerDb = $argv[2] ?? '';
    if (!preg_match('/^qr_test_[a-f0-9]{12}$/', $workerDb)) exit(2);
    $workerInput = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
    date_default_timezone_set('Asia/Manila');
    define('RESTOBILL_SAVE_ORDER_LIBRARY', true);
    require_once __DIR__ . '/../api/save_order.php';
    require_once __DIR__ . '/../src/QrOrderGateway.php';
    $workerPdo = new PDO('mysql:host=127.0.0.1;dbname=' . $workerDb . ';charset=utf8mb4', getenv('QR_TEST_USER') ?: 'root', getenv('QR_TEST_PASSWORD') ?: '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    try {
        $workerGateway = new QrOrderGateway($workerPdo, ['db' => $workerDb, 'report_db' => $workerDb]);
        $workerResult = $workerGateway->process('QR TEST', 'BU-QR-TEST', 'accept', $workerInput, '1', 'QA concurrent cashier');
        echo json_encode($workerResult, JSON_THROW_ON_ERROR);
        exit(0);
    } catch (Throwable $error) {
        fwrite(STDERR, $error->getMessage());
        exit(1);
    }
}

// Opt-in: clone table STRUCTURES only into a disposable local database. No POS rows are copied or changed.
// QR_TEST_SOURCE_DB=db_cnc_pos php backend/tests/qr_order_mysql_integration_test.php
$source = getenv('QR_TEST_SOURCE_DB');
if (!$source || !preg_match('/^[a-zA-Z0-9_]+$/', $source)) {
    fwrite(STDOUT, "SKIP: set QR_TEST_SOURCE_DB to a local POS schema to run MySQL integration checks.\n");
    exit(0);
}
$db = 'qr_test_' . bin2hex(random_bytes(6));
$pdo = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', getenv('QR_TEST_USER') ?: 'root', getenv('QR_TEST_PASSWORD') ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
date_default_timezone_set('Asia/Manila');
define('RESTOBILL_SAVE_ORDER_LIBRARY', true);
require_once __DIR__ . '/../api/save_order.php';
require_once __DIR__ . '/../src/QrOrderGateway.php';
require_once __DIR__ . '/../src/PosCurrentBillItems.php';
$checks = 0;
function checkQr($condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejectsQr(callable $run, string $message): void {
    try { $run(); } catch (Throwable $e) { checkQr(true, $message); return; }
    throw new RuntimeException($message);
}
function fixtureQr(PDO $pdo, string $table, array $values): void {
    $data = [];
    foreach ($pdo->query("SHOW COLUMNS FROM `$table`") as $column) {
        $key = $column['Field'];
        if (array_key_exists($key, $values)) { $data[$key] = $values[$key]; continue; }
        if (str_contains($column['Extra'], 'auto_increment') || $column['Default'] !== null || $column['Null'] === 'YES') continue;
        $type = $column['Type'];
        $data[$key] = preg_match('/int|double|float|decimal/', $type) ? 0
            : (preg_match('/datetime|timestamp/', $type) ? '2026-11-12 09:00:00'
            : (str_starts_with($type, 'date') ? '2026-11-12' : ''));
    }
    $columns = implode(',', array_map(fn($key) => "`$key`", array_keys($data)));
    $parameters = implode(',', array_fill(0, count($data), '?'));
    $pdo->prepare("INSERT INTO `$table` ($columns) VALUES ($parameters)")->execute(array_values($data));
}
function startQrWorker(string $database, array $input): array {
    $process = proc_open([PHP_BINARY, __FILE__, 'qr-worker', $database], [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']], $pipes);
    if (!is_resource($process)) throw new RuntimeException('Unable to start concurrency worker');
    fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR));
    fclose($pipes[0]);
    return [$process, $pipes];
}
function finishQrWorker(array $worker): array {
    [$process, $pipes] = $worker;
    $output = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    $code = proc_close($process);
    if ($code !== 0) throw new RuntimeException('Concurrency worker failed: ' . $errors);
    return json_decode($output, true, 32, JSON_THROW_ON_ERROR);
}

try {
    $pdo->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $tables = $pdo->query("SHOW TABLES FROM `$source`")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || str_starts_with($table, 'tbl_pos_qr_')) continue;
        $pdo->exec("CREATE TABLE `$db`.`$table` LIKE `$source`.`$table`");
    }
    $pdo->exec("USE `$db`");
    $pdo->exec(file_get_contents(__DIR__ . '/../../database/2026-11-12_qr_ordering.sql'));
    if (!posOrderHasItemInstructionColumn($pdo)) {
        $pdo->exec(file_get_contents(__DIR__ . '/../../database/2026-10-21_pos_order_item_instruction.sql'));
    }
    $category = 'QR TEST'; $unit = 'BU-QR-TEST';
    fixtureQr($pdo, 'tbl_main_business_units', ['Category_Code' => $category, 'Unit_Code' => $unit, 'Unit_Name' => 'QR test restaurant', 'Status' => 'Active']);
    fixtureQr($pdo, 'tbl_pos_tables', ['category_code' => $category, 'unit_code' => $unit, 'table_name' => 'Table QA', 'status' => 'Available']);
    fixtureQr($pdo, 'lkp_sales_type', ['sales_type_id' => 'ST-QR-TEST', 'description' => 'DINE IN', 'deletestatus' => 'Active']);
    fixtureQr($pdo, 'tbl_pricing_by_sales_type', ['busunitcode' => $unit, 'sales_type_id' => 'ST-QR-TEST', 'pricing_category' => 'PC-QR-TEST', 'deletestatus' => 'Active']);
    fixtureQr($pdo, 'tbl_inventory_products_masterlist', ['product_id' => 'P-QR-TEST', 'category_code' => $category, 'unit_code' => $unit, 'item_name' => 'Test meal', 'item_category' => 'Meals', 'vatable' => 'Yes', 'isDiscountable' => 'Yes', 'status' => 'Active']);
    fixtureQr($pdo, 'tbl_pricing_details', ['pricing_code' => 'PC-QR-TEST', 'inv_code' => 'P-QR-TEST', 'cost_per_uom' => 40, 'srp' => 112, 'deletestatus' => 'Active']);
    $gateway = new QrOrderGateway($pdo, ['db' => $db, 'report_db' => $db]);
    $setup = $gateway->setup($category, $unit);
    checkQr($setup['host_token'] === $gateway->setup($category, $unit)['host_token'], 'Setup must preserve the host token');
    rejectsQr(fn() => $gateway->verifyHost($category, $unit, str_repeat('0', 64)), 'Invalid host token must fail');
    $gateway->verifyHost($category, $unit, $setup['host_token']);
    $menu = $gateway->menu($category, $unit, 'DINE IN');
    checkQr(count($menu['products']) === 1 && $menu['products'][0]['selling_price'] === 112.0, 'Menu must use active POS pricing');
    checkQr(!isset($menu['products'][0]['unit_cost']), 'Public menu must hide costs');
    $input = ['request_id' => '61a23729-38ca-4779-9c1f-bcab36be6b51', 'table_number' => 'Table QA', 'order_type' => 'DINE IN',
        'customer_name' => 'Test Guest', 'customer_head_count' => 2, 'notes' => 'Serve together',
        'items' => [['product_id' => 'P-QR-TEST', 'quantity' => 2, 'selling_price' => 0.01, 'item_instruction' => 'No onions']]];
    $submitted = $gateway->submit($category, $unit, $input);
    checkQr($submitted['total_amount'] === 224.0, 'Ignore customer-supplied prices');
    checkQr($submitted === $gateway->submit($category, $unit, $input), 'Retries must return the same receipt');
    $changed = $input; $changed['items'][0]['quantity'] = 3;
    rejectsQr(fn() => $gateway->submit($category, $unit, $changed), 'Idempotency key must reject changed payload');
    $pending = $gateway->pending($category, $unit)['orders'];
    checkQr(count($pending) === 1 && $pending[0]['items'][0]['item_instruction'] === 'No onions', 'Queue must preserve items and notes');
    $rivalInput = $input; $rivalInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b70';
    $rival = $gateway->submit($category, $unit, $rivalInput);
    $decision = ['order_id' => $submitted['order_id'], 'terminal_number' => '1'];
    rejectsQr(fn() => $gateway->process($category, $unit, 'accept', $decision, '1', 'QA cashier'), 'Closed shift must reject acceptance');
    checkQr((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 0, 'Failed accept must not create a sale');
    fixtureQr($pdo, 'tbl_pos_shifting_records', ['Category_Code' => $category, 'Unit_Code' => $unit, 'terminal_number' => 1,
        'Opening_DateTime' => '2026-11-11 23:00:00', 'Shift_Status' => 'Open', 'Status' => 'Active']);
    $pdo->exec("UPDATE tbl_pricing_details SET srp=120 WHERE inv_code='P-QR-TEST'");
    rejectsQr(fn() => $gateway->process($category, $unit, 'accept', $decision, '1', 'QA cashier'), 'Price changes must require a new order');
    $pdo->exec("UPDATE tbl_pricing_details SET srp=112 WHERE inv_code='P-QR-TEST'");
    $accepted = $gateway->process($category, $unit, 'accept', $decision, '1', 'QA cashier');
    checkQr($accepted['status'] === 'accepted', 'Valid order must be accepted');
    rejectsQr(fn() => $gateway->process($category, $unit, 'accept', ['order_id' => $rival['order_id'], 'terminal_number' => '1'], '1', 'QA cashier'), 'A competing pending guest must not commandeer the table after another order is accepted');
    $gateway->process($category, $unit, 'reject', ['order_id' => $rival['order_id']], '1', 'QA cashier');
    $again = $gateway->process($category, $unit, 'accept', $decision, '1', 'QA cashier');
    checkQr($again['transaction_id'] === $accepted['transaction_id'], 'Repeated acceptance must use the same transaction');
    checkQr((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 1, 'Exactly one transaction must be created');
    $sale = $pdo->query('SELECT * FROM tbl_pos_transactions')->fetch();
    checkQr($sale['transaction_date'] === '2026-11-11', 'Business date must follow the open overnight shift');
    checkQr((float)$sale['payment_amount'] === 0.0 && $sale['remarks'] === 'Pending', 'Acceptance must be unpaid');
    // The existing POS computes header billing/VAT totals when billing is saved.
    checkQr((float)$pdo->query('SELECT SUM(sales_quantity * selling_price) FROM tbl_pos_transactions_detailed')->fetchColumn() === 224.0, 'POS detail amounts must match server pricing');
    checkQr($pdo->query('SELECT vatable FROM tbl_pos_transactions_detailed')->fetchColumn() === 'Yes', 'VAT classification must reach the normal billing flow');
    checkQr($pdo->query('SELECT item_instruction FROM tbl_pos_transactions_detailed')->fetchColumn() === 'No onions', 'Kitchen item notes must reach POS details');
    $guestMenu = $gateway->menu($category, $unit, 'DINE IN');
    checkQr($guestMenu['tables'][0]['occupied'] && !$guestMenu['tables'][0]['available'] && !$guestMenu['tables'][0]['can_continue'], 'Accepted open bills must make their table unavailable to new guests');
    $proof = ['continuation_order_id' => $submitted['order_id'], 'continuation_tracking_token' => $submitted['tracking_token']];
    $ownMenu = $gateway->menu($category, $unit, 'DINE IN', $proof);
    checkQr($ownMenu['tables'][0]['can_continue'] && $ownMenu['continuation']['transaction_state'] === 'open', 'Only a valid accepted receipt can continue its occupied table');
    $stranger = $input; $stranger['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b71';
    rejectsQr(fn() => $gateway->submit($category, $unit, $stranger), 'A new guest cannot submit to an occupied table');
    $wrongProof = $stranger + ['continuation_order_id' => $submitted['order_id'], 'continuation_tracking_token' => str_repeat('0', 64)];
    rejectsQr(fn() => $gateway->submit($category, $unit, $wrongProof), 'A known order ID without its tracking token cannot claim a table');
    $originalDetails = $pdo->query('SELECT ID,sales_quantity,selling_price,item_instruction FROM tbl_pos_transactions_detailed ORDER BY ID')->fetchAll();
    $second = $input + ['continuation_order_id' => $submitted['order_id'], 'continuation_tracking_token' => $submitted['tracking_token']]; $second['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b52';
    $additional = $gateway->submit($category, $unit, $second);
    $rejected = $gateway->process($category, $unit, 'reject', ['order_id' => $additional['order_id'], 'rejection_reason' => 'Sold out'], '1', 'QA cashier');
    checkQr($rejected['status'] === 'rejected' && $rejected['rejection_reason'] === 'Sold out', 'Rejection reason must be preserved');
    rejectsQr(fn() => $gateway->process($category, $unit, 'accept', ['order_id' => $additional['order_id']], '1', 'QA cashier'), 'Rejected orders cannot be accepted');
    $status = $gateway->status($category, $unit, ['order_id' => $submitted['order_id'], 'tracking_token' => $submitted['tracking_token']]);
    checkQr($status['status'] === 'accepted', 'Customer must see acceptance');
    rejectsQr(fn() => $gateway->status($category, $unit, ['order_id' => $submitted['order_id'], 'tracking_token' => 'bad']), 'Tracking token must protect the order');
    rejectsQr(fn() => $gateway->status('OTHER CATEGORY', $unit, ['order_id' => $submitted['order_id'], 'tracking_token' => $submitted['tracking_token']]), 'Tracking must reject a different category even with the correct token');
    rejectsQr(fn() => $gateway->status($category, 'OTHER UNIT', ['order_id' => $submitted['order_id'], 'tracking_token' => $submitted['tracking_token']]), 'Tracking must reject a different unit even with the correct token');
    rejectsQr(fn() => $gateway->verifyHost($category, 'OTHER UNIT', $setup['host_token']), 'A host token must not authorize another unit');

    // Additional batches append to the receipt-authorized open bill without replacing details.
    $batchInput = $second;
    $batchInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b53';
    $batchInput['items'][0]['quantity'] = 1;
    $batch = $gateway->submit($category, $unit, $batchInput);
    $batchAccepted = $gateway->process($category, $unit, 'accept', ['order_id' => $batch['order_id'], 'terminal_number' => '1'], '1', 'QA cashier');
    checkQr((string)$batchAccepted['transaction_id'] === (string)$accepted['transaction_id'] && $batchAccepted['is_additional'] === true, 'Additional batches must append to the authorized open transaction');
    checkQr((int)$pdo->query("SELECT COUNT(*) FROM tbl_pos_transactions WHERE table_number='Table QA' AND remarks='Pending'")->fetchColumn() === 1, 'Additional batches must leave one unpaid transaction on the table');
    $originalQuantity = $pdo->prepare('SELECT SUM(sales_quantity) FROM tbl_pos_transactions_detailed WHERE transaction_id=?');
    $originalQuantity->execute([$accepted['transaction_id']]);
    checkQr((float)$originalQuantity->fetchColumn() === 3.0, 'Additional acceptance must append quantities without replacing original details');
    checkQr((int)$batchAccepted['transaction_id'] === (int)$accepted['transaction_id'], 'Additional batches must not allocate a new transaction number');
    checkQr($pdo->query('SELECT ID,sales_quantity,selling_price,item_instruction FROM tbl_pos_transactions_detailed ORDER BY ID LIMIT 1')->fetchAll() === $originalDetails, 'Original row IDs, quantities, prices and instructions must remain unchanged');
    $repeatBatch = $gateway->process($category, $unit, 'accept', ['order_id' => $batch['order_id'], 'terminal_number' => '1'], '1', 'QA cashier');
    checkQr($repeatBatch['is_additional'] && (int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn() === 2, 'Idempotent acceptance must not append the same batch twice');
    $gross = $pdo->query('SELECT TotalSales,TotalAmountDue,customer_head_count,transaction_date,terminal_number,order_slip_no FROM tbl_pos_transactions')->fetch();
    checkQr((float)$gross['TotalSales'] === 336.0 && (float)$gross['TotalAmountDue'] === 336.0, 'Unbilled append totals must include all original and new details');
    checkQr((int)$gross['customer_head_count'] === 2 && $gross['transaction_date'] === '2026-11-11' && (string)$gross['order_slip_no'] === (string)$accepted['order_slip_no'], 'Append must preserve original visit metadata');

    // Deliberately break the audit write after header/details/counter updates.
    // RENAME targets only our generated disposable schema, never the source DB.
    $rollbackInput = $second;
    $rollbackInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b54';
    $rollbackReceipt = $gateway->submit($category, $unit, $rollbackInput);
    $rollbackDecision = ['order_id' => $rollbackReceipt['order_id'], 'terminal_number' => '1'];
    $beforeCounters = $pdo->query('SELECT * FROM tbl_pos_document_counters')->fetchAll();
    $beforeHeaders = (int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn();
    $beforeDetails = (int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn();
    $pdo->exec("RENAME TABLE `$db`.`tbl_main_activity_logs` TO `$db`.`qr_test_hidden_activity_logs`");
    try {
        rejectsQr(fn() => $gateway->process($category, $unit, 'accept', $rollbackDecision, '1', 'QA cashier'), 'A failed audit write must fail acceptance');
    } finally {
        $pdo->exec("RENAME TABLE `$db`.`qr_test_hidden_activity_logs` TO `$db`.`tbl_main_activity_logs`");
    }
    checkQr(!$pdo->inTransaction(), 'Failed writer must release its transaction');
    checkQr((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === $beforeHeaders, 'Failed writer must roll back the POS header');
    checkQr((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn() === $beforeDetails, 'Failed writer must roll back the POS details');
    checkQr($pdo->query('SELECT * FROM tbl_pos_document_counters')->fetchAll() === $beforeCounters, 'Failed writer must roll back allocated document counters');
    $rollbackStatus = $gateway->status($category, $unit, ['order_id' => $rollbackReceipt['order_id'], 'tracking_token' => $rollbackReceipt['tracking_token']]);
    checkQr($rollbackStatus['status'] === 'pending' && $rollbackStatus['transaction_id'] === null, 'Failed writer must leave the QR order pending');
    $recovered = $gateway->process($category, $unit, 'accept', $rollbackDecision, '1', 'QA cashier');
    checkQr($recovered['status'] === 'accepted' && (int)$recovered['transaction_id'] === (int)$batchAccepted['transaction_id'], 'Retry after repair must append to the same transaction');

    // Read the actual settings structure and exercise the current POS automatic
    // mapping (the obsolete standalone percentage setting is deliberately wrong).
    $chargeColumns = array_column($pdo->query('SHOW COLUMNS FROM tbl_pos_list_of_other_charges')->fetchAll(), 'Field');
    foreach (['amount' => 'DECIMAL(14,2) NOT NULL DEFAULT 0', 'rate_type' => "VARCHAR(20) NOT NULL DEFAULT 'Percentage'", 'is_enabled' => 'TINYINT NOT NULL DEFAULT 0'] as $column => $definition) {
        if (!in_array($column, $chargeColumns, true)) $pdo->exec("ALTER TABLE `$db`.`tbl_pos_list_of_other_charges` ADD COLUMN `$column` $definition");
    }
    fixtureQr($pdo, 'tbl_pos_list_of_other_charges', ['ID' => 991, 'category' => 'POS', 'particulars' => 'QR test service', 'amount' => 5, 'rate_type' => 'Percentage', 'is_enabled' => 1]);
    fixtureQr($pdo, 'tbl_pos_list_of_other_charges', ['ID' => 992, 'category' => 'POS', 'particulars' => 'QR test fixed charge', 'amount' => 10, 'rate_type' => 'Fixed', 'is_enabled' => 1]);
    fixtureQr($pdo, 'tbl_pos_list_of_other_charges', ['ID' => 993, 'category' => 'POS', 'particulars' => 'Corkage', 'amount' => 500, 'rate_type' => 'Fixed', 'is_enabled' => 1]);
    foreach (['Service Charge Enabled' => 'True', 'Service Charge Basis' => 'vat_exclusive_less_discount',
        'Service Charge Percentage' => '95', 'Service Charge Auto Types: 991' => '["ST-QR-TEST"]',
        'Service Charge Auto Types: 992' => '["ST-QR-TEST"]', 'Service Charge Auto Types: 993' => '["ST-QR-TEST"]'] as $description => $value) {
        fixtureQr($pdo, 'tbl_pos_settings', ['category' => 'Service', 'description' => $description, 'value' => $value]);
    }
    $chargedMenu = $gateway->menu($category, $unit, 'DINE IN');
    checkQr($chargedMenu['service_charge']['enabled'] === true && count($chargedMenu['service_charge']['charges']) === 2, 'Menu must expose only automatic non-corkage charges for its order type');
    $chargedInput = $second;
    $chargedInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b55';
    $charged = $gateway->submit($category, $unit, $chargedInput);
    checkQr($charged['subtotal_amount'] === 224.0 && $charged['service_charge_amount'] === 20.0 && $charged['total_amount'] === 244.0, 'Service estimate must use VAT-exclusive 200 × 5% plus fixed 10');
    $chargedStatus = $gateway->status($category, $unit, ['order_id' => $charged['order_id'], 'tracking_token' => $charged['tracking_token']]);
    checkQr($chargedStatus['service_charge_amount'] === 20.0, 'Status must preserve the submitted charge snapshot');
    $pdo->exec("UPDATE tbl_pos_settings SET value='False' WHERE description='Service Charge Enabled'");
    checkQr($gateway->status($category, $unit, ['order_id' => $charged['order_id'], 'tracking_token' => $charged['tracking_token']])['total_amount'] === 244.0, 'Later setting changes must not rewrite a submitted estimate');
    $disabledInput = $second;
    $disabledInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b56';
    checkQr($gateway->submit($category, $unit, $disabledInput)['total_amount'] === 224.0, 'New orders must honor disabled charges');

    // A previously billed discounted transaction keeps its financial snapshot
    // and charge/customer intent until the normal billing flow recomputes it.
    $pdo->exec('UPDATE tbl_pos_transactions SET billing_no=3000000001,TotalSales=560,Discount=20,OtherCharges=10,TotalAmountDue=550,VATableSales=500,VATableSales_VAT=60');
    fixtureQr($pdo, 'tbl_pos_transactions_other_charges', ['transaction_id' => $accepted['transaction_id'], 'Category_Code' => $category, 'Unit_Code' => $unit,
        'transaction_date' => '2026-11-11', 'particulars' => 'Manual charge', 'amount' => 10, 'reference' => 'MANUAL']);
    $financialBefore = $pdo->query('SELECT billing_no,TotalSales,Discount,OtherCharges,TotalAmountDue,VATableSales,VATableSales_VAT FROM tbl_pos_transactions')->fetch();
    $chargesBefore = $pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll();
    $billedInput = $second; $billedInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b57'; $billedInput['items'][0]['quantity'] = 1;
    $billedBatch = $gateway->submit($category, $unit, $billedInput);
    $billedResult = $gateway->process($category, $unit, 'accept', ['order_id' => $billedBatch['order_id'], 'terminal_number' => '1'], '1', 'QA cashier');
    checkQr($billedResult['is_additional'] && $billedResult['requires_rebilling'], 'Billed append must explicitly require re-billing');
    checkQr($pdo->query('SELECT billing_no,TotalSales,Discount,OtherCharges,TotalAmountDue,VATableSales,VATableSales_VAT FROM tbl_pos_transactions')->fetch() === $financialBefore, 'Billed append must preserve discounts, taxes and charge financial snapshot');
    checkQr($pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll() === $chargesBefore, 'Existing charge rows must remain intact');
    rejectsQr(fn() => posAssertBillReadyForPayment($pdo->query('SELECT * FROM tbl_pos_transactions')->fetch()), 'Payment must reject the re-bill marker');
    $pdo->exec("UPDATE tbl_pos_transactions SET remarks='Pending for Payment',TotalSales=672,TotalAmountDue=662");
    posAssertBillReadyForPayment($pdo->query('SELECT * FROM tbl_pos_transactions')->fetch());
    checkQr(true, 'A normal re-bill clearing the marker restores payment eligibility');

    // Two terminals accepting distinct batches concurrently must append once
    // each and retain the single authorized transaction and counter value.
    $concurrentA = $second; $concurrentA['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b58'; $concurrentA['items'][0]['quantity'] = 1;
    $concurrentB = $concurrentA; $concurrentB['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b59';
    $receiptA = $gateway->submit($category, $unit, $concurrentA);
    $receiptB = $gateway->submit($category, $unit, $concurrentB);
    $detailCountBefore = (int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn();
    $counterBefore = $pdo->query('SELECT next_transaction_id FROM tbl_pos_document_counters')->fetchColumn();
    $workerA = startQrWorker($db, ['order_id' => $receiptA['order_id'], 'terminal_number' => '1']);
    $workerB = startQrWorker($db, ['order_id' => $receiptB['order_id'], 'terminal_number' => '1']);
    $resultA = finishQrWorker($workerA); $resultB = finishQrWorker($workerB);
    checkQr((string)$resultA['transaction_id'] === (string)$accepted['transaction_id'] && (string)$resultB['transaction_id'] === (string)$accepted['transaction_id'], 'Concurrent terminals must append to the same original transaction');
    checkQr((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_detailed')->fetchColumn() === $detailCountBefore + 2, 'Concurrent batches must each append exactly once');
    checkQr($pdo->query('SELECT next_transaction_id FROM tbl_pos_document_counters')->fetchColumn() === $counterBefore, 'Concurrent appends must not allocate new transaction counters');

    // Payment wins the header lock: a previously queued additional batch must
    // become a NEW transaction after payment commits, never reopen the old one.
    $rollInput = $second; $rollInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b60'; $rollInput['items'][0]['quantity'] = 1;
    $rollReceipt = $gateway->submit($category, $unit, $rollInput);
    $pdo->beginTransaction();
    $pdo->query('SELECT * FROM tbl_pos_transactions FOR UPDATE')->fetchAll();
    $rollWorker = startQrWorker($db, ['order_id' => $rollReceipt['order_id'], 'terminal_number' => '1']);
    $pdo->exec("UPDATE tbl_pos_transactions SET remarks='Paid',invoice_no=4000000001,payment_amount=886");
    $paidSnapshot = $pdo->query('SELECT * FROM tbl_pos_transactions')->fetch();
    $paidDetails = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed ORDER BY ID')->fetchAll();
    $pdo->commit();
    $rolled = finishQrWorker($rollWorker);
    checkQr(!$rolled['is_additional'] && (int)$rolled['transaction_id'] === (int)$accepted['transaction_id'] + 1, 'Payment-first race must create a new transaction');
    $readPaid = $pdo->prepare('SELECT * FROM tbl_pos_transactions WHERE transaction_id=?'); $readPaid->execute([$accepted['transaction_id']]);
    checkQr($readPaid->fetch() === $paidSnapshot, 'Rollover must never mutate the paid transaction header');
    $readPaidItems = $pdo->prepare('SELECT * FROM tbl_pos_transactions_detailed WHERE transaction_id=? ORDER BY ID'); $readPaidItems->execute([$accepted['transaction_id']]);
    checkQr($readPaidItems->fetchAll() === $paidDetails, 'Rollover must preserve every paid detail row');
    checkQr($gateway->status($category, $unit, ['order_id' => $submitted['order_id'], 'tracking_token' => $submitted['tracking_token']])['transaction_state'] === 'paid', 'Prior receipts must report the settled bill state');
    $staleVisit = $second; $staleVisit['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b61';
    rejectsQr(fn() => $gateway->submit($category, $unit, $staleVisit), 'A paid visit token cannot claim a later occupied visit on the same table');

    fixtureQr($pdo, 'tbl_pos_tables', ['category_code' => $category, 'unit_code' => $unit, 'table_name' => 'Table Other', 'status' => 'Available']);
    $pdo->prepare("UPDATE tbl_pos_transactions SET table_number='Table QA & Table Other' WHERE transaction_id=?")->execute([$rolled['transaction_id']]);
    $combinedTables = $gateway->menu($category, $unit, 'DINE IN')['tables'];
    checkQr(count(array_filter($combinedTables, fn($row) => $row['occupied'] && !$row['available'])) === 2, 'A merged bill must occupy every constituent physical table');
    $movedInput = $input + ['continuation_order_id' => $rollReceipt['order_id'], 'continuation_tracking_token' => $rollReceipt['tracking_token']];
    $movedInput['request_id'] = '61a23729-38ca-4779-9c1f-bcab36be6b62';
    rejectsQr(fn() => $gateway->submit($category, $unit, $movedInput), 'A moved or merged bill must require staff review before continuing');
    fwrite(STDOUT, "PASS: {$checks} MySQL QR integration checks.\n");
} finally {
    // This name was generated above; never remove the source database.
    if (preg_match('/^qr_test_[a-f0-9]{12}$/', $db)) $pdo->exec("DROP DATABASE IF EXISTS `$db`");
}
