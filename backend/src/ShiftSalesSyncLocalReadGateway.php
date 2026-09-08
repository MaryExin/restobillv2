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
                    'customers' => 0,
                    'discounts_per_product' => 0,
                    'loyalty_discounts' => 0,
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
                    'count_customers' => $counts['customers'],
                    'count_discounts_per_product' => $counts['discounts_per_product'],
                    'count_loyalty_discounts' => $counts['loyalty_discounts'],
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
        // Finalization writes Remarks = Synced only after both WEB datasets
        // are verified. Keep open/incomplete shifts visible, but do not rescan
        // completed history on every refresh.
        $stmt = $this->conn->prepare("
            SELECT *
            FROM tbl_pos_shifting_records
            WHERE Unit_Code = :unit_code
              AND (
                    COALESCE(Shift_Status, '') <> 'Closed'
                    OR COALESCE(Closing_DateTime, '') = ''
                    OR COALESCE(Remarks, '') <> 'Synced'
                  )
            ORDER BY ID DESC
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
        // Match the stored date strings directly so MySQL can use an index on
        // transaction_date instead of parsing every historical transaction.
        $dateCandidates = $this->getTransactionDateCandidates($openingDateTime);
        if (count($dateCandidates) === 0) {
            return [];
        }

        $datePlaceholders = implode(',', array_fill(0, count($dateCandidates), '?'));
        $sql = "
            SELECT transaction_id, Category_Code, Unit_Code, terminal_number
            FROM tbl_pos_transactions
            WHERE Category_Code = ?
              AND Unit_Code = ?
              AND terminal_number = ?
              AND transaction_date IN ({$datePlaceholders})
            ORDER BY ID ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            $categoryCode,
            $unitCode,
            $terminalNumber,
            ...$dateCandidates,
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

        if ($scope['where'] === '') {
            return [
                'transactions' => 0,
                'detailed' => 0,
                'discounts' => 0,
                'payments' => 0,
                'other_charges' => 0,
                'customers' => 0,
                'discounts_per_product' => 0,
                'loyalty_discounts' => 0,
            ];
        }

        $discountsPerProductScope = $this->buildScopedTransactionWhere(
            $transactionRefs,
            'category_code',
            'unit_code'
        );

        return [
            'transactions' => count($transactionRefs),
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
            'customers' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_customers WHERE {$scope['where']}",
                $scope['values']
            ),
            'discounts_per_product' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_transactions_discounts_per_product WHERE {$discountsPerProductScope['where']}",
                $discountsPerProductScope['values']
            ),
            'loyalty_discounts' => $this->countRows(
                "SELECT COUNT(*) FROM tbl_pos_loyalty_discounts WHERE {$scope['where']}",
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
        $groups = [];

        foreach ($transactionRefs as $ref) {
            $category = trim((string) ($ref['Category_Code'] ?? ''));
            $unit = trim((string) ($ref['Unit_Code'] ?? ''));
            $transactionId = trim((string) ($ref['transaction_id'] ?? ''));
            $terminal = trim((string) ($ref['terminal_number'] ?? ''));
            if (
                $category === ''
                || $unit === ''
                || $transactionId === ''
                || ($terminalColumn !== null && $terminal === '')
            ) {
                continue;
            }

            $groupKey = $category . '||' . $unit;
            if ($terminalColumn !== null) {
                $groupKey .= '||' . $terminal;
            }

            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'category' => $category,
                    'unit' => $unit,
                    'terminal' => $terminal,
                    'transaction_ids' => [],
                ];
            }

            $groups[$groupKey]['transaction_ids'][$transactionId] = $transactionId;
        }

        foreach ($groups as $group) {
            $transactionIds = array_values($group['transaction_ids']);
            if (count($transactionIds) === 0) {
                continue;
            }

            $placeholders = implode(',', array_fill(0, count($transactionIds), '?'));
            $clause = "({$categoryColumn} = ? AND {$unitColumn} = ?";
            $values[] = $group['category'];
            $values[] = $group['unit'];

            if ($terminalColumn !== null) {
                $clause .= " AND {$terminalColumn} = ?";
                $values[] = $group['terminal'];
            }

            $clause .= " AND {$transactionColumn} IN ({$placeholders}))";
            array_push($values, ...$transactionIds);
            $clauses[] = $clause;
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

    private function getTransactionDateCandidates(string $openingDateTime): array
    {
        $sortableDate = $this->toSortableDate($openingDateTime);
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $sortableDate) !== 1) {
            return [];
        }

        $date = DateTime::createFromFormat('!Y-m-d', substr($sortableDate, 0, 10));
        if (!$date instanceof DateTime) {
            return [];
        }

        return array_values(array_unique([
            $date->format('Y-m-d'),
            $date->format('n/j/Y'),
            $date->format('m/d/Y'),
        ]));
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
