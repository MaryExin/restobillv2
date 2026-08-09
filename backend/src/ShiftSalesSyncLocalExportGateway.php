<?php

declare(strict_types=1);

class ShiftSalesSyncLocalExportGateway
{
    private PDO $conn;
    private array $columnCache = [];
    private string $primaryDatabaseName;
    private string $reportDatabaseName;

    public function __construct(
        Database $database,
        string $primaryDatabaseName,
        string $reportDatabaseName
    )
    {
        $this->conn = $database->getConnection();
        $this->primaryDatabaseName = $this->requireIdentifier(
            $primaryDatabaseName,
            'primary database name'
        );
        $this->reportDatabaseName = $this->requireIdentifier(
            $reportDatabaseName,
            'report database name'
        );
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
            foreach ([
                'db' => $this->primaryDatabaseName,
                'report_db' => $this->reportDatabaseName,
            ] as $source => $databaseName) {
                $missingTables = $this->getMissingSourceTables($databaseName);
                if (count($missingTables) > 0) {
                    return [
                        'message' => 'SourceTablesMissing',
                        'source' => $source,
                        'missing_tables' => $missingTables,
                    ];
                }
            }

            $primaryDataset = $this->exportDataset($shifts, $this->primaryDatabaseName);
            if (count($primaryDataset['missing_shifts']) > 0) {
                return [
                    'message' => 'SourceRowsMissing',
                    'source' => 'db',
                    'missing_shifts' => $primaryDataset['missing_shifts'],
                ];
            }

            $reportDataset = $this->exportDataset($shifts, $this->reportDatabaseName);
            if (count($reportDataset['missing_shifts']) > 0) {
                return [
                    'message' => 'SourceRowsMissing',
                    'source' => 'report_db',
                    'missing_shifts' => $reportDataset['missing_shifts'],
                ];
            }

            unset($primaryDataset['missing_shifts'], $reportDataset['missing_shifts']);

            return [
                'message' => 'Success',
                'busunitcode' => $busunitCode,
                ...$primaryDataset,
                'report_dataset' => $reportDataset,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function exportDataset(array $shifts, string $databaseName): array
    {
        $exportShifts = [];
        $allTransactionRefs = [];
        $missingShifts = [];

        foreach ($shifts as $shiftRef) {
            $unitCode = trim((string) ($shiftRef['unit_code'] ?? ''));
            $shiftId = trim((string) ($shiftRef['shift_id'] ?? ''));
            $terminalNumber = trim((string) ($shiftRef['terminal_number'] ?? ''));
            $openingDateTime = trim((string) ($shiftRef['opening_datetime'] ?? ''));
            $rowKey = trim((string) ($shiftRef['row_key'] ?? ''));
            $reference = $rowKey !== ''
                ? $rowKey
                : $unitCode . '||' . $shiftId . '||' . $terminalNumber . '||' . $openingDateTime;

            if (
                $unitCode === ''
                || $shiftId === ''
                || $terminalNumber === ''
                || $openingDateTime === ''
            ) {
                $missingShifts[] = $reference;
                continue;
            }

            $shiftRow = $this->getOfflineShiftRow(
                $databaseName,
                $unitCode,
                $shiftId,
                $terminalNumber,
                $openingDateTime
            );

            if (!$shiftRow) {
                $missingShifts[] = $reference;
                continue;
            }

            $opening = trim((string) ($shiftRow['Opening_DateTime'] ?? ''));
            $closing = trim((string) ($shiftRow['Closing_DateTime'] ?? ''));
            $shiftStatus = mb_strtolower(trim((string) ($shiftRow['Shift_Status'] ?? '')));

            if ($shiftStatus !== 'closed' || $opening === '' || $closing === '') {
                $missingShifts[] = $reference;
                continue;
            }

            $exportShifts[] = $shiftRow;
            $categoryCode = trim((string) ($shiftRow['Category_Code'] ?? ''));

            $transactionRefs = $this->getOfflineTransactionRefsForShift(
                $databaseName,
                $categoryCode,
                $unitCode,
                $terminalNumber,
                $opening
            );

            foreach ($transactionRefs as $ref) {
                $transactionId = trim((string) ($ref['transaction_id'] ?? ''));
                $category = trim((string) ($ref['Category_Code'] ?? ''));
                $unit = trim((string) ($ref['Unit_Code'] ?? ''));
                $terminal = trim((string) ($ref['terminal_number'] ?? ''));
                $key = $category . '||' . $unit . '||' . $terminal . '||' . $transactionId;

                if ($transactionId !== '' && $category !== '' && $unit !== '' && $terminal !== '') {
                    $allTransactionRefs[$key] = $ref;
                }
            }
        }

        $transactionRefs = array_values($allTransactionRefs);

        return [
            'shifts' => $exportShifts,
            'transactions' => $this->getOfflineTransactionsByRefs($databaseName, $transactionRefs),
            'details' => $this->getOfflineDetailsByTransactionRefs($databaseName, $transactionRefs),
            'discounts' => $this->getOfflineDiscountsByTransactionRefs($databaseName, $transactionRefs),
            'payments' => $this->getOfflinePaymentsByTransactionRefs($databaseName, $transactionRefs),
            'other_charges' => $this->getOfflineOtherChargesByTransactionRefs($databaseName, $transactionRefs),
            'customers' => $this->getOfflineCustomersByTransactionRefs($databaseName, $transactionRefs),
            'discounts_per_product' => $this->getOfflineDiscountsPerProductByTransactionRefs(
                $databaseName,
                $transactionRefs
            ),
            'loyalty_discounts' => $this->getOfflineLoyaltyDiscountsByTransactionRefs(
                $databaseName,
                $transactionRefs
            ),
            'missing_shifts' => array_values(array_unique($missingShifts)),
        ];
    }

    private function getOfflineShiftRow(
        string $databaseName,
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): ?array {
        $shiftTable = $this->qualifiedTable($databaseName, 'tbl_pos_shifting_records');
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$shiftTable}
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
        string $databaseName,
        string $categoryCode,
        string $unitCode,
        string $terminalNumber,
        string $openingDateTime
    ): array {
        $transactionTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions');
        $sql = "
            SELECT transaction_id, Category_Code, Unit_Code, terminal_number
            FROM {$transactionTable}
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

    private function getOfflineTransactionsByRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere(
            $transactionRefs,
            'Category_Code',
            'Unit_Code',
            'transaction_id',
            'terminal_number'
        );

        if ($scope['where'] === '') {
            return [];
        }

        $transactionTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions');
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$transactionTable}
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineDetailsByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $detailTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions_detailed');
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$detailTable}
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
    }

    private function getOfflineDiscountsByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $hasScopedDiscountColumns = $this->tableHasColumns(
            $databaseName,
            'tbl_pos_transactions_discounts',
            ['Category_Code', 'Unit_Code']
        );
        $scope = $hasScopedDiscountColumns
            ? $this->buildScopedTransactionWhere($transactionRefs)
            : $this->buildScopedTransactionWhere(
                $transactionRefs,
                't.Category_Code',
                't.Unit_Code',
                't.transaction_id',
                't.terminal_number'
            );

        if ($scope['where'] === '') {
            return [];
        }

        $discountTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions_discounts');
        $transactionTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions');
        $sql = $hasScopedDiscountColumns
            ? "
                SELECT *
                FROM {$discountTable}
                WHERE {$scope['where']}
                ORDER BY id ASC
            "
            : "
                SELECT d.*
                FROM {$discountTable} d
                INNER JOIN {$transactionTable} t
                  ON t.transaction_id = d.transaction_id
                WHERE {$scope['where']}
                ORDER BY d.id ASC
            ";

        $stmt = $this->conn->prepare($sql);

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
    }

    private function getOfflinePaymentsByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $paymentTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions_payments');
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$paymentTable}
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
    }

    private function getOfflineOtherChargesByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $otherChargeTable = $this->qualifiedTable(
            $databaseName,
            'tbl_pos_transactions_other_charges'
        );
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$otherChargeTable}
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
    }

    private function getOfflineCustomersByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $customerTable = $this->qualifiedTable($databaseName, 'tbl_pos_transactions_customers');
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$customerTable}
            WHERE {$scope['where']}
            ORDER BY ID ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
    }

    private function getOfflineDiscountsPerProductByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere(
            $transactionRefs,
            'category_code',
            'unit_code'
        );

        if ($scope['where'] === '') {
            return [];
        }

        $discountPerProductTable = $this->qualifiedTable(
            $databaseName,
            'tbl_pos_transactions_discounts_per_product'
        );
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$discountPerProductTable}
            WHERE {$scope['where']}
            ORDER BY id ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getOfflineLoyaltyDiscountsByTransactionRefs(
        string $databaseName,
        array $transactionRefs
    ): array
    {
        $scope = $this->buildScopedTransactionWhere($transactionRefs);

        if ($scope['where'] === '') {
            return [];
        }

        $loyaltyDiscountTable = $this->qualifiedTable(
            $databaseName,
            'tbl_pos_loyalty_discounts'
        );
        $stmt = $this->conn->prepare("
            SELECT *
            FROM {$loyaltyDiscountTable}
            WHERE {$scope['where']}
            ORDER BY id ASC
        ");

        foreach ($scope['values'] as $index => $value) {
            $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
        }

        $stmt->execute();

        return $this->withTransactionScope($stmt->fetchAll(PDO::FETCH_ASSOC), $transactionRefs);
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

    private function withTransactionScope(array $rows, array $transactionRefs): array
    {
        $byScopedKey = [];
        $byTransactionId = [];

        foreach ($transactionRefs as $ref) {
            $category = trim((string) ($ref['Category_Code'] ?? ''));
            $unit = trim((string) ($ref['Unit_Code'] ?? ''));
            $transactionId = trim((string) ($ref['transaction_id'] ?? ''));

            if ($category === '' || $unit === '' || $transactionId === '') {
                continue;
            }

            $byScopedKey[$category . '||' . $unit . '||' . $transactionId] = $ref;
            $byTransactionId[$transactionId] ??= $ref;
        }

        foreach ($rows as &$row) {
            $transactionId = trim((string) ($row['transaction_id'] ?? ''));
            $category = trim((string) ($row['Category_Code'] ?? ''));
            $unit = trim((string) ($row['Unit_Code'] ?? ''));
            $ref = null;

            if ($category !== '' && $unit !== '' && $transactionId !== '') {
                $ref = $byScopedKey[$category . '||' . $unit . '||' . $transactionId] ?? null;
            }

            if ($ref === null && $transactionId !== '') {
                $ref = $byTransactionId[$transactionId] ?? null;
            }

            if ($ref === null) {
                continue;
            }

            if ($category === '') {
                $row['Category_Code'] = $ref['Category_Code'] ?? null;
            }

            if ($unit === '') {
                $row['Unit_Code'] = $ref['Unit_Code'] ?? null;
            }

            $row['terminal_number'] = $ref['terminal_number'] ?? null;
        }
        unset($row);

        return $rows;
    }

    private function tableHasColumns(
        string $databaseName,
        string $table,
        array $columns
    ): bool
    {
        $cacheKey = $databaseName . '.' . $table;

        if (!array_key_exists($cacheKey, $this->columnCache)) {
            $qualifiedTable = $this->qualifiedTable($databaseName, $table);
            $stmt = $this->conn->query("SHOW COLUMNS FROM {$qualifiedTable}");
            $this->columnCache[$cacheKey] = array_map(
                static fn(array $row): string => (string) ($row['Field'] ?? ''),
                $stmt->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        $available = array_flip($this->columnCache[$cacheKey]);
        foreach ($columns as $column) {
            if (!isset($available[$column])) {
                return false;
            }
        }

        return true;
    }

    private function getMissingSourceTables(string $databaseName): array
    {
        $requiredTables = [
            'tbl_pos_shifting_records',
            'tbl_pos_transactions',
            'tbl_pos_transactions_detailed',
            'tbl_pos_transactions_discounts',
            'tbl_pos_transactions_payments',
            'tbl_pos_transactions_other_charges',
            'tbl_pos_transactions_customers',
            'tbl_pos_transactions_discounts_per_product',
            'tbl_pos_loyalty_discounts',
        ];
        $placeholders = implode(',', array_fill(0, count($requiredTables), '?'));
        $stmt = $this->conn->prepare("
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME IN ({$placeholders})
        ");
        $stmt->execute(array_merge([$databaseName], $requiredTables));
        $available = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

        return array_values(array_filter(
            $requiredTables,
            static fn(string $table): bool => !isset($available[$table])
        ));
    }

    private function qualifiedTable(string $databaseName, string $table): string
    {
        return '`' . $this->requireIdentifier($databaseName, 'database name')
            . '`.`' . $this->requireIdentifier($table, 'table name') . '`';
    }

    private function requireIdentifier(string $value, string $label): string
    {
        $value = trim($value);

        if ($value === '' || !preg_match('/^[A-Za-z0-9_]+$/', $value)) {
            throw new InvalidArgumentException("Invalid {$label}.");
        }

        return $value;
    }
}
