<?php

declare(strict_types=1);

class ShiftSalesSyncLocalMarkSyncedGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function markShiftsSynced(array $data, int|string $userId): array
    {
        $shifts = $data['shifts'] ?? [];

        if (!is_array($shifts) || count($shifts) === 0) {
            return ['message' => 'NoRows'];
        }

        $marked = 0;

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

                $marked += $this->markShiftSynced(
                    $unitCode,
                    $shiftId,
                    $terminalNumber,
                    $openingDateTime
                );
            }

            $this->conn->commit();

            return [
                'message' => 'Success',
                'marked_synced' => $marked,
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
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): int {
        $stmt = $this->conn->prepare("
            UPDATE tbl_pos_shifting_records
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
}
