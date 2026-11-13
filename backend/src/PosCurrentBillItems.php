<?php

declare(strict_types=1);

/** Appending QR items preserves a billed snapshot until a real billing save. */
function posAssertBillReadyForPayment(array $transaction): void
{
    if (($transaction['remarks'] ?? '') === 'Pending QR Rebill') {
        throw new InvalidArgumentException('QR items were added after billing. Reopen Billing and save the updated bill before payment.');
    }
}

/** Check the locked header before a stale screen can recreate a cancelled bill. */
function posAssertBillNotCancelled(array $transaction): void
{
    foreach (['remarks', 'status', 'order_status'] as $field) {
        $state = strtolower(trim((string)($transaction[$field] ?? '')));
        if (in_array($state, ['void', 'voided', 'cancel', 'cancelled', 'canceled', 'unsplit'], true)) {
            throw new InvalidArgumentException(
                'This transaction is voided, cancelled, or unsplit. Reload the transaction list.'
            );
        }
    }
}

/**
 * Call after locking the transaction header. A split and a bill/payment save
 * must see the same current detail rows before either writes financial totals.
 * Older clients omit cart_items; they still receive the gross-total check.
 */
function posAssertCurrentBillItems(
    PDO $pdo,
    array $transaction,
    float $grossTotal,
    ?array $cartItems = null,
    bool $allowPriceChanges = false
): void {
    if (!$pdo->inTransaction()) {
        throw new LogicException('Current bill items must be checked inside a transaction.');
    }

    // An unsplit child intentionally has no details. Reject its cancelled
    // header before the legacy header-only transaction allowance below.
    posAssertBillNotCancelled($transaction);

    $read = $pdo->prepare("
        SELECT ID, sales_quantity, selling_price
        FROM tbl_pos_transactions_detailed
        WHERE transaction_id = :tid
          AND Category_Code = :cat
          AND Unit_Code = :unit
        ORDER BY ID
        FOR UPDATE
    ");
    $read->execute([
        ':tid' => $transaction['transaction_id'],
        ':cat' => $transaction['Category_Code'],
        ':unit' => $transaction['Unit_Code'],
    ]);
    $rows = $read->fetchAll(PDO::FETCH_ASSOC);
    $message = 'The bill items have changed. Reload the transaction before billing or payment.';

    $submitted = [];
    if ($cartItems !== null) {
        foreach ($cartItems as $item) {
            if (!is_array($item) || !isset($item['databaseID'])
                || !is_scalar($item['databaseID'])
                || !preg_match('/^[1-9][0-9]*$/', (string)$item['databaseID'])) {
                throw new InvalidArgumentException($message);
            }
            $key = (string)$item['databaseID'];
            if (isset($submitted[$key])) {
                throw new InvalidArgumentException($message);
            }
            $submitted[$key] = $item;
        }
        if (count($submitted) !== count($rows)) {
            throw new InvalidArgumentException($message);
        }
    }

    $currentTotal = 0.0;
    foreach ($rows as $row) {
        $key = (string)$row['ID'];
        $quantity = (float)$row['sales_quantity'];
        $price = (float)$row['selling_price'];
        if ($cartItems !== null) {
            if (!isset($submitted[$key])) {
                throw new InvalidArgumentException($message);
            }
            $item = $submitted[$key];
            if (array_key_exists('sales_quantity', $item)
                && (!is_numeric($item['sales_quantity'])
                    || !is_finite((float)$item['sales_quantity'])
                    || round((float)$item['sales_quantity'], 4) !== round($quantity, 4))) {
                throw new InvalidArgumentException($message);
            }
            $submittedPrice = $item['selling_price'] ?? null;
            if (!is_numeric($submittedPrice) || !is_finite((float)$submittedPrice)
                || (float)$submittedPrice < 0) {
                throw new InvalidArgumentException('A bill item has an invalid selling price.');
            }
            if (!$allowPriceChanges && round((float)$submittedPrice, 4) !== round($price, 4)) {
                throw new InvalidArgumentException($message);
            }
            $price = $allowPriceChanges ? (float)$submittedPrice : $price;
        }
        $currentTotal += $quantity * $price;
    }

    // Preserve legacy non-product transactions, which have no detail rows.
    if ($rows !== [] && (!is_finite($grossTotal)
        || round($grossTotal, 2) !== round($currentTotal, 2))) {
        throw new InvalidArgumentException($message);
    }
}
