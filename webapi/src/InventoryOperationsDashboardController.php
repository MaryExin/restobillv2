<?php

class InventoryOperationsDashboardController
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
            echo json_encode($this->gateway->getSummaryData([]));
            return;
        }

        if ($method === "POST") {
            $mode = strtolower(trim((string) ($data["mode"] ?? "summary")));

            if ($mode === "detail") {
                echo json_encode($this->gateway->getDetailRows($data));
                return;
            }

            echo json_encode($this->gateway->getSummaryData($data));
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
