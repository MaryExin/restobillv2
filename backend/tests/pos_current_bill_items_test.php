<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosCurrentBillItems.php';

// Isolated SQLite fixtures exercise the production guard without a live sale.
final class CurrentBillItemsPdo extends PDO
{
    public int $preparedQueries = 0;

    public function __construct()
    {
        parent::__construct('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $this->exec('CREATE TABLE tbl_pos_transactions_detailed (
            ID INTEGER PRIMARY KEY, transaction_id TEXT, Category_Code TEXT,
            Unit_Code TEXT, sales_quantity NUMERIC, selling_price NUMERIC)');
        $this->exec("INSERT INTO tbl_pos_transactions_detailed VALUES
            (1, 'SOURCE', 'CAT', 'UNIT', 3, 100),
            (2, 'SOURCE', 'CAT', 'UNIT', 1, 50),
            (3, 'SOURCE', 'OTHER', 'UNIT', 9, 999),
            (4, 'CHILD', 'CAT', 'UNIT', 2, 100),
            (5, 'FREE', 'CAT', 'UNIT', 2, 0)");
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedQueries++;
        return parent::prepare(str_replace('FOR UPDATE', '', $query), $options);
    }
}

$checks = 0;
function checkCurrentBill(bool $value, string $message): void
{
    global $checks;
    $checks++;
    if (!$value) throw new RuntimeException($message);
}
function rejectCurrentBill(callable $operation, string $message): void
{
    try { $operation(); }
    catch (InvalidArgumentException $error) { checkCurrentBill(true, $message); return; }
    throw new RuntimeException($message);
}

$pdo = new CurrentBillItemsPdo();
$source = ['transaction_id' => 'SOURCE', 'Category_Code' => 'CAT', 'Unit_Code' => 'UNIT'];
$cart = [
    ['databaseID' => 1, 'sales_quantity' => 3, 'selling_price' => 100],
    ['databaseID' => 2, 'sales_quantity' => 1, 'selling_price' => 50],
];
$pdo->beginTransaction();
posAssertCurrentBillItems($pdo, $source, 350, $cart);
posAssertCurrentBillItems($pdo, $source, 350);
checkCurrentBill(true, 'Current items and legacy totals must pass, excluding another branch.');

$priceChange = $cart;
$priceChange[0]['selling_price'] = 90;
posAssertCurrentBillItems($pdo, $source, 320, $priceChange, true);
checkCurrentBill(true, 'Billing can retain its existing price edit behavior.');
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 320, $priceChange), 'Payment cannot submit stale prices.');
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 350, [$cart[0], $cart[0]]), 'Duplicate detail IDs must fail.');

// The same product/price can appear in another row; detail identity is decisive.
$foreignCart = $cart;
$foreignCart[0]['databaseID'] = 4;
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 350, $foreignCart, true), 'A child bill detail must not be billed on its source.');

$pdo->exec("UPDATE tbl_pos_transactions_detailed SET sales_quantity = 1 WHERE ID = 1");
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 350, $cart, true), 'Partial split must reject an already-open billing form.');
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 350), 'Partial split must reject a legacy payment total.');
$updatedCart = $cart;
$updatedCart[0]['sales_quantity'] = 1;
posAssertCurrentBillItems($pdo, $source, 150, $updatedCart);
checkCurrentBill(true, 'Reloaded remaining items must be payable.');

$pdo->exec("UPDATE tbl_pos_transactions_detailed SET transaction_id = 'CHILD' WHERE ID = 2");
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 150, $updatedCart, true), 'Full-row split must reject old detail membership.');
posAssertCurrentBillItems($pdo, $source, 100, [$updatedCart[0]]);
checkCurrentBill(true, 'Reloaded source accepts exact current membership.');

$free = array_replace($source, ['transaction_id' => 'FREE']);
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $free, 0, [
    ['databaseID' => 5, 'sales_quantity' => 3, 'selling_price' => 0],
]), 'Quantity snapshot must detect free item movement with unchanged gross total.');
$badPrice = $updatedCart[0];
$badPrice['selling_price'] = INF;
rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $source, 100, [$badPrice], true), 'Nonfinite prices must fail.');
$pdo->rollBack();

// Header-only legacy transactions have no product sum to compare.
$pdo->beginTransaction();
posAssertCurrentBillItems($pdo, array_replace($source, ['transaction_id' => 'HEADER-ONLY']), 500);
checkCurrentBill(true, 'Legacy header-only transactions remain supported.');

// An unsplit child retains its header for the audit trail, but has no items.
// Both older clients without cart snapshots and newer clients must be blocked
// before that empty state can bypass the normal gross-total validation.
$cancelledChild = array_replace($source, [
    'transaction_id' => 'UNSPLIT-CHILD', 'status' => 'Unsplit',
    'order_status' => 'Cancelled', 'remarks' => 'Unsplit',
]);
foreach ([null, [], [['databaseID' => 4, 'sales_quantity' => 2, 'selling_price' => 100]]] as $staleCart) {
    $queriesBefore = $pdo->preparedQueries;
    rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $cancelledChild, 200, $staleCart, true), 'An unsplit child must never be billed from a stale screen.');
    checkCurrentBill($pdo->preparedQueries === $queriesBefore, 'Cancelled headers must fail before reading empty detail rows.');
}

// Billing currently supplies remarks; payment and order-edit callers can
// supply status too. Each field must independently detect cancellation.
foreach (['remarks', 'status', 'order_status'] as $field) {
    foreach (['Voided', 'VOID', ' Cancelled ', 'CANCELED', 'cancel', ' Unsplit '] as $state) {
        $header = array_replace($source, ['transaction_id' => 'HEADER-ONLY', $field => $state]);
        rejectCurrentBill(fn() => posAssertCurrentBillItems($pdo, $header, 0), 'Cancellation must be recognized from ' . $field . '.');
    }
}

foreach ([
    ['status' => 'Active', 'order_status' => 'Pending', 'remarks' => 'Pending for Payment'],
    ['status' => null, 'order_status' => null, 'remarks' => null],
    ['status' => 'Paid', 'order_status' => 'Completed', 'remarks' => 'Paid'],
] as $statuses) {
    posAssertCurrentBillItems($pdo, array_replace($source, ['transaction_id' => 'HEADER-ONLY'], $statuses), 500);
    checkCurrentBill(true, 'Keep active/header-only compatibility and leave paid idempotency to existing endpoint rules.');
}
$uncancelledWithRows = array_replace($source, ['status' => 'Active', 'remarks' => 'Pending for Payment']);
posAssertCurrentBillItems($pdo, $uncancelledWithRows, 350, $cart);
checkCurrentBill(true, 'Active bills with current item snapshots still pass.');
$pdo->rollBack();

foreach (['billing.php', 'pos_payment_post_transaction.php'] as $endpoint) {
    $code = file_get_contents(__DIR__ . '/../api/' . $endpoint);
    checkCurrentBill(strpos($code, 'posAssertCurrentBillItems(') > strpos($code, 'FOR UPDATE'), 'Endpoint must check items after taking the header lock.');
    $write = strpos($code, 'UPDATE tbl_pos_transactions', strpos($code, 'posAssertCurrentBillItems('));
    checkCurrentBill($write !== false, 'Endpoint must check items before changing financial totals.');
}

echo "Current bill item checks passed: {$checks}\n";
