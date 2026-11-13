<?php

declare(strict_types=1);

/** Small shared read adapter; callers hold the scoped transaction header lock. */
function posOrderSnapshotRows(PDO|mysqli $connection, string $sql, array $values): array
{
    $statement = $connection->prepare($sql);
    if ($statement === false && $connection instanceof mysqli) {
        throw new mysqli_sql_exception($connection->error, $connection->errno);
    }
    if ($connection instanceof PDO) {
        $statement->execute($values);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }
    try {
        $statement->bind_param(str_repeat('s', count($values)), ...$values);
        if (!$statement->execute()) throw new mysqli_sql_exception($statement->error, $statement->errno);
        $result = $statement->get_result();
        if ($result === false) throw new mysqli_sql_exception($statement->error, $statement->errno);
        return $result->fetch_all(MYSQLI_ASSOC);
    } finally {
        $statement->close();
    }
}

/** Return the new row identities after a replacement save, before committing. */
function posOrderReadSnapshot(PDO|mysqli $connection, string $transactionId, string $category, string $unit): array
{
    $rows = posOrderSnapshotRows($connection, '
        SELECT ID AS databaseID, sales_quantity, selling_price
        FROM tbl_pos_transactions_detailed
        WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ?
        ORDER BY ID FOR UPDATE', [$transactionId, $category, $unit]);
    return array_map(static fn(array $row): array => [
        'databaseID' => (string)$row['databaseID'],
        'sales_quantity' => (float)$row['sales_quantity'],
        'selling_price' => (float)$row['selling_price'],
    ], $rows);
}

function posOrderHasAcceptedQrBatch(PDO|mysqli $connection, string $transactionId, string $category, string $unit): bool
{
    try {
        return posOrderSnapshotRows($connection, "
            SELECT order_id FROM tbl_pos_qr_orders
            WHERE transaction_id = ? AND category_code = ? AND unit_code = ? AND status = 'accepted'
            LIMIT 1", [$transactionId, $category, $unit]) !== [];
    } catch (PDOException|mysqli_sql_exception $error) {
        // Older POS installations have no QR tables. Other database failures
        // must not silently disable this concurrency guard.
        $driverCode = $error instanceof PDOException ? (int)($error->errorInfo[1] ?? 0) : (int)$error->getCode();
        if ($driverCode === 1146 || (string)$error->getCode() === '42S02') return false;
        throw $error;
    }
}

/** Check original loaded rows, not the edited cart the cashier wants to save. */
function posOrderAssertCurrentSnapshot(PDO|mysqli $connection, string $transactionId, string $category, string $unit, ?array $original): void
{
    $message = 'The order items have changed. Reload this transaction before saving so additional QR orders are preserved.';
    if ($original === null) {
        if (posOrderHasAcceptedQrBatch($connection, $transactionId, $category, $unit)) {
            throw new InvalidArgumentException($message, 409);
        }
        return; // Backward compatibility for legacy clients editing ordinary orders.
    }
    if (array_values($original) !== $original) throw new InvalidArgumentException($message, 409);
    $expected = [];
    foreach ($original as $row) {
        if (!is_array($row) || !isset($row['databaseID']) || !is_scalar($row['databaseID'])
            || !preg_match('/^[1-9][0-9]*$/', (string)$row['databaseID'])) {
            throw new InvalidArgumentException($message, 409);
        }
        $id = (string)$row['databaseID'];
        if (isset($expected[$id])) throw new InvalidArgumentException($message, 409);
        foreach (['sales_quantity', 'selling_price'] as $field) {
            if (!isset($row[$field]) || !is_numeric($row[$field]) || !is_finite((float)$row[$field])) {
                throw new InvalidArgumentException($message, 409);
            }
        }
        $expected[$id] = $row;
    }
    $current = posOrderReadSnapshot($connection, $transactionId, $category, $unit);
    if (count($expected) !== count($current)) throw new InvalidArgumentException($message, 409);
    foreach ($current as $row) {
        $old = $expected[(string)$row['databaseID']] ?? null;
        if ($old === null
            || round((float)$old['sales_quantity'], 4) !== round((float)$row['sales_quantity'], 4)
            || round((float)$old['selling_price'], 4) !== round((float)$row['selling_price'], 4)) {
            throw new InvalidArgumentException($message, 409);
        }
    }
}

function posOrderPreserveRebillRemarks(array $existing, string $requested): string
{
    return strcasecmp(trim((string)($existing['remarks'] ?? '')), 'Pending QR Rebill') === 0
        ? 'Pending QR Rebill' : $requested;
}
