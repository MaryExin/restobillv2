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
                'primary_synced_row_keys' => [],
                'report_synced_row_keys' => [],
                'busunit_names' => [],
            ];
        }

        try {
            $syncedRowKeys = [];
            $primarySyncedRowKeys = [];
            $reportSyncedRowKeys = [];
            $busunitCodes = [];
            $validShifts = [];

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

                $identityKey = $this->buildShiftIdentityKey(
                    $unitCode,
                    $shiftId,
                    $terminalNumber,
                    $openingDateTime
                );
                $validShifts[] = [
                    'row_key' => $rowKey,
                    'identity_key' => $identityKey,
                    'unit_code' => $unitCode,
                    'shift_id' => $shiftId,
                    'terminal_number' => $terminalNumber,
                    'opening_datetime' => $openingDateTime,
                ];
            }

            $primarySyncedKeys = $this->findWebSyncedShiftKeys(
                $validShifts,
                $this->quoteIdentifier('tbl_pos_shifting_records')
            );
            $reportSyncedKeys = $this->findWebSyncedShiftKeys(
                $validShifts,
                $this->quoteIdentifier('tbl_pos_shifting_records_bd')
            );

            foreach ($validShifts as $shift) {
                $identityKey = (string) $shift['identity_key'];
                $rowKey = (string) $shift['row_key'];
                $primarySynced = isset($primarySyncedKeys[$identityKey]);
                $reportSynced = isset($reportSyncedKeys[$identityKey]);

                if ($primarySynced) {
                    $primarySyncedRowKeys[] = $rowKey;
                }
                if ($reportSynced) {
                    $reportSyncedRowKeys[] = $rowKey;
                }
                if ($primarySynced && $reportSynced) {
                    $syncedRowKeys[] = $rowKey;
                }
            }

            $busunitNames = $this->getBusunitNames(array_values($busunitCodes));

            return [
                'message' => 'Success',
                'synced_row_keys' => array_values(array_unique($syncedRowKeys)),
                'primary_synced_row_keys' => array_values(array_unique($primarySyncedRowKeys)),
                'report_synced_row_keys' => array_values(array_unique($reportSyncedRowKeys)),
                'busunit_names' => $busunitNames,
            ];
        } catch (Throwable $e) {
            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'synced_row_keys' => [],
                'primary_synced_row_keys' => [],
                'report_synced_row_keys' => [],
                'busunit_names' => [],
            ];
        }
    }

    private function findWebSyncedShiftKeys(
        array $shifts,
        string $table
    ): array {
        $syncedKeys = [];

        foreach (array_chunk($shifts, 250) as $chunk) {
            $clauses = [];
            $values = [];

            foreach ($chunk as $shift) {
                $clauses[] = '(
                    Unit_Code = ?
                    AND Shift_ID = ?
                    AND terminal_number = ?
                    AND Opening_DateTime = ?
                )';
                array_push(
                    $values,
                    $shift['unit_code'],
                    $shift['shift_id'],
                    $shift['terminal_number'],
                    $shift['opening_datetime']
                );
            }

            if (count($clauses) === 0) {
                continue;
            }

            $where = implode(' OR ', $clauses);
            $stmt = $this->conn->prepare("
                SELECT Unit_Code, Shift_ID, terminal_number, Opening_DateTime
                FROM {$table}
                WHERE Status = 'Synced'
                  AND ({$where})
            ");

            foreach ($values as $index => $value) {
                $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
            }

            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $key = $this->buildShiftIdentityKey(
                    (string) ($row['Unit_Code'] ?? ''),
                    (string) ($row['Shift_ID'] ?? ''),
                    (string) ($row['terminal_number'] ?? ''),
                    (string) ($row['Opening_DateTime'] ?? '')
                );
                $syncedKeys[$key] = true;
            }
        }

        return $syncedKeys;
    }

    private function buildShiftIdentityKey(
        string $unitCode,
        string $shiftId,
        string $terminalNumber,
        string $openingDateTime
    ): string {
        return trim($unitCode) . '||'
            . trim($shiftId) . '||'
            . trim($terminalNumber) . '||'
            . trim($openingDateTime);
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

    private function quoteIdentifier(string $identifier): string
    {
        if ($identifier === '' || !preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new InvalidArgumentException('Invalid SQL identifier.');
        }

        return '`' . $identifier . '`';
    }
}
