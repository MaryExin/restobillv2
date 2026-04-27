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
        $transactions = $data['transactions'] ?? [];
        $details = $data['details'] ?? [];
        $discounts = $data['discounts'] ?? [];
        $payments = $data['payments'] ?? [];
        $otherCharges = $data['other_charges'] ?? [];

        if (!is_array($shifts) || count($shifts) === 0) {
            return ['message' => 'NoRows'];
        }

        $syncedShifts = 0;
        $syncedTransactions = 0;
        $syncedDetailed = 0;
        $syncedDiscounts = 0;
        $syncedPayments = 0;
        $syncedOtherCharges = 0;

        try {
            $this->conn->beginTransaction();

            foreach ($shifts as $row) {
                $this->upsertWebShiftRecord($row, 'Synced');
                $this->markWebShiftSynced(
                    (string) ($row['Unit_Code'] ?? ''),
                    (string) ($row['Shift_ID'] ?? ''),
                    (string) ($row['terminal_number'] ?? ''),
                    (string) ($row['Opening_DateTime'] ?? '')
                );
                $syncedShifts++;
            }

            foreach ($transactions as $row) {
                $this->upsertWebTransaction($row);
                $syncedTransactions++;
            }

            foreach ($transactions as $row) {
                $this->deleteWebTransactionDetailsForScope($row);
            }

            foreach ($details as $row) {
                $this->upsertWebTransactionDetailed($row);
                $syncedDetailed++;
            }

            foreach ($discounts as $row) {
                $this->upsertWebTransactionDiscount($row);
                $syncedDiscounts++;
            }

            foreach ($payments as $row) {
                $this->upsertWebTransactionPayment($row);
                $syncedPayments++;
            }

            foreach ($otherCharges as $row) {
                $this->upsertWebTransactionOtherCharge($row);
                $syncedOtherCharges++;
            }

            $this->conn->commit();

            return [
                'message' => 'Success',
                'synced_shifts' => $syncedShifts,
                'synced_transactions' => $syncedTransactions,
                'synced_detailed' => $syncedDetailed,
                'synced_discounts' => $syncedDiscounts,
                'synced_payments' => $syncedPayments,
                'synced_other_charges' => $syncedOtherCharges,
                'summary_message' => "Synced {$syncedShifts} shift(s), {$syncedTransactions} transaction(s), {$syncedDetailed} detailed row(s), {$syncedDiscounts} discount row(s), {$syncedPayments} payment row(s), and {$syncedOtherCharges} other charge row(s) to WEB.",
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

    private function upsertWebShiftRecord(array $row, string $statusValue): void
    {
        $existingId = $this->findExistingWebShiftId(
            (string) ($row['Unit_Code'] ?? ''),
            (string) ($row['Shift_ID'] ?? ''),
            (string) ($row['terminal_number'] ?? ''),
            (string) ($row['Opening_DateTime'] ?? '')
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
                UPDATE tbl_pos_shifting_records
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
            INSERT INTO tbl_pos_shifting_records (
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
        string $openingDateTime
    ): void {
        if ($unitCode === '' || $shiftId === '' || $terminalNumber === '' || $openingDateTime === '') {
            return;
        }

        $stmt = $this->conn->prepare("
            UPDATE tbl_pos_shifting_records
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
        string $openingDateTime
    ): ?int {
        $stmt = $this->conn->prepare("
            SELECT ID
            FROM tbl_pos_shifting_records
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

    private function upsertWebTransaction(array $row): void
    {
        $existingId = $this->findExistingScopedTransactionId(
            'tbl_pos_transactions',
            'ID',
            $row
        );

        $params = $this->transactionParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE tbl_pos_transactions SET
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
            INSERT INTO tbl_pos_transactions (
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

    private function upsertWebTransactionDetailed(array $row): void
    {
        $params = $this->detailParams($row);

        $stmt = $this->conn->prepare("
            INSERT INTO tbl_pos_transactions_detailed (
                transaction_id,
                Category_Code,
                Unit_Code,
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

    private function deleteWebTransactionDetailsForScope(array $row): void
    {
        $identity = $this->scopedTransactionIdentity($row);
        if ($identity === null) {
            return;
        }

        $stmt = $this->conn->prepare("
            DELETE FROM tbl_pos_transactions_detailed
            WHERE Category_Code = :Category_Code
              AND Unit_Code = :Unit_Code
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

    private function upsertWebTransactionDiscount(array $row): void
    {
        $existingId = $this->findExistingDiscountId($row);
        $params = $this->discountParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE tbl_pos_transactions_discounts SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
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
            INSERT INTO tbl_pos_transactions_discounts (
                transaction_id,
                Category_Code,
                Unit_Code,
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

    private function upsertWebTransactionPayment(array $row): void
    {
        $existingId = $this->findExistingPaymentId($row);
        $params = $this->paymentParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE tbl_pos_transactions_payments SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
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
            INSERT INTO tbl_pos_transactions_payments (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                payment_method,
                payment_amount,
                payment_reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
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
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'payment_method' => $row['payment_method'] ?? null,
            'payment_amount' => $row['payment_amount'] ?? null,
            'payment_reference' => $row['payment_reference'] ?? null,
        ];
    }

    private function upsertWebTransactionOtherCharge(array $row): void
    {
        $existingId = $this->findExistingOtherChargeId($row);
        $params = $this->otherChargeParams($row);

        if ($existingId !== null) {
            $stmt = $this->conn->prepare("
                UPDATE tbl_pos_transactions_other_charges SET
                    transaction_id = :transaction_id,
                    Category_Code = :Category_Code,
                    Unit_Code = :Unit_Code,
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
            INSERT INTO tbl_pos_transactions_other_charges (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                particulars,
                amount,
                reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
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
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'particulars' => $row['particulars'] ?? null,
            'amount' => $row['amount'] ?? null,
            'reference' => $row['reference'] ?? null,
        ];
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
        $transactionId = trim((string) ($row['transaction_id'] ?? ''));

        if ($category === '' || $unit === '' || $transactionId === '') {
            return null;
        }

        return [
            'Category_Code' => $category,
            'Unit_Code' => $unit,
            'transaction_id' => $transactionId,
        ];
    }

    private function findExistingDiscountId(array $row): ?int
    {
        $stmt = $this->conn->prepare("
            SELECT id
            FROM tbl_pos_transactions_discounts
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
              AND COALESCE(customer_id, '') = COALESCE(:customer_id, '')
              AND COALESCE(discount_type, '') = COALESCE(:discount_type, '')
              AND COALESCE(created_at, '') = COALESCE(:created_at, '')
            LIMIT 1
        ");
        $stmt->execute([
            'transaction_id' => $row['transaction_id'] ?? null,
            'Category_Code' => $row['Category_Code'] ?? null,
            'Unit_Code' => $row['Unit_Code'] ?? null,
            'customer_id' => $row['customer_id'] ?? null,
            'discount_type' => $row['discount_type'] ?? null,
            'created_at' => $row['created_at'] ?? null,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }

    private function findExistingPaymentId(array $row): ?int
    {
        $identity = $this->scopedTransactionIdentity($row);
        if ($identity === null) {
            return null;
        }

        $stmt = $this->conn->prepare("
            SELECT ID
            FROM tbl_pos_transactions_payments
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
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

    private function findExistingOtherChargeId(array $row): ?int
    {
        $stmt = $this->conn->prepare("
            SELECT ID
            FROM tbl_pos_transactions_other_charges
            WHERE transaction_id = :transaction_id
              AND COALESCE(Category_Code, '') = COALESCE(:Category_Code, '')
              AND COALESCE(Unit_Code, '') = COALESCE(:Unit_Code, '')
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
            'Project_Code' => $row['Project_Code'] ?? null,
            'transaction_date' => $row['transaction_date'] ?? null,
            'particulars' => $row['particulars'] ?? null,
            'amount' => $row['amount'] ?? null,
            'reference' => $row['reference'] ?? null,
        ]);

        $id = $stmt->fetchColumn();

        return $id !== false ? (int) $id : null;
    }
}
