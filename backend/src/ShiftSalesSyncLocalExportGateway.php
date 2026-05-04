<?php

declare(strict_types=1);

class ShiftSalesSyncLocalExportGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function exportSelectedShifts(array $data, int|string $userId): array
    {
        $busunitCode = trim((string) ($data['busunitcode'] ?? ''));
        $shifts = $data['shifts'] ?? [];

        if ($busunitCode === '') {
            return ['message' => 'MissingTargetMapping'];
        }

        if (!is_array($shifts) || count($shifts) === 0) {
            return ['message' => 'NoRows'];
        }

        try {
            $exportShifts = [];
            $allTransactionRefs = [];

            foreach ($shifts as $shiftRef) {
                $unitCode = trim((string) ($shiftRef['unit_code'] ?? ''));
                $shiftId = trim((string) ($shiftRef['shift_id'] ?? ''));
                $terminalNumber = trim((string) ($shiftRef['terminal_number'] ?? ''));
                $openingDateTime = trim((string) ($shiftRef['opening_datetime'] ?? ''));

                if (
                    $unitCode === ''
                    || $shiftId === ''
                    || $terminalNumber === ''
                    || $openingDateTime === ''
                ) {
                    continue;
                }

                $shiftRow = $this->getOfflineShiftRow(
                    $unitCode,
                    $shiftId,
                    $terminalNumber,
                    $openingDateTime
                );

                if (!$shiftRow) {
                    continue;
                }

                $opening = trim((string) ($shiftRow['Opening_DateTime'] ?? ''));
                $closing = trim((string) ($shiftRow['Closing_DateTime'] ?? ''));
                $shiftStatus = mb_strtolower(trim((string) ($shiftRow['Shift_Status'] ?? '')));

                if ($shiftStatus !== 'closed' || $opening === '' || $closing === '') {
                    continue;
                }

                $exportShifts[] = $shiftRow;
                $categoryCode = trim((string) ($shiftRow['Category_Code'] ?? ''));

                $transactionRefs = $this->getOfflineTransactionRefsForShift(
                    $categoryCode,
                    $unitCode,
                    $opening,
                    $closing
                );

                foreach ($transactionRefs as $ref) {
                    $transactionId = trim((string) ($ref['transaction_id'] ?? ''));
                    $category = trim((string) ($ref['Category_Code'] ?? ''));
                    $unit = trim((string) ($ref['Unit_Code'] ?? ''));
                    $key = $category . '||' . $unit . '||' . $transactionId;

                    if ($transactionId !== '' && $category !== '' && $unit !== '') {
                        $allTransactionRefs[$key] = $ref;
                    }
                }
            }

            $transactionRefs = array_values($allTransactionRefs);

            return [
                'message' => 'Success',
                'busunitcode' => $busunitCode,
                'shifts' => $exportShifts,
                'transactions' => $this->getOfflineTransactionsByRefs($transactionRefs),
                'details' => $this->getOfflineDetailsByTransactionRefs($transactionRefs),
                'discounts' => $this->getOfflineDiscountsByTransactionRefs($transactionRefs),
                'payments' => $this->getOfflinePaymentsByTransactionRefs($transactionRefs),
                'other_charges' => $this->getOfflineOtherChargesByTransactionRefs($transactionRefs),
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function getOfflineShiftRow(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): ?array {
        $stmt = $this->conn->prepare("
            SELECT *
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

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    private function getOfflineTransactionRefsForShift(
        string $categoryCode,
        string $unitCode,
        string $openingDateTime,
        string $closingDateTime
    ): array {
        $sql = "
            SELECT transaction_id, Category_Code, Unit_Code
            FROM tbl_pos_transactions
            WHERE Category_Code = :category_code
              AND Unit_Code = :unit_code
              AND COALESCE(
                    STR_TO_DATE(CONCAT(transaction_date, ' ', transaction_time), '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(CONCAT(transaction_date, ' ', transaction_time), '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(date_recorded, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(date_recorded, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(date_recorded, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(date_recorded, '%Y-%m-%d %H:%i')
                  ) BETWEEN
                  COALESCE(
                    STR_TO_DATE(:opening_datetime_1, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(:opening_datetime_2, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(:opening_datetime_3, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(:opening_datetime_4, '%Y-%m-%d %H:%i')
                  )
                  AND
                  COALESCE(
                    STR_TO_DATE(:closing_datetime_1, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(:closing_datetime_2, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(:closing_datetime_3, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(:closing_datetime_4, '%Y-%m-%d %H:%i')
                  )
            ORDER BY ID ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            'category_code' => $categoryCode,
            'unit_code' => $unitCode,
            'opening_datetime_1' => $openingDateTime,
            'opening_datetime_2' => $openingDateTime,
            'opening_datetime_3' => $openingDateTime,
            'opening_datetime_4' => $openingDateTime,
            'closing_datetime_1' => $closingDateTime,
            'closing_datetime_2' => $closingDateTime,
            'closing_datetime_3' => $closingDateTime,
            'closing_datetime_4' => $closingDateTime,
        ]);

        $refs = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $transactionId = trim((string) ($row['transaction_id'] ?? ''));
            $category = trim((string) ($row['Category_Code'] ?? ''));
            $unit = trim((string) ($row['Unit_Code'] ?? ''));

            if ($transactionId !== '' && $category !== '' && $unit !== '') {
                $refs[] = [
                    'transaction_id' => $transactionId,
                    'Category_Code' => $category,
                    'Unit_Code' => $unit,
                ];
            }
        }

        return $refs;
    }

    private function getOfflineTransactionsByRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_transactions
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineDetailsByTransactionRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_transactions_detailed
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineDiscountsByTransactionRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_transactions_discounts
            WHERE {$scope['where']}
            ORDER BY id ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflinePaymentsByTransactionRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_transactions_payments
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineOtherChargesByTransactionRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_transactions_other_charges
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function buildScopedTransactionWhere(
        array $transactionRefs,
        string $categoryColumn = 'Category_Code',
        string $unitColumn = 'Unit_Code',
        string $transactionColumn = 'transaction_id'
    ): array {
        $clauses = [];
        $values = [];
        $seen = [];

        foreach ($transactionRefs as $ref) {
            $category = trim((string) ($ref['Category_Code'] ?? ''));
            $unit = trim((string) ($ref['Unit_Code'] ?? ''));
            $transactionId = trim((string) ($ref['transaction_id'] ?? ''));
            $key = $category . '||' . $unit . '||' . $transactionId;

            if ($category === '' || $unit === '' || $transactionId === '' || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $clauses[] = "({$categoryColumn} = ? AND {$unitColumn} = ? AND {$transactionColumn} = ?)";
            $values[] = $category;
            $values[] = $unit;
            $values[] = $transactionId;
        }

        return [
            'where' => count($clauses) > 0 ? '(' . implode(' OR ', $clauses) . ')' : '',
            'values' => $values,
        ];
    }
}
