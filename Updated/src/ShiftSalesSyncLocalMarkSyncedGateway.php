<?php

declare(strict_types=1);

class ShiftSalesSyncLocalMarkSyncedGateway
{
    private PDO $conn;
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

    public function markShiftsSynced(array $data, int|string $userId): array
    {
        $shifts = $data['shifts'] ?? [];

        if (!is_array($shifts) || count($shifts) === 0) {
            return ['message' => 'NoRows'];
        }

        $markedPrimary = 0;
        $markedReport = 0;

        try {
            $this->conn->beginTransaction();

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

                $markedPrimary += $this->markShiftSynced(
                    $this->primaryDatabaseName,
                    $unitCode,
                    $shiftId,
                    $terminalNumber,
                    $openingDateTime
                );
                $markedReport += $this->markShiftSynced(
                    $this->reportDatabaseName,
                    $unitCode,
                    $shiftId,
                    $terminalNumber,
                    $openingDateTime
                );
            }

            $this->conn->commit();

            return [
                'message' => 'Success',
                'marked_synced' => $markedPrimary,
                'marked_primary' => $markedPrimary,
                'marked_report' => $markedReport,
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

    private function markShiftSynced(
        string $databaseName,
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): int {
        $shiftTable = $this->qualifiedTable($databaseName, 'tbl_pos_shifting_records');
        $stmt = $this->conn->prepare("
            UPDATE {$shiftTable}
            SET Remarks = 'Synced'
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

        return $stmt->rowCount();
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
