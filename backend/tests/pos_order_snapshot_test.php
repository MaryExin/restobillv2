<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosOrderSnapshot.php';

final class OrderSnapshotPdo extends PDO
{
    public bool $missingQrTable = false;
    public bool $deniedQrTable = false;

    public function __construct()
    {
        parent::__construct('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $this->exec('CREATE TABLE tbl_pos_transactions_detailed (
            ID INTEGER PRIMARY KEY, transaction_id TEXT, Category_Code TEXT, Unit_Code TEXT,
            sales_quantity NUMERIC, selling_price NUMERIC)');
        $this->exec("INSERT INTO tbl_pos_transactions_detailed VALUES
            (1,'100','CAT','UNIT',2,100), (2,'100','CAT','UNIT',1,50),
            (3,'100','OTHER','UNIT',3,900), (4,'100','CAT','OTHER',4,800)");
        $this->exec('CREATE TABLE tbl_pos_qr_orders (order_id TEXT, transaction_id TEXT, category_code TEXT, unit_code TEXT, status TEXT)');
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        if (str_contains($query, 'tbl_pos_qr_orders') && ($this->missingQrTable || $this->deniedQrTable)) {
            $error = new PDOException($this->missingQrTable ? 'Missing table' : 'Access denied');
            $error->errorInfo = [$this->missingQrTable ? '42S02' : '42000', $this->missingQrTable ? 1146 : 1142];
            throw $error;
        }
        return parent::prepare(str_replace('FOR UPDATE', '', $query), $options);
    }
}

$checks = 0;
function snapshotCheck(bool $value, string $message): void
{
    global $checks;
    if (!$value) throw new RuntimeException($message);
    $checks++;
}
function snapshotReject(callable $operation, string $message): void
{
    try { $operation(); }
    catch (InvalidArgumentException $error) {
        snapshotCheck($error->getCode() === 409, 'Stale snapshot must return conflict.');
        snapshotCheck(str_contains($error->getMessage(), 'Reload'), $message);
        return;
    }
    throw new RuntimeException($message);
}

$pdo = new OrderSnapshotPdo();
$pdo->beginTransaction();
$original = posOrderReadSnapshot($pdo, '100', 'CAT', 'UNIT');
snapshotCheck(count($original) === 2, 'Read must exclude matching transaction IDs from other branches.');
snapshotCheck($original[0] === ['databaseID' => '1', 'sales_quantity' => 2.0, 'selling_price' => 100.0], 'Snapshot response uses frontend field names and stable numeric values.');
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', array_reverse($original));
snapshotCheck(true, 'Row order does not change membership.');
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', null);
snapshotCheck(true, 'Legacy clients can edit non-QR orders without a snapshot.');

// Same total is not enough: a free additional item must invalidate stale carts.
$pdo->exec("INSERT INTO tbl_pos_transactions_detailed VALUES (5,'100','CAT','UNIT',1,0)");
snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $original), 'Appended free QR items must not be deleted by an old cart.');
$current = posOrderReadSnapshot($pdo, '100', 'CAT', 'UNIT');
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $current);
snapshotCheck(true, 'Reloading the transaction permits editing its current rows.');
$pdo->exec("UPDATE tbl_pos_transactions_detailed SET sales_quantity=2 WHERE ID=5");
snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $current), 'Quantity-only changes to a free item must conflict.');
$current = posOrderReadSnapshot($pdo, '100', 'CAT', 'UNIT');
$pdo->exec('UPDATE tbl_pos_transactions_detailed SET selling_price=90 WHERE ID=1');
snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $current), 'A concurrent price change must conflict.');

$current = posOrderReadSnapshot($pdo, '100', 'CAT', 'UNIT');
$pdo->exec('UPDATE tbl_pos_transactions_detailed SET ID=6 WHERE ID=1');
snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $current), 'Replacing an identical line changes its identity.');
$saved = posOrderReadSnapshot($pdo, '100', 'CAT', 'UNIT');
snapshotCheck(in_array('6', array_column($saved, 'databaseID'), true) && !in_array('1', array_column($saved, 'databaseID'), true), 'Replacement responses must carry the newly inserted IDs.');
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $saved);
snapshotCheck(true, 'A subsequent save can use the returned snapshot.');

foreach ([[], [$saved[0], $saved[0]], [['databaseID' => 'bad', 'sales_quantity' => 1, 'selling_price' => 50]],
    [['databaseID' => 2, 'sales_quantity' => INF, 'selling_price' => 50]],
    [['databaseID' => 2, 'sales_quantity' => 1, 'selling_price' => null]], ['row' => $saved[0]]] as $bad) {
    snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $bad), 'Malformed or incomplete snapshots must conflict.');
}

$pdo->exec("INSERT INTO tbl_pos_qr_orders VALUES ('Q-OTHER','100','CAT','OTHER','accepted'),('Q-PENDING','100','CAT','UNIT','pending')");
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', null);
snapshotCheck(true, 'Other branches and pending batches must not block legacy updates.');
$pdo->exec("INSERT INTO tbl_pos_qr_orders VALUES ('Q-OWN','100','CAT','UNIT','accepted')");
snapshotReject(fn() => posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', null), 'Legacy carts cannot replace transactions containing accepted QR items.');
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', $saved);
snapshotCheck(true, 'A current snapshot allows edits even after accepted QR batches.');

$pdo->missingQrTable = true;
posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', null);
snapshotCheck(true, 'Older installations without the optional QR table remain compatible.');
$pdo->missingQrTable = false;
$pdo->deniedQrTable = true;
try { posOrderAssertCurrentSnapshot($pdo, '100', 'CAT', 'UNIT', null); throw new RuntimeException('Database access errors must not disable the guard.'); }
catch (PDOException $error) { snapshotCheck($error->errorInfo[1] === 1142, 'Permission failures must remain errors.'); }

snapshotCheck(posOrderPreserveRebillRemarks(['remarks' => 'Pending QR Rebill'], 'Pending for Payment') === 'Pending QR Rebill', 'Ordinary cart saves cannot clear the pending re-bill marker.');
snapshotCheck(posOrderPreserveRebillRemarks(['remarks' => ' pending qr rebill '], 'Paid') === 'Pending QR Rebill', 'Marker comparison is normalized.');
snapshotCheck(posOrderPreserveRebillRemarks(['remarks' => 'Pending'], 'Pending for Payment') === 'Pending for Payment', 'Ordinary order remarks remain backward compatible.');
$pdo->rollBack();

// Verify guard placement and additive contract at the actual endpoint boundary.
$endpoint = file_get_contents(__DIR__ . '/../api/update_order.php');
$guard = strpos($endpoint, 'posOrderAssertCurrentSnapshot(');
snapshotCheck($guard > strpos($endpoint, 'FOR UPDATE') && $guard < strpos($endpoint, 'DELETE FROM tbl_pos_transactions_detailed'), 'Endpoint must guard the locked original rows before replacing anything.');
snapshotCheck(strpos($endpoint, '$savedOriginalCartItems = posOrderReadSnapshot') < strpos($endpoint, '$conn->commit()'), 'Response snapshot must be read before releasing the transaction lock.');
snapshotCheck(str_contains($endpoint, '"original_cart_items" => $savedOriginalCartItems'), 'Endpoint returns the refreshed snapshot.');
snapshotCheck(strpos($endpoint, '->prepareItems(') > $guard && strpos($endpoint, '->clearOrder(') > $guard && str_contains($endpoint, '->storePart('), 'Optional installed product metadata is handled only after the guard.');

echo "Order snapshot checks passed: {$checks}\n";
