<?php

declare(strict_types=1);

require_once __DIR__ . '/../api/pos_report_mirror.php';
require_once __DIR__ . '/../api/pos_report_mirror_activation.php';

/**
 * Enroll a newly created split bill using the same activation boundary and
 * sequence as save_order.php. The caller owns the transaction and must also
 * refresh the existing source bill's mirror without allowing new enrollment.
 *
 * $sourcePosId is the new header's physical ID, captured immediately after its
 * insert, not transaction_id or the ID of a subsequently inserted detail row.
 */
function posSplitBillEnrollReport(
    PDO $pdo,
    array $config,
    string $sourcePosId,
    string $transactionId,
    string $transactionDate,
    string $categoryCode,
    string $unitCode
): array {
    if (!$pdo->inTransaction()) {
        throw new LogicException('Split bill report enrollment requires an active transaction.');
    }
    if (preg_match('/^\d+$/', $sourcePosId) !== 1 || (int)$sourcePosId <= 0) {
        throw new InvalidArgumentException('A valid new split bill row ID is required.');
    }

    $posDbName = posReportMirrorIdentifier($config['db'] ?? 'db_cnc_pos', 'POS database name');
    $reportDbName = posReportMirrorIdentifier($config['report_db'] ?? 'reports_database', 'report database name');
    $skipInterval = posReportMirrorGetSkipInterval($pdo, $posDbName, $reportDbName);

    // Missing activation migrations must not prevent an ordinary POS mutation,
    // matching save_order.php. A failed activation claim is isolated so it
    // cannot leave behind a partial activation marker or consumed sequence.
    $pdo->exec('SAVEPOINT pos_split_bill_report_activation');
    try {
        $activation = posReportMirrorActivationClaimAndNextSequence(
            $pdo,
            $config,
            $sourcePosId,
            $transactionId,
            $transactionDate,
            $skipInterval
        );
        $pdo->exec('RELEASE SAVEPOINT pos_split_bill_report_activation');
    } catch (Throwable $error) {
        // A failed rollback must propagate: the caller cannot safely commit a
        // split if its activation savepoint could not be restored.
        $pdo->exec('ROLLBACK TO SAVEPOINT pos_split_bill_report_activation');
        $pdo->exec('RELEASE SAVEPOINT pos_split_bill_report_activation');
        error_log('Unable to activate split bill report mirroring: ' . $error->getMessage());
        $activation = [
            'status' => 'activation_failed',
            'active' => false,
            'migration_required' => false,
            'source_sequence' => null,
        ];
    }

    $status = (string)($activation['status'] ?? '');
    $sequence = (int)($activation['source_sequence'] ?? 0);
    $activationKey = trim((string)($activation['activation_key'] ?? ''));
    $canMirror = $status === 'active'
        || $status === 'not_required'
        || ($skipInterval === 0 && $status === 'waiting_for_first_skipped_transaction');

    if ($canMirror) {
        // Mirror errors deliberately propagate, rolling back both bills,
        // details, counters and report changes in the caller's transaction.
        mirrorPosTransactionToReport(
            $pdo,
            $config,
            $transactionId,
            $categoryCode,
            $unitCode,
            true,
            $skipInterval,
            $sequence > 0 ? $sequence : max(1, (int)$sourcePosId),
            $activationKey !== '' ? $activationKey : null,
            $sequence > 0 ? $sequence : null
        );
    } else {
        error_log('Split bill report mirror skipped because activation state is unavailable: '
            . ($status !== '' ? $status : 'unknown'));
    }

    return $activation;
}
