<?php

declare(strict_types=1);

// Opt-in real mysqli verification using a disposable schema, never POS tables.
// QR_TEST_MYSQL=1 php backend/tests/pos_order_snapshot_mysql_test.php
if (getenv('QR_TEST_MYSQL') !== '1') {
    echo "SKIP: set QR_TEST_MYSQL=1 to run isolated mysqli snapshot checks.\n";
    exit(0);
}
require_once __DIR__ . '/../src/PosOrderSnapshot.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$connection = new mysqli('127.0.0.1', getenv('QR_TEST_USER') ?: 'root', getenv('QR_TEST_PASSWORD') ?: '');
$database = 'qr_snapshot_test_' . bin2hex(random_bytes(6));
$checks = 0;
function snapshotMysqlCheck(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

/** Run the actual endpoint in a child process against only the disposable DB. */
function snapshotEndpointChecks(mysqli $connection, string $database): void
{
    $fixture = sys_get_temp_dir() . '/qr-snapshot-endpoint-' . bin2hex(random_bytes(6));
    mkdir($fixture . '/api', 0700, true);
    mkdir($fixture . '/src', 0700);
    try {
        copy(__DIR__ . '/../api/update_order.php', $fixture . '/api/update_order.php');
        foreach (['PosOrderSnapshot', 'PosCurrentBillItems', 'PosOrderItemInstructions'] as $helper) {
            copy(__DIR__ . '/../src/' . $helper . '.php', $fixture . '/src/' . $helper . '.php');
        }
        file_put_contents($fixture . '/api/cors.php', '<?php');
        // Report synchronization is a separate boundary. It must never reach
        // the real reporting database from this disposable endpoint fixture.
        file_put_contents($fixture . '/api/pos_report_mirror.php', '<?php function mirrorPosTransactionToReport(...$args) {}');
        file_put_contents($fixture . '/api/config.php', <<<'PHP'
<?php
return ['host'=>'127.0.0.1', 'db'=>getenv('QR_SNAPSHOT_DATABASE'), 'report_db'=>getenv('QR_SNAPSHOT_DATABASE'),
    'user'=>getenv('QR_TEST_USER') ?: 'root', 'pass'=>getenv('QR_TEST_PASSWORD') ?: '', 'charset'=>'utf8mb4'];
PHP);
        file_put_contents($fixture . '/run.php', <<<'PHP'
<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = json_decode(getenv('QR_SNAPSHOT_REQUEST'), true, 512, JSON_THROW_ON_ERROR);
register_shutdown_function(static function (): void { fwrite(STDERR, json_encode(['http_status'=>http_response_code() ?: 200])); });
require __DIR__ . '/api/update_order.php';
PHP);

        $connection->query('DROP TABLE tbl_pos_transactions_detailed');
        $connection->query('CREATE TABLE tbl_pos_transactions (
            ID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED, Category_Code VARCHAR(100), Unit_Code VARCHAR(100),
            order_slip_no BIGINT UNSIGNED, transaction_type VARCHAR(30), transaction_date VARCHAR(30), transaction_time VARCHAR(30),
            terminal_number VARCHAR(30), table_number VARCHAR(100), order_type VARCHAR(30), customer_head_count INT,
            discount_type VARCHAR(100), payment_method VARCHAR(100), special_instructions TEXT, cashier VARCHAR(100),
            remarks VARCHAR(100), order_status VARCHAR(30), status VARCHAR(30), void_date VARCHAR(30), refund_date VARCHAR(30)
        ) ENGINE=InnoDB');
        $connection->query('CREATE TABLE tbl_pos_transactions_detailed (
            ID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED, Category_Code VARCHAR(100), Unit_Code VARCHAR(100),
            transaction_date VARCHAR(30), product_id VARCHAR(100), sku VARCHAR(100), sales_quantity DECIMAL(14,4),
            landing_cost DECIMAL(14,4), unit_cost DECIMAL(14,4), selling_price DECIMAL(14,4),
            vatable VARCHAR(20), isDiscountable VARCHAR(20), order_status VARCHAR(30), item_instruction TEXT
        ) ENGINE=InnoDB');
        $connection->query('CREATE TABLE tbl_pos_qr_orders (
            order_id VARCHAR(36), transaction_id BIGINT UNSIGNED, category_code VARCHAR(100), unit_code VARCHAR(100), status VARCHAR(20)
        ) ENGINE=InnoDB');
        $connection->query('CREATE TABLE tbl_main_activity_logs (
            ID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, Category_Code VARCHAR(100), Unit_Code VARCHAR(100), activity_date_time DATETIME,
            user_id VARCHAR(100), user_name VARCHAR(100), type_of_activity VARCHAR(100), activity_performed VARCHAR(100), values_of_data TEXT
        ) ENGINE=InnoDB');
        $connection->query('CREATE TABLE tbl_main_transaction_logs (
            ID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, Category_Code VARCHAR(100), Unit_Code VARCHAR(100), Register VARCHAR(100),
            Trans_Date VARCHAR(30), Reference_No VARCHAR(100), Trans_Type VARCHAR(100), User_ID BIGINT, Amount DECIMAL(14,4),
            Description TEXT, Log_Date VARCHAR(30), Log_Time VARCHAR(30)
        ) ENGINE=InnoDB');
        $connection->query("INSERT INTO tbl_pos_transactions (transaction_id,Category_Code,Unit_Code,order_slip_no,remarks,status,order_status)
            VALUES (100,'CAT','UNIT',200,'Pending QR Rebill','Active','Pending'),
                   (100,'OTHER','UNIT',300,'Pending','Active','Pending')");
        $connection->query("INSERT INTO tbl_pos_transactions_detailed (ID,transaction_id,Category_Code,Unit_Code,product_id,sku,sales_quantity,selling_price)
            VALUES (1,100,'CAT','UNIT','MEAL','MEAL',1,100), (2,100,'OTHER','UNIT','FOREIGN','FOREIGN',9,999)");
        $connection->query("INSERT INTO tbl_pos_qr_orders VALUES ('QR-ACCEPTED',100,'CAT','UNIT','accepted')");
        $loaded = posOrderReadSnapshot($connection, '100', 'CAT', 'UNIT');
        $connection->query("INSERT INTO tbl_pos_transactions_detailed (ID,transaction_id,Category_Code,Unit_Code,product_id,sku,sales_quantity,selling_price)
            VALUES (3,100,'CAT','UNIT','QR-SOUP','QR-SOUP',1,50)");
        $before = posOrderReadSnapshot($connection, '100', 'CAT', 'UNIT');
        $input = ['transaction_id'=>'100', 'Category_Code'=>'CAT', 'Unit_Code'=>'UNIT',
            'transaction_type'=>'PRODUCT', 'transaction_date'=>'2026-11-13', 'transaction_time'=>'10:00 AM', 'terminal_number'=>'1',
            'table_number'=>'Table QA', 'order_type'=>'DINE IN', 'customer_head_count'=>'2', 'cashier'=>'Fixture cashier',
            'user_id'=>'1', 'user_name'=>'Fixture cashier', 'remarks'=>'Pending for Payment', 'order_status'=>'Pending',
            'status'=>'Active', 'void_date'=>'', 'refund_date'=>'', 'original_cart_items'=>json_encode($loaded),
            'cart_items'=>json_encode([['product_id'=>'MEAL', 'sku'=>'MEAL', 'sales_quantity'=>2, 'selling_price'=>100,
                'landing_cost'=>40, 'unit_cost'=>40, 'vatable'=>'Yes', 'isDiscountable'=>'Yes', 'order_status'=>'ACTIVE', 'item_instruction'=>'No salt']])];
        $run = static function (array $request) use ($fixture, $database): array {
            $process = proc_open([PHP_BINARY, $fixture . '/run.php'],
                [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']], $pipes, null,
                ['QR_SNAPSHOT_DATABASE'=>$database, 'QR_SNAPSHOT_REQUEST'=>json_encode($request),
                    'QR_TEST_USER'=>getenv('QR_TEST_USER') ?: 'root', 'QR_TEST_PASSWORD'=>getenv('QR_TEST_PASSWORD') ?: '']);
            if (!is_resource($process)) throw new RuntimeException('Could not start endpoint fixture.');
            fclose($pipes[0]);
            $output = stream_get_contents($pipes[1]); $diagnostic = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            $exit = proc_close($process);
            if ($exit !== 0) throw new RuntimeException('Endpoint fixture failed: ' . $diagnostic);
            return [json_decode($output, true, 512, JSON_THROW_ON_ERROR), json_decode($diagnostic, true, 512, JSON_THROW_ON_ERROR)];
        };
        [$stale, $staleHttp] = $run($input);
        snapshotMysqlCheck($stale['status'] === 'error' && $staleHttp['http_status'] === 409, 'Actual endpoint rejects a stale loaded cart.');
        snapshotMysqlCheck(posOrderReadSnapshot($connection, '100', 'CAT', 'UNIT') === $before, 'Stale POST must not delete the appended QR item or replace original rows.');
        snapshotMysqlCheck((int)$connection->query('SELECT COUNT(*) FROM tbl_main_activity_logs')->fetch_row()[0] === 0, 'Stale POST rolls back before audit or order writes.');

        $legacy = $input; unset($legacy['original_cart_items']);
        [$missing, $missingHttp] = $run($legacy);
        snapshotMysqlCheck($missing['status'] === 'error' && $missingHttp['http_status'] === 409, 'Actual endpoint protects QR rows from older clients without snapshots.');

        $input['original_cart_items'] = json_encode($before);
        $cart = json_decode($input['cart_items'], true);
        $cart[] = ['product_id'=>'QR-SOUP', 'sku'=>'QR-SOUP', 'sales_quantity'=>1, 'selling_price'=>50,
            'landing_cost'=>10, 'unit_cost'=>10, 'vatable'=>'Yes', 'isDiscountable'=>'Yes', 'order_status'=>'ACTIVE', 'item_instruction'=>'Keep hot'];
        $input['cart_items'] = json_encode($cart);
        [$saved, $savedHttp] = $run($input);
        snapshotMysqlCheck($saved['status'] === 'success' && $savedHttp['http_status'] === 200, 'Actual endpoint accepts an up-to-date cart with valid bind parameters.');
        snapshotMysqlCheck(count($saved['original_cart_items']) === 2 && array_intersect(['1','3'], array_column($saved['original_cart_items'], 'databaseID')) === [], 'Successful response supplies replacement detail IDs.');
        snapshotMysqlCheck($saved['total_amount'] == 250 && $saved['order_slip_no'] == 200, 'Update preserves the order slip and totals the edited complete cart.');
        snapshotMysqlCheck($saved['requires_rebilling'] === true, 'Successful response retains the re-bill requirement.');
        $header = $connection->query("SELECT remarks FROM tbl_pos_transactions WHERE transaction_id=100 AND Category_Code='CAT' AND Unit_Code='UNIT'")->fetch_assoc();
        snapshotMysqlCheck($header['remarks'] === 'Pending QR Rebill', 'Normal save cannot clear the stored re-bill marker.');
        $foreign = $connection->query("SELECT remarks FROM tbl_pos_transactions WHERE transaction_id=100 AND Category_Code='OTHER'")->fetch_assoc();
        snapshotMysqlCheck($foreign['remarks'] === 'Pending' && count(posOrderReadSnapshot($connection, '100', 'OTHER', 'UNIT')) === 1, 'Matching foreign-branch transaction and details remain untouched.');
        $notes = $connection->query("SELECT item_instruction FROM tbl_pos_transactions_detailed WHERE Category_Code='CAT' ORDER BY ID")->fetch_all(MYSQLI_ASSOC);
        snapshotMysqlCheck(array_column($notes, 'item_instruction') === ['No salt','Keep hot'], 'Item instructions survive the replacement endpoint.');
        $input['original_cart_items'] = json_encode($saved['original_cart_items']);
        [$again] = $run($input);
        snapshotMysqlCheck($again['status'] === 'success', 'Returned snapshot permits a subsequent save without reloading.');
    } finally {
        foreach (glob($fixture . '/api/*') as $file) unlink($file);
        foreach (glob($fixture . '/src/*') as $file) unlink($file);
        if (is_file($fixture . '/run.php')) unlink($fixture . '/run.php');
        rmdir($fixture . '/api'); rmdir($fixture . '/src'); rmdir($fixture);
    }
}
try {
    $connection->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $connection->select_db($database);
    $connection->query('CREATE TABLE tbl_pos_transactions_detailed (
        ID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id BIGINT UNSIGNED,
        Category_Code VARCHAR(100), Unit_Code VARCHAR(100), sales_quantity DECIMAL(14,4), selling_price DECIMAL(14,4)
    ) ENGINE=InnoDB');
    $connection->query('CREATE TABLE tbl_pos_qr_orders (
        order_id VARCHAR(36), transaction_id BIGINT UNSIGNED, category_code VARCHAR(100), unit_code VARCHAR(100), status VARCHAR(20)
    ) ENGINE=InnoDB');
    $connection->query("INSERT INTO tbl_pos_transactions_detailed VALUES
        (1,100,'CAT','UNIT',2,100), (2,100,'CAT','UNIT',1,0), (3,100,'OTHER','UNIT',9,999)");
    $connection->begin_transaction();
    $snapshot = posOrderReadSnapshot($connection, '100', 'CAT', 'UNIT');
    snapshotMysqlCheck(count($snapshot) === 2 && $snapshot[0]['databaseID'] === '1', 'mysqli snapshot must bind and isolate branch scope.');
    posOrderAssertCurrentSnapshot($connection, '100', 'CAT', 'UNIT', $snapshot);
    snapshotMysqlCheck(true, 'The exact mysqli snapshot passes.');
    $connection->query("INSERT INTO tbl_pos_transactions_detailed VALUES (4,100,'CAT','UNIT',1,0)");
    try {
        posOrderAssertCurrentSnapshot($connection, '100', 'CAT', 'UNIT', $snapshot);
        throw new RuntimeException('A stale mysqli cart was accepted.');
    } catch (InvalidArgumentException $error) {
        snapshotMysqlCheck($error->getCode() === 409, 'An appended free item must cause conflict.');
    }
    $connection->query("INSERT INTO tbl_pos_qr_orders VALUES ('QR-1',100,'CAT','UNIT','accepted')");
    try {
        posOrderAssertCurrentSnapshot($connection, '100', 'CAT', 'UNIT', null);
        throw new RuntimeException('Legacy overwrite of QR rows was allowed.');
    } catch (InvalidArgumentException $error) {
        snapshotMysqlCheck($error->getCode() === 409, 'Missing original rows must fail on an accepted QR transaction.');
    }
    snapshotMysqlCheck(!posOrderHasAcceptedQrBatch($connection, '100', 'OTHER', 'UNIT'), 'Accepted batches must remain scoped.');
    $connection->rollback();
    $connection->query('DROP TABLE tbl_pos_qr_orders');
    snapshotMysqlCheck(!posOrderHasAcceptedQrBatch($connection, '100', 'CAT', 'UNIT'), 'An absent optional QR table retains older-install compatibility.');
    snapshotEndpointChecks($connection, $database);
    echo "MySQL order snapshot checks passed: {$checks}\n";
} finally {
    $connection->rollback();
    $connection->query("DROP DATABASE IF EXISTS `$database`");
    $connection->close();
}
