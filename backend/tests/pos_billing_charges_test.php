<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosBillingCharges.php';

// Run real endpoints against SQLite fixtures only. No application config,
// network request or live database connection is loaded by this test.
final class BillingChargesTestPdo extends PDO
{
    public function __construct(...$ignored)
    {
        parent::__construct('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->sqliteCreateFunction('NOW', static fn() => '2030-01-01 12:00:00');
        $tables = [
            'tbl_pos_transactions', 'tbl_pos_transactions_other_charges', 'tbl_pos_settings',
            'tbl_pos_transactions_discounts', 'tbl_main_activity_logs', 'tbl_main_transaction_logs',
            'tbl_pos_transactions_detailed', 'tbl_inventory_products_masterlist',
        ];
        foreach ($tables as $table) {
            $file = fopen(__DIR__ . '/../../database/' . $table . '.csv', 'r');
            $columns = fgetcsv($file);
            // The existing catalog CSV starts with an unresolved merge marker;
            // its actual documented columns are the following header row.
            if (count($columns) === 1 && str_starts_with($columns[0], '<<<<<<<')) {
                $columns = fgetcsv($file);
            }
            fclose($file);
            $columns[0] = ltrim($columns[0], "\xEF\xBB\xBF");
            if ($table === 'tbl_pos_transactions_discounts') {
                $columns = array_unique(array_merge($columns, ['Category_Code', 'Unit_Code']));
            }
            $definitions = array_map(static fn($name) => '"' . $name . '" '
                . (strtolower($name) === 'id' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'TEXT'), $columns);
            $this->exec('CREATE TABLE ' . $table . ' (' . implode(', ', $definitions) . ')');
        }
        $state = json_decode(getenv('BILLING_CHARGES_TEST_STATE') ?: '{}', true);
        $transactions = $state['transactions'] ?? [[
            'transaction_id' => '1000000001', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
            'Project_Code' => 'PROJECT', 'transaction_date' => '2026-10-20', 'terminal_number' => '1',
            'billing_no' => '3000000001', 'invoice_no' => '0', 'cashier' => 'Fixture Cashier',
            'remarks' => 'Pending for Payment', 'TotalSales' => '4000', 'Discount' => '0',
            'OtherCharges' => '0', 'TotalAmountDue' => '4000',
        ]];
        foreach (['tbl_pos_transactions' => $transactions, 'tbl_pos_transactions_other_charges' => $state['charges'] ?? []] as $table => $rows) {
            foreach ($rows as $row) {
                $this->prepare('INSERT INTO ' . $table . ' (' . implode(', ', array_keys($row)) . ') VALUES ('
                    . implode(', ', array_fill(0, count($row), '?')) . ')')->execute(array_values($row));
            }
        }
        register_shutdown_function(function (): void {
            fwrite(STDERR, json_encode([
                'status' => http_response_code(),
                'transactions' => $this->query('SELECT * FROM tbl_pos_transactions ORDER BY ID')->fetchAll(),
                'charges' => $this->query('SELECT * FROM tbl_pos_transactions_other_charges ORDER BY ID')->fetchAll(),
                'logs' => (int)$this->query('SELECT COUNT(*) FROM tbl_main_activity_logs')->fetchColumn(),
                'in_transaction' => $this->inTransaction(),
            ], JSON_THROW_ON_ERROR));
        });
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        // SQLite serializes the isolated fixture. Production keeps its real
        // MySQL FOR UPDATE row lock; only that dialect syntax is removed here.
        return parent::prepare(str_replace('FOR UPDATE', '', $query), $options);
    }
}

if (getenv('BILLING_CHARGES_TEST_CHILD') === '1') {
    return;
}

$checks = 0;
function checkBillingCharges(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}

function expectBillingChargeError(callable $operation): void
{
    try { $operation(); }
    catch (InvalidArgumentException $error) { checkBillingCharges(true, $error->getMessage()); return; }
    throw new RuntimeException('Invalid charge input was accepted.');
}

$fixture = sys_get_temp_dir() . '/pos-billing-charges-' . bin2hex(random_bytes(6));
mkdir($fixture, 0700);
try {
    foreach (['billing.php', 'transaction_discount_items.php'] as $endpoint) {
        $source = file_get_contents(__DIR__ . '/../api/' . $endpoint);
        $source = str_replace([
            '<?php', 'file_get_contents("php://input")', 'new PDO(',
            'require_once __DIR__ . "/../src/PosBillingCharges.php";',
            'require_once __DIR__ . "/../src/PosCurrentBillItems.php";',
        ], [
            '<?php $_SERVER["REQUEST_METHOD"] = "POST";', 'file_get_contents("php://stdin")', 'new BillingChargesTestPdo(',
            'require_once ' . var_export(__DIR__ . '/../src/PosBillingCharges.php', true) . ';',
            'require_once ' . var_export(__DIR__ . '/../src/PosCurrentBillItems.php', true) . ';',
        ], $source);
        file_put_contents($fixture . '/' . $endpoint, $source);
    }
    file_put_contents($fixture . '/cors.php', '<?php');
    file_put_contents($fixture . '/config.php', '<?php require_once ' . var_export(__FILE__, true) . '; return '
        . var_export(['host' => 'fixture', 'db' => 'fixture', 'charset' => 'utf8mb4', 'user' => '', 'pass' => ''], true) . ';');
    file_put_contents($fixture . '/pdo.php', '<?php require_once ' . var_export(__FILE__, true) . '; $pdo = new BillingChargesTestPdo();');
    file_put_contents($fixture . '/pos_report_mirror.php', <<<'PHP'
<?php
function mirrorPosTransactionToReport(...$args) {
    if (getenv('BILLING_CHARGES_TEST_FAIL_MIRROR') === '1') {
        throw new RuntimeException('Fixture mirror failure');
    }
}
PHP
    );

    $run = static function (array $body, array $state = [], bool $failMirror = false, string $endpoint = 'billing.php') use ($fixture): array {
        $process = proc_open([PHP_BINARY, $fixture . '/' . $endpoint],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, [
                'BILLING_CHARGES_TEST_CHILD' => '1',
                'BILLING_CHARGES_TEST_STATE' => json_encode($state, JSON_THROW_ON_ERROR),
                'BILLING_CHARGES_TEST_FAIL_MIRROR' => $failMirror ? '1' : '0',
            ]);
        if (!is_resource($process)) throw new RuntimeException('Cannot start isolated endpoint fixture.');
        fwrite($pipes[0], json_encode($body, JSON_THROW_ON_ERROR));
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $snapshot = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        checkBillingCharges(proc_close($process) === 0, 'Endpoint fixture failed: ' . $output . $snapshot);
        return [json_decode($output, true, 512, JSON_THROW_ON_ERROR), json_decode($snapshot, true, 512, JSON_THROW_ON_ERROR)];
    };

    $base = [
        'transaction_id' => '1000000001', 'category_code' => 'RESTAURANT', 'unit_code' => 'BRANCH',
        'printTitle' => 'BILLING', 'transStatus' => 'Pending for Payment', 'cashier' => 'Fixture Cashier',
        'TotalSales' => 4000, 'Discount' => 0, 'OtherCharges' => 250, 'TotalAmountDue' => 4250,
        'billing_charges' => [['particulars' => 'Corkage', 'amount' => 250]],
    ];
    [$response, $saved] = $run($base);
    checkBillingCharges($response['status'] === 'success' && $response['billing_charges_saved'] === true, 'New clients must receive the persistence capability flag.');
    checkBillingCharges((float)$saved['transactions'][0]['TotalAmountDue'] === 4250.0, '4000 plus 250 corkage must save 4250.');
    checkBillingCharges((float)$saved['transactions'][0]['OtherCharges'] === 250.0, 'Header must include corkage.');
    checkBillingCharges(count($saved['charges']) === 1 && (float)$saved['charges'][0]['amount'] === 250.0, 'Existing other-charge table stores the fixed amount.');
    checkBillingCharges($saved['charges'][0]['reference'] === 'AUTO' && $saved['charges'][0]['particulars'] === 'Corkage', 'Billing-owned Corkage marker must round-trip.');
    checkBillingCharges($saved['charges'][0]['transaction_date'] === '2026-10-20' && $saved['charges'][0]['Project_Code'] === 'PROJECT', 'Charges use the selected transaction date/project, not the current calendar date.');
    checkBillingCharges($saved['in_transaction'] === false && $saved['logs'] === 1, 'Header, charge and log save commit together.');

    [$response, $repeated] = $run($base, $saved);
    checkBillingCharges(count($repeated['charges']) === 1, 'Re-saving cannot duplicate corkage.');
    [$response, $cleared] = $run(array_replace($base, [
        'billing_charges' => [['particulars' => 'Corkage', 'amount' => 0]], 'OtherCharges' => 0, 'TotalAmountDue' => 4000,
    ]), $saved);
    checkBillingCharges($response['status'] === 'success' && $cleared['charges'] === [], 'Explicit zero clears the old charge.');
    [$response, $cleared] = $run(array_replace($base, ['billing_charges' => [], 'OtherCharges' => 0, 'TotalAmountDue' => 4000]), $saved);
    checkBillingCharges($response['billing_charges_saved'] === true && $cleared['charges'] === [], 'Empty charge list clears AUTO charges.');

    $manual = array_replace($saved['charges'][0], ['ID' => 2, 'particulars' => 'Delivery', 'amount' => '50', 'reference' => 'CUSTOM']);
    $nullableManual = array_replace($manual, ['ID' => 3, 'particulars' => 'Other fee', 'amount' => '10', 'reference' => null]);
    $otherUnit = array_replace($saved['charges'][0], ['ID' => 4, 'Unit_Code' => 'OTHER-BRANCH']);
    $otherCategory = array_replace($saved['charges'][0], ['ID' => 5, 'Category_Code' => 'OTHER-RESTAURANT']);
    $otherTransaction = array_replace($saved['charges'][0], ['ID' => 6, 'transaction_id' => '1000000002']);
    $withManual = $saved;
    $withManual['charges'] = array_merge($saved['charges'], [$manual, $nullableManual, $otherUnit, $otherCategory, $otherTransaction]);
    [$response, $preserved] = $run(array_replace($base, ['OtherCharges' => 310, 'TotalAmountDue' => 4310]), $withManual);
    checkBillingCharges($response['status'] === 'success' && count($preserved['charges']) === 6, 'Manual and other scopes survive AUTO replacement.');
    foreach ([$manual, $nullableManual, $otherUnit, $otherCategory, $otherTransaction] as $expected) {
        checkBillingCharges(in_array($expected, $preserved['charges'], true), 'An unrelated/manual charge was changed.');
    }
    checkBillingCharges((float)$preserved['transactions'][0]['OtherCharges'] === 310.0, 'Header combines AUTO and all preserved manual charges.');

    [$response, $manualOnly] = $run(array_replace($base, [
        'billing_charges' => [], 'OtherCharges' => 60, 'TotalAmountDue' => 4060,
    ]), $withManual);
    checkBillingCharges($response['status'] === 'success' && count($manualOnly['charges']) === 5, 'Clearing billing charges preserves manual and other-scope rows.');
    checkBillingCharges((float)$manualOnly['transactions'][0]['OtherCharges'] === 60.0, 'Cleared corkage leaves only preserved manual amounts in the header.');

    [$response, $mismatch] = $run($base, $withManual);
    checkBillingCharges($response['status'] === 'error' && strpos($response['message'], 'OtherCharges') !== false, 'Omitting saved manual amounts must reject the request.');
    checkBillingCharges($mismatch['charges'] === $withManual['charges'] && $mismatch['transactions'] === $withManual['transactions'], 'A total mismatch must preserve every row and header.');

    [$response, $rollback] = $run(array_replace($base, ['OtherCharges' => 310, 'TotalAmountDue' => 4310]), $withManual, true);
    checkBillingCharges($response['status'] === 'error' && $response['message'] === 'Fixture mirror failure', 'Simulated downstream failure must fail billing.');
    checkBillingCharges($rollback['transactions'] === $withManual['transactions'] && $rollback['charges'] === $withManual['charges'], 'Late failure rolls back both updated header and replaced charges.');
    checkBillingCharges($rollback['logs'] === 0 && !$rollback['in_transaction'], 'Rollback also removes audit writes and closes the transaction.');

    $legacy = $base;
    unset($legacy['billing_charges']);
    [$response, $oldClient] = $run($legacy, $withManual);
    checkBillingCharges($response['status'] === 'success' && !array_key_exists('billing_charges_saved', $response), 'Old callers keep their response shape.');
    checkBillingCharges($oldClient['charges'] === $withManual['charges'], 'Omitting the optional field must not change existing detail charges.');

    foreach ([null, '250', [['particulars' => [], 'amount' => 250]], [['particulars' => ' ', 'amount' => 250]],
        [['particulars' => 'Corkage', 'amount' => -1]], [['particulars' => 'Corkage', 'amount' => null]],
        [['particulars' => 'Corkage', 'amount' => true]], [['particulars' => 'Corkage', 'amount' => 'invalid']],
        [['particulars' => 'Corkage', 'amount' => '1e500']], [null]] as $invalid) {
        [$response, $rejected] = $run(array_replace($base, ['billing_charges' => $invalid]), $saved);
        checkBillingCharges($response['status'] === 'error' && !isset($response['billing_charges_saved']), 'Invalid billing charges must reject.');
        checkBillingCharges($rejected['charges'] === $saved['charges'] && $rejected['transactions'] === $saved['transactions'], 'Invalid input cannot partly mutate billing.');
    }
    foreach ([NAN, INF, -INF, '', [], new stdClass()] as $invalid) {
        expectBillingChargeError(static fn() => posBillingChargeAmount($invalid));
    }
    checkBillingCharges(posNormalizeBillingCharges([['particulars' => ' Corkage ', 'amount' => '250.126']]) === [
        ['particulars' => 'Corkage', 'amount' => 250.13],
    ], 'Each amount rounds to cents and the name trims.');
    [$response, $rounded] = $run(array_replace($base, [
        'TotalSales' => 5000, 'Discount' => 1000,
        'billing_charges' => [['particulars' => ' Corkage ', 'amount' => '250.126']],
        'OtherCharges' => 250.13, 'TotalAmountDue' => 4250.13,
    ]));
    checkBillingCharges($response['status'] === 'success' && (float)$rounded['transactions'][0]['Discount'] === 1000.0, 'Adding corkage leaves the existing discount unchanged.');
    checkBillingCharges((float)$rounded['charges'][0]['amount'] === 250.13 && (float)$rounded['transactions'][0]['TotalAmountDue'] === 4250.13, 'Rounded corkage is added after the discounted 4000 amount.');

    [$response, $state] = $run([
        'transaction_id' => '1000000001', 'category_code' => 'RESTAURANT', 'unit_code' => 'BRANCH',
    ], $preserved, false, 'transaction_discount_items.php');
    checkBillingCharges($response['success'] === true && count($response['other_charge_rows']) === 3, 'Billing reopens all and only the selected scoped charge rows: ' . json_encode($response));
    checkBillingCharges(array_sum(array_map(static fn($row) => (float)$row['amount'], $response['other_charge_rows'])) === 310.0, 'Saved Corkage and manual charges round-trip together.');
    [$response] = $run(['transaction_id' => 'missing'], $preserved, false, 'transaction_discount_items.php');
    checkBillingCharges($response['success'] === false && $response['other_charge_rows'] === [], 'Error response keeps an empty charge-row array.');

    echo "Passed {$checks} billing charge checks (isolated endpoint/SQLite fixtures).\n";
} finally {
    foreach (glob($fixture . '/*') ?: [] as $file) unlink($file);
    rmdir($fixture);
}
