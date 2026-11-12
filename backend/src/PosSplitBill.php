<?php

declare(strict_types=1);

require_once __DIR__ . '/PosBillAudit.php';

function posSplitBillScope($transactionId, $category, $unit): array
{
    foreach ([$transactionId, $category, $unit] as $value) {
        if (!is_string($value) && !is_int($value)) {
            throw new InvalidArgumentException('Transaction and business identifiers must be text or integers.');
        }
    }
    $transactionId = (string)$transactionId;
    $category = (string)$category;
    $unit = (string)$unit;
    if (!preg_match('/^[1-9][0-9]*$/', $transactionId) || trim($category) === '' || trim($unit) === '') {
        throw new InvalidArgumentException('transaction_id, Category_Code and Unit_Code are required.');
    }
    return [$transactionId, $category, $unit];
}

// Both preview and mutation lock the header before reading its children. The
// snapshot also prevents a repeated request from splitting the same bill twice.
function posSplitBillRead(PDO $pdo, array $scope): array
{
    $header = $pdo->prepare('SELECT * FROM tbl_pos_transactions
        WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ? FOR UPDATE');
    $header->execute($scope);
    $headers = $header->fetchAll(PDO::FETCH_ASSOC);
    if (count($headers) !== 1) {
        throw new InvalidArgumentException('Transaction not found in this business unit.');
    }
    $state = ['transaction' => $headers[0]];
    foreach ([
        'items' => ['tbl_pos_transactions_detailed', 'ID'],
        'payments' => ['tbl_pos_transactions_payments', 'ID'],
        'charges' => ['tbl_pos_transactions_other_charges', 'ID'],
        'discounts' => ['tbl_pos_transactions_discounts', 'id'],
        'product_discounts' => ['tbl_pos_transactions_discounts_per_product', 'id'],
        'loyalty_discounts' => ['tbl_pos_loyalty_discounts', 'id'],
    ] as $key => [$table, $id]) {
        $read = $pdo->prepare("SELECT * FROM {$table}
            WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ? ORDER BY {$id} FOR UPDATE");
        $read->execute($scope);
        $state[$key] = $read->fetchAll(PDO::FETCH_ASSOC);
    }
    if (class_exists('PosOrderProductGroups', false)) {
        // Group metadata belongs to the existing detail IDs. Moving or cloning
        // those rows alone would separate variants from their saved selection.
        // Inspect only this branch's locked details, not a transaction-ID-only
        // lookup that could match an unrelated branch's grouped order.
        $annotatedItems = (new PosOrderProductGroups($pdo))->annotateLines($state['items']);
        foreach ($annotatedItems as $item) {
            if (array_key_exists('group_selection', $item)) {
                $state['split_blocked_reason'] = 'This bill contains a product group. Keep its variants together; split billing is unavailable for grouped orders.';
                break;
            }
        }
    }
    return $state;
}

function posSplitBillSnapshot(array $state): string
{
    return hash('sha256', json_encode($state, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
}

function posSplitBillReason(array $state): ?string
{
    if (isset($state['split_blocked_reason'])) {
        return $state['split_blocked_reason'];
    }
    $header = $state['transaction'];
    $status = strtolower(trim((string)($header['status'] ?? '')));
    if ($status !== '' && $status !== 'active') {
        return 'Only unpaid, active transactions can be split.';
    }
    foreach (['remarks', 'status', 'order_status'] as $key) {
        if (preg_match('/paid|settled|void|refund|cancel|closed/i', (string)($header[$key] ?? ''))) {
            // "Unpaid" is a valid pending label in some installations.
            if (strtolower(trim((string)$header[$key])) !== 'unpaid') {
                return 'Only unpaid, active transactions can be split.';
            }
        }
    }
    if ((int)($header['invoice_no'] ?? 0) > 0 || (float)($header['payment_amount'] ?? 0) != 0
        || $state['payments'] !== [] || (int)($header['void_id'] ?? 0) > 0 || (int)($header['refund_id'] ?? 0) > 0) {
        return 'Transactions with a receipt, payment, void or refund cannot be split.';
    }
    foreach (['void_date', 'refund_date'] as $column) {
        $date = trim((string)($header[$column] ?? ''));
        if ($date !== '' && $date !== '0' && strncmp($date, '0000-00-00', 10) !== 0) {
            return 'Voided or refunded transactions cannot be split.';
        }
    }
    foreach (['Discount', 'customer_count_for_discount', 'VATExemptSales_VAT'] as $key) {
        if ((float)($header[$key] ?? 0) != 0) {
            return 'Remove saved discounts before splitting, then apply discounts separately to each bill.';
        }
    }
    foreach (array_merge($state['discounts'], $state['product_discounts']) as $discount) {
        if (strtolower(trim((string)($discount['status'] ?? 'Active'))) !== 'inactive') {
            return 'Remove saved discounts before splitting, then apply discounts separately to each bill.';
        }
    }
    foreach ($state['loyalty_discounts'] as $loyalty) {
        if (strtolower(trim((string)($loyalty['status'] ?? 'Active'))) !== 'inactive') {
            return 'Transactions with posted loyalty points or redemptions cannot be split.';
        }
    }
    if ($state['items'] === []) {
        return 'This transaction has no products to split.';
    }
    foreach ($state['items'] as $item) {
        if (!is_numeric($item['sales_quantity']) || !is_finite((float)$item['sales_quantity'])
            || (float)$item['sales_quantity'] <= 0 || !is_numeric($item['selling_price'])
            || !is_finite((float)$item['selling_price']) || (float)$item['selling_price'] < 0
            || preg_match('/void|refund|cancel/i', (string)($item['order_status'] ?? ''))) {
            return 'This transaction contains invalid or reversed products and cannot be split.';
        }
    }
    return null;
}

function posSplitBillPreview(PDO $pdo, $transactionId, $category, $unit): array
{
    $scope = posSplitBillScope($transactionId, $category, $unit);
    $pdo->beginTransaction();
    try {
        $state = posSplitBillRead($pdo, $scope);
        $reason = posSplitBillReason($state);
        $items = $state['items'];
        $name = $pdo->prepare('SELECT item_name FROM tbl_inventory_products_masterlist WHERE product_id = ? LIMIT 1');
        foreach ($items as &$item) {
            $name->execute([$item['product_id']]);
            $item['item_name'] = $name->fetchColumn() ?: $item['product_id'];
        }
        unset($item);
        $pdo->commit();
        return [
            'status' => 'success', 'transaction' => $state['transaction'], 'items' => $items,
            'snapshot_token' => posSplitBillSnapshot($state), 'can_split' => $reason === null, 'reason' => $reason,
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function posSplitBillQuantities(array $items, $selection): array
{
    if (!is_array($selection) || $selection === [] || array_values($selection) !== $selection) {
        throw new InvalidArgumentException('Select at least one product to move.');
    }
    $available = array_column($items, null, 'ID');
    $quantities = [];
    foreach ($selection as $entry) {
        if (!is_array($entry) || !is_scalar($entry['detail_id'] ?? null)
            || !preg_match('/^[1-9][0-9]*$/', (string)$entry['detail_id'])) {
            throw new InvalidArgumentException('Each selected product needs a valid detail_id.');
        }
        $id = (string)$entry['detail_id'];
        $value = $entry['quantity'] ?? null;
        if (isset($quantities[$id]) || !isset($available[$id])) {
            throw new InvalidArgumentException('A selected product is duplicated or no longer belongs to this bill. Reload the bill.');
        }
        if ((!is_string($value) && !is_int($value) && !is_float($value)) || !is_numeric($value)
            || !is_finite((float)$value) || (float)$value <= 0
            || abs((float)$value - round((float)$value, 4)) > 0.00000001) {
            throw new InvalidArgumentException('Split quantities must be positive numbers with at most four decimal places.');
        }
        $quantity = round((float)$value, 4);
        if ($quantity > (float)$available[$id]['sales_quantity']) {
            throw new InvalidArgumentException('A split quantity exceeds the quantity on this bill.');
        }
        $quantities[$id] = $quantity;
    }
    foreach ($available as $id => $item) {
        if (round((float)$item['sales_quantity'] - ($quantities[$id] ?? 0), 4) > 0) {
            return $quantities;
        }
    }
    throw new InvalidArgumentException('Keep at least one product quantity on the original bill.');
}

// Only trusted, explicitly selected column lists are passed to this helper.
function posSplitBillInsert(PDO $pdo, string $table, array $row): void
{
    $columns = implode(', ', array_map(static fn($column) => '`' . $column . '`', array_keys($row)));
    $stmt = $pdo->prepare('INSERT INTO ' . $table . ' (' . $columns . ') VALUES ('
        . implode(', ', array_fill(0, count($row), '?')) . ')');
    $stmt->execute(array_values($row));
}

function posSplitBillAllocate(PDO $pdo, string $category, string $unit): array
{
    $read = $pdo->prepare('SELECT * FROM tbl_pos_document_counters WHERE Category_Code = ? AND Unit_Code = ? FOR UPDATE');
    $read->execute([$category, $unit]);
    $counter = $read->fetch(PDO::FETCH_ASSOC);
    if (!$counter) {
        try {
            posSplitBillInsert($pdo, 'tbl_pos_document_counters', [
                'Category_Code' => $category, 'Unit_Code' => $unit,
                'next_transaction_id' => 1000000001, 'next_order_slip_no' => 2000000001,
                'next_billing_no' => 3000000001, 'next_invoice_no' => 4000000001,
            ]);
        } catch (PDOException $error) {
            // Another creator can initialize this branch's counter first.
            if ($error->getCode() !== '23000') throw $error;
        }
        $read->execute([$category, $unit]);
        $counter = $read->fetch(PDO::FETCH_ASSOC);
    }
    if (!$counter) throw new RuntimeException('Could not allocate a transaction number.');
    // Protect installations whose counters were seeded below existing orders.
    $max = $pdo->prepare('SELECT MAX(transaction_id) AS transaction_id, MAX(order_slip_no) AS order_slip_no
        FROM tbl_pos_transactions WHERE Category_Code = ? AND Unit_Code = ?');
    $max->execute([$category, $unit]);
    $last = $max->fetch(PDO::FETCH_ASSOC);
    $transactionId = max(1000000001, (int)$counter['next_transaction_id'], (int)$last['transaction_id'] + 1);
    $orderSlip = max(2000000001, (int)$counter['next_order_slip_no'], (int)$last['order_slip_no'] + 1);
    $update = $pdo->prepare('UPDATE tbl_pos_document_counters SET next_transaction_id = ?, next_order_slip_no = ?
        WHERE Category_Code = ? AND Unit_Code = ?');
    $update->execute([$transactionId + 1, $orderSlip + 1, $category, $unit]);
    return [$transactionId, $orderSlip];
}

function posSplitBillTotals(array $items, float $charges): array
{
    $gross = 0.0;
    $vatable = 0.0;
    $exempt = 0.0;
    foreach ($items as $item) {
        $line = (float)$item['sales_quantity'] * (float)$item['selling_price'];
        $gross += $line;
        if (strtolower(trim((string)$item['vatable'])) === 'yes') $vatable += $line;
        else $exempt += $line;
    }
    $gross = round($gross, 2);
    return [
        'TotalSales' => $gross, 'Discount' => 0, 'OtherCharges' => $charges,
        'TotalAmountDue' => round($gross + $charges, 2),
        'VATableSales' => round($vatable / 1.12, 10), 'VATableSales_VAT' => round($vatable - $vatable / 1.12, 10),
        'VATExemptSales' => round($exempt, 10), 'VATExemptSales_VAT' => 0, 'VATZeroRatedSales' => 0,
    ];
}

function posSplitBill(PDO $pdo, array $input, callable $beforeCommit): array
{
    $scope = posSplitBillScope($input['transaction_id'] ?? '',
        $input['Category_Code'] ?? '', $input['Unit_Code'] ?? '');
    $token = $input['snapshot_token'] ?? null;
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        throw new InvalidArgumentException('Reload the bill before splitting.');
    }
    $pdo->beginTransaction();
    try {
        $state = posSplitBillRead($pdo, $scope);
        if (!hash_equals(posSplitBillSnapshot($state), $token)) {
            throw new DomainException('This bill has changed or was already split. Reload it before trying again.');
        }
        $reason = posSplitBillReason($state);
        if ($reason !== null) throw new DomainException($reason);
        $quantities = posSplitBillQuantities($state['items'], $input['items'] ?? null);
        $source = $state['transaction'];
        [$transactionId, $orderSlip] = posSplitBillAllocate($pdo, $scope[1], $scope[2]);
        $remaining = [];
        $moved = [];
        foreach ($state['items'] as $item) {
            $quantity = $quantities[$item['ID']] ?? 0;
            if ($quantity > 0) $moved[] = array_replace($item, ['sales_quantity' => $quantity]);
            $left = round((float)$item['sales_quantity'] - $quantity, 4);
            if ($left > 0) $remaining[] = array_replace($item, ['sales_quantity' => $left]);
        }
        // No charges or discounts are duplicated into the new bill. Saved
        // charges stay on the source and can be reviewed in normal billing.
        $charges = round((float)($source['OtherCharges'] ?? 0), 2);
        if (!is_finite($charges) || $charges < 0) throw new DomainException('Review invalid charges before splitting.');
        $sourceTotals = posSplitBillTotals($remaining, $charges);
        $newTotals = posSplitBillTotals($moved, 0);
        $new = [];
        foreach (['Category_Code', 'Unit_Code', 'Project_Code', 'transaction_type', 'transaction_date',
            'terminal_number', 'table_number', 'order_type', 'special_instructions', 'cashier', 'order_status'] as $column) {
            $new[$column] = $source[$column] ?? null;
        }
        $new = array_merge($new, $newTotals, [
            'transaction_id' => $transactionId, 'transaction_time' => date('h:i A'), 'order_slip_no' => $orderSlip,
            'purchase_order_no' => 0, 'billing_no' => 0, 'invoice_no' => 0, 'customer_exclusive_id' => '',
            'customer_head_count' => 1, 'customer_count_for_discount' => 0, 'discount_type' => 'No Discount',
            'payment_amount' => 0, 'payment_method' => '', 'change_amount' => 0, 'short_over' => 0,
            'remarks' => 'Pending for Payment', 'status' => 'Active', 'date_recorded' => date('Y-m-d H:i:s'),
        ]);
        posSplitBillInsert($pdo, 'tbl_pos_transactions', $new);
        $new['ID'] = $pdo->lastInsertId();
        $move = $pdo->prepare('UPDATE tbl_pos_transactions_detailed SET transaction_id = ?
            WHERE ID = ? AND transaction_id = ? AND Category_Code = ? AND Unit_Code = ?');
        $reduce = $pdo->prepare('UPDATE tbl_pos_transactions_detailed SET sales_quantity = ?
            WHERE ID = ? AND transaction_id = ? AND Category_Code = ? AND Unit_Code = ?');
        $originalItems = array_column($state['items'], null, 'ID');
        foreach ($moved as $item) {
            $original = $originalItems[$item['ID']];
            $left = round((float)$original['sales_quantity'] - (float)$item['sales_quantity'], 4);
            if ($left === 0.0) {
                $move->execute(array_merge([$transactionId, $item['ID']], $scope));
            } else {
                $reduce->execute(array_merge([$left, $item['ID']], $scope));
                $copy = [];
                foreach (['transaction_id', 'Category_Code', 'Unit_Code', 'transaction_date', 'product_id', 'sku',
                    'sales_quantity', 'landing_cost', 'unit_cost', 'selling_price', 'vatable', 'isDiscountable', 'order_status',
                    'item_instruction'] as $column) {
                    if (array_key_exists($column, $item)) $copy[$column] = $item[$column];
                }
                $copy['transaction_id'] = $transactionId;
                posSplitBillInsert($pdo, 'tbl_pos_transactions_detailed', $copy);
            }
        }
        $assignments = implode(', ', array_map(static fn($key) => $key . ' = ?', array_keys($sourceTotals)));
        $update = $pdo->prepare('UPDATE tbl_pos_transactions SET ' . $assignments
            . ' WHERE transaction_id = ? AND Category_Code = ? AND Unit_Code = ?');
        $update->execute(array_merge(array_values($sourceTotals), $scope));
        $source = array_replace($source, $sourceTotals);
        $userId = is_scalar($input['user_id'] ?? '') ? (string)($input['user_id'] ?? '') : '';
        $userName = is_scalar($input['user_name'] ?? '') ? (string)($input['user_name'] ?? '') : '';
        $auditData = [
            'source_transaction_id' => $scope[0], 'transaction_id' => $transactionId,
            'Unit_Code' => $scope[2],
            'order_slip_no' => $orderSlip, 'items' => $input['items'],
            'source_total' => $source['TotalAmountDue'], 'split_total' => $new['TotalAmountDue'],
        ];
        $audit = json_encode($auditData, JSON_THROW_ON_ERROR);
        // Existing installations store values_of_data in VARCHAR(255). Keep
        // old short records compatible while preserving durable linkage for
        // larger selections without relying on database truncation behavior.
        if (strlen($audit) > 255) {
            unset($auditData['items']);
            $auditData['item_count'] = count($input['items']);
            $audit = json_encode($auditData, JSON_THROW_ON_ERROR);
        }
        if (strlen($audit) > 255) throw new DomainException('The split history is too long to save safely.');
        posSplitBillInsert($pdo, 'tbl_main_activity_logs', [
            'Category_Code' => $scope[1], 'Unit_Code' => posBillAuditStoredUnit($pdo, 'tbl_main_activity_logs', $scope[2]), 'activity_date_time' => date('Y-m-d H:i:s'),
            'user_id' => $userId, 'user_name' => $userName, 'type_of_activity' => 'POS BILLING',
            'activity_performed' => 'SPLIT BILL', 'values_of_data' => $audit,
        ]);
        posSplitBillInsert($pdo, 'tbl_main_transaction_logs', [
            'Category_Code' => $scope[1], 'Unit_Code' => posBillAuditStoredUnit($pdo, 'tbl_main_transaction_logs', $scope[2]), 'Register' => $source['terminal_number'],
            'Trans_Date' => $source['transaction_date'], 'Reference_No' => (string)$orderSlip, 'Trans_Type' => 'SPLIT BILL',
            'User_ID' => is_numeric($userId) ? (int)$userId : 0, 'Amount' => $new['TotalSales'],
            'Description' => 'Split bill ' . $scope[0] . ' into transaction ' . $transactionId,
            'Log_Date' => date('Y-m-d'), 'Log_Time' => date('H:i:s'),
        ]);
        $beforeCommit($source, $new);
        $pdo->commit();
        return [
            'status' => 'success', 'source_transaction_id' => $scope[0], 'transaction_id' => $transactionId,
            'order_slip_no' => $orderSlip, 'source_transaction' => $source, 'transaction' => $new,
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
