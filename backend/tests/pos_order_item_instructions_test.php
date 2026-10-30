<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/PosOrderItemInstructions.php';

// Isolated fixtures only: never load application config or open a live database.
$checks = 0;
function checkItemInstructions(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expectInstructionError(callable $operation, string $message): void
{
    try {
        $operation();
    } catch (Throwable $error) {
        checkItemInstructions(strpos($error->getMessage(), $message) !== false, 'Unexpected error: ' . $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected error containing: ' . $message);
}

class InstructionPdoFixture extends PDO
{
    public bool $hasColumn;

    public function __construct(bool $hasColumn)
    {
        parent::__construct('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $this->hasColumn = $hasColumn;
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        if (str_starts_with($query, 'SHOW COLUMNS')) {
            checkItemInstructions(strpos($query, "`Field` = 'item_instruction'") !== false, 'Column lookup must use an exact field match.');
            return parent::query("SELECT 'item_instruction' AS Field" . ($this->hasColumn ? '' : ' WHERE 0'));
        }
        return parent::query($query, $fetchMode, ...$fetchModeArgs);
    }
}

class InstructionMysqliFixture
{
    public bool $freed = false;
    private bool $hasColumn;
    public function __construct(bool $hasColumn) { $this->hasColumn = $hasColumn; }
    public function query(string $sql): self
    {
        checkItemInstructions(str_starts_with($sql, 'SHOW COLUMNS'), 'Detection must only read schema metadata.');
        return $this;
    }
    public function fetch_assoc(): ?array { return $this->hasColumn ? ['Field' => 'item_instruction'] : null; }
    public function free(): void { $this->freed = true; }
}

foreach ([false, true] as $hasColumn) {
    $pdo = new InstructionPdoFixture($hasColumn);
    checkItemInstructions(posOrderHasItemInstructionColumn($pdo) === $hasColumn, 'PDO schema compatibility detection failed.');
    $mysqli = new InstructionMysqliFixture($hasColumn);
    checkItemInstructions(posOrderHasItemInstructionColumn($mysqli) === $hasColumn, 'mysqli schema compatibility detection failed.');
    checkItemInstructions($mysqli->freed, 'Schema result must be released.');
}

checkItemInstructions(posOrderItemInstruction([]) === null, 'Missing notes must remain nullable.');
checkItemInstructions(posOrderItemInstruction(['item_instruction' => null]) === null, 'Null notes must remain nullable.');
checkItemInstructions(posOrderItemInstruction(['item_instruction' => '  ']) === '', 'Blank notes must normalize to empty.');
checkItemInstructions(posOrderItemInstruction(['item_instruction' => '0']) === '0', 'A zero note must not disappear.');
posOrderValidateItemInstructions([[], ['item_instruction' => null], ['item_instruction' => ' ']], false);
checkItemInstructions(true, 'Ordinary orders remain compatible before migration.');
expectInstructionError(fn() => posOrderValidateItemInstructions([['item_instruction' => 'Pair with ALOHA']], false), POS_ORDER_ITEM_INSTRUCTION_MIGRATION);
expectInstructionError(fn() => posOrderValidateItemInstructions([['item_instruction' => '0']], false), POS_ORDER_ITEM_INSTRUCTION_MIGRATION);
expectInstructionError(fn() => posOrderValidateItemInstructions([['item_instruction' => []]], true), 'must be text');
expectInstructionError(fn() => posOrderValidateItemInstructions([['item_instruction' => str_repeat('a', 65536)]], true), 'too long');
expectInstructionError(fn() => posOrderValidateItemInstructions([null], true), 'must be an object');
expectInstructionError(fn() => posOrderHasItemInstructionColumn(new class {
    public function query(string $sql): bool { return false; }
}), 'Could not check');

$baseValues = [1000000001, 'GRUMPYJOE', 'BRANCH', '2026-10-21', 'CHEESE-12-HALF', 'CHEESE-12-HALF', 1, 0, 120, 475, 'Yes', 'Yes', 'ACTIVE'];
foreach ([false, true] as $hasColumn) {
    foreach ([false, true] as $named) {
        $pdo = new InstructionPdoFixture($hasColumn);
        $pdo->exec('CREATE TABLE tbl_pos_transactions_detailed (
            transaction_id INTEGER, Category_Code TEXT, Unit_Code TEXT, transaction_date TEXT,
            product_id TEXT, sku TEXT, sales_quantity NUMERIC, landing_cost NUMERIC, unit_cost NUMERIC,
            selling_price NUMERIC, vatable TEXT, isDiscountable TEXT, order_status TEXT'
            . ($hasColumn ? ', item_instruction TEXT NULL' : '') . ')');
        $sql = posOrderDetailInsertSql($hasColumn, $named);
        preg_match_all('/:([a-zA-Z_]+)/', $sql, $matches);
        checkItemInstructions(count($matches[1]) === count(array_unique($matches[1])), 'Named insert placeholders cannot repeat.');
        checkItemInstructions(substr_count($sql, '?') === ($named ? 0 : ($hasColumn ? 14 : 13)), 'Positional bind count mismatch.');
        foreach ([null, '', '2 flavors: 5 CHEESE + ALOHA 12" / chef\'s choice 🍕'] as $note) {
            if (!$hasColumn && $note !== null && $note !== '') continue;
            $values = $baseValues;
            if ($hasColumn) $values[] = $note;
            $parameters = $named ? array_combine($matches[1], $values) : $values;
            $pdo->prepare($sql)->execute($parameters);
            $stored = $pdo->query('SELECT * FROM tbl_pos_transactions_detailed ORDER BY rowid DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
            checkItemInstructions($stored['product_id'] === 'CHEESE-12-HALF' && (float)$stored['selling_price'] === 475.0, 'Real half SKU and price must remain intact.');
            checkItemInstructions(!$hasColumn || $stored['item_instruction'] === $note, 'Notes must round-trip without changing quotes or Unicode.');
        }
    }
}

// Guard the integration order: an old database must reject notes before any
// transaction counters, header writes, or destructive detail replacements.
foreach (['save_order.php', 'update_order.php', 'transfer_product.php'] as $filename) {
    $source = file_get_contents(__DIR__ . '/../api/' . $filename);
    $validation = strpos($source, 'posOrderValidateItemInstructions(');
    $begin = strpos($source, $filename === 'save_order.php' ? '$pdo->beginTransaction();' : '$conn->begin_transaction()');
    checkItemInstructions($validation !== false && $begin !== false && $validation < $begin, $filename . ' must validate before starting writes.');
    checkItemInstructions(strpos($source, 'posOrderDetailInsertSql($hasItemInstruction') !== false, $filename . ' must use the compatible insert.');
    checkItemInstructions(strpos($source, 'posOrderItemInstruction($item)') !== false, $filename . ' must bind the note.');
}

echo "Passed {$checks} order item instruction checks.\n";
