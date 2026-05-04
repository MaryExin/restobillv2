<?php

declare(strict_types=1);

class PosReportsDashboardController
{
    private PosReportsDashboardGateway $gateway;
    private int|string $user_id;

    public function __construct(PosReportsDashboardGateway $gateway, int|string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, ?array $data = []): void
    {
        if ($method !== 'POST') {
            $this->respondMethodNotAllowed('POST');
            return;
        }

        $datefrom = (string) ($data['datefrom'] ?? date('Y-m-d'));
        $dateto = (string) ($data['dateto'] ?? date('Y-m-d'));
        $graph_datefrom = (string) ($data['graph_datefrom'] ?? $datefrom);
        $graph_dateto = (string) ($data['graph_dateto'] ?? $datefrom);
        $includeVoided = !empty($data['includeVoided']);
        $voidOnly = !empty($data['voidOnly']);
        $busunitcode = trim((string) ($data['busunitcode'] ?? ''));

        $result = $this->gateway->getDashboardData(
            $datefrom,
            $dateto,
            $graph_datefrom,
            $graph_dateto,
            $includeVoided,
            $voidOnly,
            $busunitcode
        );

        header('Content-Type: application/json');
        echo json_encode($result);
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: $allowed");
    }
}