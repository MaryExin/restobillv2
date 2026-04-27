<?php

declare(strict_types=1);

class ProductSyncWebReadController
{
    private ProductSyncWebReadGateway $gateway;
    private int|string $user_id;

    public function __construct(ProductSyncWebReadGateway $gateway, int|string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        if ($method === "GET" || $method === "POST") {
            echo json_encode($this->gateway->readWebSnapshot($data, $this->user_id));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
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