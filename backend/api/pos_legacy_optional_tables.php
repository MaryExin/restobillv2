<?php

declare(strict_types=1);

// Older stores may predate these optional features. Never create their tables
// during a request or mistake a damaged existing table for an absent one.
function posLegacyOptionalTableAvailable(PDO $pdo, string $table): bool
{
    if (!in_array($table, [
        'tbl_pos_discount_type_sales_type',
        'tbl_pos_zreading_archive_log',
    ], true)) {
        throw new InvalidArgumentException('This table is not an optional legacy table.');
    }

    $stmt = $pdo->prepare('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    return $stmt->fetchColumn() !== false;
}

function posTruncateExistingResetTable(PDO $pdo, string $table): void
{
    if (in_array($table, [
        'tbl_pos_discount_type_sales_type',
        'tbl_pos_zreading_archive_log',
    ], true) && !posLegacyOptionalTableAvailable($pdo, $table)) {
        return;
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/D', $table)) {
        throw new InvalidArgumentException('Invalid reset table name.');
    }
    $pdo->exec("TRUNCATE TABLE `$table`;");
}
