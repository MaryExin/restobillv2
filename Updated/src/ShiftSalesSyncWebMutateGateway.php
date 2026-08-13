<?php

declare(strict_types=1);

class ShiftSalesSyncWebMutateGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function uploadExportedShifts(array $data, int|string $userId): array
    {
        $shifts = $data['shifts'] ?? [];
        $reportDataset = $data['report_dataset'] ?? null;

        if (!is_array($shifts) || count($shifts) === 0) {
            return ['message' => 'NoRows'];
        }

        if (
            $reportDataset !== null
            && (!is_array($reportDataset)
                || !is_array($reportDataset['shifts'] ?? null)
                || count($reportDataset['shifts']) === 0)
        ) {
            return ['message' => 'ReportRowsMissing'];
        }

        try {
            $this->conn->beginTransaction();
            $primarySummary = $this->syncDataset($data, $this->destinationTables(false));
            $reportSummary = $reportDataset !== null
                ? $this->syncDataset($reportDataset, $this->destinationTables(true))
                : null;

            $primarySummary = array_merge(
                $primarySummary,
                $this->verifyDataset($data, $this->destinationTables(false))
            );
            if ($reportDataset !== null && $reportSummary !== null) {
                $reportSummary = array_merge(
                    $reportSummary,
                    $this->verifyDataset($reportDataset, $this->destinationTables(true))
                );
            }

            $databaseName = (string) $this->conn->query('SELECT DATABASE()')->fetchColumn();
            $this->conn->commit();

            $summaryMessage = $reportSummary === null
                ? $this->formatTargetSummary('Main WEB', $primarySummary)
                : $this->formatTargetSummary('Main WEB', $primarySummary)
                    . ' ' . $this->formatTargetSummary('Report WEB', $reportSummary);
            $summaryMessage .= " Verified in online database: {$databaseName}.";

            return [
                'message' => 'Success',
                'synced_shifts' => $primarySummary['synced_shifts'],
                'synced_transactions' => $primarySummary['synced_transactions'],
                'synced_detailed' => $primarySummary['synced_detailed'],
                'synced_discounts' => $primarySummary['synced_discounts'],
                'synced_payments' => $primarySummary['synced_payments'],
                'synced_other_charges' => $primarySummary['synced_other_charges'],
                'synced_customers' => $primarySummary['synced_customers'],
                'synced_discounts_per_product' => $primarySummary['synced_discounts_per_product'],
                'synced_loyalty_discounts' => $primarySummary['synced_loyalty_discounts'],
                'target_summaries' => [
                    'primary' => $primarySummary,
                    'report' => $reportSummary,
                ],
                'database_name' => $databaseName,
                'summary_message' => $summaryMessage,
            ];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function syncDataset(array $data, array $tables): array
    {
        $shifts = is_array($data['shifts'] ?? null) ? $data['shifts'] : [];
        $transactions = is_array($data['transactions'] ?? null) ? $data['transactions'] : [];
        $details = is_array($data['details'] ?? null) ? $data['details'] : [];
        $discounts = is_array($data['discounts'] ?? null) ? $data['discounts'] : [];
        $payments = is_array($data['payments'] ?? null) ? $data['payments'] : [];
        $otherCharges = is_array($data['other_charges'] ?? null) ? $data['other_charges'] : [];
        $customers = is_array($data['customers'] ?? null) ? $data['customers'] : [];
        $discountsPerProduct = is_array($data['discounts_per_product'] ?? null)
            ? $data['discounts_per_product']
            : [];
        $loyaltyDiscounts = is_array($data['loyalty_discounts'] ?? null)
            ? $data['loyalty_discounts']
            : [];

        foreach ($shifts as $row) {
            $this->upsertWebShiftRecord($row, 'Synced', $tables['shifts']);
            $this->markWebShiftSynced(
                (string) ($row['Unit_Code'] ?? ''),
                (string) ($row['Shift_ID'] ?? ''),
                (string) ($row['terminal_number'] ?? ''),
                (string) ($row['Opening_DateTime'] ?? ''),
                $tables['shifts']
            );
        }

        foreach ($transactions as $row) {
            $this->upsertWebTransaction($row, $tables['transactions']);
            $this->deleteWebTransactionDetailsForScope($row, $tables['details']);
            $this->deleteWebScopedChildrenForTransaction(
                $row,
                $tables['customers'],
                'Category_Code',
                'Unit_Code'
            );
            $this->deleteWebScopedChildrenForTransaction(
                $row,
                $tables['discounts_per_product'],
                'category_code',
                'unit_code'
            );
            $this->deleteWebScopedChildrenForTransaction(
                $row,
                $tables['loyalty_discounts'],
                'Category_Code',
                'Unit_Code'
            );
        }

        foreach ($details as $row) {
            $this->upsertWebTransactionDetailed($row, $tables['details']);
        }
        foreach ($discounts as $row) {
            $this->upsertWebTransactionDiscount($row, $tables['discounts']);
        }
        foreach ($payments as $row) {
            $this->upsertWebTransactionPayment($row, $tables['payments']);
        }
        foreach ($otherCharges as $row) {
            $this->upsertWebTransactionOtherCharge($row, $tables['other_charges']);
        }
        foreach ($customers as $row) {
            $this->insertWebTransactionCustomer($row, $tables['customers']);
        }
        foreach ($discountsPerProduct as $row) {
            $this->insertWebDiscountPerProduct($row, $tables['discounts_per_product']);
        }
        foreach ($loyaltyDiscounts as $row) {
            $this->insertWebLoyaltyDiscount($row, $tables['loyalty_discounts']);
        }

        return [
            'synced_shifts' => count($shifts),
            'synced_transactions' => count($transactions),
            'synced_detailed' => count($details),
            'synced_discounts' => count($discounts),
            'synced_payments' => count($payments),
            'synced_other_charges' => count($otherCharges),
            'synced_customers' => count($customers),
            'synced_discounts_per_product' => count($discountsPerProduct),
            'synced_loyalty_discounts' => count($loyaltyDiscounts),
        ];
    }

    private function destinationTables(bool $report): array
    {
        $suffix = $report ? '_bd' : '';

        return [
            'shifts' => $this->quoteIdentifier('tbl_pos_shifting_records' . $suffix),
            'transactions' => $this->quoteIdentifier('tbl_pos_transactions' . $suffix),
            'details' => $this->quoteIdentifier('tbl_pos_transactions_detailed' . $suffix),
            'discounts' => $this->quoteIdentifier('tbl_pos_transactions_discounts' . $suffix),
            'payments' => $this->quoteIdentifier('tbl_pos_transactions_payments' . $suffix),
            'other_charges' => $this->quoteIdentifier('tbl_pos_transactions_other_charges' . $suffix),
            'customers' => $this->quoteIdentifier('tbl_pos_transactions_customers' . $suffix),
            'discounts_per_product' => $this->quoteIdentifier(
                'tbl_pos_transactions_discounts_per_product' . $suffix
            ),
            'loyalty_discounts' => $this->quoteIdentifier('tbl_pos_loyalty_discounts' . $suffix),
        ];
    }

    private function formatTargetSummary(string $label, array $summary): string
    {
        return "{$label}: {$summary['synced_shifts']} shift(s), "
            . "{$summary['synced_transactions']} transaction(s), "
            . "{$summary['synced_detailed']} detailed row(s), "
            . "{$summary['synced_discounts']} discount row(s), "
            . "{$summary['synced_payments']} payment row(s), "
            . "{$summary['synced_other_charges']} other charge row(s), "
            . "{$summary['synced_customers']} customer row(s), "
            . "{$summary['synced_discounts_per_product']} product discount row(s), and "
            . "{$summary['synced_loyalty_discounts']} loyalty row(s).";
    }

    private function verifyDataset(array $data, array $tables): array
    {
        $transactions = is_array($data['transactions'] ?? null) ? $data['transactions'] : [];
        $checks = [
            'shifts' => [
                'expected' => count(is_array($data['shifts'] ?? null) ? $data['shifts'] : []),
                'actual' => $this->countVerifiedShifts($data['shifts'] ?? [], $tables['shifts']),
            ],
            'transactions' => [
                'expected' => count($transactions),
                'actual' => $this->countVerifiedTransactionRows(
                    $transactions,
                    $tables['transactions'],
                    'Category_Code',
                    'Unit_Code',
                    true
                ),
            ],
            'details' => $this->verifiedChildCount(
                $data,
                'details',
                $transactions,
                $tables['details'],
                'Category_Code',
                'Unit_Code',
                true
            ),
            'discounts' => $this->verifiedChildCount(
                $data,
                'discounts',
                $transactions,
                $tables['discounts'],
                'Category_Code',
                'Unit_Code',
                true
            ),
            'payments' => $this->verifiedChildCount(
                $data,
                'payments',
                $transactions,
                $tables['payments'],
                'Category_Code',
                'Unit_Code',
                true
            ),
            'other_charges' => $this->verifiedChildCount(
                $data,
                'other_charges',
                $transactions,
                $tables['other_charges'],
                'Category_Code',
                'Unit_Code',
                true
            ),
            'customers' => $this->verifiedChildCount(
                $data,
                'customers',
                $transactions,
                $tables['customers'],
                'Category_Code',
                'Unit_Code'
            ),
            'discounts_per_product' => $this->verifiedChildCount(
                $data,
                'discounts_per_product',
                $transactions,
                $tables['discounts_per_product'],
                'category_code',
                'unit_code'
            ),
            'loyalty_discounts' => $this->verifiedChildCount(
                $data,
                'loyalty_discounts',
                $transactions,
                $tables['loyalty_discounts'],
                'Category_Code',
                'Unit_Code'
            ),
        ];

        foreach ($checks as $tableKey => $check) {
            if ($check['actual'] < $check['expected']) {
                throw new RuntimeException(
                    "WEB persistence verification failed for {$tableKey}: "
                    . "expected {$check['expected']}, found {$check['actual']}."
                );
            }
        }

        return [
            'verified' => true,
            'verified_tables' => $checks,
        ];
    }

    private function verifiedChildCount(
        array $data,
        string $dataKey,
        array $transactions,
        string $table,
        string $categoryColumn,
        string $unitColumn,
        bool $includeTerminal = false
    ): array
    {
        return [
            'expected' => count(is_array($data[$dataKey] ?? null) ? $data[$dataKey] : []),
            'actual' => $this->countVerifiedTransactionRows(
                $transactions,
                $table,
                $categoryColumn,
                $unitColumn,
                $includeTerminal
            ),
        ];
    }

    private function countVerifiedShifts(array $shifts, string $table): int
    {
        $clauses = [];
        $values = [];
        $seen = [];

        foreach ($shifts as $row) {
            $unitCode = trim((string) ($row['Unit_Code'] ?? ''));
            $shiftId = trim((string) ($row['Shift_ID'] ?? ''));
            $terminal = trim((string) ($row['terminal_number'] ?? ''));
            $opening = trim((string) ($row['Opening_DateTime'] ?? ''));
            $key = $unitCode . '||' . $shiftId . '||' . $terminal . '||' . $opening;

            if (
                $unitCode === ''
                || $shiftId === ''
                || $terminal === ''
                || $opening === ''
                || isset($seen[$key])
            ) {
                continue;
            }

            $seen[$key] = true;
            $clauses[] = '(Unit_Code = ? AND Shift_ID = ? AND terminal_number = ? '
                . "AND Opening_DateTime = ? AND Status = 'Synced')";
            array_push($values, $unitCode, $shiftId, $terminal, $opening);
        }

        return $this->countByClauses($table, $clauses, $values);
    }

    private function countVerifiedTransactionRows(
        array $transactions,
        string $table,
        string $categoryColumn,
        string $unitColumn,
        bool $includeTerminal
    ): int
    {
        $categoryColumn = $this->quoteIdentifier($categoryColumn);
        $unitColumn = $this->quoteIdentifier($unitColumn);
        $clauses = [];
        $values = [];
        $seen = [];

        foreach ($transactions as $row) {
            $category = trim((string) ($row['Category_Code'] ?? ''));
            $unit = trim((string) ($row['Unit_Code'] ?? ''));
            $transactionId = trim((string) ($row['transaction_id'] ?? ''));
            $terminal = trim((string) ($row['terminal_number'] ?? ''));
            $key = $category . '||' . $unit . '||' . $transactionId;

            if ($includeTerminal) {
                $key .= '||' . $terminal;
            }

            if (
                $category === ''
                || $unit === ''
                || $transactionId === ''
                || ($includeTerminal && $terminal === '')
                || isset($seen[$key])
            ) {
                continue;
            }

            $seen[$key] = true;
            $clause = "({$categoryColumn} = ? AND {$unitColumn} = ? AND transaction_id = ?";
            array_push($values, $category, $unit, $transactionId);

            if ($includeTerminal) {
                $clause .= ' AND terminal_number = ?';
                $values[] = $terminal;
            }

            $clauses[] = $clause . ')';
        }

        return $this->countByClauses($table, $clauses, $values);
    }

    private function countByClauses(string $table, array $clauses, array $values): int
    {
        if (count($clauses) === 0) {
            return 0;
        }

        $where = implode(' OR ', $clauses);
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM {$table} WHERE {$where}");

        foreach ($values as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    private function upsertWebShiftRecord(
        array $row,
        string $statusValue,
        string $table
    ): void
    {
        $existingId = $this->findExistingWebShiftId(
            (string) ($row['Unit_Code'] ?? ''),
            (string) ($row['Shift_ID'] ?? ''),
            (string) ($row['terminal_number'] ?? ''),
            (string) ($row['Opening_DateTime'] ?? ''),
            $table
        );

        $params = [
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'Shift_ID' => $row['Shift_ID'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'Opening_User_ID' => $row['Opening_User_ID'] ?? null,
            'Opening_DateTime' => $row['Opening_DateTime'] ?? null,
            'Opening_Cash_Count' => $row['Opening_Cash_Count'] ?? null,
            'Closing_User_ID' => $row['Closing_User_ID'] ?? null,
            'Closing_DateTime' => $row['Closing_DateTime'] ?? null,
            'Closing_Cash_Count' => $row['Closing_Cash_Count'] ?? null,
            'Beg_OR' => $row['Beg_OR'] ?? null,
            'End_OR' => $row['End_OR'] ?? null,
            'Beg_VoidNo' => $row['Beg_VoidNo'] ?? null,
            'End_VoidNo' => $row['End_VoidNo'] ?? null,
            'Beg_RefundNo' => $row['Beg_RefundNo'] ?? null,
            'End_RefundNo' => $row['End_RefundNo'] ?? null,
            'Z_Counter_No' => $row['Z_Counter_No'] ?? null,
            'Grand_Accum_Sales' => $row['Grand_Accum_Sales'] ?? null,
            'Shift_Status' => $row['Shift_Status'] ?? null,
            'Remarks' => $row['Remarks'] ?? null,
            'Status' => $statusValue,
            'Date_Recorded' => $row['Date_Recorded'] ?? null,
        ];

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE {$table}
                SET
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
                    Shift_ID = :Shift_ID,
                    terminal_number = :terminal_number,
                    Opening_User_ID = :Opening_User_ID,
                    Opening_DateTime = :Opening_DateTime,
                    Opening_Cash_Count = :Opening_Cash_Count,
                    Closing_User_ID = :Closing_User_ID,
                    Closing_DateTime = :Closing_DateTime,
                    Closing_Cash_Count = :Closing_Cash_Count,
                    Beg_OR = :Beg_OR,
                    End_OR = :End_OR,
                    Beg_VoidNo = :Beg_VoidNo,
                    End_VoidNo = :End_VoidNo,
                    Beg_RefundNo = :Beg_RefundNo,
                    End_RefundNo = :End_RefundNo,
                    Z_Counter_No = :Z_Counter_No,
                    Grand_Accum_Sales = :Grand_Accum_Sales,
                    Shift_Status = :Shift_Status,
                    Remarks = :Remarks,
                    Status = :Status,
                    Date_Recorded = :Date_Recorded
                WHERE ID = :ID
            ");
            $params['ID'] = $existingId;
            $stmt->execute($params);
            return;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                Category_Code,
                Unit_Code,
                Shift_ID,
                terminal_number,
                Opening_User_ID,
                Opening_DateTime,
                Opening_Cash_Count,
                Closing_User_ID,
                Closing_DateTime,
                Closing_Cash_Count,
                Beg_OR,
                End_OR,
                Beg_VoidNo,
                End_VoidNo,
                Beg_RefundNo,
                End_RefundNo,
                Z_Counter_No,
                Grand_Accum_Sales,
                Shift_Status,
                Remarks,
                Status,
                Date_Recorded
            ) VALUES (
                :Category_Code,
                :Unit_Code,
                :Shift_ID,
                :terminal_number,
                :Opening_User_ID,
                :Opening_DateTime,
                :Opening_Cash_Count,
                :Closing_User_ID,
                :Closing_DateTime,
                :Closing_Cash_Count,
                :Beg_OR,
                :End_OR,
                :Beg_VoidNo,
                :End_VoidNo,
                :Beg_RefundNo,
                :End_RefundNo,
                :Z_Counter_No,
                :Grand_Accum_Sales,
                :Shift_Status,
                :Remarks,
                :Status,
                :Date_Recorded
            )
        ");
        $stmt->execute($params);
    }

    private function markWebShiftSynced(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime,
        string $table
    ): void {
        if ($unitCode === '' || $shiftId === '' || $terminalNumber === '' || $openingDateTime === '') {
            return;
        }

        $stmt = $this->conn->prepare("
            UPDATE {$table}
            SET Status = 'Synced'
            WHERE Unit_Code = :unit_code
              AND Shift_ID = :shift_id
              AND terminal_number = :terminal_number
              AND Opening_DateTime = :opening_datetime
        ");
        $stmt->execute([
            'unit_code' => $unitCode,
            'shift_id' => $shiftId,
            'terminal_number' => $terminalNumber,
            'opening_datetime' => $openingDateTime,
        ]);
    }

    private function findExistingWebShiftId(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime,
        string $table
    ): ?int {
        $stmt = $this->conn->prepare("
            SELECT ID
            FROM {$table}
            WHERE Unit_Code = :unit_code
              AND Shift_ID = :shift_id
              AND terminal_number = :terminal_number
              AND Opening_DateTime = :opening_datetime
            LIMIT 1
        ");
        $stmt->execute([
            'unit_code' => $unitCode,
            'shift_id' => $shiftId,
            'terminal_number' => $terminalNumber,
            'opening_datetime' => $openingDateTime,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function upsertWebTransaction(array $row, string $table): void
    {
        $existingId = $this->findExistingScopedTransactionId(
            $table,
            'ID',
            $row
        );

        $params = $this->transactionParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE {$table} SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
                    Project_Code = :Project_Code,
                    transaction_type = :transaction_type,
                    transaction_date = :transaction_date,
                    transaction_time = :transaction_time,
                    terminal_number = :terminal_number,
                    purchase_order_no = :purchase_order_no,
                    order_slip_no = :order_slip_no,
                    billing_no = :billing_no,
                    invoice_no = :invoice_no,
                    table_number = :table_number,
                    order_type = :order_type,
                    customer_exclusive_id = :customer_exclusive_id,
                    customer_head_count = :customer_head_count,
                    customer_count_for_discount = :customer_count_for_discount,
                    discount_type = :discount_type,
                    TotalSales = :TotalSales,
                    Discount = :Discount,
                    OtherCharges = :OtherCharges,
                    TotalAmountDue = :TotalAmountDue,
                    VATableSales = :VATableSales,
                    VATableSales_VAT = :VATableSales_VAT,
                    VATExemptSales = :VATExemptSales,
                    VATExemptSales_VAT = :VATExemptSales_VAT,
                    VATZeroRatedSales = :VATZeroRatedSales,
                    payment_amount = :payment_amount,
                    payment_method = :payment_method,
                    change_amount = :change_amount,
                    short_over = :short_over,
                    special_instructions = :special_instructions,
                    cashier = :cashier,
                    remarks = :remarks,
                    order_status = :order_status,
                    status = :status,
                    void_id = :void_id,
                    void_remarks = :void_remarks,
                    void_date = :void_date,
                    refund_id = :refund_id,
                    refund_remarks = :refund_remarks,
                    refund_date = :refund_date,
                    date_recorded = :date_recorded
                WHERE ID = :ID
            ");
            $params['ID'] = $existingId;
            $stmt->execute($params);
            return;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_type,
                transaction_date,
                transaction_time,
                terminal_number,
                purchase_order_no,
                order_slip_no,
                billing_no,
                invoice_no,
                table_number,
                order_type,
                customer_exclusive_id,
                customer_head_count,
                customer_count_for_discount,
                discount_type,
                TotalSales,
                Discount,
                OtherCharges,
                TotalAmountDue,
                VATableSales,
                VATableSales_VAT,
                VATExemptSales,
                VATExemptSales_VAT,
                VATZeroRatedSales,
                payment_amount,
                payment_method,
                change_amount,
                short_over,
                special_instructions,
                cashier,
                remarks,
                order_status,
                status,
                void_id,
                void_remarks,
                void_date,
                refund_id,
                refund_remarks,
                refund_date,
                date_recorded
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_type,
                :transaction_date,
                :transaction_time,
                :terminal_number,
                :purchase_order_no,
                :order_slip_no,
                :billing_no,
                :invoice_no,
                :table_number,
                :order_type,
                :customer_exclusive_id,
                :customer_head_count,
                :customer_count_for_discount,
                :discount_type,
                :TotalSales,
                :Discount,
                :OtherCharges,
                :TotalAmountDue,
                :VATableSales,
                :VATableSales_VAT,
                :VATExemptSales,
                :VATExemptSales_VAT,
                :VATZeroRatedSales,
                :payment_amount,
                :payment_method,
                :change_amount,
                :short_over,
                :special_instructions,
                :cashier,
                :remarks,
                :order_status,
                :status,
                :void_id,
                :void_remarks,
                :void_date,
                :refund_id,
                :refund_remarks,
                :refund_date,
                :date_recorded
            )
        ");
        $stmt->execute($params);
    }

    private function transactionParams(array $row): array
    {
        return [
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_type' => $row['transaction_type'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'transaction_time' => $row['transaction_time'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'purchase_order_no' => $row['purchase_order_no'] ?? null,
            'order_slip_no' => $row['order_slip_no'] ?? null,
            'billing_no' => $row['billing_no'] ?? null,
            'invoice_no' => $row['invoice_no'] ?? null,
            'table_number' => $row['table_number'] ?? null,
            'order_type' => $row['order_type'] ?? null,
            'customer_exclusive_id' => $row['customer_exclusive_id'] ?? null,
            'customer_head_count' => $row['customer_head_count'] ?? null,
            'customer_count_for_discount' => $row['customer_count_for_discount'] ?? null,
            'discount_type' => $row['discount_type'] ?? null,
            'TotalSales' => $row['TotalSales'] ?? null,
            'Discount' => $row['Discount'] ?? null,
            'OtherCharges' => $row['OtherCharges'] ?? null,
            'TotalAmountDue' => $row['TotalAmountDue'] ?? null,
            'VATableSales' => $row['VATableSales'] ?? null,
            'VATableSales_VAT' => $row['VATableSales_VAT'] ?? null,
            'VATExemptSales' => $row['VATExemptSales'] ?? null,
            'VATExemptSales_VAT' => $row['VATExemptSales_VAT'] ?? null,
            'VATZeroRatedSales' => $row['VATZeroRatedSales'] ?? null,
            'payment_amount' => $row['payment_amount'] ?? null,
            'payment_method' => $row['payment_method'] ?? null,
            'change_amount' => $row['change_amount'] ?? null,
            'short_over' => $row['short_over'] ?? null,
            'special_instructions' => $row['special_instructions'] ?? null,
            'cashier' => $row['cashier'] ?? null,
            'remarks' => $row['remarks'] ?? null,
            'order_status' => $row['order_status'] ?? null,
            'status' => $row['status'] ?? null,
            'void_id' => $row['void_id'] ?? null,
            'void_remarks' => $row['void_remarks'] ?? null,
            'void_date' => $row['void_date'] ?? null,
            'refund_id' => $row['refund_id'] ?? null,
            'refund_remarks' => $row['refund_remarks'] ?? null,
            'refund_date' => $row['refund_date'] ?? null,
            'date_recorded' => $row['date_recorded'] ?? null,
        ];
    }

    private function upsertWebTransactionDetailed(array $row, string $table): void
    {
        $params = $this->detailParams($row);

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                terminal_number,
                transaction_date,
                product_id,
                sku,
                sales_quantity,
                landing_cost,
                unit_cost,
                selling_price,
                vatable,
                isDiscountable,
                order_status
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :terminal_number,
                :transaction_date,
                :product_id,
                :sku,
                :sales_quantity,
                :landing_cost,
                :unit_cost,
                :selling_price,
                :vatable,
                :isDiscountable,
                :order_status
            )
        ");
        $stmt->execute($params);
    }

    private function deleteWebTransactionDetailsForScope(array $row, string $table): void
    {
        $identity = $this->scopedTransactionIdentity($row);
        if ($identity === null) {
            return;
        }

        $stmt = $this->conn->prepare("
            DELETE FROM {$table}
            WHERE Category_Code = :Category_Code
              AND Unit_Code = :Unit_Code
              AND terminal_number = :terminal_number
              AND transaction_id = :transaction_id
        ");
        $stmt->execute($identity);
    }

    private function detailParams(array $row): array
    {
        return [
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'product_id' => $row['product_id'] ?? null,
            'sku' => $row['sku'] ?? null,
            'sales_quantity' => $row['sales_quantity'] ?? null,
            'landing_cost' => $row['landing_cost'] ?? null,
            'unit_cost' => $row['unit_cost'] ?? null,
            'selling_price' => $row['selling_price'] ?? null,
            'vatable' => $row['vatable'] ?? null,
            'isDiscountable' => $row['isDiscountable'] ?? null,
            'order_status' => $row['order_status'] ?? null,
        ];
    }

    private function upsertWebTransactionDiscount(array $row, string $table): void
    {
        $existingId = $this->findExistingDiscountId($row, $table);
        $params = $this->discountParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE {$table} SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
                    terminal_number = :terminal_number,
                    customer_id = :customer_id,
                    discount_type = :discount_type,
                    discount_amount = :discount_amount,
                    customer_name = :customer_name,
                    date_of_birth = :date_of_birth,
                    gender = :gender,
                    tin = :tin,
                    contact_no = :contact_no,
                    status = :status,
                    usertracker = :usertracker,
                    created_at = :created_at
                WHERE id = :id
            ");
            $params['id'] = $existingId;
            $stmt->execute($params);
            return;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                terminal_number,
                customer_id,
                discount_type,
                discount_amount,
                customer_name,
                date_of_birth,
                gender,
                tin,
                contact_no,
                status,
                usertracker,
                created_at
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :terminal_number,
                :customer_id,
                :discount_type,
                :discount_amount,
                :customer_name,
                :date_of_birth,
                :gender,
                :tin,
                :contact_no,
                :status,
                :usertracker,
                :created_at
            )
        ");
        $stmt->execute($params);
    }

    private function discountParams(array $row): array
    {
        return [
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'customer_id' => $row['customer_id'] ?? null,
            'discount_type' => $row['discount_type'] ?? null,
            'discount_amount' => $row['discount_amount'] ?? null,
            'customer_name' => $row['customer_name'] ?? null,
            'date_of_birth' => $row['date_of_birth'] ?? null,
            'gender' => $row['gender'] ?? null,
            'tin' => $row['tin'] ?? null,
            'contact_no' => $row['contact_no'] ?? null,
            'status' => $row['status'] ?? null,
            'usertracker' => $row['usertracker'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ];
    }

    private function upsertWebTransactionPayment(array $row, string $table): void
    {
        $existingId = $this->findExistingPaymentId($row, $table);
        $params = $this->paymentParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE {$table} SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
                    terminal_number = :terminal_number,
                    Project_Code = :Project_Code,
                    transaction_date = :transaction_date,
                    payment_method = :payment_method,
                    payment_amount = :payment_amount,
                    payment_reference = :payment_reference
                WHERE ID = :ID
            ");
            $params['ID'] = $existingId;
            $stmt->execute($params);
            return;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                terminal_number,
                Project_Code,
                transaction_date,
                payment_method,
                payment_amount,
                payment_reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :terminal_number,
                :Project_Code,
                :transaction_date,
                :payment_method,
                :payment_amount,
                :payment_reference
            )
        ");
        $stmt->execute($params);
    }

    private function paymentParams(array $row): array
    {
        return [
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'payment_method' => $row['payment_method'] ?? null,
            'payment_amount' => $row['payment_amount'] ?? null,
            'payment_reference' => $row['payment_reference'] ?? null,
        ];
    }

    private function upsertWebTransactionOtherCharge(array $row, string $table): void
    {
        $existingId = $this->findExistingOtherChargeId($row, $table);
        $params = $this->otherChargeParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE {$table} SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
                    terminal_number = :terminal_number,
                    Project_Code = :Project_Code,
                    transaction_date = :transaction_date,
                    particulars = :particulars,
                    amount = :amount,
                    reference = :reference
                WHERE ID = :ID
            ");
            $params['ID'] = $existingId;
            $stmt->execute($params);
            return;
        }

        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                terminal_number,
                Project_Code,
                transaction_date,
                particulars,
                amount,
                reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :terminal_number,
                :Project_Code,
                :transaction_date,
                :particulars,
                :amount,
                :reference
            )
        ");
        $stmt->execute($params);
    }

    private function otherChargeParams(array $row): array
    {
        return [
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'particulars' => $row['particulars'] ?? null,
            'amount' => $row['amount'] ?? null,
            'reference' => $row['reference'] ?? null,
        ];
    }

    private function deleteWebScopedChildrenForTransaction(
        array $transactionRow,
        string $table,
        string $categoryColumn,
        string $unitColumn
    ): void
    {
        $identity = $this->scopedTransactionIdentity($transactionRow);
        if ($identity === null) {
            return;
        }

        $categoryColumn = $this->quoteIdentifier($categoryColumn);
        $unitColumn = $this->quoteIdentifier($unitColumn);
        $stmt = $this->conn->prepare("
            DELETE FROM {$table}
            WHERE transaction_id = :transaction_id
              AND {$categoryColumn} = :Category_Code
              AND {$unitColumn} = :Unit_Code
        ");
        $stmt->execute([
            'transaction_id' => $identity['transaction_id'],
            'Category_Code' => $identity['Category_Code'],
            'Unit_Code' => $identity['Unit_Code'],
        ]);
    }

    private function insertWebTransactionCustomer(array $row, string $table): void
    {
        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                customer_id
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_date,
                :customer_id
            )
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'customer_id' => $row['customer_id'] ?? null,
        ]);
    }

    private function insertWebDiscountPerProduct(array $row, string $table): void
    {
        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                transaction_date,
                category_code,
                unit_code,
                product_id,
                item_name,
                customer_id,
                discount_type,
                discount_sharing,
                total_customers,
                qualified_customers,
                vat_exempt_amount,
                discount_amount,
                status,
                created_at
            ) VALUES (
                :transaction_id,
                :transaction_date,
                :category_code,
                :unit_code,
                :product_id,
                :item_name,
                :customer_id,
                :discount_type,
                :discount_sharing,
                :total_customers,
                :qualified_customers,
                :vat_exempt_amount,
                :discount_amount,
                :status,
                :created_at
            )
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'category_code' => $row['category_code'] ?? $row['Category_Code'] ?? null,
            'unit_code' => $row['unit_code'] ?? $row['Unit_Code'] ?? null,
            'product_id' => $row['product_id'] ?? null,
            'item_name' => $row['item_name'] ?? null,
            'customer_id' => $row['customer_id'] ?? null,
            'discount_type' => $row['discount_type'] ?? null,
            'discount_sharing' => $row['discount_sharing'] ?? null,
            'total_customers' => $row['total_customers'] ?? null,
            'qualified_customers' => $row['qualified_customers'] ?? null,
            'vat_exempt_amount' => $row['vat_exempt_amount'] ?? null,
            'discount_amount' => $row['discount_amount'] ?? null,
            'status' => $row['status'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ]);
    }

    private function insertWebLoyaltyDiscount(array $row, string $table): void
    {
        $stmt = $this->conn->prepare("
            INSERT INTO {$table} (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                loyalty_member_id,
                customer_name,
                phone_number,
                points_redeemed,
                points_earned,
                discount_amount,
                status,
                usertracker,
                created_at
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_date,
                :loyalty_member_id,
                :customer_name,
                :phone_number,
                :points_redeemed,
                :points_earned,
                :discount_amount,
                :status,
                :usertracker,
                :created_at
            )
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'loyalty_member_id' => $row['loyalty_member_id'] ?? null,
            'customer_name' => $row['customer_name'] ?? null,
            'phone_number' => $row['phone_number'] ?? null,
            'points_redeemed' => $row['points_redeemed'] ?? null,
            'points_earned' => $row['points_earned'] ?? null,
            'discount_amount' => $row['discount_amount'] ?? null,
            'status' => $row['status'] ?? null,
            'usertracker' => $row['usertracker'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ]);
    }

    private function findExistingScopedTransactionId(string $table, string $pk, array $row): ?int
    {
        $identity = $this->scopedTransactionIdentity($row);
        if ($identity === null) {
            return null;
        }

        $stmt = $this->conn->prepare("
            SELECT {$pk}
            FROM {$table}
            WHERE Category_Code = :Category_Code
              AND Unit_Code = :Unit_Code
              AND terminal_number = :terminal_number
              AND transaction_id = :transaction_id
            LIMIT 1
        ");
        $stmt->execute($identity);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function scopedTransactionIdentity(array $row): ?array
    {
        $category = trim((string) ($row['Category_Code'] ?? ''));
        $unit = trim((string) ($row['Unit_Code'] ?? ''));
        $terminal = trim((string) ($row['terminal_number'] ?? ''));
        $transactionId = trim((string) ($row['transaction_id'] ?? ''));

        if ($category === '' || $unit === '' || $terminal === '' || $transactionId === '') {
            return null;
        }

        return [
            'Category_Code' => $category,
            'Unit_Code' => $unit,
            'terminal_number' => $terminal,
            'transaction_id' => $transactionId,
        ];
    }

    private function findExistingDiscountId(array $row, string $table): ?int
    {
        $stmt = $this->conn->prepare("
            SELECT id
            FROM {$table}
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
              AND COALESCE(terminal_number, '') = COALESCE(:terminal_number, '')
              AND COALESCE(customer_id, '') = COALESCE(:customer_id, '')
              AND COALESCE(discount_type, '') = COALESCE(:discount_type, '')
              AND COALESCE(created_at, '') = COALESCE(:created_at, '')
            LIMIT 1
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'customer_id' => $row['customer_id'] ?? null,
            'discount_type' => $row['discount_type'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function findExistingPaymentId(array $row, string $table): ?int
    {
        $identity = $this->scopedTransactionIdentity($row);
        if ($identity === null) {
            return null;
        }

        $stmt = $this->conn->prepare("
            SELECT ID
            FROM {$table}
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
              AND COALESCE(terminal_number, '') = COALESCE(:terminal_number, '')
              AND COALESCE(payment_method, '') = COALESCE(:payment_method, '')
              AND COALESCE(payment_amount, 0) = COALESCE(:payment_amount, 0)
              AND COALESCE(payment_reference, '') = COALESCE(:payment_reference, '')
            LIMIT 1
        ");
        $stmt->execute($identity + [
            'payment_method' => $row['payment_method'] ?? null,
            'payment_amount' => $row['payment_amount'] ?? null,
            'payment_reference' => $row['payment_reference'] ?? null,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function findExistingOtherChargeId(array $row, string $table): ?int
    {
        $stmt = $this->conn->prepare("
            SELECT ID
            FROM {$table}
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
              AND COALESCE(terminal_number, '') = COALESCE(:terminal_number, '')
              AND COALESCE(Project_Code, '') = COALESCE(:Project_Code, '')
              AND COALESCE(transaction_date, '') = COALESCE(:transaction_date, '')
              AND COALESCE(particulars, '') = COALESCE(:particulars, '')
              AND COALESCE(amount, 0) = COALESCE(:amount, 0)
              AND COALESCE(reference, '') = COALESCE(:reference, '')
            LIMIT 1
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'terminal_number' => $row['terminal_number'] ?? null,
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'particulars' => $row['particulars'] ?? null,
            'amount' => $row['amount'] ?? null,
            'reference' => $row['reference'] ?? null,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function quoteIdentifier(string $identifier): string
    {
        if ($identifier === '' || !preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new InvalidArgumentException('Invalid SQL identifier.');
        }

        return '`' . $identifier . '`';
    }
}
