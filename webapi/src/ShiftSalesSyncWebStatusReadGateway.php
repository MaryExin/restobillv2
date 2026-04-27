<?php

declare(strict_types=1);

class ShiftSalesSyncWebStatusReadGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function readWebSyncStatus(array $data, int|string $userId): array
    {
        $shifts = $data['shifts'] ?? [];

        if (!is_array($shifts)) {
            return [
                'message' => 'InvalidPayload',
                'synced_row_keys' => [],
                'busunit_names' => [],
            ];
        }

        try {
            $syncedRowKeys = [];
            $busunitCodes = [];

            foreach ($shifts as $shift) {
                $unitCode = trim((string) ($shift['unit_code'] ?? ''));
                $shiftId = trim((string) ($shift['shift_id'] ?? ''));
                $terminalNumber = trim((string) ($shift['terminal_number'] ?? ''));
                $openingDateTime = trim((string) ($shift['opening_datetime'] ?? ''));
                $rowKey = trim((string) ($shift['row_key'] ?? ''));

                if ($unitCode !== '') {
                    $busunitCodes[$unitCode] = $unitCode;
                }

                if (
                    $unitCode === ''
                    || $shiftId === ''
                    || $terminalNumber === ''
                    || $openingDateTime === ''
                    || $rowKey === ''
                ) {
                    continue;
                }

                if (
                    $this->existsWebSyncedShift(
                        $unitCode,
                        $shiftId,
                        $terminalNumber,
                        $openingDateTime
                    )
                ) {
                    $syncedRowKeys[] = $rowKey;
                }
            }

            $busunitNames = $this->getBusunitNames(array_values($busunitCodes));

            return [
                'message' => 'Success',
                'synced_row_keys' => array_values(array_unique($syncedRowKeys)),
                'busunit_names' => $busunitNames,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'synced_row_keys' => [],
                'busunit_names' => [],
            ];
        }
    }

    private function existsWebSyncedShift(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): bool {
        $stmt = $this->conn->prepare("
            SELECT 1
            FROM tbl_pos_shifting_records
            WHERE Unit_Code = :unit_code
              AND Shift_ID = :shift_id
              AND terminal_number = :terminal_number
              AND Opening_DateTime = :opening_datetime
              AND Status = 'Synced'
            LIMIT 1
        ");
        $stmt->execute([
            'unit_code' => $unitCode,
            'shift_id' => $shiftId,
            'terminal_number' => $terminalNumber,
            'opening_datetime' => $openingDateTime,
        ]);

        return (bool) $stmt->fetchColumn();
    }

    private function getBusunitNames(array $busunitCodes): array
    {
        if (count($busunitCodes) === 0) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($busunitCodes), '?'));

        $stmt = $this->conn->prepare("
            SELECT busunitcode, name
            FROM lkp_busunits
            WHERE busunitcode IN ($placeholders)
        ");

        foreach ($busunitCodes as $index => $code) {
            $stmt->bindValue($index + 1, $code, PDO::PARAM_STR);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $map = [];
        foreach ($rows as $row) {
            $code = trim((string) ($row['busunitcode'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code !== '') {
                $map[$code] = $name;
            }
        }

        return $map;
    }
}