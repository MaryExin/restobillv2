<?php

declare(strict_types=1);

// Isolated SQLite fixtures only. This test never reads application config,
// connects to the live POS, or invokes the production report mirror.
require_once __DIR__ . '/../src/PosSplitBill.php';

$checks = 0;
function checkSplit(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}

final class SplitBillFixture extends PDO
{
    public array $tables = [
        'tbl_pos_transactions', 'tbl_pos_transactions_detailed',
        'tbl_pos_document_counters', 'tbl_pos_transactions_payments',
        'tbl_pos_transactions_discounts', 'tbl_pos_transactions_discounts_per_product',
        'tbl_pos_transactions_other_charges', 'tbl_pos_transactions_customers',
        'tbl_main_activity_logs', 'tbl_main_transaction_logs',
        'tbl_inventory_products_masterlist',
    ];
    public array $auditUnitTypes = [];

    public function __construct(bool $instructions = true, bool $counter = true)
    {
        parent::__construct('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->sqliteCreateFunction('NOW', static fn() => '2026-10-27 16:00:00');
        $this->sqliteCreateFunction('CONCAT', static fn(...$values) => implode('', $values));
        $numeric = [
            'sales_quantity', 'selling_price', 'landing_cost', 'unit_cost',
            'TotalSales', 'Discount', 'OtherCharges', 'TotalAmountDue',
            'VATableSales', 'VATableSales_VAT', 'VATExemptSales', 'VATExemptSales_VAT',
            'VATZeroRatedSales', 'payment_amount', 'change_amount', 'short_over',
            'amount', 'discount_amount', 'vat_exemption', 'vat_exempt_amount',
            'next_transaction_id', 'next_order_slip_no', 'next_billing_no', 'next_invoice_no',
        ];
        foreach ($this->tables as $table) {
            $file = fopen(__DIR__ . '/../../database/' . $table . '.csv', 'r');
            $columns = fgetcsv($file);
            if (count($columns) === 1 && str_starts_with($columns[0], '<<<<<<<')) {
                $columns = fgetcsv($file);
            }
            fclose($file);
            $columns[0] = ltrim($columns[0], "\xEF\xBB\xBF");
            if ($table === 'tbl_pos_transactions_discounts') {
                $columns = array_merge($columns, ['Category_Code', 'Unit_Code', 'vat_exemption']);
            }
            if ($table === 'tbl_pos_transactions_detailed' && $instructions) $columns[] = 'item_instruction';
            $definitions = array_map(static function ($column) use ($numeric): string {
                if (strtolower($column) === 'id' || $column === 'seq') return '"' . $column . '" INTEGER PRIMARY KEY AUTOINCREMENT';
                return '"' . $column . '" ' . (in_array($column, $numeric, true) ? 'NUMERIC' : 'TEXT');
            }, array_unique($columns));
            if ($table === 'tbl_pos_document_counters') $definitions[] = 'UNIQUE(Category_Code, Unit_Code)';
            if ($table === 'tbl_pos_transactions') $definitions[] = 'UNIQUE(transaction_id, Category_Code, Unit_Code)';
            $this->exec('CREATE TABLE ' . $table . ' (' . implode(', ', $definitions) . ')');
        }
        // Columns from database/2026-07-09_tbl_pos_loyalty_discounts.sql.
        $this->exec('CREATE TABLE tbl_pos_loyalty_discounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT,
            Category_Code TEXT, Unit_Code TEXT, Project_Code TEXT, transaction_date TEXT,
            loyalty_member_id INTEGER, customer_name TEXT, phone_number TEXT,
            points_redeemed NUMERIC DEFAULT 0, points_earned NUMERIC DEFAULT 0,
            discount_amount NUMERIC DEFAULT 0, status TEXT DEFAULT "Active",
            usertracker TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
        $this->tables[] = 'tbl_pos_loyalty_discounts';

        $this->insert('tbl_pos_transactions', [
            'ID' => 1, 'transaction_id' => '1000000001',
            'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH', 'Project_Code' => null,
            'transaction_type' => 'PRODUCT', 'transaction_date' => '2026-10-20',
            'transaction_time' => '10:30 AM', 'terminal_number' => '1', 'purchase_order_no' => '0',
            'order_slip_no' => '2000000001', 'billing_no' => '3000000001', 'invoice_no' => '0',
            'table_number' => 'Table 01 & Table 02', 'order_type' => 'DINE IN',
            'customer_exclusive_id' => null, 'customer_head_count' => '3',
            'customer_count_for_discount' => '0', 'discount_type' => 'No Discount',
            'TotalSales' => 660, 'Discount' => 0, 'OtherCharges' => 50, 'TotalAmountDue' => 710,
            'VATableSales' => 500, 'VATableSales_VAT' => 60,
            'VATExemptSales' => 100, 'VATExemptSales_VAT' => 0, 'VATZeroRatedSales' => 0,
            'payment_amount' => 0, 'payment_method' => '', 'change_amount' => 0, 'short_over' => 0,
            'special_instructions' => 'Friends at the same table', 'cashier' => 'Fixture Cashier',
            'remarks' => 'Pending for Payment', 'order_status' => 'Pending', 'status' => 'Active',
            'void_id' => '0', 'void_remarks' => null, 'void_date' => null,
            'refund_id' => '0', 'refund_remarks' => null, 'refund_date' => null,
            'date_recorded' => '2026-10-20 10:30:00',
        ]);
        foreach ([
            [11, 'PIZZA', 3, 112, 'Yes', 'No onions 🍕'],
            [12, 'PIZZA', 1, 224, 'Yes', 'Extra cheese; half aloha'],
            [13, 'WATER', 2, 50, 'No', null],
        ] as [$id, $product, $quantity, $price, $vatable, $note]) {
            $detail = [
                'ID' => $id, 'transaction_id' => '1000000001', 'Category_Code' => 'RESTAURANT',
                'Unit_Code' => 'BRANCH', 'transaction_date' => '2026-10-20',
                'product_id' => $product, 'sku' => $product, 'sales_quantity' => $quantity,
                'landing_cost' => 10, 'unit_cost' => 20, 'selling_price' => $price,
                'vatable' => $vatable, 'isDiscountable' => 'Yes', 'order_status' => 'ACTIVE',
            ];
            if ($instructions) $detail['item_instruction'] = $note;
            $this->insert('tbl_pos_transactions_detailed', $detail);
        }
        foreach (['PIZZA' => 'Pizza', 'WATER' => 'Water'] as $product => $name) {
            $this->insert('tbl_inventory_products_masterlist', [
                'product_id' => $product, 'sku' => $product,
                'category_code' => 'RESTAURANT', 'unit_code' => 'BRANCH',
                'item_name' => $name, 'unit_of_measure' => 'Each',
            ]);
        }
        $this->insert('tbl_pos_transactions_other_charges', [
            'transaction_id' => '1000000001', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
            'Project_Code' => null, 'transaction_date' => '2026-10-20',
            'particulars' => 'Corkage', 'amount' => 50, 'reference' => 'AUTO',
        ]);
        if ($counter) $this->insert('tbl_pos_document_counters', [
            'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
            'next_transaction_id' => 1000000002, 'next_order_slip_no' => 2000000002,
            'next_billing_no' => 3000000002, 'next_invoice_no' => 4000000001,
        ]);
    }

    public function insert(string $table, array $row): void
    {
        $this->prepare('INSERT INTO ' . $table . ' (' . implode(', ', array_keys($row)) . ') VALUES ('
            . implode(', ', array_fill(0, count($row), '?')) . ')')->execute(array_values($row));
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        preg_match_all('/(?<!:):([A-Za-z_][A-Za-z0-9_]*)/', $query, $matches);
        if (count($matches[1]) !== count(array_unique($matches[1]))) {
            throw new RuntimeException('Repeated PDO named parameter in SQL: ' . $query);
        }
        // SQLite serializes these isolated fixtures; production retains locks.
        return parent::prepare(str_replace('FOR UPDATE', '', $query), $options);
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        if (preg_match('/SHOW COLUMNS FROM `?([A-Za-z0-9_]+)`?(?: WHERE `?Field`? = \'([^\']+)\')?/i', trim($query), $matches)) {
            $rows = parent::query('PRAGMA table_info(' . $matches[1] . ')')->fetchAll();
            $parts = [];
            foreach ($rows as $row) {
                if (isset($matches[2]) && $matches[2] !== $row['name']) continue;
                $columnType = $row['name'] === 'Unit_Code'
                    ? ($this->auditUnitTypes[$matches[1]] ?? $row['type']) : $row['type'];
                $parts[] = 'SELECT ' . $this->quote($row['name']) . ' AS Field, ' . $this->quote($columnType) . ' AS Type';
            }
            return parent::query($parts ? implode(' UNION ALL ', $parts) : 'SELECT NULL AS Field WHERE 0');
        }
        return parent::query($query, $fetchMode, ...$fetchModeArgs);
    }

    public function snapshot(): string
    {
        $state = [];
        foreach ($this->tables as $table) $state[$table] = $this->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll();
        return json_encode($state, JSON_THROW_ON_ERROR);
    }
}

function splitInput(SplitBillFixture $pdo, array $items = [['detail_id' => 11, 'quantity' => 1]]): array
{
    $preview = posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH');
    return [
        'transaction_id' => '1000000001', 'Category_Code' => 'RESTAURANT', 'Unit_Code' => 'BRANCH',
        'snapshot_token' => $preview['snapshot_token'], 'items' => $items,
        'user_id' => '42', 'user_name' => 'Fixture Cashier',
    ];
}

function expectSplitFailure(SplitBillFixture $pdo, array $input, ?callable $callback = null): void
{
    $before = $pdo->snapshot();
    try {
        posSplitBill($pdo, $input, $callback ?? static function (): void {});
    } catch (Throwable $error) {
        checkSplit($error->getMessage() !== '', 'A rejected split must explain the failure.');
        checkSplit($before === $pdo->snapshot(), 'A rejected split must leave all rows and counters unchanged: ' . $error->getMessage());
        checkSplit(!$pdo->inTransaction(), 'A rejected split must roll back its transaction.');
        return;
    }
    throw new RuntimeException('Invalid split was accepted: ' . json_encode($input));
}

// Other transaction tests reuse these isolated schema/fixture helpers without
// running this suite or loading its optional group adapter test double.
if (defined('POS_SPLIT_BILL_FIXTURES_ONLY') && POS_SPLIT_BILL_FIXTURES_ONLY) return;

$pdo = new SplitBillFixture();
$preview = posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH');
checkSplit($preview['status'] === 'success' && $preview['can_split'] === true, 'An unpaid active bill must be eligible.');
checkSplit(count($preview['items']) === 3 && is_array($preview['transaction']), 'Preview must include all distinct detail rows and the scoped header.');
checkSplit(is_string($preview['snapshot_token']) && $preview['snapshot_token'] !== '', 'Preview must supply a version token.');
$input = splitInput($pdo, [['detail_id' => 11, 'quantity' => 1], ['detail_id' => 12, 'quantity' => 1]]);
$chargesBefore = $pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll();
$callbackCalled = false;
$response = posSplitBill($pdo, $input, static function (array $source, array $created) use ($pdo, &$callbackCalled): void {
    $callbackCalled = true;
    checkSplit($pdo->inTransaction(), 'Report refresh must execute before commit.');
    checkSplit((string)$source['transaction_id'] === '1000000001', 'Report callback must receive the original bill.');
    checkSplit((int)$created['ID'] > 1 && (string)$created['transaction_id'] !== '1000000001', 'Report callback must receive the new physical header ID.');
    checkSplit((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 2, 'New header must exist before report refresh.');
});
checkSplit($response['status'] === 'success' && $callbackCalled, 'Successful split must refresh reports and return success.');
checkSplit(!$pdo->inTransaction(), 'Successful split must commit.');
$headers = $pdo->query('SELECT * FROM tbl_pos_transactions ORDER BY ID')->fetchAll();
[$original, $created] = $headers;
checkSplit(count($headers) === 2 && $created['transaction_id'] === '1000000002', 'Exactly one independently numbered bill must be created.');
checkSplit($created['order_slip_no'] === '2000000002' && (int)$created['billing_no'] === 0 && (int)$created['invoice_no'] === 0, 'New bill must have its own slip and await its own billing/receipt numbers.');
foreach (['Category_Code', 'Unit_Code', 'Project_Code', 'transaction_date', 'table_number', 'order_type', 'terminal_number'] as $field) {
    checkSplit($created[$field] === $original[$field], 'New bill must preserve the source ' . $field . '.');
}
checkSplit((float)$original['TotalSales'] === 324.0 && (float)$created['TotalSales'] === 336.0, 'Each bill must total only its own products.');
checkSplit((float)$original['TotalAmountDue'] === 374.0 && (float)$created['TotalAmountDue'] === 336.0, 'Saved charges must remain solely on the original bill.');
checkSplit($chargesBefore === $pdo->query('SELECT * FROM tbl_pos_transactions_other_charges')->fetchAll(), 'Split must not copy, drop or modify saved charge rows.');
checkSplit((float)$original['OtherCharges'] === 50.0 && (float)$created['OtherCharges'] === 0.0, 'Charge headers must match their child rows.');
$details = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed ORDER BY ID')->fetchAll();
checkSplit(count($details) === 4, 'A partial split creates one extra detail, while a whole row moves intact.');
checkSplit((float)$details[0]['sales_quantity'] === 2.0 && $details[0]['transaction_id'] === '1000000001', 'Original partial row must retain its identity and remaining quantity.');
checkSplit($details[1]['ID'] === 12 && $details[1]['transaction_id'] === '1000000002', 'Whole-row transfer must preserve its ID.');
checkSplit($details[1]['item_instruction'] === 'Extra cheese; half aloha' && (float)$details[1]['selling_price'] === 224.0, 'Duplicate product rows must preserve their own notes and prices.');
checkSplit($details[3]['item_instruction'] === 'No onions 🍕' && (float)$details[3]['selling_price'] === 112.0, 'Partial clones must preserve Unicode instructions and server price.');
checkSplit((float)$pdo->query('SELECT SUM(sales_quantity) FROM tbl_pos_transactions_detailed')->fetchColumn() === 6.0, 'Total item quantity must be conserved.');
checkSplit((float)$pdo->query('SELECT SUM(sales_quantity * selling_price) FROM tbl_pos_transactions_detailed')->fetchColumn() === 660.0, 'Total product value must be conserved.');
$counter = $pdo->query('SELECT * FROM tbl_pos_document_counters')->fetch();
checkSplit((int)$counter['next_transaction_id'] === 1000000003 && (int)$counter['next_order_slip_no'] === 2000000003, 'Exactly one transaction/slip counter pair must be consumed.');
checkSplit((int)$counter['next_billing_no'] === 3000000002 && (int)$counter['next_invoice_no'] === 4000000001, 'Splitting must not consume billing or invoice numbers.');
expectSplitFailure($pdo, $input); // Retrying an old request must not split twice.

foreach ([0, -1, 4, 0.00001, 'bad', null, true, [], INF, NAN] as $quantity) {
    $pdo = new SplitBillFixture();
    expectSplitFailure($pdo, splitInput($pdo, [['detail_id' => 11, 'quantity' => $quantity]]));
}
foreach ([
    [],
    [['detail_id' => 11, 'quantity' => 1], ['detail_id' => 11, 'quantity' => 1]],
    [['detail_id' => 999, 'quantity' => 1]],
    [['detail_id' => 11, 'quantity' => 3], ['detail_id' => 12, 'quantity' => 1], ['detail_id' => 13, 'quantity' => 2]],
] as $items) {
    $pdo = new SplitBillFixture();
    expectSplitFailure($pdo, splitInput($pdo, $items));
}
foreach (['Category_Code' => 'OTHER', 'Unit_Code' => 'OTHER', 'transaction_id' => '9999999999', 'snapshot_token' => 'invalid'] as $field => $value) {
    $pdo = new SplitBillFixture();
    expectSplitFailure($pdo, array_replace(splitInput($pdo), [$field => $value]));
}

foreach ([
    'UPDATE tbl_pos_transactions_detailed SET sales_quantity = 2 WHERE ID = 11',
    'UPDATE tbl_pos_transactions_detailed SET selling_price = 113 WHERE ID = 11',
    "UPDATE tbl_pos_transactions_detailed SET item_instruction = 'Changed note' WHERE ID = 11",
    'UPDATE tbl_pos_transactions_other_charges SET amount = 70',
] as $concurrentChange) {
    $pdo = new SplitBillFixture();
    $stale = splitInput($pdo);
    $pdo->exec($concurrentChange);
    expectSplitFailure($pdo, $stale);
}

foreach ([
    "UPDATE tbl_pos_transactions SET remarks = 'Paid'",
    "UPDATE tbl_pos_transactions SET status = 'Inactive'",
    "UPDATE tbl_pos_transactions SET status = 'Voided', void_id = '1'",
    "UPDATE tbl_pos_transactions SET status = 'Refunded', refund_id = '1'",
    "UPDATE tbl_pos_transactions SET invoice_no = '4000000001'",
    'UPDATE tbl_pos_transactions SET payment_amount = 20',
    'UPDATE tbl_pos_transactions SET Discount = 20',
    "INSERT INTO tbl_pos_transactions_payments(transaction_id, Category_Code, Unit_Code, payment_amount) VALUES ('1000000001','RESTAURANT','BRANCH',0)",
    "INSERT INTO tbl_pos_transactions_discounts(transaction_id, Category_Code, Unit_Code, status, discount_amount) VALUES ('1000000001','RESTAURANT','BRANCH','Active',20)",
    "INSERT INTO tbl_pos_transactions_discounts_per_product(transaction_id, category_code, unit_code, status, discount_amount) VALUES ('1000000001','RESTAURANT','BRANCH','Active',20)",
    "INSERT INTO tbl_pos_loyalty_discounts(transaction_id, Category_Code, Unit_Code, status, discount_amount) VALUES ('1000000001','RESTAURANT','BRANCH','Active',20)",
] as $blockingState) {
    $pdo = new SplitBillFixture();
    $pdo->exec($blockingState);
    $preview = posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH');
    checkSplit($preview['can_split'] === false && trim((string)$preview['reason']) !== '', 'Preview must explain why this bill cannot be split: ' . $blockingState);
    expectSplitFailure($pdo, splitInput($pdo));
}

$pdo = new SplitBillFixture();
$pdo->exec("INSERT INTO tbl_pos_transactions_discounts(transaction_id, Category_Code, Unit_Code, status, discount_amount) VALUES ('1000000001','RESTAURANT','BRANCH','Inactive',20)");
checkSplit(posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH')['can_split'] === true, 'Inactive discounts must not prevent splitting.');
expectSplitFailure($pdo, splitInput($pdo), static function (): void { throw new RuntimeException('Simulated report failure'); });
checkSplit((int)$pdo->query('SELECT next_transaction_id FROM tbl_pos_document_counters')->fetchColumn() === 1000000002, 'A report failure must restore counter values.');

foreach ([false, true] as $instructions) {
    $pdo = new SplitBillFixture($instructions);
    posSplitBill($pdo, splitInput($pdo, [['detail_id' => 13, 'quantity' => 0.5]]), static function (): void {});
    checkSplit((float)$pdo->query('SELECT sales_quantity FROM tbl_pos_transactions_detailed WHERE ID = 13')->fetchColumn() === 1.5, 'Fractional quantities must split accurately with or without instruction migration.');
    checkSplit((float)$pdo->query('SELECT SUM(sales_quantity) FROM tbl_pos_transactions_detailed')->fetchColumn() === 6.0, 'Fractional split must conserve quantity.');
}

// A branch with a missing or stale counter must never reuse an existing bill.
foreach (['missing', 'stale'] as $counterState) {
    $pdo = new SplitBillFixture(true, $counterState !== 'missing');
    if ($counterState === 'stale') $pdo->exec('UPDATE tbl_pos_document_counters SET next_transaction_id = 1, next_order_slip_no = 1');
    posSplitBill($pdo, splitInput($pdo), static function (): void {});
    $created = $pdo->query('SELECT * FROM tbl_pos_transactions ORDER BY ID DESC LIMIT 1')->fetch();
    checkSplit($created['transaction_id'] === '1000000002' && $created['order_slip_no'] === '2000000002', 'Missing/stale counters must allocate beyond persisted transaction and slip IDs.');
    checkSplit((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_document_counters')->fetchColumn() === 1, 'Counter initialization must leave exactly one scoped counter row.');
}

$pdo = new SplitBillFixture();
$pdo->exec("INSERT INTO tbl_pos_transactions_payments(transaction_id, Category_Code, Unit_Code, payment_amount) VALUES ('1000000001','RESTAURANT','OTHER',50)");
$pdo->exec("INSERT INTO tbl_pos_transactions_discounts(transaction_id, Category_Code, Unit_Code, status, discount_amount) VALUES ('1000000001','RESTAURANT','OTHER','Active',20)");
$pdo->exec("INSERT INTO tbl_pos_transactions_discounts_per_product(transaction_id, category_code, unit_code, status, discount_amount) VALUES ('1000000001','OTHER','BRANCH','Active',20)");
checkSplit(posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH')['can_split'] === true, 'Other branches/categories must not affect eligibility.');
$foreign = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 11')->fetch();
$foreign['ID'] = 99;
$foreign['Unit_Code'] = 'OTHER';
$pdo->insert('tbl_pos_transactions_detailed', $foreign);
expectSplitFailure($pdo, splitInput($pdo, [['detail_id' => 99, 'quantity' => 1]]));
posSplitBill($pdo, splitInput($pdo), static function (): void {});
checkSplit($foreign === $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 99')->fetch(), 'A successful split must leave foreign detail rows untouched.');
checkSplit((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions_payments')->fetchColumn() === 1, 'A successful split must leave foreign payments untouched.');

$pdo = new SplitBillFixture();
$pdo->exec("CREATE TRIGGER reject_split_audit BEFORE INSERT ON tbl_main_activity_logs BEGIN SELECT RAISE(ABORT, 'Simulated audit failure'); END");
expectSplitFailure($pdo, splitInput($pdo));

foreach (['transaction_id', 'Category_Code', 'Unit_Code'] as $field) {
    $pdo = new SplitBillFixture();
    $input = splitInput($pdo);
    $input[$field] = [];
    expectSplitFailure($pdo, $input);
}

// Install the optional adapter only after the ordinary deployment tests above.
// This fixture models its public annotateLines contract without depending on
// a live terminal's independently installed product-group feature or database.
checkSplit(!class_exists('PosOrderProductGroups', false), 'Ordinary splits must work without the optional group helper loaded.');
if (!class_exists('PosOrderProductGroups', false)) {
    final class PosOrderProductGroups
    {
        public static array $selectionByDetailId = [];
        public static array $inspectedIds = [];

        public function __construct(private PDO $connection) {}

        public function annotateLines(array $items): array
        {
            checkSplit($this->connection->inTransaction(), 'Group metadata must be checked while the split header/detail locks are held.');
            self::$inspectedIds = array_map(static fn(array $item): int => (int)$item['ID'], $items);
            foreach ($items as &$item) {
                if (array_key_exists((int)$item['ID'], self::$selectionByDetailId)) {
                    $item['group_selection'] = self::$selectionByDetailId[(int)$item['ID']];
                }
            }
            unset($item);
            return $items;
        }
    }
}

$pdo = new SplitBillFixture();
PosOrderProductGroups::$selectionByDetailId = [11 => ['selection_id' => 'pizza-combo']];
$beforeGroupPreview = $pdo->snapshot();
$preview = posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH');
checkSplit($preview['status'] === 'success' && $preview['can_split'] === false, 'A grouped bill must return a normal, blocked preview.');
checkSplit(str_contains($preview['reason'], 'product group') && str_contains($preview['reason'], 'split billing'), 'Grouped preview must explain why splitting is blocked.');
checkSplit($beforeGroupPreview === $pdo->snapshot(), 'Inspecting grouped products must not alter order metadata or detail rows.');
expectSplitFailure($pdo, splitInput($pdo, [['detail_id' => 13, 'quantity' => 1]]));

$pdo = new SplitBillFixture();
PosOrderProductGroups::$selectionByDetailId = [];
$plainInput = splitInput($pdo);
checkSplit(posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH')['can_split'] === true, 'The installed helper must leave plain bills eligible.');
posSplitBill($pdo, $plainInput, static function (): void {});
checkSplit((int)$pdo->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 2, 'Plain bills must still split when the optional helper is installed.');

$pdo = new SplitBillFixture();
PosOrderProductGroups::$selectionByDetailId = [99 => ['selection_id' => 'other-branch-combo']];
$foreign = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 11')->fetch();
$foreign['ID'] = 99;
$foreign['Unit_Code'] = 'OTHER';
$pdo->insert('tbl_pos_transactions_detailed', $foreign);
$preview = posSplitBillPreview($pdo, '1000000001', 'RESTAURANT', 'BRANCH');
checkSplit($preview['can_split'] === true && !in_array(99, PosOrderProductGroups::$inspectedIds, true), 'A grouped order sharing the transaction ID in another branch must not block this bill.');
posSplitBill($pdo, splitInput($pdo), static function (): void {});
checkSplit($foreign === $pdo->query('SELECT * FROM tbl_pos_transactions_detailed WHERE ID = 99')->fetch(), 'Splitting the plain bill must preserve the foreign grouped detail.');

$pdo = new SplitBillFixture();
PosOrderProductGroups::$selectionByDetailId = [];
$beforeGroupWasAdded = splitInput($pdo);
PosOrderProductGroups::$selectionByDetailId = [11 => ['selection_id' => 'added-after-preview']];
expectSplitFailure($pdo, $beforeGroupWasAdded);

echo "Passed {$checks} split bill integration checks.\n";
