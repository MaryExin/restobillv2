<?php

declare(strict_types=1);

final class QrOrderConflict extends RuntimeException
{
    public string $errorCode;
    public function __construct(string $message, string $errorCode)
    {
        parent::__construct($message, 409);
        $this->errorCode = $errorCode;
    }
}

/** The customer sends identifiers/quantities only; prices always come from POS pricing. */
final class QrOrderGateway
{
    private PDO $pdo;
    private array $config;

    public function __construct(PDO $pdo, array $config)
    {
        $this->pdo = $pdo;
        $this->config = $config;
    }

    public static function text($value, int $limit, string $field, bool $required = false): string
    {
        if (!is_string($value) && !is_numeric($value) && $value !== null) {
            throw new InvalidArgumentException("{$field} must be text.");
        }
        $value = trim((string)$value);
        if (strlen($value) > $limit || ($required && $value === '')) {
            throw new InvalidArgumentException("Invalid {$field}.");
        }
        return $value;
    }

    public static function uuid($value): string
    {
        $value = self::text($value, 36, 'request/order ID', true);
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $value)) {
            throw new InvalidArgumentException('A valid UUID request/order ID is required.');
        }
        return strtolower($value);
    }

    public static function normalizeSubmission(array $data): array
    {
        $orderType = strtoupper(self::text($data['order_type'] ?? 'DINE IN', 30, 'order_type', true));
        if (!in_array($orderType, ['DINE IN', 'TAKE OUT'], true)) {
            throw new InvalidArgumentException('Unsupported order type.');
        }
        $rawHeadCount = $data['customer_head_count'] ?? 1;
        $headCount = is_bool($rawHeadCount) ? false : filter_var($rawHeadCount, FILTER_VALIDATE_INT);
        if ($headCount === false || $headCount < 1 || $headCount > 100) {
            throw new InvalidArgumentException('Guest count must be between 1 and 100.');
        }
        $items = $data['items'] ?? null;
        if (!is_array($items) || count($items) < 1 || count($items) > 50 || array_values($items) !== $items) {
            throw new InvalidArgumentException('An order needs 1 to 50 item lines.');
        }
        $normalizedItems = [];
        $totalQuantity = 0;
        foreach ($items as $item) {
            if (!is_array($item)) throw new InvalidArgumentException('Invalid order item.');
            $rawQuantity = $item['quantity'] ?? null;
            $quantity = is_bool($rawQuantity) ? false : filter_var($rawQuantity, FILTER_VALIDATE_INT);
            if ($quantity === false || $quantity < 1 || $quantity > 99) {
                throw new InvalidArgumentException('Item quantity must be between 1 and 99.');
            }
            $totalQuantity += $quantity;
            $normalizedItems[] = [
                'product_id' => self::text($item['product_id'] ?? null, 100, 'product_id', true),
                'quantity' => $quantity,
                'item_instruction' => self::text($item['item_instruction'] ?? '', 500, 'item instruction'),
            ];
        }
        if ($totalQuantity > 200) throw new InvalidArgumentException('An order can contain at most 200 items.');
        return [
            'request_id' => self::uuid($data['request_id'] ?? null),
            'order_type' => $orderType,
            'table_number' => $orderType === 'DINE IN'
                ? self::text($data['table_number'] ?? null, 100, 'table_number', true) : '',
            'customer_name' => self::text($data['customer_name'] ?? '', 120, 'customer_name'),
            'customer_head_count' => $headCount,
            'notes' => self::text($data['notes'] ?? '', 1000, 'notes'),
            'items' => $normalizedItems,
            'continuation_order_id' => empty($data['continuation_order_id']) ? null : self::uuid($data['continuation_order_id']),
            'continuation_tracking_token' => self::text($data['continuation_tracking_token'] ?? '', 64, 'continuation_tracking_token'),
        ];
    }

    private function query(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function branch(string $category, string $unit): array
    {
        $row = $this->query('SELECT Unit_Name FROM tbl_main_business_units
            WHERE Category_Code = ? AND Unit_Code = ? AND Status = \'Active\' LIMIT 1', [$category, $unit])->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new InvalidArgumentException('The selected business unit is unavailable.');
        return $row;
    }

    private static function openTransactionSql(string $alias): string
    {
        $closed = "('PAID','VOID','VOIDED','CANCEL','CANCELLED','CANCELED','UNSPLIT','REFUND','REFUNDED','CLOSED')";
        return "COALESCE({$alias}.invoice_no, 0) = 0 AND COALESCE({$alias}.void_id, 0) = 0 AND COALESCE({$alias}.refund_id, 0) = 0
            AND UPPER(TRIM(COALESCE({$alias}.remarks, ''))) NOT IN {$closed}
            AND UPPER(TRIM(COALESCE({$alias}.status, ''))) NOT IN {$closed}
            AND UPPER(TRIM(COALESCE({$alias}.order_status, ''))) NOT IN {$closed}
            AND NOT EXISTS (SELECT 1 FROM tbl_pos_transactions_payments qp
                WHERE qp.transaction_id={$alias}.transaction_id AND qp.Category_Code={$alias}.Category_Code AND qp.Unit_Code={$alias}.Unit_Code)";
    }

    private function transaction(string $category, string $unit, $id, bool $lock = false): ?array
    {
        if (!$id) return null;
        $rows = $this->query('SELECT t.*, EXISTS(SELECT 1 FROM tbl_pos_transactions_payments p
            WHERE p.transaction_id=t.transaction_id AND p.Category_Code=t.Category_Code AND p.Unit_Code=t.Unit_Code) AS has_payment
            FROM tbl_pos_transactions t WHERE t.Category_Code=? AND t.Unit_Code=? AND t.transaction_id=?' . ($lock ? ' FOR UPDATE' : ''),
            [$category, $unit, $id])->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) > 1) throw new RuntimeException('Duplicate POS transaction numbers need staff review.', 409);
        return $rows[0] ?? null;
    }

    private static function transactionState(?array $row): string
    {
        if (!$row) return 'closed';
        if ((float)($row['void_id'] ?? 0) > 0 || (float)($row['refund_id'] ?? 0) > 0) return 'closed';
        foreach (['remarks', 'status', 'order_status'] as $key) {
            if (in_array(strtoupper(trim((string)($row[$key] ?? ''))), ['VOID','VOIDED','CANCEL','CANCELLED','CANCELED','UNSPLIT','REFUND','REFUNDED','CLOSED'], true)) return 'closed';
        }
        if ((float)($row['invoice_no'] ?? 0) > 0 || !empty($row['has_payment'])
            || strcasecmp(trim((string)($row['remarks'] ?? '')), 'Paid') === 0
            || strcasecmp(trim((string)($row['status'] ?? '')), 'Paid') === 0
            || strcasecmp(trim((string)($row['order_status'] ?? '')), 'Paid') === 0) return 'paid';
        return 'open';
    }

    private function continuation(string $category, string $unit, array $input): ?array
    {
        $id = $input['continuation_order_id'] ?? null;
        $token = self::text($input['continuation_tracking_token'] ?? '', 64, 'continuation_tracking_token');
        if (!$id && $token === '') return null;
        $id = self::uuid($id);
        $row = $this->query('SELECT * FROM tbl_pos_qr_orders WHERE order_id=? AND category_code=? AND unit_code=?', [$id, $category, $unit])->fetch(PDO::FETCH_ASSOC);
        if (!$row || !hash_equals($row['tracking_token'], $token) || $row['status'] !== 'accepted') {
            throw new QrOrderConflict('The previous order cannot authorize this table. Refresh your order status.', 'INVALID_CONTINUATION');
        }
        return $row;
    }

    public function tables(string $category, string $unit, ?array $prior = null): array
    {
        $rows = $this->query("SELECT tb.table_name FROM tbl_pos_tables tb WHERE tb.category_code = ? AND tb.unit_code = ?
            AND UPPER(TRIM(COALESCE(tb.status, ''))) NOT IN ('INACTIVE','DELETED') ORDER BY tb.table_name",
            [$category, $unit])->fetchAll(PDO::FETCH_ASSOC);
        $occupancy = [];
        foreach ($this->query('SELECT t.table_number FROM tbl_pos_transactions t WHERE t.Category_Code=? AND t.Unit_Code=? AND ' . self::openTransactionSql('t'), [$category, $unit])->fetchAll(PDO::FETCH_ASSOC) as $transaction) {
            foreach (preg_split('/\s*&\s*/', (string)($transaction['table_number'] ?? '')) as $name) {
                $key = strtoupper(trim($name));
                if ($key === '') continue;
                $occupancy[$key] = ($occupancy[$key] ?? 0) + 1;
            }
        }
        $target = $prior ? $this->transaction($category, $unit, $prior['transaction_id']) : null;
        foreach ($rows as &$row) {
            $count = $occupancy[strtoupper(trim($row['table_name']))] ?? 0;
            $row['occupied'] = $count > 0;
            $row['available'] = !$row['occupied'];
            $row['can_continue'] = $prior && $prior['order_type'] === 'DINE IN' && $prior['table_number'] === $row['table_name']
                && $count === 1 && $target && $target['table_number'] === $row['table_name'] && self::transactionState($target) === 'open';
        }
        unset($row);
        return $rows;
    }

    public function setup(string $category, string $unit): array
    {
        $branch = $this->branch($category, $unit);
        $this->query('INSERT INTO tbl_pos_qr_hosts (category_code, unit_code, host_token, created_at)
            VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE category_code = VALUES(category_code)',
            [$category, $unit, bin2hex(random_bytes(32)), date('Y-m-d H:i:s')]);
        $token = $this->query('SELECT host_token FROM tbl_pos_qr_hosts WHERE category_code = ? AND unit_code = ?',
            [$category, $unit])->fetchColumn();
        return ['host_token' => $token, 'category_code' => $category, 'unit_code' => $unit,
            'business_name' => $branch['Unit_Name'], 'tables' => $this->tables($category, $unit)];
    }

    public function verifyHost(string $category, string $unit, string $token): void
    {
        $stored = $this->query('SELECT host_token FROM tbl_pos_qr_hosts WHERE category_code = ? AND unit_code = ?',
            [$category, $unit])->fetchColumn();
        if (!is_string($stored) || strlen($token) !== 64 || !hash_equals($stored, $token)) {
            throw new RuntimeException('QR host authorization failed.', 401);
        }
        $this->branch($category, $unit);
    }

    private function orderTypes(string $unit): array
    {
        return $this->query("SELECT DISTINCT UPPER(TRIM(st.description)) AS order_type
            FROM tbl_pricing_by_sales_type map
            JOIN lkp_sales_type st ON st.sales_type_id = map.sales_type_id AND st.deletestatus = 'Active'
            WHERE map.busunitcode = ? AND map.deletestatus = 'Active'
              AND UPPER(TRIM(st.description)) IN ('DINE IN', 'TAKE OUT') ORDER BY order_type", [$unit])->fetchAll(PDO::FETCH_COLUMN);
    }

    private function products(string $category, string $unit, string $orderType): array
    {
        $pricing = $this->query("SELECT map.pricing_category FROM tbl_pricing_by_sales_type map
            JOIN lkp_sales_type st ON st.sales_type_id = map.sales_type_id AND st.deletestatus = 'Active'
            WHERE map.busunitcode = ? AND map.deletestatus = 'Active'
              AND UPPER(TRIM(st.description)) = ? ORDER BY map.seq DESC LIMIT 1", [$unit, $orderType])->fetchColumn();
        if (!$pricing) throw new InvalidArgumentException('Pricing is not configured for this order type.');
        $rows = $this->query("SELECT p.product_id, p.item_name, p.item_description, p.item_category,
                p.unit_of_measure, p.sku, p.vatable, p.isDiscountable,
                d.cost_per_uom AS unit_cost, d.srp AS selling_price
            FROM tbl_inventory_products_masterlist p
            JOIN (SELECT inv_code, MAX(seq) AS latest_seq FROM tbl_pricing_details
                WHERE pricing_code = ? AND deletestatus = 'Active' GROUP BY inv_code) latest
                ON latest.inv_code = p.product_id
            JOIN tbl_pricing_details d ON d.seq = latest.latest_seq AND d.inv_code = latest.inv_code
            WHERE p.category_code = ? AND p.unit_code = ? AND p.status = 'Active'
              AND d.srp IS NOT NULL AND d.srp >= 0
            ORDER BY p.item_category, p.item_name", [$pricing, $category, $unit])->fetchAll(PDO::FETCH_ASSOC);
        $products = [];
        foreach ($rows as $row) {
            $row['selling_price'] = round((float)$row['selling_price'], 4);
            $row['unit_cost'] = round((float)($row['unit_cost'] ?? 0), 4);
            $products[(string)$row['product_id']] = $row;
        }
        return $products;
    }

    public function menu(string $category, string $unit, string $orderType, array $input = []): array
    {
        $branch = $this->branch($category, $unit);
        $types = $this->orderTypes($unit);
        if (!in_array($orderType, $types, true)) {
            $orderType = $types[0] ?? '';
        }
        $products = [];
        if ($orderType !== '') {
            foreach ($this->products($category, $unit, $orderType) as $product) {
                unset($product['unit_cost'], $product['sku'], $product['isDiscountable']);
                $products[] = $product;
            }
        }
        $prior = $this->continuation($category, $unit, $input);
        $target = $prior ? $this->transaction($category, $unit, $prior['transaction_id']) : null;
        $continuation = $prior ? ['order_id' => $prior['order_id'], 'table_number' => $prior['table_number'],
            'transaction_state' => self::transactionState($target),
            'can_continue' => self::transactionState($target) === 'open' && $target['table_number'] === $prior['table_number']] : null;
        return ['business_name' => $branch['Unit_Name'], 'category_code' => $category, 'unit_code' => $unit,
            'order_type' => $orderType, 'order_types' => $types, 'products' => $products,
            'tables' => $this->tables($category, $unit, $prior), 'continuation' => $continuation,
            'service_charge' => $this->serviceCharge($orderType)];
    }

    private function assertTable(string $category, string $unit, array $data): void
    {
        if ($data['order_type'] !== 'DINE IN') return;
        $valid = $this->query("SELECT ID FROM tbl_pos_tables WHERE category_code = ? AND unit_code = ? AND table_name = ?
            AND UPPER(TRIM(COALESCE(status, ''))) NOT IN ('INACTIVE', 'DELETED') LIMIT 1 FOR UPDATE",
            [$category, $unit, $data['table_number']])->fetchColumn();
        if (!$valid) throw new InvalidArgumentException('Choose a valid restaurant table.');
    }

    /** The scoped physical table lock is held before checking/locking its POS headers. */
    private function resolveTarget(string $category, string $unit, array $data, ?array $prior): ?array
    {
        if ($data['order_type'] !== 'DINE IN') return null;
        if ($prior && ($prior['table_number'] !== $data['table_number'] || $prior['order_type'] !== $data['order_type'])) {
            throw new QrOrderConflict('The previous receipt belongs to a different table or order type.', 'INVALID_CONTINUATION');
        }
        $target = $prior ? $this->transaction($category, $unit, $prior['transaction_id'], true) : null;
        if ($target && self::transactionState($target) === 'open'
            && ($target['table_number'] !== $data['table_number'] || strcasecmp($target['order_type'], $data['order_type']) !== 0)) {
            throw new QrOrderConflict('This bill was moved. Ask the cashier to confirm your table.', 'INVALID_CONTINUATION');
        }
        $open = [];
        foreach ($this->query('SELECT t.transaction_id,t.table_number FROM tbl_pos_transactions t
            WHERE t.Category_Code=? AND t.Unit_Code=? AND ' . self::openTransactionSql('t') . ' FOR UPDATE',
            [$category, $unit])->fetchAll(PDO::FETCH_ASSOC) as $transaction) {
            $names = array_map(static fn($value) => strtoupper(trim($value)), preg_split('/\s*&\s*/', (string)($transaction['table_number'] ?? '')));
            if (in_array(strtoupper($data['table_number']), $names, true)) $open[] = $transaction['transaction_id'];
        }
        if ($target && self::transactionState($target) === 'open' && count($open) === 1 && (string)$open[0] === (string)$target['transaction_id']) return $target;
        if ($open !== []) {
            throw new QrOrderConflict('This table already has an open bill. Use your accepted order receipt to add items, or choose an available table.', 'TABLE_UNAVAILABLE');
        }
        return null;
    }

    private function serviceCharge(string $orderType): array
    {
        $rows = $this->query("SELECT description, value FROM tbl_pos_settings WHERE category = 'Service' ORDER BY ID DESC")
            ->fetchAll(PDO::FETCH_ASSOC);
        $settings = [];
        foreach ($rows as $row) {
            if (!array_key_exists($row['description'], $settings)) $settings[$row['description']] = $row['value'];
        }
        $enabled = in_array(strtolower(trim((string)($settings['Service Charge Enabled'] ?? ''))), ['true','1','yes','on'], true);
        $basis = ($settings['Service Charge Basis'] ?? '') === 'vat_exclusive_less_discount'
            ? 'vat_exclusive_less_discount' : 'net_after_deductions';
        $charges = [];
        if ($enabled) {
            $typeIds = $this->query("SELECT sales_type_id FROM lkp_sales_type WHERE deletestatus='Active' AND UPPER(TRIM(description))=?", [$orderType])->fetchAll(PDO::FETCH_COLUMN);
            // Older databases have only ID/category/particulars. No automatic charge
            // is configured there; read optional fields without assuming a migration.
            $rows = $this->query("SELECT * FROM tbl_pos_list_of_other_charges WHERE category='POS' ORDER BY ID")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                if ((int)($row['is_enabled'] ?? 0) !== 1 || strtoupper(trim($row['particulars'])) === 'CORKAGE') continue;
                $mapped = json_decode((string)($settings['Service Charge Auto Types: ' . $row['ID']] ?? '[]'), true);
                if (!is_array($mapped) || !array_intersect($typeIds, $mapped)) continue;
                $amount = (float)($row['amount'] ?? 0);
                if (!is_finite($amount) || $amount <= 0) continue;
                $charges[] = ['particulars' => $row['particulars'], 'amount' => $amount,
                    'rate_type' => ($row['rate_type'] ?? '') === 'Fixed' ? 'Fixed' : 'Percentage'];
            }
        }
        return ['enabled' => $enabled, 'basis' => $basis, 'charges' => $charges];
    }

    /** Matches the existing billing service-charge bases before any discounts. */
    public static function estimateCharges(array $items, array $catalog, array $settings): array
    {
        $subtotal = 0.0;
        $vatExclusive = 0.0;
        foreach ($items as $item) {
            $product = $catalog[$item['product_id']];
            $line = (float)$product['selling_price'] * (int)$item['quantity'];
            $subtotal += round($line, 2);
            $vatExclusive += strtolower(trim((string)($product['vatable'] ?? ''))) === 'yes' ? $line / 1.12 : $line;
        }
        $base = ($settings['basis'] ?? '') === 'vat_exclusive_less_discount' ? $vatExclusive : $subtotal / 1.12;
        $charge = 0.0;
        if ($settings['enabled'] ?? false) {
            foreach ($settings['charges'] ?? [] as $row) {
                $charge += round($row['rate_type'] === 'Fixed' ? (float)$row['amount'] : $base * (float)$row['amount'] / 100, 2);
            }
        }
        return ['subtotal_amount' => round($subtotal, 2), 'service_charge_amount' => round($charge, 2),
            'total_amount' => round($subtotal + $charge, 2)];
    }

    private function receipt(array $row, bool $includeToken = false): array
    {
        $result = [];
        foreach (['order_id', 'status', 'transaction_id', 'order_slip_no', 'rejection_reason', 'created_at', 'processed_at'] as $key) {
            $result[$key] = $row[$key] ?? null;
        }
        $result['total_amount'] = (float)$row['total_amount'];
        $result['subtotal_amount'] = (float)$row['subtotal_amount'];
        $result['service_charge_amount'] = (float)$row['service_charge_amount'];
        $target = ($row['status'] ?? '') === 'accepted'
            ? $this->transaction($row['category_code'], $row['unit_code'], $row['transaction_id']) : null;
        $result['transaction_state'] = ($row['status'] ?? '') === 'accepted' ? self::transactionState($target) : null;
        $result['can_continue'] = $target && self::transactionState($target) === 'open'
            && ($row['order_type'] ?? '') === 'DINE IN' && $target['table_number'] === ($row['table_number'] ?? null);
        $result['requires_rebilling'] = $target && ($target['remarks'] ?? '') === 'Pending QR Rebill';
        $result['is_additional'] = false;
        if (!empty($row['continuation_order_id']) && !empty($row['transaction_id'])) {
            $previousId = $this->query("SELECT transaction_id FROM tbl_pos_qr_orders
                WHERE order_id=? AND category_code=? AND unit_code=? AND status='accepted'",
                [$row['continuation_order_id'], $row['category_code'], $row['unit_code']])->fetchColumn();
            $result['is_additional'] = $previousId !== false && (string)$previousId === (string)$row['transaction_id'];
        }
        if ($includeToken) $result['tracking_token'] = $row['tracking_token'];
        return $result;
    }

    public function submit(string $category, string $unit, array $input): array
    {
        $data = self::normalizeSubmission($input);
        $hashData = $data;
        if (!$data['continuation_order_id'] && $data['continuation_tracking_token'] === '') {
            // Keep pre-continuation request hashes valid during deployment/retries.
            unset($hashData['continuation_order_id'], $hashData['continuation_tracking_token']);
        }
        $hash = hash('sha256', json_encode($hashData, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        $this->pdo->beginTransaction();
        try {
            // Serialize branch submissions and retry lookup before checking a changed menu.
            $this->query('SELECT unit_code FROM tbl_pos_qr_hosts WHERE category_code = ? AND unit_code = ? FOR UPDATE', [$category, $unit]);
            $existing = $this->query('SELECT * FROM tbl_pos_qr_orders WHERE category_code = ? AND unit_code = ? AND request_id = ?',
                [$category, $unit, $data['request_id']])->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                if (!hash_equals($existing['request_hash'], $hash)) throw new RuntimeException('This request ID was already used for a different order.', 409);
                $this->pdo->commit();
                return $this->receipt($existing, true);
            }
            $this->assertTable($category, $unit, $data);
            $prior = $this->continuation($category, $unit, $data);
            $this->resolveTarget($category, $unit, $data, $prior);
            $catalog = $this->products($category, $unit, $data['order_type']);
            $total = 0.0;
            foreach ($data['items'] as $item) {
                $product = $catalog[$item['product_id']] ?? null;
                if (!$product) throw new InvalidArgumentException('An item is no longer available. Refresh the menu.');
                $total += round($product['selling_price'] * $item['quantity'], 2);
            }
            $estimate = self::estimateCharges($data['items'], $catalog, $this->serviceCharge($data['order_type']));
            $orderId = $data['request_id'];
            $token = bin2hex(random_bytes(32));
            $created = date('Y-m-d H:i:s');
            $this->query('INSERT INTO tbl_pos_qr_orders (order_id,category_code,unit_code,request_id,request_hash,tracking_token,
                customer_name,customer_head_count,table_number,order_type,notes,subtotal_amount,service_charge_amount,total_amount,created_at,continuation_order_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [$orderId, $category, $unit, $data['request_id'], $hash, $token,
                $data['customer_name'] ?: null, $data['customer_head_count'], $data['table_number'] ?: null,
                $data['order_type'], $data['notes'] ?: null, $estimate['subtotal_amount'], $estimate['service_charge_amount'], $estimate['total_amount'], $created, $prior['order_id'] ?? null]);
            foreach ($data['items'] as $item) {
                $product = $catalog[$item['product_id']];
                $this->query('INSERT INTO tbl_pos_qr_order_items (order_id,product_id,item_name,item_category,sku,quantity,unit_cost,selling_price,vatable,is_discountable,item_instruction)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)', [$orderId, $item['product_id'], $product['item_name'], $product['item_category'] ?? '', $product['sku'] ?: null,
                    $item['quantity'], $product['unit_cost'], $product['selling_price'], $product['vatable'] ?? 'Yes',
                    $product['isDiscountable'] ?? '', $item['item_instruction'] ?: null]);
            }
            $this->pdo->commit();
            return $this->receipt(['order_id' => $orderId, 'tracking_token' => $token, 'status' => 'pending',
                'created_at' => $created] + $estimate, true);
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    public function status(string $category, string $unit, array $data): array
    {
        $id = self::uuid($data['order_id'] ?? null);
        $token = self::text($data['tracking_token'] ?? '', 64, 'tracking_token', true);
        $row = $this->query('SELECT * FROM tbl_pos_qr_orders WHERE order_id = ? AND category_code = ? AND unit_code = ?',
            [$id, $category, $unit])->fetch(PDO::FETCH_ASSOC);
        if (!$row || !hash_equals($row['tracking_token'], $token)) throw new RuntimeException('Order not found.', 404);
        return $this->receipt($row);
    }

    public function pending(string $category, string $unit): array
    {
        $branch = $this->branch($category, $unit);
        $orders = $this->query("SELECT order_id,customer_name,customer_head_count,table_number,order_type,notes,subtotal_amount,service_charge_amount,total_amount,status,created_at
            FROM tbl_pos_qr_orders WHERE category_code = ? AND unit_code = ? AND status = 'pending'
            ORDER BY created_at ASC LIMIT 200", [$category, $unit])->fetchAll(PDO::FETCH_ASSOC);
        foreach ($orders as &$order) {
            $order['total_amount'] = (float)$order['total_amount'];
            $order['items'] = $this->items($order['order_id']);
            foreach ($order['items'] as &$item) {
                unset($item['unit_cost'], $item['vatable'], $item['is_discountable']);
            }
            unset($item);
        }
        unset($order);
        return ['orders' => $orders, 'tables' => $this->tables($category, $unit), 'business_name' => $branch['Unit_Name']];
    }

    private function items(string $orderId): array
    {
        return $this->query('SELECT product_id,item_name,item_category,sku,quantity,unit_cost,selling_price,vatable,is_discountable,item_instruction
            FROM tbl_pos_qr_order_items WHERE order_id = ? ORDER BY id', [$orderId])->fetchAll(PDO::FETCH_ASSOC);
    }

    private function appendToTransaction(array $target, array $cart, string $notes, string $userId, string $cashier): array
    {
        if (!$this->pdo->inTransaction() || self::transactionState($target) !== 'open') {
            throw new LogicException('Additional orders require a locked, open transaction.');
        }
        $hasInstructions = posOrderHasItemInstructionColumn($this->pdo);
        posOrderValidateItemInstructions($cart, $hasInstructions);
        $insert = $this->pdo->prepare(posOrderDetailInsertSql($hasInstructions, true));
        $batchTotal = 0.0;
        foreach ($cart as $item) {
            $params = [':transaction_id' => $target['transaction_id'], ':Category_Code' => $target['Category_Code'],
                ':Unit_Code' => $target['Unit_Code'], ':transaction_date' => $target['transaction_date']];
            foreach (['product_id','sku','sales_quantity','landing_cost','unit_cost','selling_price','vatable','isDiscountable','order_status'] as $key) $params[':' . $key] = $item[$key];
            if ($hasInstructions) $params[':item_instruction'] = posOrderItemInstruction($item);
            $insert->execute($params);
            $batchTotal += round((float)$item['sales_quantity'] * (float)$item['selling_price'], 2);
        }
        $scope = [$target['transaction_id'], $target['Category_Code'], $target['Unit_Code']];
        $allItems = $this->query('SELECT sales_quantity,selling_price,vatable FROM tbl_pos_transactions_detailed
            WHERE transaction_id=? AND Category_Code=? AND Unit_Code=? ORDER BY ID', $scope)->fetchAll(PDO::FETCH_ASSOC);
        $gross = $taxableGross = $exempt = 0.0;
        foreach ($allItems as $item) {
            $line = (float)$item['sales_quantity'] * (float)$item['selling_price'];
            $gross += $line;
            if (strtolower(trim((string)$item['vatable'])) === 'yes') $taxableGross += $line;
            else $exempt += $line;
        }
        $needsRebill = (float)$target['billing_no'] > 0 || (float)$target['Discount'] > 0
            || (float)$target['OtherCharges'] > 0 || (float)$target['VATExemptSales_VAT'] > 0
            || $target['remarks'] === 'Pending QR Rebill';
        $combinedNotes = trim((string)$target['special_instructions']);
        $combinedNotes .= ($combinedNotes !== '' ? "\n\n" : '') . $notes;
        if ($needsRebill) {
            // Keep the billed financial snapshot/discount/charge rows intact. A
            // real re-bill must recompute it; simply adding gross would silently
            // leave percentage charges and customer VAT exemptions outdated.
            $this->query("UPDATE tbl_pos_transactions SET remarks='Pending QR Rebill',special_instructions=?
                WHERE transaction_id=? AND Category_Code=? AND Unit_Code=?", array_merge([$combinedNotes], $scope));
        } else {
            $vatSales = $taxableGross / 1.12;
            $this->query("UPDATE tbl_pos_transactions SET TotalSales=?,TotalAmountDue=?,VATableSales=?,VATableSales_VAT=?,
                VATExemptSales=?,VATExemptSales_VAT=0,VATZeroRatedSales=0,remarks='Pending',special_instructions=?
                WHERE transaction_id=? AND Category_Code=? AND Unit_Code=?",
                array_merge([round($gross, 2), round($gross, 2), $vatSales, $taxableGross - $vatSales, $exempt, $combinedNotes], $scope));
        }
        $this->query('INSERT INTO tbl_main_activity_logs (Category_Code,Unit_Code,activity_date_time,user_id,user_name,type_of_activity,activity_performed,values_of_data)
            VALUES (?,?,?,?,?,?,?,?)', [$target['Category_Code'], $target['Unit_Code'], date('Y-m-d H:i:s'), $userId, $cashier,
            'POS ORDER', 'ADD QR ORDER', json_encode(['transaction_id' => $target['transaction_id'], 'batch_total' => round($batchTotal, 2),
                'requires_rebilling' => $needsRebill, 'items' => $cart], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
        $this->query('INSERT INTO tbl_main_transaction_logs (Category_Code,Unit_Code,Register,Trans_Date,Reference_No,Trans_Type,User_ID,Amount,Description,Log_Date,Log_Time)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)', [$target['Category_Code'], $target['Unit_Code'], $target['terminal_number'], $target['transaction_date'],
            $target['order_slip_no'], 'ADDITIONAL ORDER', is_numeric($userId) ? (int)$userId : 0, round($batchTotal, 2),
            'QR additional order | Transaction ID: ' . $target['transaction_id'] . ' | Cashier: ' . $cashier, date('Y-m-d'), date('H:i:s')]);
        mirrorPosTransactionToReport($this->pdo, $this->config, (string)$target['transaction_id'], $target['Category_Code'], $target['Unit_Code']);
        return ['transaction_id' => $target['transaction_id'], 'order_slip_no' => $target['order_slip_no'], 'total_amount' => round($batchTotal, 2)];
    }

    public function process(string $category, string $unit, string $action, array $data, string $userId, string $cashier): array
    {
        $id = self::uuid($data['order_id'] ?? null);
        $this->pdo->beginTransaction();
        try {
            // Same ordering as submit: branch host, QR row, physical table, POS
            // header. This serializes competing guests across POS terminals.
            $this->query('SELECT unit_code FROM tbl_pos_qr_hosts WHERE category_code=? AND unit_code=? FOR UPDATE', [$category, $unit]);
            $order = $this->query('SELECT * FROM tbl_pos_qr_orders WHERE order_id = ? AND category_code = ? AND unit_code = ? FOR UPDATE',
                [$id, $category, $unit])->fetch(PDO::FETCH_ASSOC);
            if (!$order) throw new RuntimeException('Order not found.', 404);
            if ($order['status'] !== 'pending') {
                if (($action === 'accept' && $order['status'] === 'accepted') || ($action === 'reject' && $order['status'] === 'rejected')) {
                    $this->pdo->commit();
                    return $this->receipt($order);
                }
                throw new RuntimeException('This order was already processed.', 409);
            }
            $processed = date('Y-m-d H:i:s');
            if ($action === 'reject') {
                $reason = self::text($data['rejection_reason'] ?? '', 255, 'rejection_reason') ?: 'Unable to accept this order. Please speak to the staff.';
                $this->query("UPDATE tbl_pos_qr_orders SET status='rejected',rejection_reason=?,processed_by=?,processed_at=? WHERE order_id=?",
                    [$reason, $userId, $processed, $id]);
                $order = array_merge($order, ['status' => 'rejected', 'rejection_reason' => $reason, 'processed_at' => $processed]);
            } else {
                $terminal = self::text($data['terminal_number'] ?? '', 30, 'terminal_number', true);
                $shift = $this->query("SELECT Opening_DateTime FROM tbl_pos_shifting_records WHERE Category_Code=? AND Unit_Code=?
                    AND terminal_number=? AND Shift_Status='Open' AND Status='Active' ORDER BY Opening_DateTime DESC LIMIT 1 FOR UPDATE",
                    [$category, $unit, $terminal])->fetchColumn();
                if (!$shift) throw new RuntimeException('Open a shift on this terminal before accepting QR orders.', 409);
                $shiftTime = strtotime((string)$shift);
                if (!$shiftTime) throw new RuntimeException('The open shift has an invalid business date.', 409);
                $this->assertTable($category, $unit, $order);
                $prior = empty($order['continuation_order_id']) ? null : $this->query("SELECT * FROM tbl_pos_qr_orders
                    WHERE order_id=? AND category_code=? AND unit_code=? AND status='accepted'",
                    [$order['continuation_order_id'], $category, $unit])->fetch(PDO::FETCH_ASSOC);
                if (!empty($order['continuation_order_id']) && !$prior) throw new QrOrderConflict('The previous accepted receipt is unavailable.', 'INVALID_CONTINUATION');
                $target = $this->resolveTarget($category, $unit, $order, $prior ?: null);
                $catalog = $this->products($category, $unit, $order['order_type']);
                $items = $this->items($id);
                $cart = [];
                foreach ($items as $item) {
                    $product = $catalog[$item['product_id']] ?? null;
                    if (!$product || abs($product['selling_price'] - (float)$item['selling_price']) > 0.00001) {
                        throw new RuntimeException('An item is unavailable or its price changed. Reject this order and ask the customer to submit again.', 409);
                    }
                    $cart[] = ['product_id' => $item['product_id'], 'sku' => $item['sku'] ?: $item['product_id'],
                        'sales_quantity' => (int)$item['quantity'], 'landing_cost' => $product['unit_cost'],
                        'unit_cost' => $product['unit_cost'], 'selling_price' => (float)$item['selling_price'],
                        'vatable' => $product['vatable'] ?? 'Yes', 'isDiscountable' => $product['isDiscountable'] ?? '',
                        'order_status' => 'ACTIVE', 'item_instruction' => $item['item_instruction']];
                }
                $notes = 'QR order ' . $id;
                if ($order['customer_name']) $notes .= ' | Guest: ' . $order['customer_name'];
                if ($order['notes']) $notes .= "\n" . $order['notes'];
                $saved = $target ? $this->appendToTransaction($target, $cart, $notes, $userId, $cashier) : posSaveOrder($this->pdo, $this->config, [
                    'Category_Code' => $category, 'Unit_Code' => $unit, 'transaction_type' => 'PRODUCT',
                    'transaction_date' => date('Y-m-d', $shiftTime), 'transaction_time' => date('h:i A'),
                    'terminal_number' => $terminal, 'table_number' => $order['table_number'] ?: 'TAKE OUT',
                    'order_type' => $order['order_type'], 'customer_head_count' => (int)$order['customer_head_count'],
                    'special_instructions' => $notes, 'cashier' => $cashier, 'user_id' => $userId, 'user_name' => $cashier,
                    'remarks' => 'Pending', 'order_status' => 'Pending', 'status' => 'Active',
                    'void_date' => '0000-00-00 00:00:00', 'refund_date' => '0000-00-00 00:00:00', 'cart_items' => $cart,
                ], false);
                $this->query("UPDATE tbl_pos_qr_orders SET status='accepted',transaction_id=?,order_slip_no=?,terminal_number=?,processed_by=?,processed_at=? WHERE order_id=?",
                    [$saved['transaction_id'], $saved['order_slip_no'], $terminal, $userId, $processed, $id]);
                $order = array_merge($order, ['status' => 'accepted', 'transaction_id' => $saved['transaction_id'],
                    'order_slip_no' => $saved['order_slip_no'], 'processed_at' => $processed]);
            }
            $this->pdo->commit();
            return $this->receipt($order);
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }
}
