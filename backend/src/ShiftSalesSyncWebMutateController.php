<?php

declare(strict_types=1);

class ShiftSalesSyncWebMutateController
{
    private ShiftSalesSyncWebMutateGateway $gateway;
    private int|string $userId;

    public function __construct(ShiftSalesSyncWebMutateGateway $gateway, int|string $userId)
    {
        $this->gateway = $gateway;
        $this->userId = $userId;
    }

    public function processRequest(string $method, ?array $data = []): void
    {
        if ($method !== 'POST') {
            $this->respondMethodNotAllowed('POST');
            return;
        }

        $result = $this->gateway->uploadExportedShifts($data ?? [], $this->userId);

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