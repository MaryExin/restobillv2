<?php

declare(strict_types=1);

function posBillingChargeAmount($value): float
{
    if ((!is_int($value) && !is_float($value) && !is_string($value))
        || !is_numeric($value) || !is_finite((float)$value) || (float)$value < 0) {
        throw new InvalidArgumentException('Billing charge amounts must be finite, nonnegative numbers.');
    }
    return round((float)$value, 2);
}

function posNormalizeBillingCharges($rows): array
{
    if (!is_array($rows) || array_values($rows) !== $rows) {
        throw new InvalidArgumentException('billing_charges must be an array.');
    }
    $charges = [];
    foreach ($rows as $row) {
        if (!is_array($row) || !isset($row['particulars']) || !is_scalar($row['particulars'])) {
            throw new InvalidArgumentException('Each billing charge must have a text name.');
        }
        $particulars = trim((string)$row['particulars']);
        if ($particulars === '') {
            throw new InvalidArgumentException('Each billing charge must have a name.');
        }
        $amount = posBillingChargeAmount($row['amount'] ?? null);
        // An explicit zero removes this billing-owned charge on the next save.
        if ($amount > 0) {
            $charges[] = ['particulars' => $particulars, 'amount' => $amount];
        }
    }
    return $charges;
}

// Called after the scoped transaction header is locked, inside billing.php's
// transaction. Never commit here: charge rows, header totals and report mirrors
// must either all save or all roll back together.
function posSaveBillingCharges(PDO $pdo, array $transaction, array $charges, $suppliedOtherCharges): float
{
    if (!$pdo->inTransaction()) {
        throw new LogicException('Billing charges must be saved inside the billing transaction.');
    }
    $scope = [
        ':tid' => $transaction['transaction_id'],
        ':cat' => $transaction['Category_Code'],
        ':unit' => $transaction['Unit_Code'],
    ];
    $read = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM tbl_pos_transactions_other_charges
        WHERE transaction_id = :tid
          AND Category_Code = :cat
          AND Unit_Code = :unit
          AND COALESCE(reference, '') <> 'AUTO'
    ");
    $read->execute($scope);
    $total = round((float)$read->fetchColumn() + array_sum(array_column($charges, 'amount')), 2);
    if (!is_finite($total) || posBillingChargeAmount($suppliedOtherCharges) !== $total) {
        throw new InvalidArgumentException('OtherCharges does not match the current billing and saved charges. Reload the transaction and try again.');
    }

    $delete = $pdo->prepare("
        DELETE FROM tbl_pos_transactions_other_charges
        WHERE transaction_id = :tid
          AND Category_Code = :cat
          AND Unit_Code = :unit
          AND reference = 'AUTO'
    ");
    $delete->execute($scope);

    if ($charges !== []) {
        $insert = $pdo->prepare("
            INSERT INTO tbl_pos_transactions_other_charges
                (transaction_id, Category_Code, Unit_Code, Project_Code, transaction_date, particulars, amount, reference)
            VALUES
                (:tid, :cat, :unit, :project, :date, :particulars, :amount, 'AUTO')
        ");
        foreach ($charges as $charge) {
            $insert->execute($scope + [
                ':project' => $transaction['Project_Code'] ?? null,
                ':date' => $transaction['transaction_date'] ?? null,
                ':particulars' => $charge['particulars'],
                ':amount' => $charge['amount'],
            ]);
        }
    }
    return $total;
}
