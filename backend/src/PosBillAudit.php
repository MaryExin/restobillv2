<?php

declare(strict_types=1);

/** Numeric legacy audit columns cannot store the POS's textual business IDs. */
function posBillAuditStoredUnit(PDO $pdo, string $table, string $unit): string|int
{
    if (!in_array($table, ['tbl_main_activity_logs', 'tbl_main_transaction_logs'], true)) {
        throw new InvalidArgumentException('Unsupported bill audit table.');
    }
    static $columnTypes;
    $columnTypes ??= new WeakMap();
    $types = $columnTypes[$pdo] ?? [];
    if (!isset($types[$table])) {
        $column = $pdo->query("SHOW COLUMNS FROM `{$table}` WHERE `Field` = 'Unit_Code'")->fetch(PDO::FETCH_ASSOC);
        if (!is_array($column) || !isset($column['Type'])) {
            throw new RuntimeException('The bill audit business-unit column could not be verified.');
        }
        $types[$table] = (string)$column['Type'];
        $columnTypes[$pdo] = $types;
    }
    $numeric = preg_match('/^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|bit)\b/i', $types[$table]);
    return $numeric && !is_numeric($unit) ? 0 : $unit;
}

function posBillAuditIdentifier($value): ?string
{
    return (is_string($value) || is_int($value)) && preg_match('/^[1-9][0-9]*$/', (string)$value)
        ? (string)$value : null;
}

function posBillAuditHeaderIdentifier($value): ?string
{
    // Native MySQL drivers expose legacy DOUBLE document IDs as floats. Only
    // exact, safely represented integers are acceptable header identities.
    if (is_float($value)) {
        if (!is_finite($value) || $value < 1 || $value > 9007199254740991 || floor($value) !== $value) return null;
        $value = sprintf('%.0f', $value);
    }
    return posBillAuditIdentifier($value);
}

/**
 * $transactionHeaders must include every header matching the legacy audit IDs,
 * across branches, so a coerced Unit_Code=0 never guesses between collisions.
 */
function posBillAuditScopeRows(array $auditRows, array $transactionHeaders, string $category, string $unit): array
{
    $headers = [];
    foreach ($transactionHeaders as $header) {
        $id = posBillAuditHeaderIdentifier($header['transaction_id'] ?? null);
        if ($id !== null) $headers[$id][] = $header;
    }
    $inBranch = static fn(array $header): bool => (string)($header['Category_Code'] ?? '') === $category
        && (string)($header['Unit_Code'] ?? '') === $unit;
    $scoped = [];
    $legacyUndo = [];
    foreach ($auditRows as $row) {
        if ((string)($row['Category_Code'] ?? '') !== $category) continue;
        $data = json_decode((string)($row['values_of_data'] ?? ''), true);
        if (!is_array($data)) continue;
        if (array_key_exists('Unit_Code', $data)) {
            // Explicit JSON scope always wins, including a deliberate mismatch.
            if ((is_string($data['Unit_Code']) || is_int($data['Unit_Code'])) && (string)$data['Unit_Code'] === $unit) {
                $scoped[(string)$row['ID']] = $row;
            }
            continue;
        }
        $storedUnit = (string)($row['Unit_Code'] ?? '');
        if ($storedUnit !== '0' && $storedUnit === $unit) {
            $scoped[(string)$row['ID']] = $row;
            continue;
        }
        if ($storedUnit !== '0') continue;
        $source = posBillAuditIdentifier($data['source_transaction_id'] ?? null);
        $child = posBillAuditIdentifier($data['transaction_id'] ?? null);
        if ($source === null || $child === null || $source === $child) continue;
        $sourceRows = $headers[$source] ?? [];
        $childRows = $headers[$child] ?? [];
        if (array_filter($sourceRows, $inBranch) === []) continue;
        if (count($sourceRows) !== 1 || count($childRows) !== 1 || !$inBranch($childRows[0])) {
            // This cannot produce an undo link. If its source is certainly in
            // or could be in this branch, retain it only as an unresolved-
            // descendant barrier. Ambiguity must never hide a nested split.
            $row['_pos_bill_audit_invalid_link'] = true;
            $scoped[(string)$row['ID']] = $row;
            continue;
        }
        if (($row['activity_performed'] ?? '') === 'SPLIT BILL') {
            if (posBillAuditIdentifier($data['order_slip_no'] ?? null) !== posBillAuditHeaderIdentifier($childRows[0]['order_slip_no'] ?? null)) {
                $row['_pos_bill_audit_invalid_link'] = true;
            }
            $scoped[(string)$row['ID']] = $row;
        } elseif (($row['activity_performed'] ?? '') === 'UNSPLIT BILL') {
            $legacyUndo[] = [$row, $data];
        }
    }
    foreach ($legacyUndo as [$row, $data]) {
        $splitId = posBillAuditIdentifier($data['split_activity_id'] ?? null);
        $split = $splitId === null ? null : ($scoped[$splitId] ?? null);
        $original = $split === null ? null : json_decode((string)$split['values_of_data'], true);
        if ($split !== null && empty($split['_pos_bill_audit_invalid_link'])
            && ($split['activity_performed'] ?? '') === 'SPLIT BILL' && is_array($original)
            && (string)$original['source_transaction_id'] === (string)$data['source_transaction_id']
            && (string)$original['transaction_id'] === (string)$data['transaction_id']) {
            $scoped[(string)$row['ID']] = $row;
        }
    }
    ksort($scoped, SORT_NUMERIC);
    return array_values($scoped);
}

