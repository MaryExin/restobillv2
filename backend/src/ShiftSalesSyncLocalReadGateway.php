<?php

declare(strict_types=1);

class ShiftSalesSyncLocalReadGateway
{
    private PDO $conn;
    private array $columnCache = [];

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function readShiftSyncData(array $data, int|string $userId): array
    {
        try {
            $target = $this->getActiveOfflineTargetMapping();

            if (!$target || trim((string) ($target['busunitcode'] ?? '')) === '') {
                return [
                    'message' => 'NoBusinessUnit',
                    'target' => null,
                    'rows' => [],
                ];
            }

            $busunitCode = (string) $target['busunitcode'];
            $shifts = $this->getOfflineShiftRows($busunitCode);

            $rows = [];
            foreach ($shifts as $shift) {
                $unitCode = trim((string) ($shift['Unit_Code'] ?? ''));
                $shiftId = trim((string) ($shift['Shift_ID'] ?? ''));
                $terminal = trim((string) ($shift['terminal_number'] ?? ''));
                $opening = trim((string) ($shift['Opening_DateTime'] ?? ''));
                $closing = trim((string) ($shift['Closing_DateTime'] ?? ''));
                $shiftStatus = trim((string) ($shift['Shift_Status'] ?? ''));
                $categoryCode = trim((string) ($shift['Category_Code'] ?? ''));

                $txnRefs = [];
                $counts = [
                    'transactions' => 0,
                    'detailed' => 0,
                    'discounts' => 0,
                    'payments' => 0,
                    'other_charges' => 0,
                ];

                if ($opening !== '' && $closing !== '') {
                    $txnRefs = $this->getOfflineTransactionRefsForShift(
                        $categoryCode,
                        $unitCode,
                        $terminal,
                        $opening
                    );
                    $counts = $this->getChildCountsByTransactionRefs($txnRefs);
                }

                $rowKey = $this->buildShiftKey($unitCode, $shiftId, $terminal, $opening);

                $rows[] = [
                    'row_key' => $rowKey,
                    'category_code' => $categoryCode,
                    'unit_code' => $unitCode,
                    'shift_id' => $shiftId,
                    'terminal_number' => $terminal,
                    'opening_datetime' => $opening,
                    'closing_datetime' => $closing,
                    'closing_sort' => $this->toSortableDate($closing),
                    'shift_status' => $shiftStatus,
                    'already_synced' => false,
                    'ready_to_sync' => (
                        mb_strtolower(trim($shiftStatus)) === 'closed'
                        && $opening !== ''
                        && $closing !== ''
                    ),
                    'count_transactions' => $counts['transactions'],
                    'count_detailed' => $counts['detailed'],
                    'count_discounts' => $counts['discounts'],
                    'count_payments' => $counts['payments'],
                    'count_other_charges' => $counts['other_charges'],
                    'remarks' => (string) ($shift['Remarks'] ?? ''),
                    'status' => (string) ($shift['Status'] ?? ''),
                ];
            }

            usort($rows, function (array $a, array $b): int {
                return strcmp(
                    (string) ($b['closing_sort'] ?? ''),
                    (string) ($a['closing_sort'] ?? '')
                );
            });

            return [
                'message' => 'Success',
                'target' => [
                    'busunitcode' => $busunitCode,
                    'busunit_name' => '',
                ],
                'rows' => $rows,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'target' => null,
                'rows' => [],
            ];
        }
    }

