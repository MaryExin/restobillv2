<?php

declare(strict_types=1);

// No live config or report database: exercise the real split and undo core
// against the existing CSV-derived, isolated SQLite fixtures.
define('POS_SPLIT_BILL_FIXTURES_ONLY', true);
require_once __DIR__ . '/pos_split_bill_test.php';
require_once __DIR__ . '/../src/PosUnsplitBill.php';

$undoChecks = 0;
function checkUnsplit(bool $condition, string $message): void
{
    global $undoChecks;
    $undoChecks++;
    if (!$condition) throw new RuntimeException($message);
}

function undoFixture(): SplitBillFixture
{
    $pdo = new SplitBillFixture();
    posSplitBill($pdo, splitInput($pdo, [['detail_id' => 11, 'quantity' => 1], ['detail_id' => 12, 'quantity' => 1]]), static function (): void {});
    return $pdo;
}

function undoInput(SplitBillFixture $pdo, string $child = '1000000002'): array
{
    $preview = posUnsplitBillPreview($pdo, $child, 'RESTAURANT', 'BRANCH');
    return [
        'transaction_id' => $child, 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
        'snapshot_token' => $preview['snapshot_token'], 'user_id' => '42', 'user_name' => 'Fixture Cashier',
    ];
}

function expectUndoFailure(SplitBillFixture $pdo, array $input, ?callable $callback = null): void
{
    $before = $pdo->snapshot();
    try {
        posUnsplitBill($pdo, $input, $callback ?? static function (): void {});
    } catch (Throwable $error) {
        checkUnsplit($error->getMessage() !== '', 'Blocked undo must explain why.');
        checkUnsplit($before === $pdo->snapshot(), 'Blocked undo must preserve all records: ' . $error->getMessage());
        checkUnsplit(!$pdo->inTransaction(), 'Blocked undo must release its transaction.');
        return;
    }
    throw new RuntimeException('Unsafe undo was accepted.');
}

