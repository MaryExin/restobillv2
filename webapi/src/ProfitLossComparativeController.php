<?php

class ProfitLossComparativeController
{


    private ProfitLossComparativeGateway $gateway;
    private $user_id;

    public function __construct(ProfitLossComparativeGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $data): void
    {
        if ($method !== 'POST') {
            $this->respondMethodNotAllowed('POST');
            return;
        }

        $groupBy = strtoupper((string)($data['groupBy'] ?? 'BUSUNIT'));
        $groupCodes = $data['groupCodes'] ?? [];
        $dateFrom = (string)($data['dateFrom'] ?? '');
        $dateTo   = (string)($data['dateTo'] ?? '');

        $result = $this->gateway->getProfitAndLossComparative(
            $groupBy,
            is_array($groupCodes) ? $groupCodes : [],
            $dateFrom,
            $dateTo
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