    private function getActiveOfflineTargetMapping(): ?array
    {
        $stmt = $this->conn->query("
            SELECT busunitcode
            FROM tbl_pricing_by_sales_type
            WHERE deletestatus = 'Active'
            ORDER BY seq ASC
            LIMIT 1
        ");

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        return [
            'busunitcode' => trim((string) ($row['busunitcode'] ?? '')),
        ];
    }

    private function getOfflineShiftRows(string $busunitCode): array
    {
        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_shifting_records
            WHERE Unit_Code = :unit_code
            ORDER BY
                COALESCE(
                    STR_TO_DATE(Closing_DateTime, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(Closing_DateTime, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(Closing_DateTime, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(Closing_DateTime, '%Y-%m-%d %H:%i'),
                    STR_TO_DATE(Date_Recorded, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(Date_Recorded, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(Date_Recorded, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(Date_Recorded, '%Y-%m-%d %H:%i')
                ) DESC,
                ID DESC
        ");
        $stmt->execute([
            'unit_code' => $busunitCode,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineTransactionRefsForShift(
        string $categoryCode,
        string $unitCode,
        string $terminalNumber,
        string $openingDateTime
    ): array {
        $sql = "
            SELECT transaction_id, Category_Code, Unit_Code, terminal_number
            FROM tbl_pos_transactions
            WHERE Category_Code = :category_code
              AND Unit_Code = :unit_code
              AND terminal_number = :terminal_number
              AND COALESCE(
                    STR_TO_DATE(transaction_date, '%c/%e/%Y'),
                    STR_TO_DATE(transaction_date, '%Y-%m-%d')
                  ) = DATE(COALESCE(
                    STR_TO_DATE(:opening_datetime_1, '%c/%e/%Y %h:%i %p'),
                    STR_TO_DATE(:opening_datetime_2, '%c/%e/%Y %H:%i'),
                    STR_TO_DATE(:opening_datetime_3, '%Y-%m-%d %H:%i:%s'),
                    STR_TO_DATE(:opening_datetime_4, '%Y-%m-%d %H:%i')
                  ))
            ORDER BY ID ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            'category_code' => $categoryCode,
            'unit_code' => $unitCode,
            'terminal_number' => $terminalNumber,
            'opening_datetime_1' => $openingDateTime,
            'opening_datetime_2' => $openingDateTime,
            'opening_datetime_3' => $openingDateTime,
            'opening_datetime_4' => $openingDateTime,
        ]);

        $refs = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $transactionId = trim((string) ($row['transaction_id'] ?? ''));
            $category = trim((string) ($row['Category_Code'] ?? ''));
            $unit = trim((string) ($row['Unit_Code'] ?? ''));
            $terminal = trim((string) ($row['terminal_number'] ?? ''));

            if ($transactionId !== '' && $category !== '' && $unit !== '' && $terminal !== '') {
                $refs[] = [
                    'transaction_id' => $transactionId,
                    'Category_Code' => $category,
                    'Unit_Code' => $unit,
                    'terminal_number' => $terminal,
                ];
            }
        }

        return $refs;
    }

    private function getChildCountsByTransactionRefs(array $transactionRefs): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);
        $transactionScope = $this->buildScopedTransactionWhere(
            $transactionRefs,
            'Category_Code',
            'Unit_Code',
            'transaction_id',
            'terminal_number'
        );

        if ($scope['where'] === '') {
            return [
                'transactions' => 0,
                'detailed' => 0,
                'discounts' => 0,
                'payments' => 0,
                'other_charges' => 0,
            ];
        }

        return [
            'transactions' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions WHERE {$transactionScope['where']}",
                $transactionScope['values']
            ),
            'detailed' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_detailed WHERE {$scope['where']}",
                $scope['values']
            ),
            'discounts' => $this->countDiscountRows($transactionRefs),
            'payments' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_payments WHERE {$scope['where']}",
                $scope['values']
            ),
            'other_charges' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_other_charges WHERE {$scope['where']}",
                $scope['values']
            ),
        ];
    }

    private function buildScopedTransactionWhere(
        array $transactionRefs,
        string $categoryColumn = 'Category_Code',
        string $unitColumn = 'Unit_Code',
        string $transactionColumn = 'transaction_id',
        ?string $terminalColumn = null
    ): array {
        $clauses = [];
        $values = [];
        $seen = [];

        foreach ($transactionRefs as $ref) {
            $category = trim((string) ($ref['Category_Code'] ?? ''));
            $unit = trim((string) ($ref['Unit_Code'] ?? ''));
            $transactionId = trim((string) ($ref['transaction_id'] ?? ''));
            $terminal = trim((string) ($ref['terminal_number'] ?? ''));
            $key = $category . '||' . $unit . '||' . $transactionId;

            if ($terminalColumn !== null) {
                $key .= '||' . $terminal;
            }

            if (
                $category === ''
                || $unit === ''
                || $transactionId === ''
                || ($terminalColumn !== null && $terminal === '')
                || isset($seen[$key])
            ) {
                continue;
            }

            $seen[$key] = true;
            $clause = "({$categoryColumn} = ? AND {$unitColumn} = ? AND {$transactionColumn} = ?";
            $values[] = $category;
            $values[] = $unit;
            $values[] = $transactionId;

            if ($terminalColumn !== null) {
                $clause .= " AND {$terminalColumn} = ?";
                $values[] = $terminal;
            }

            $clauses[] = $clause . ")";
        }

        return [
            'where' => count($clauses) > 0 ? '(' . implode(' OR ', $clauses) . ')' : '',
            'values' => $values,
        ];
    }

    private function countDiscountRows(array $transactionRefs): int
    {
        if ($this->tableHasColumns('tbl_pos_transactions_discounts', ['Category_Code', 'Unit_Code'])) {
            $scope = $this->buildScopedTransactionWhere($transactionRefs);
            if ($scope['where'] === '') {
                return 0;
            }

            return $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_discounts WHERE {$scope['where']}",
                $scope['values']
            );
        }

        $scope = $this->buildScopedTransactionWhere(
            $transactionRefs,
            't.Category_Code',
            't.Unit_Code',
            't.transaction_id',
            't.terminal_number'
        );
        if ($scope['where'] === '') {
            return 0;
        }

        return $this->countRows(
            "
                SELECT COUNT(*)
                FROM tbl_pos_transactions_discounts d
                INNER JOIN tbl_pos_transactions t
                  ON t.transaction_id = d.transaction_id
                WHERE {$scope['where']}
            ",
            $scope['values']
        );
    }

    private function tableHasColumns(string $table, array $columns): bool
    {
        if (!array_key_exists($table, $this->columnCache)) {
            $stmt = $this->conn->query("SHOW COLUMNS FROM {$table}");
            $this->columnCache[$table] = array_map(
                static fn(array $row): string => (string) ($row['Field'] ?? ''),
                $stmt->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        $available = array_flip($this->columnCache[$table]);
        foreach ($columns as $column) {
            if (!isset($available[$column])) {
                return false;
            }
        }

        return true;
    }

    private function countRows(string $sql, array $values): int
    {
        $stmt = $this->conn->prepare($sql);
        foreach ($values as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }
        $stmt->execute();
        return (int) $stmt->fetchColumn();
    }

    private function buildShiftKey(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): string {
        return $unitCode . '||' . $shiftId . '||' . $terminalNumber . '||' . $openingDateTime;
    }

    private function toSortableDate(?string $value): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }

        $formats = [
            'n/j/Y G:i',
            'n/j/Y g:i A',
            'Y-m-d H:i:s',
            'Y-m-d H:i',
        ];

        foreach ($formats as $format) {
            $dt = DateTime::createFromFormat($format, $value);
            if ($dt instanceof DateTime) {
                return $dt->format('Y-m-d H:i:s');
            }
        }

        $ts = strtotime($value);
        if ($ts !== false) {
            return date('Y-m-d H:i:s', $ts);
        }

        return $value;
    }
}
