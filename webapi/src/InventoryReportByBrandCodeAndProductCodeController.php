<?php

class InventoryReportByBrandCodeAndProductCodeController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method,  $data): void
    {
        if ($method === 'POST') {
            $result = $this->gateway->getInventoryReportByBrandCodeAndProductCode(
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