/** Shared by the PDO mutation and mysqli table listing. */
function posBillAuditReadRows(PDO|mysqli $db, string $category, string $unit, bool $lock = false): array
{
    $fetch = static function (string $sql, array $parameters) use ($db): array {
        $read = $db->prepare($sql);
        if ($db instanceof PDO) {
            $read->execute($parameters);
            return $read->fetchAll(PDO::FETCH_ASSOC);
        }
        $read->bind_param(str_repeat('s', count($parameters)), ...$parameters);
        $read->execute();
        $rows = $read->get_result()->fetch_all(MYSQLI_ASSOC);
        $read->close();
        return $rows;
    };
    $auditRows = $fetch("SELECT CAST(ID AS CHAR) AS ID, Category_Code, Unit_Code, activity_performed, values_of_data
        FROM tbl_main_activity_logs WHERE Category_Code = ? AND type_of_activity = 'POS BILLING'
          AND activity_performed IN ('SPLIT BILL', 'UNSPLIT BILL') ORDER BY ID" . ($lock ? ' FOR UPDATE' : ''), [$category]);
    $ids = [];
    foreach ($auditRows as $row) {
        if ((string)$row['Unit_Code'] !== '0') continue;
        $data = json_decode((string)$row['values_of_data'], true);
        if (!is_array($data) || array_key_exists('Unit_Code', $data)) continue;
        foreach (['source_transaction_id', 'transaction_id'] as $key) {
            $id = posBillAuditIdentifier($data[$key] ?? null);
            if ($id !== null) $ids[$id] = $id;
        }
    }
    $headers = [];
    foreach (array_chunk(array_values($ids), 500) as $chunk) {
        $headers = array_merge($headers, $fetch('SELECT ID, CAST(transaction_id AS CHAR) AS transaction_id,
            Category_Code, Unit_Code, CAST(order_slip_no AS CHAR) AS order_slip_no
            FROM tbl_pos_transactions WHERE transaction_id IN (' . implode(', ', array_fill(0, count($chunk), '?'))
            . ') ORDER BY transaction_id, ID' . ($lock ? ' FOR UPDATE' : ''), $chunk));
    }
    return posBillAuditScopeRows($auditRows, $headers, $category, $unit);
}
