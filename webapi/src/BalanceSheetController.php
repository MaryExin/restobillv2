<?php

class BalanceSheetController
{
    private $gateway;
    private $user_id;

    public function __construct(BalanceSheetGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $data): void
    {
        if ($method === 'POST') {

            // ✅ Backward compatible inputs
            $busunit = $data['busunitcode'] ?? '';
            $dateTo  = $data['dateTo'] ?? '';

            // ✅ NEW (optional): group aggregation
            $filterType  = $data['filterType'] ?? '';   // AREA | CORPORATION | BRAND | BUSUNIT (optional)
            $filterValue = $data['filterValue'] ?? '';  // selected value

            $result = $this->gateway->getBalanceSheet(
                $busunit,
                $dateTo,
                $filterType,
                $filterValue
            );

            header('Content-Type: application/json');
            echo json_encode($result);

        } else {
            $this->respondMethodNotAllowed('POST');
        }
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: $allowed");
    }
}
