<?php

use Google\Service\Sheets;

final class GSheetsConsoGateway
{


    private Sheets $sheets;
    private string $spreadsheetId;

    public function __construct(Sheets $sheets, string $spreadsheetId)
    {
        $this->sheets = $sheets;
        $this->spreadsheetId = $spreadsheetId;
    }

    /**
     * Reads CONSO starting at A1.
     * Example range: "CONSO!A1:Q"
     */
    public function getConso(string $range = 'CONSO!A1:Q'): array
    {
        $resp = $this->sheets->spreadsheets_values->get($this->spreadsheetId, $range);
        $values = $resp->getValues() ?? [];

        if (count($values) === 0) return [];

        // Row 1 is header, like your CONSO format :contentReference[oaicite:6]{index=6}
        $headers = array_map(
            fn($h) => trim((string)$h),
            $values[0]
        );

        $rows = [];
        for ($i = 1; $i < count($values); $i++) {
            $row = $values[$i];
            $obj = [];
            foreach ($headers as $colIndex => $key) {
                $obj[$key] = $row[$colIndex] ?? null;
            }
            $rows[] = $obj;
        }

        return $rows;
    }

    /**
     * Example: append one row to CONSO (optional).
     */
    public function appendConso(array $rowValues, string $range = 'CONSO!A1:Q'): array
    {
        $body = new \Google\Service\Sheets\ValueRange([
            'values' => [$rowValues],
        ]);

        // Official append method :contentReference[oaicite:7]{index=7}
        $params = [
            'valueInputOption' => 'USER_ENTERED',
            'insertDataOption' => 'INSERT_ROWS',
        ];

        $result = $this->sheets->spreadsheets_values->append(
            $this->spreadsheetId,
            $range,
            $body,
            $params
        );

        return [
            'updates' => $result->getUpdates(),
        ];
    }
}
