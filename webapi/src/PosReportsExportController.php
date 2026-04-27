<?php

declare(strict_types=1);

class PosReportsExportController
{
    private PosReportsExportGateway $gateway;
    private int|string $user_id;

    public function __construct(PosReportsExportGateway $gateway, int|string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, ?array $data = []): void
    {
        if ($method !== 'GET') {
            $this->respondMethodNotAllowed('GET');
            return;
        }

        $report = (string) ($data['report'] ?? 'daily');
        $datefrom = (string) ($data['datefrom'] ?? date('Y-m-d'));
        $dateto = (string) ($data['dateto'] ?? date('Y-m-d'));
        $includeVoided = !empty($data['includeVoided']);
        $voidOnly = !empty($data['voidOnly']);
        $year = (string) ($data['year'] ?? date('Y'));
        $busunitcode = trim((string) ($data['busunitcode'] ?? ''));

        $this->gateway->exportReport(
            $report,
            $datefrom,
            $dateto,
            $includeVoided,
            $voidOnly,
            $year,
            $busunitcode
        );
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: $allowed");
    }
}