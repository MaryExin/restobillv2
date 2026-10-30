<?php

declare(strict_types=1);

// Execute real endpoint control flow with entirely fake PDO/mysqli boundaries.
// No application configuration, credentials or live database is loaded.
final class CancelledEndpointState
{
    public static array $state = [];
    public static int $writes = 0;
    public static int $rollbacks = 0;
    public static bool $active = false;

    public static function read(string $sql, array $params): array
    {
        if (!preg_match('/^\s*SELECT\b/i', $sql)) {
            self::$writes++;
            throw new RuntimeException('Fixture blocked a write.');
        }
        if (str_contains($sql, 'tbl_pos_settings')) return [['value' => 0]];
        if (!preg_match('/\bFROM\s+tbl_pos_transactions\b/i', $sql)) {
            throw new RuntimeException('Unexpected fixture query: ' . $sql);
        }
        $id = (string)(reset($params) ?: '1000000010');
        $header = self::$state[$id] ?? null;
        if ($header === null) return [];
        // Project only selected header columns so missing SELECT fields are
        // observable in these tests, just as they would be against MySQL.
        preg_match('/SELECT\s+(.*?)\s+FROM/is', $sql, $match);
        if (trim($match[1] ?? '') !== '*') {
            $columns = array_map(static fn($name) => trim($name, " \n\r\t`"), explode(',', $match[1] ?? ''));
            $header = array_intersect_key($header, array_flip($columns));
        }
        return [$header];
    }
}

