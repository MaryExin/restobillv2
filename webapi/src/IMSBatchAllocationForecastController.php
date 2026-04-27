<?php

class IMSBatchAllocationForecastController
{
    protected $gateway;
    protected $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, array $data): void
    {
        if ($method === "GET") {
            echo json_encode($this->gateway->getBatchAllocationData([]));
            return;
        }

        if ($method === "POST") {
            echo json_encode($this->gateway->getBatchAllocationData($data));
            return;
        }

        $this->respondMethodNotAllowed("GET, POST");
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
