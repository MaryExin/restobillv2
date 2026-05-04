<?php

class PricingBySalesTypePerBUController
{
    private $gateway;
    private $user_id;

    public function __construct(PricingBySalesTypePerBUGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $data): void
    {
        if ($method === 'GET') {
            $result = $this->gateway->readAssignments();
            header('Content-Type: application/json');
            echo json_encode($result);
            return;
        }

        if ($method === 'POST') {
            $action = strtoupper(trim((string)($data['action'] ?? 'READ')));

            if ($action === 'SAVE') {
                $result = $this->gateway->saveAssignments($data, $this->user_id);
            } else {
                $result = $this->gateway->readAssignments();
            }

            header('Content-Type: application/json');
            echo json_encode($result);
            return;
        }

        $this->respondMethodNotAllowed('GET, POST');
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: $allowed");
    }
}