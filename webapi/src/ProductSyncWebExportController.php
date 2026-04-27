<?php

declare(strict_types=1);

class ProductSyncWebExportController
{
    private ProductSyncWebExportGateway $gateway;
    private int|string $user_id;

    public function __construct(ProductSyncWebExportGateway $gateway, int|string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        if ($method === "POST") {
            echo json_encode($this->gateway->buildExportPayload($data, $this->user_id));
        } else {
            $this->respondMethodNotAllowed("POST");
        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode([
            "message" => "Method Not Allowed"
        ]);
    }
}