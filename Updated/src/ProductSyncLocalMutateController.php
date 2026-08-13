<?php

declare(strict_types=1);

class ProductSyncLocalMutateController
{
    private ProductSyncLocalMutateGateway $gateway;
    private int|string $userId;

    public function __construct(ProductSyncLocalMutateGateway $gateway, int|string $userId)
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

        $result = $this->gateway->applyExportPayload($data ?? [], $this->userId);

        header('Content-Type: application/json');
        echo json_encode($result);
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: {$allowed}");
        header('Content-Type: application/json');
        echo json_encode([
            'message' => 'Method Not Allowed',
        ]);
    }
}