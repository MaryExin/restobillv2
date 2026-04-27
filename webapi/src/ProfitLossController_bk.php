<?php

class ProfitLossController
{
    private $gateway;
    private $user_id;

    public function __construct(ProfitLossGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method,  $data): void
    {
        if ($method === 'POST') {
            $result = $this->gateway->getProfitAndLoss(
                $data['busunitcode'] ?? '',
                $data['dateTo'] ?? ''
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