$pdo = undoFixture();
$preview = posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH');
checkUnsplit($preview['status'] === 'success' && $preview['can_unsplit'], 'A fresh split bill must be undoable.');
checkUnsplit($preview['transaction']['transaction_id'] === '1000000002' && $preview['source_transaction']['transaction_id'] === '1000000001', 'Preview must resolve the actual child and original.');
checkUnsplit(count($preview['items']) === 2 && $preview['items'][0]['item_name'] === 'Pizza', 'Preview must show the separate selected detail rows and product names.');
$beforeDetails = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed ORDER BY ID')->fetchAll();
$beforeCharges = $pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll();
$beforeCounter = $pdo->query('SELECT * FROM tbl_pos_document_counters')->fetchAll();
$input = undoInput($pdo);
$callbackCalled = false;
$result = posUnsplitBill($pdo, $input, static function (array $source, array $child) use ($pdo, &$callbackCalled): void {
    $callbackCalled = true;
    checkUnsplit($pdo->inTransaction(), 'Report changes must occur inside the undo transaction.');
    checkUnsplit($source['transaction_id'] === '1000000001' && $child['status'] === 'Unsplit', 'Report callback must receive updated source and discarded child.');
    checkUnsplit((int)$pdo->query("SELECT COUNT(*) FROM tbl_pos_transactions_detailed WHERE transaction_id = '1000000002'")->fetchColumn() === 0, 'Child must be empty before reports update.');
});
checkUnsplit($result['status'] === 'success' && $callbackCalled, 'Undo must commit and refresh reports.');
checkUnsplit($result['removed_transaction_id'] === '1000000002' && $result['source_transaction_id'] === '1000000001', 'Success identifiers must match the frontend contract.');
checkUnsplit((float)$result['source_transaction']['TotalSales'] === 660.0 && (float)$result['source_transaction']['TotalAmountDue'] === 710.0, 'Original bill must recover product value and retain its charges.');
checkUnsplit((float)$result['source_transaction']['VATableSales'] === 500.0 && (float)$result['source_transaction']['VATExemptSales'] === 100.0, 'Restored tax totals must use the current server detail rows.');
$child = $result['transaction'];
checkUnsplit($child['status'] === 'Unsplit' && $child['remarks'] === 'Unsplit' && $child['order_status'] === 'Cancelled', 'Discarded split must have a distinct non-void status.');
foreach (['TotalSales', 'Discount', 'OtherCharges', 'TotalAmountDue', 'VATableSales', 'VATableSales_VAT', 'VATExemptSales', 'VATExemptSales_VAT', 'VATZeroRatedSales', 'payment_amount'] as $field) {
    checkUnsplit((float)$child[$field] === 0.0, 'Discarded header must clear ' . $field . '.');
}
checkUnsplit((int)$child['invoice_no'] === 0 && (int)$child['void_id'] === 0 && (int)$child['refund_id'] === 0 && empty($child['void_date']), 'Undo must not manufacture a receipt or void/refund record.');
checkUnsplit($child['order_slip_no'] === '2000000002' && (int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 2, 'Both headers and their reserved slip numbers must remain.');
foreach ($beforeDetails as &$detail) $detail['transaction_id'] = '1000000001';
unset($detail);
checkUnsplit($beforeDetails === $pdo->query('SELECT * FROM tbl_pos_transactions_detailed ORDER BY ID')->fetchAll(), 'Undo must preserve every detail ID, quantity, price, optional instruction and duplicate product row.');
checkUnsplit($beforeCharges === $pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll(), 'Original charges must remain untouched.');
checkUnsplit($beforeCounter === $pdo->query('SELECT * FROM tbl_pos_document_counters')->fetchAll(), 'Undo must not allocate or rewind document counters.');
$audits = $pdo->query('SELECT * FROM tbl_main_activity_logs ORDER BY ID')->fetchAll();
checkUnsplit(count($audits) === 2 && $audits[0]['activity_performed'] === 'SPLIT BILL' && $audits[1]['activity_performed'] === 'UNSPLIT BILL', 'Original split audit must remain beside its reversal audit.');
checkUnsplit(strlen($audits[1]['values_of_data']) <= 255 && json_decode($audits[1]['values_of_data'], true)['split_activity_id'] === (string)$audits[0]['ID'], 'Compact undo audit must fit deployed VARCHAR(255) and reference original activity.');
checkUnsplit(posUnsplitBillLinks($audits) === [], 'An undone bill must not appear as an available link.');
checkUnsplit((int)$pdo->query("SELECT COUNT(*) FROM tbl_main_transaction_logs WHERE Trans_Type = 'UNSPLIT BILL'")->fetchColumn() === 1, 'Undo must append a transaction log.');
expectUndoFailure($pdo, $input);
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Repeated preview must explain that undo is unavailable.');

// Missing, ambiguous, malformed and cross-branch linkage cannot select a parent.
$pdo = new SplitBillFixture();
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Ordinary bills must not offer undo.');
$pdo = undoFixture();
$audit = $pdo->query('SELECT * FROM tbl_main_activity_logs')->fetch();
$duplicate = $audit;
unset($duplicate['ID']);
$pdo->insert('tbl_main_activity_logs', $duplicate);
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Duplicate source history must block undo even if identical.');
expectUndoFailure($pdo, undoInput($pdo));
$raw = [['ID' => 1, 'activity_performed' => 'SPLIT BILL', 'values_of_data' => '{broken']];
checkUnsplit(posUnsplitBillLinks($raw) === [], 'Malformed JSON cannot produce a link.');
foreach ([['source_transaction_id' => []], ['source_transaction_id' => '1000000002'], ['order_slip_no' => true], ['transaction_id' => '01000000002']] as $bad) {
    $data = array_merge(json_decode($audit['values_of_data'], true), $bad);
    checkUnsplit(posUnsplitBillLinks([array_replace($audit, ['values_of_data' => json_encode($data)])]) === [], 'Malformed/self-referencing IDs must not produce a link.');
}
$pdo = undoFixture();
$input = undoInput($pdo);
$legacyData = json_decode($pdo->query('SELECT values_of_data FROM tbl_main_activity_logs')->fetchColumn(), true);
unset($legacyData['Unit_Code']);
$pdo->prepare("UPDATE tbl_main_activity_logs SET Unit_Code = 'OTHER', values_of_data = ?")->execute([json_encode($legacyData)]);
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Other branch history must not link this child.');
expectUndoFailure($pdo, $input);
$pdo = undoFixture();
$input = undoInput($pdo);
$input['Unit_Code'] = 'OTHER';
expectUndoFailure($pdo, $input);

// Both bills are protected, including payments or a changed bill after preview.
foreach (['1000000001', '1000000002'] as $id) {
    foreach (["invoice_no = 4000000001", "remarks = 'Paid'", "status = 'Voided'", "refund_id = 1", "Discount = 5"] as $change) {
        $pdo = undoFixture();
        $pdo->exec("UPDATE tbl_pos_transactions SET {$change} WHERE transaction_id = '{$id}'");
        checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Unsafe original or child state must block preview: ' . $change);
        expectUndoFailure($pdo, undoInput($pdo));
    }
    $pdo = undoFixture();
    $pdo->insert('tbl_pos_transactions_payments', ['transaction_id' => $id, 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH', 'payment_amount' => 0]);
    expectUndoFailure($pdo, undoInput($pdo));
    $pdo = undoFixture();
    $input = undoInput($pdo);
    $pdo->exec("UPDATE tbl_pos_transactions_detailed SET item_instruction = 'Changed after preview' WHERE transaction_id = '{$id}'");
    expectUndoFailure($pdo, $input);
    $pdo = undoFixture();
    $pdo->exec("UPDATE tbl_pos_transactions_detailed SET transaction_date = '2026-10-21' WHERE transaction_id = '{$id}'");
    checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Detail dates must match their bill before undo.');
    expectUndoFailure($pdo, undoInput($pdo));
}
foreach (["transaction_date = '2026-10-21'", "order_slip_no = '2999999999'", "table_number = 'Different table'", "terminal_number = '2'", "order_type = 'TAKE OUT'", "OtherCharges = 1", "customer_exclusive_id = 'CUSTOMER'"] as $change) {
    $pdo = undoFixture();
    $pdo->exec("UPDATE tbl_pos_transactions SET {$change} WHERE transaction_id = '1000000002'");
    checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Changed child context or financial association must block undo: ' . $change);
    expectUndoFailure($pdo, undoInput($pdo));
}
foreach (['tbl_pos_transactions_other_charges', 'tbl_pos_transactions_customers', 'tbl_pos_transactions_discounts', 'tbl_pos_transactions_discounts_per_product', 'tbl_pos_loyalty_discounts'] as $table) {
    $pdo = undoFixture();
    $row = ['transaction_id' => '1000000002', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH'];
    if (str_contains($table, 'discount')) $row['status'] = 'Active';
    $pdo->insert($table, $row);
    expectUndoFailure($pdo, undoInput($pdo));
}

// Nested splits must be returned from the leaves; independent branches remain intact.
$pdo = undoFixture();
$nestedPreview = posSplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH');
posSplitBill($pdo, [
    'transaction_id' => '1000000002', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
    'snapshot_token' => $nestedPreview['snapshot_token'], 'items' => [['detail_id' => 12, 'quantity' => 0.5]],
], static function (): void {});
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Outstanding nested split must block parent undo.');
expectUndoFailure($pdo, undoInput($pdo));
$nestedAudit = $pdo->query('SELECT * FROM tbl_main_activity_logs ORDER BY ID DESC LIMIT 1')->fetch();
$nestedCopy = $nestedAudit;
unset($nestedCopy['ID']);
$pdo->insert('tbl_main_activity_logs', $nestedCopy);
$duplicateId = $pdo->lastInsertId();
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Ambiguous descendant history must block ancestor undo, not disappear.');
expectUndoFailure($pdo, undoInput($pdo));
$pdo->prepare('DELETE FROM tbl_main_activity_logs WHERE ID = ?')->execute([$duplicateId]);
$mismatchedUndo = $nestedCopy;
$mismatchedUndo['activity_performed'] = 'UNSPLIT BILL';
$mismatchedUndo['values_of_data'] = json_encode([
    'source_transaction_id' => '1000000002', 'transaction_id' => '1000000003', 'split_activity_id' => '99999',
]);
$pdo->insert('tbl_main_activity_logs', $mismatchedUndo);
$mismatchedId = $pdo->lastInsertId();
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'An undo record for a different split activity must not clear descendants.');
expectUndoFailure($pdo, undoInput($pdo));
$pdo->prepare('DELETE FROM tbl_main_activity_logs WHERE ID = ?')->execute([$mismatchedId]);
posUnsplitBill($pdo, undoInput($pdo, '1000000003'), static function (): void {});
checkUnsplit(posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Returning nested split must re-enable parent undo.');
$result = posUnsplitBill($pdo, undoInput($pdo), static function (): void {});
checkUnsplit((float)$result['source_transaction']['TotalAmountDue'] === 710.0, 'Nested undo sequence must conserve full original value.');

$pdo = undoFixture();
$foreign = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 12')->fetch();
$foreign['ID'] = 99;
$foreign['Unit_Code'] = 'OTHER';
$pdo->insert('tbl_pos_transactions_detailed', $foreign);
$pdo->insert('tbl_pos_transactions_payments', ['transaction_id' => '1000000002', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'OTHER', 'payment_amount' => 100]);
posUnsplitBill($pdo, undoInput($pdo), static function (): void {});
checkUnsplit($foreign === $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 99')->fetch(), 'Undo must not change same-ID bills in other branches.');

$pdo = undoFixture();
expectUndoFailure($pdo, undoInput($pdo), static function (): void { throw new RuntimeException('Simulated report mirror failure'); });
$pdo = undoFixture();
$pdo->exec("CREATE TRIGGER reject_undo_audit BEFORE INSERT ON tbl_main_activity_logs BEGIN SELECT RAISE(ABORT, 'Simulated audit failure'); END");
expectUndoFailure($pdo, undoInput($pdo));

// Large split selections must still create a parseable, compact parent link.
$pdo = new SplitBillFixture();
$items = [];
for ($id = 20; $id < 35; $id++) {
    $detail = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 11')->fetch();
    $detail['ID'] = $id;
    $detail['sales_quantity'] = 1;
    $pdo->insert('tbl_pos_transactions_detailed', $detail);
    $items[] = ['detail_id' => $id, 'quantity' => 1];
}
posSplitBill($pdo, splitInput($pdo, $items), static function (): void {});
$audit = $pdo->query('SELECT * FROM tbl_main_activity_logs')->fetch();
$data = json_decode($audit['values_of_data'], true);
checkUnsplit(strlen($audit['values_of_data']) <= 255 && $data['item_count'] === 15 && !isset($data['items']), 'Large selections must use compact audit JSON instead of truncation.');
checkUnsplit(isset(posUnsplitBillLinks([$audit])['1000000002']), 'Compact and legacy split audit formats must both resolve.');
posUnsplitBill($pdo, undoInput($pdo), static function (): void {});
checkUnsplit((int)$pdo->query("SELECT COUNT(*) FROM tbl_pos_transactions_detailed WHERE transaction_id = '1000000001'")->fetchColumn() === 18, 'Compact audit undo must return all current child rows.');

foreach (['transaction_id', 'Category_Code', 'Unit_Code', 'snapshot_token'] as $field) {
    $pdo = undoFixture();
    $input = undoInput($pdo);
    $input[$field] = [];
    expectUndoFailure($pdo, $input);
}

// Legacy numeric audit Unit_Code columns must not coerce every text branch to
// zero during reads, and writes retain the true branch in compact JSON.
function legacyUndoFixture(): SplitBillFixture
{
    $pdo = undoFixture();
    $data = json_decode($pdo->query('SELECT values_of_data FROM tbl_main_activity_logs')->fetchColumn(), true);
    unset($data['Unit_Code']);
    $pdo->prepare('UPDATE tbl_main_activity_logs SET Unit_Code = 0, values_of_data = ?')->execute([json_encode($data)]);
    return $pdo;
}

$pdo = new SplitBillFixture();
$pdo->auditUnitTypes = ['tbl_main_activity_logs' => 'int(11)', 'tbl_main_transaction_logs' => 'double'];
foreach (['tbl_main_activity_logs', 'tbl_main_transaction_logs'] as $table) {
    $pdo->exec("CREATE TRIGGER enforce_numeric_{$table} BEFORE INSERT ON {$table}
        WHEN NEW.Unit_Code <> '0' BEGIN SELECT RAISE(ABORT, 'Text written to numeric audit Unit_Code'); END");
}
posSplitBill($pdo, splitInput($pdo), static function (): void {});
$numericAudit = $pdo->query('SELECT * FROM tbl_main_activity_logs')->fetch();
$numericData = json_decode($numericAudit['values_of_data'], true);
checkUnsplit((string)$numericAudit['Unit_Code'] === '0' && $numericData['Unit_Code'] === 'BRANCH', 'Numeric audit storage must preserve the actual branch in JSON.');
checkUnsplit((string)$pdo->query('SELECT Unit_Code FROM tbl_main_transaction_logs')->fetchColumn() === '0', 'Numeric transaction-log storage must deliberately use zero.');
checkUnsplit(posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Explicit JSON scope must resolve numeric audit storage.');
posUnsplitBill($pdo, undoInput($pdo), static function (): void {});
$undoAudit = $pdo->query('SELECT * FROM tbl_main_activity_logs ORDER BY ID DESC LIMIT 1')->fetch();
checkUnsplit((string)$undoAudit['Unit_Code'] === '0' && json_decode($undoAudit['values_of_data'], true)['Unit_Code'] === 'BRANCH', 'Undo must preserve JSON scope in the same numeric schema.');
checkUnsplit(strlen($numericAudit['values_of_data']) <= 255 && strlen($undoAudit['values_of_data']) <= 255, 'Scoped split and undo records must fit the live audit field.');

$pdo = legacyUndoFixture();
$beforeLegacyPreview = $pdo->snapshot();
checkUnsplit(posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Unique legacy zero-unit history must recover using both header identities.');
checkUnsplit($beforeLegacyPreview === $pdo->snapshot(), 'Legacy scope recovery must be read-only.');
$legacyRows = $pdo->query('SELECT * FROM tbl_main_activity_logs')->fetchAll();
$headerRows = $pdo->query('SELECT * FROM tbl_pos_transactions')->fetchAll();
foreach ($headerRows as &$header) {
    $header['transaction_id'] = (float)$header['transaction_id'];
    $header['order_slip_no'] = (float)$header['order_slip_no'];
}
unset($header);
checkUnsplit(isset(posUnsplitBillLinks(posBillAuditScopeRows($legacyRows, $headerRows, 'RESTAURANT', 'BRANCH'))['1000000002']), 'Native DOUBLE header IDs must retain exact legacy linkage.');
posUnsplitBill($pdo, undoInput($pdo), static function (): void {});
$legacyUndo = json_decode($pdo->query('SELECT values_of_data FROM tbl_main_activity_logs ORDER BY ID DESC LIMIT 1')->fetchColumn(), true);
unset($legacyUndo['Unit_Code']);
$pdo->prepare("UPDATE tbl_main_activity_logs SET Unit_Code = 0, values_of_data = ? WHERE activity_performed = 'UNSPLIT BILL'")->execute([json_encode($legacyUndo)]);
checkUnsplit(posUnsplitBillLinks(posBillAuditReadRows($pdo, 'RESTAURANT', 'BRANCH')) === [], 'An exact legacy undo must continue to suppress its recovered split link.');

foreach (['1000000001', '1000000002'] as $collisionId) {
    foreach (['Unit_Code' => 'OTHER', 'Category_Code' => 'OTHER_CATEGORY'] as $column => $other) {
        $pdo = legacyUndoFixture();
        $collision = $pdo->query("SELECT * FROM tbl_pos_transactions WHERE transaction_id = '{$collisionId}'")->fetch();
        unset($collision['ID']);
        $collision[$column] = $other;
        $pdo->insert('tbl_pos_transactions', $collision);
        checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Legacy recovery must reject globally duplicated source or child IDs.');
        expectUndoFailure($pdo, undoInput($pdo));
    }
}
$pdo = legacyUndoFixture();
$pdo->exec("UPDATE tbl_pos_transactions SET order_slip_no = '2999999999' WHERE transaction_id = '1000000002'");
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Legacy recovery requires the original child slip number.');
expectUndoFailure($pdo, undoInput($pdo));

$pdo = undoFixture();
$rows = $pdo->query('SELECT * FROM tbl_main_activity_logs')->fetchAll();
$rows[0]['Unit_Code'] = '0';
checkUnsplit(count(posBillAuditScopeRows($rows, [], 'RESTAURANT', 'BRANCH')) === 1, 'Explicit JSON scope needs no legacy header inference.');
checkUnsplit(posBillAuditScopeRows($rows, [], 'RESTAURANT', 'OTHER') === [], 'Another text branch must never receive a zero-unit scoped record.');
$data = json_decode($rows[0]['values_of_data'], true);
$data['Unit_Code'] = 'OTHER';
$rows[0]['Unit_Code'] = 'BRANCH';
$rows[0]['values_of_data'] = json_encode($data);
checkUnsplit(posBillAuditScopeRows($rows, [], 'RESTAURANT', 'BRANCH') === [], 'Mismatched explicit JSON scope must override a matching storage field.');
$data['Unit_Code'] = [];
$rows[0]['values_of_data'] = json_encode($data);
checkUnsplit(posBillAuditScopeRows($rows, [], 'RESTAURANT', 'BRANCH') === [], 'Malformed explicit scope must not fall back to the storage field.');

$pdo = undoFixture();
$nestedPreview = posSplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH');
posSplitBill($pdo, [
    'transaction_id' => '1000000002', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
    'snapshot_token' => $nestedPreview['snapshot_token'], 'items' => [['detail_id' => 12, 'quantity' => 0.5]],
], static function (): void {});
$nestedId = $pdo->query('SELECT MAX(ID) FROM tbl_main_activity_logs')->fetchColumn();
$nestedData = json_decode($pdo->query('SELECT values_of_data FROM tbl_main_activity_logs ORDER BY ID DESC LIMIT 1')->fetchColumn(), true);
unset($nestedData['Unit_Code']);
$pdo->prepare('UPDATE tbl_main_activity_logs SET Unit_Code = 0, values_of_data = ? WHERE ID = ?')->execute([json_encode($nestedData), $nestedId]);
$collision = $pdo->query("SELECT * FROM tbl_pos_transactions WHERE transaction_id = '1000000002'")->fetch();
unset($collision['ID']);
$collision['Unit_Code'] = 'OTHER';
$pdo->insert('tbl_pos_transactions', $collision);
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Ambiguous legacy source IDs must remain a barrier to undoing their possible ancestor.');
expectUndoFailure($pdo, undoInput($pdo));

// Optional group metadata must block undo without changing its ownership.
if (!class_exists('PosOrderProductGroups', false)) {
    final class PosOrderProductGroups
    {
        public static array $groupedIds = [];
        public function __construct(private PDO $pdo) {}
        public function annotateLines(array $items): array
        {
            checkUnsplit($this->pdo->inTransaction(), 'Grouped metadata must be inspected under bill locks.');
            foreach ($items as &$item) {
                if (in_array((int)$item['ID'], self::$groupedIds, true)) $item['group_selection'] = [];
            }
            unset($item);
            return $items;
        }
    }
}
$pdo = undoFixture();
$input = undoInput($pdo);
PosOrderProductGroups::$groupedIds = [12];
checkUnsplit(!posUnsplitBillPreview($pdo, '1000000002', 'RESTAURANT', 'BRANCH')['can_unsplit'], 'Grouped child products must block undo.');
expectUndoFailure($pdo, $input);
PosOrderProductGroups::$groupedIds = [];
posUnsplitBill($pdo, undoInput($pdo), static function (): void {});

$endpoint = file_get_contents(__DIR__ . '/../api/unsplit_bill.php');
$childMirror = strpos($endpoint, 'mirrorPosTransactionToReport($pdo, $config, (string)$child');
$sourceMirror = strpos($endpoint, 'mirrorPosTransactionToReport($pdo, $config, (string)$source');
checkUnsplit($childMirror !== false && $sourceMirror > $childMirror, 'API must refresh child mirror before source mirror.');
checkUnsplit(!str_contains($endpoint, 'posSplitBillEnrollReport'), 'Undo must not enroll or renumber report transactions.');

echo "Passed {$undoChecks} unsplit bill integration checks.\n";
