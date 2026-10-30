<?php

declare(strict_types=1);

require_once __DIR__ . '/PosSplitBill.php';

/**
 * Supply branch-scoped activity rows. Linkage is read only from exact JSON
 * identifiers, never inferred from table numbers or transaction descriptions.
 * A duplicate creation or any undo makes that child unavailable for another undo.
 */
function posUnsplitBillLinks(array $auditRows): array
{
    $links = [];
    $seen = [];
    $undone = [];
    $identifier = static function ($value): ?string {
        return (is_string($value) || is_int($value))
            && preg_match('/^[1-9][0-9]*$/', (string)$value) ? (string)$value : null;
    };
    foreach ($auditRows as $row) {
        $action = $row['activity_performed'] ?? '';
        if (!in_array($action, ['SPLIT BILL', 'UNSPLIT BILL'], true)) continue;
        $data = json_decode((string)($row['values_of_data'] ?? ''), true);
        if (!is_array($data)) continue;
        $child = $identifier($data['transaction_id'] ?? $data['removed_transaction_id'] ?? null);
        if ($child === null) continue;
        if ($action === 'UNSPLIT BILL') {
            if (empty($row['_pos_bill_audit_invalid_link'])) $undone[$child] = true;
            continue;
        }
        $seen[$child] = ($seen[$child] ?? 0) + 1;
        if (!empty($row['_pos_bill_audit_invalid_link'])) continue;
        $source = $identifier($data['source_transaction_id'] ?? null);
        $slip = $identifier($data['order_slip_no'] ?? null);
        $auditId = $identifier($row['ID'] ?? null);
        if ($source === null || $source === $child || $slip === null || $auditId === null) continue;
        $links[$child] = [
            'transaction_id' => $child, 'source_transaction_id' => $source,
            'order_slip_no' => $slip, 'split_activity_id' => $auditId,
        ];
    }
    foreach ($links as $child => $_) {
        if (($seen[$child] ?? 0) !== 1 || isset($undone[$child])) unset($links[$child]);
    }
    return $links;
}

function posUnsplitBillAuditRows(PDO $pdo, array $scope, bool $lock = false): array
{
    return posBillAuditReadRows($pdo, $scope[1], $scope[2], $lock);
}

function posUnsplitBillOutstandingChildren(array $auditRows, string $sourceId): array
{
    $children = [];
    $undoRecords = [];
    foreach ($auditRows as $row) {
        $data = json_decode((string)($row['values_of_data'] ?? ''), true);
        if (!is_array($data) || !is_scalar($data['source_transaction_id'] ?? null)
            || (string)$data['source_transaction_id'] !== $sourceId) continue;
        if (($row['activity_performed'] ?? '') === 'SPLIT BILL') {
            // Do not use the selectable-link map here: it deliberately hides
            // ambiguous records, which must still block an ancestor's undo.
            $children[(string)$row['ID']] = [
                'split_activity_id' => (string)$row['ID'],
                'transaction_id' => $data['transaction_id'] ?? null,
            ];
        } elseif (($row['activity_performed'] ?? '') === 'UNSPLIT BILL' && empty($row['_pos_bill_audit_invalid_link'])) {
            $undoRecords[] = $data;
        }
    }
    foreach ($undoRecords as $undo) {
        if (!is_scalar($undo['split_activity_id'] ?? null) || !is_scalar($undo['transaction_id'] ?? null)) continue;
        $activityId = (string)$undo['split_activity_id'];
        if (isset($children[$activityId]) && is_scalar($children[$activityId]['transaction_id'])
            && (string)$children[$activityId]['transaction_id'] === (string)$undo['transaction_id']) {
            unset($children[$activityId]);
        }
    }
    return array_values($children);
}

