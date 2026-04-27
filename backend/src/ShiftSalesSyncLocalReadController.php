<?php

declare(strict_types=1);

class ShiftSalesSyncLocalReadController
{
    private ShiftSalesSyncLocalReadGateway $gateway;
    private int|string $userId;

    public function __construct(ShiftSalesSyncLocalReadGateway $gateway, int|string $userId)
    {
        $this->gateway = $gateway;
        $this->userId = $userId;
    }

    public function processRequest(string $method, ?array $data = []): void
    {
        if ($method !== 'GET' && $method !== 'POST') {
            $this->respondMethodNotAllowed('GET, POST');
            return;
        }

        $result = $this->gateway->readShiftSyncData($data ?? [], $this->userId);

        header('Content-Type: application/json');
        echo json_encode($result);
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: {$allowed}");
        header('Content-Type: application/json');
        echo json_encode([
            'message' => 'Method Not Allowed'
        ]);
    }
}