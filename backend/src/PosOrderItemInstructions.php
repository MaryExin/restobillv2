<?php

declare(strict_types=1);

const POS_ORDER_ITEM_INSTRUCTION_MIGRATION = 'database/2026-10-21_pos_order_item_instruction.sql';

// Older installations can still save ordinary orders before the migration.
// Notes must never be accepted and then silently discarded.
function posOrderHasItemInstructionColumn($connection): bool
{
    $result = $connection->query(
        "SHOW COLUMNS FROM `tbl_pos_transactions_detailed` WHERE `Field` = 'item_instruction'"
    );
    if ($result === false) {
        throw new RuntimeException('Could not check order item instruction support.');
    }

    if ($result instanceof PDOStatement) {
        $row = $result->fetch(PDO::FETCH_ASSOC);
        $result->closeCursor();
    } else {
        $row = $result->fetch_assoc();
        $result->free();
    }

    return is_array($row) && ($row['Field'] ?? '') === 'item_instruction';
}

function posOrderItemInstruction(array $item): ?string
{
    $value = $item['item_instruction'] ?? null;
    if ($value === null) {
        return null;
    }
    if (!is_string($value) && !is_numeric($value)) {
        throw new InvalidArgumentException('An order item instruction must be text.');
    }

    $instruction = trim((string)$value);
    if (strlen($instruction) > 65535) {
        throw new InvalidArgumentException('An order item instruction is too long.');
    }

    return $instruction;
}

function posOrderValidateItemInstructions(array $items, bool $hasColumn): void
{
    foreach ($items as $item) {
        if (!is_array($item)) {
            throw new InvalidArgumentException('An order item must be an object.');
        }
        $instruction = posOrderItemInstruction($item);
        if (!$hasColumn && $instruction !== null && $instruction !== '') {
            throw new RuntimeException(
                'Order item instructions require a database update. Apply '
                . POS_ORDER_ITEM_INSTRUCTION_MIGRATION . ' before saving this order.'
            );
        }
    }
}

function posOrderDetailInsertSql(bool $hasItemInstruction, bool $namedParameters = false): string
{
    $columns = [
        'transaction_id', 'Category_Code', 'Unit_Code', 'transaction_date',
        'product_id', 'sku', 'sales_quantity', 'landing_cost', 'unit_cost',
        'selling_price', 'vatable', 'isDiscountable', 'order_status',
    ];
    if ($hasItemInstruction) {
        $columns[] = 'item_instruction';
    }
    $parameters = $namedParameters
        ? array_map(static fn(string $column): string => ':' . $column, $columns)
        : array_fill(0, count($columns), '?');

    return 'INSERT INTO tbl_pos_transactions_detailed (' . implode(', ', $columns)
        . ') VALUES (' . implode(', ', $parameters) . ')';
}