function posUnsplitBillRead(PDO $pdo, array $scope, ?array $initialLink): array
{
    // Read linkage before beginning the transaction, then lock the two headers
    // in a stable order. Re-read history with a current locking read afterwards.
    $ids = [$scope[0]];
    if ($initialLink !== null) $ids[] = $initialLink['source_transaction_id'];
    usort($ids, static fn($a, $b) => strlen($a) <=> strlen($b) ?: strcmp($a, $b));
    $states = [];
    foreach ($ids as $id) $states[$id] = posSplitBillRead($pdo, [$id, $scope[1], $scope[2]]);
    $auditRows = posUnsplitBillAuditRows($pdo, $scope, true);
    $links = posUnsplitBillLinks($auditRows);
    $link = $links[$scope[0]] ?? null;
    if ($link !== $initialLink) throw new DomainException('The split history has changed. Reload the bill before undoing it.');
    $state = [
        'child' => $states[$scope[0]],
        'source' => $link === null ? null : $states[$link['source_transaction_id']],
        'link' => $link, 'customers' => [], 'nested' => [],
    ];
    $customers = $pdo->prepare('SELECT * FROM tbl_pos_transactions_customers
        WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ? ORDER BY ID FOR UPDATE');
    $customers->execute($scope);
    $state['customers'] = $customers->fetchAll(PDO::FETCH_ASSOC);
    // Includes ambiguous, paid or reversed descendants that cannot safely be
    // returned; only an exact recorded undo clears a descendant's history.
    $state['nested'] = posUnsplitBillOutstandingChildren($auditRows, $scope[0]);
    return $state;
}

function posUnsplitBillReason(array $state): ?string
{
    if ($state['link'] === null || $state['source'] === null) {
        return 'This bill has no unique, available split history to undo.';
    }
    $child = $state['child']['transaction'];
    $source = $state['source']['transaction'];
    if ((string)$child['order_slip_no'] !== $state['link']['order_slip_no']) {
        return 'The split bill number no longer matches its history.';
    }
    foreach (['transaction_date', 'table_number', 'terminal_number', 'order_type', 'Project_Code'] as $column) {
        if ((string)($child[$column] ?? '') !== (string)($source[$column] ?? '')) {
            return 'The bills have different dates, tables, terminals or order details. They cannot be unsplit.';
        }
    }
    foreach (['child' => 'Split bill', 'source' => 'Original bill'] as $key => $label) {
        $reason = posSplitBillReason($state[$key]);
        if ($reason !== null) {
            return $label . ': ' . strtr($reason, [
                'can be split' => 'can be unsplit', 'cannot be split' => 'cannot be unsplit',
                'before splitting, then apply discounts separately to each bill.' => 'before undoing the split.',
                'no products to split' => 'no products to return', 'split billing' => 'undoing the split',
            ]);
        }
        foreach ($state[$key]['items'] as $item) {
            if ((string)$item['transaction_date'] !== (string)$state[$key]['transaction']['transaction_date']) {
                return $label . ': a product has a different transaction date. Review it before undoing the split.';
            }
        }
    }
    if ((float)($child['OtherCharges'] ?? 0) != 0 || $state['child']['charges'] !== []) {
        return 'Remove saved charges from the split bill before undoing the split.';
    }
    if ($state['customers'] !== [] || !in_array(trim((string)($child['customer_exclusive_id'] ?? '')), ['', '0'], true)) {
        return 'Remove the customer association from the split bill before undoing the split.';
    }
    if ($state['nested'] !== []) return 'Undo the other bills split from this bill first.';
    $charges = (float)($source['OtherCharges'] ?? 0);
    if (!is_finite($charges) || $charges < 0) return 'Review the original bill charges before undoing the split.';
    return null;
}

function posUnsplitBillPreview(PDO $pdo, $transactionId, $category, $unit): array
{
    $scope = posSplitBillScope($transactionId, $category, $unit);
    $link = posUnsplitBillLinks(posUnsplitBillAuditRows($pdo, $scope))[$scope[0]] ?? null;
    $pdo->beginTransaction();
    try {
        $state = posUnsplitBillRead($pdo, $scope, $link);
        $reason = posUnsplitBillReason($state);
        $items = $state['child']['items'];
        $name = $pdo->prepare('SELECT item_name FROM tbl_inventory_products_masterlist WHERE product_id = ? LIMIT 1');
        foreach ($items as &$item) {
            $name->execute([$item['product_id']]);
            $item['item_name'] = $name->fetchColumn() ?: $item['product_id'];
        }
        unset($item);
        $pdo->commit();
        return [
            'status' => 'success', 'transaction' => $state['child']['transaction'],
            'source_transaction' => $state['source']['transaction'] ?? null, 'items' => $items,
            'can_unsplit' => $reason === null, 'reason' => $reason,
            'snapshot_token' => posSplitBillSnapshot($state),
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function posUnsplitBill(PDO $pdo, array $input, callable $beforeCommit): array
{
    $scope = posSplitBillScope($input['transaction_id'] ?? '', $input['Category_Code'] ?? '', $input['Unit_Code'] ?? '');
    $token = $input['snapshot_token'] ?? null;
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        throw new InvalidArgumentException('Reload the split bill before undoing it.');
    }
    $link = posUnsplitBillLinks(posUnsplitBillAuditRows($pdo, $scope))[$scope[0]] ?? null;
    $pdo->beginTransaction();
    try {
        $state = posUnsplitBillRead($pdo, $scope, $link);
        if (!hash_equals(posSplitBillSnapshot($state), $token)) {
            throw new DomainException('These bills have changed or were already unsplit. Reload them before trying again.');
        }
        $reason = posUnsplitBillReason($state);
        if ($reason !== null) throw new DomainException($reason);
        $source = $state['source']['transaction'];
        $child = $state['child']['transaction'];
        $items = array_merge($state['source']['items'], $state['child']['items']);
        $sourceTotals = posSplitBillTotals($items, round((float)$source['OtherCharges'], 2));
        $childTotals = array_merge(posSplitBillTotals([], 0), [
            'payment_amount' => 0, 'change_amount' => 0, 'short_over' => 0,
            'status' => 'Unsplit', 'remarks' => 'Unsplit', 'order_status' => 'Cancelled',
        ]);
        $move = $pdo->prepare('UPDATE tbl_pos_transactions_detailed SET transaction_id = ?
            WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ?');
        $move->execute(array_merge([(string)$source['transaction_id']], $scope));
        if ($move->rowCount() !== count($state['child']['items'])) {
            throw new DomainException('The split bill products changed. Reload the bill before undoing it.');
        }
        foreach ([[$sourceTotals, (string)$source['transaction_id']], [$childTotals, $scope[0]]] as [$totals, $id]) {
            $assignments = implode(', ', array_map(static fn($key) => $key . ' = ?', array_keys($totals)));
            $update = $pdo->prepare('UPDATE tbl_pos_transactions SET ' . $assignments
                . ' WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ?');
            $update->execute(array_merge(array_values($totals), [$id, $scope[1], $scope[2]]));
        }
        $source = array_replace($source, $sourceTotals);
        $child = array_replace($child, $childTotals);
        $userId = is_scalar($input['user_id'] ?? '') ? (string)($input['user_id'] ?? '') : '';
        $userName = is_scalar($input['user_name'] ?? '') ? (string)($input['user_name'] ?? '') : '';
        $audit = json_encode([
            'source_transaction_id' => (string)$source['transaction_id'], 'transaction_id' => $scope[0],
            'Unit_Code' => $scope[2],
            'split_activity_id' => $state['link']['split_activity_id'],
            'item_count' => count($state['child']['items']), 'restored_total' => $source['TotalAmountDue'],
        ], JSON_THROW_ON_ERROR);
        if (strlen($audit) > 255) throw new DomainException('The unsplit history is too long to save safely.');
        posSplitBillInsert($pdo, 'tbl_main_activity_logs', [
            'Category_Code' => $scope[1], 'Unit_Code' => posBillAuditStoredUnit($pdo, 'tbl_main_activity_logs', $scope[2]), 'activity_date_time' => date('Y-m-d H:i:s'),
            'user_id' => $userId, 'user_name' => $userName, 'type_of_activity' => 'POS BILLING',
            'activity_performed' => 'UNSPLIT BILL', 'values_of_data' => $audit,
        ]);
        posSplitBillInsert($pdo, 'tbl_main_transaction_logs', [
            'Category_Code' => $scope[1], 'Unit_Code' => posBillAuditStoredUnit($pdo, 'tbl_main_transaction_logs', $scope[2]), 'Register' => $source['terminal_number'],
            'Trans_Date' => $source['transaction_date'], 'Reference_No' => (string)$child['order_slip_no'],
            'Trans_Type' => 'UNSPLIT BILL', 'User_ID' => is_numeric($userId) ? (int)$userId : 0,
            'Amount' => $state['child']['transaction']['TotalSales'],
            'Description' => 'Unsplit transaction ' . $scope[0] . ' into transaction ' . $source['transaction_id'],
            'Log_Date' => date('Y-m-d'), 'Log_Time' => date('H:i:s'),
        ]);
        $beforeCommit($source, $child);
        $pdo->commit();
        return [
            'status' => 'success', 'removed_transaction_id' => $scope[0],
            'source_transaction_id' => (string)$source['transaction_id'],
            'source_transaction' => $source, 'transaction' => $child,
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