final class CancelledEndpointPdoStatement extends PDOStatement
{
    private string $sql;
    private array $rows = [];
    public function __construct(string $sql) { $this->sql = $sql; }
    public function execute(?array $params = null): bool { $this->rows = CancelledEndpointState::read($this->sql, $params ?? []); return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed { return array_shift($this->rows) ?? false; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { return $this->rows; }
    public function fetchColumn(int $column = 0): mixed { return array_values($this->rows[0] ?? [])[$column] ?? false; }
}
final class CancelledEndpointPdo extends PDO
{
    public function __construct(...$ignored) {}
    public function prepare(string $query, array $options = []): PDOStatement|false { return new CancelledEndpointPdoStatement($query); }
    public function beginTransaction(): bool { CancelledEndpointState::$active = true; return true; }
    public function inTransaction(): bool { return CancelledEndpointState::$active; }
    public function rollBack(): bool { CancelledEndpointState::$rollbacks++; CancelledEndpointState::$active = false; return true; }
}
final class CancelledEndpointMysqliResult
{
    public function __construct(private array $rows) {}
    public function fetch_assoc(): ?array { return array_shift($this->rows); }
    public function free(): void {}
}
final class CancelledEndpointMysqliStatement
{
    private array $params = [];
    private array $rows = [];
    public function __construct(private string $sql) {}
    public function bind_param(string $types, &...$params): bool { $this->params = $params; return true; }
    public function execute(): bool { $this->rows = CancelledEndpointState::read($this->sql, $this->params); return true; }
    public function get_result(): CancelledEndpointMysqliResult { return new CancelledEndpointMysqliResult($this->rows); }
    public function close(): void {}
}
final class CancelledEndpointMysqli
{
    public string $connect_error = '';
    public string $error = '';
    public function __construct(...$ignored) {}
    public function set_charset(string $charset): bool { return true; }
    public function query(string $sql): CancelledEndpointMysqliResult
    {
        if (!str_starts_with($sql, 'SHOW COLUMNS')) throw new RuntimeException('Unexpected schema query.');
        return new CancelledEndpointMysqliResult([]);
    }
    public function prepare(string $sql): CancelledEndpointMysqliStatement { return new CancelledEndpointMysqliStatement($sql); }
    public function begin_transaction(): bool { CancelledEndpointState::$active = true; return true; }
    public function rollback(): bool { CancelledEndpointState::$rollbacks++; CancelledEndpointState::$active = false; return true; }
    public function close(): void {}
}

if (getenv('CANCELLED_BILL_ENDPOINT_CHILD') === '1') {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    CancelledEndpointState::$state = json_decode(getenv('CANCELLED_BILL_ENDPOINT_STATE'), true, 512, JSON_THROW_ON_ERROR);
    $_POST = json_decode(getenv('CANCELLED_BILL_ENDPOINT_BODY'), true, 512, JSON_THROW_ON_ERROR);
    register_shutdown_function(static function (): void {
        fwrite(STDERR, json_encode(['status' => http_response_code(), 'writes' => CancelledEndpointState::$writes,
            'rollbacks' => CancelledEndpointState::$rollbacks, 'active' => CancelledEndpointState::$active], JSON_THROW_ON_ERROR));
    });
    return;
}

$checks = 0;
function checkCancelledEndpoint(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
$fixture = sys_get_temp_dir() . '/pos-cancelled-endpoints-' . bin2hex(random_bytes(6));
mkdir($fixture, 0700);
try {
    $endpoints = ['billing.php', 'pos_payment_post_transaction.php', 'update_order.php', 'transfer_product.php',
        'pos_payment_mark_as_paid.php', 'pos_payment_void.php', 'pos_payment_refund.php',
        'pos_save_discount_per_product.php', 'pos_save_transaction_charges.php', 'pos_discount_customer_info.php'];
    foreach ($endpoints as $endpoint) {
        $source = file_get_contents(__DIR__ . '/../api/' . $endpoint);
        $source = preg_replace('/\A<\?php/', '<?php require_once ' . var_export(__FILE__, true) . ';', $source, 1);
        $source = str_replace(['file_get_contents("php://input")', 'new PDO(', 'new mysqli('],
            ['file_get_contents("php://stdin")', 'new CancelledEndpointPdo(', 'new CancelledEndpointMysqli('], $source);
        foreach (['PosCurrentBillItems', 'PosOrderItemInstructions', 'PosBillingCharges'] as $helper) {
            $source = str_replace('require_once __DIR__ . "/../src/' . $helper . '.php";',
                'require_once ' . var_export(__DIR__ . '/../src/' . $helper . '.php', true) . ';', $source);
        }
        file_put_contents($fixture . '/' . $endpoint, $source);
    }
    $loadFixture = 'require_once ' . var_export(__FILE__, true) . ';';
    file_put_contents($fixture . '/cors.php', '<?php ' . $loadFixture);
    file_put_contents($fixture . '/bootstrap.php', '<?php ' . $loadFixture);
    file_put_contents($fixture . '/config.php', '<?php return ' . var_export([
        'host' => 'fixture-only', 'db' => 'fixture-only', 'charset' => 'utf8mb4', 'user' => '', 'pass' => '',
    ], true) . ';');
    file_put_contents($fixture . '/pdo.php', '<?php ' . $loadFixture . ' $pdo = new CancelledEndpointPdo();');
    file_put_contents($fixture . '/pos_report_mirror.php', '<?php function mirrorPosTransactionToReport(...$args) { throw new RuntimeException("Unexpected mirror call"); }');
    // Authorization is not under test; isolate it as an already-approved
    // fixture session, without loading developer tokens or credentials.
    file_put_contents($fixture . '/pos_developer_auth.php', '<?php function posDeveloperRequestTokenData() { return []; } function posDeveloperFullAccessTokenIsValid($token) { return true; }');

    $baseHeader = ['transaction_id' => '1000000010', 'Category_Code' => 'CAT', 'Unit_Code' => 'UNIT',
        'Project_Code' => '', 'transaction_date' => '2026-10-27', 'billing_no' => 0, 'invoice_no' => 0,
        'status' => 'Active', 'remarks' => 'Pending for Payment', 'order_status' => 'Pending',
        'void_id' => 0, 'refund_id' => 0, 'order_slip_no' => 2000000010, 'cashier' => 'Fixture'];
    $unsplitHeader = array_replace($baseHeader, ['status' => 'Unsplit', 'remarks' => 'Unsplit', 'order_status' => 'Cancelled']);
    $body = ['transaction_id' => '1000000010', 'category_code' => 'CAT', 'unit_code' => 'UNIT',
        'Category_Code' => 'CAT', 'Unit_Code' => 'UNIT', 'TotalSales' => 100, 'TotalAmountDue' => 100,
        'payment_amount' => 100, 'printTitle' => 'BILLING', 'transStatus' => 'Pending for Payment',
        'source_transaction_id' => '1000000010', 'destination_transaction_id' => '1000000011',
        'cart_items' => json_encode([['product_id' => 'PRODUCT', 'sales_quantity' => 1, 'selling_price' => 100]]),
        'source_items' => json_encode([['product_id' => 'PRODUCT', 'sales_quantity' => 1, 'selling_price' => 100]]),
        'destination_items' => json_encode([['product_id' => 'PRODUCT', 'sales_quantity' => 1, 'selling_price' => 100]])];

    $run = static function (string $endpoint, array $state, array $input) use ($fixture): array {
        $process = proc_open([PHP_BINARY, $fixture . '/' . $endpoint],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, [
                'CANCELLED_BILL_ENDPOINT_CHILD' => '1', 'CANCELLED_BILL_ENDPOINT_STATE' => json_encode($state),
                'CANCELLED_BILL_ENDPOINT_BODY' => json_encode($input),
            ]);
        fwrite($pipes[0], json_encode($input)); fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]); $snapshot = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        checkCancelledEndpoint(proc_close($process) === 0, 'Endpoint fixture failed: ' . $output . $snapshot);
        try {
            return [json_decode($output, true, 512, JSON_THROW_ON_ERROR), json_decode($snapshot, true, 512, JSON_THROW_ON_ERROR)];
        } catch (JsonException $error) {
            throw new RuntimeException($endpoint . ' returned invalid fixture JSON: ' . $output . $snapshot, 0, $error);
        }
    };

    foreach ($endpoints as $endpoint) {
        $input = $body;
        if (!in_array($endpoint, ['update_order.php', 'transfer_product.php'], true)) unset($input['cart_items']);
        [$response, $saved] = $run($endpoint, ['1000000010' => $unsplitHeader, '1000000011' => $baseHeader], $input);
        checkCancelledEndpoint(str_contains($response['message'] ?? '', 'unsplit'), $endpoint . ' must reject the cancelled split header with a useful message.');
        checkCancelledEndpoint($saved['writes'] === 0, $endpoint . ' must not touch headers, items, payments or document counters.');
        checkCancelledEndpoint($saved['rollbacks'] === 1 && $saved['active'] === false, $endpoint . ' must release its transaction lock.');
        checkCancelledEndpoint($saved['status'] === (in_array($endpoint, ['pos_payment_mark_as_paid.php', 'pos_payment_void.php', 'pos_payment_refund.php'], true) ? 409 : 500), $endpoint . ' must preserve its response convention.');
    }
    [$response, $saved] = $run('transfer_product.php', ['1000000010' => $baseHeader, '1000000011' => $unsplitHeader], $body);
    checkCancelledEndpoint(str_contains($response['message'], 'unsplit') && $saved['writes'] === 0 && $saved['rollbacks'] === 1, 'Transfer must reject an unsplit destination as well as an unsplit source.');

    foreach ([
        ['pos_payment_mark_as_paid.php', ['remarks' => 'Paid'], 'already marked as paid'],
        ['pos_payment_void.php', ['status' => 'Voided', 'void_id' => 8000000001], 'already voided'],
        ['pos_payment_refund.php', ['status' => 'Refunded', 'refund_id' => 9000000001], 'already refunded'],
    ] as [$endpoint, $fields, $expected]) {
        [$response, $saved] = $run($endpoint, ['1000000010' => array_replace($baseHeader, $fields)], $body);
        checkCancelledEndpoint(str_contains($response['message'] ?? '', $expected) && $saved['status'] === 409, 'Existing paid/reversal duplicate handling must remain unchanged.');
        checkCancelledEndpoint($saved['writes'] === 0 && $saved['rollbacks'] === 1, 'Duplicate handling must stay read-only and release locks.');
    }
    echo "Passed {$checks} cancelled-bill endpoint checks (isolated stubs; no live DB).\n";
} finally {
    foreach (glob($fixture . '/*') as $path) unlink($path);
    rmdir($fixture);
}
