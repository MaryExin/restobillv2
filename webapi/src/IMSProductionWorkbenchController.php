<?php

class IMSProductionWorkbenchController
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
            echo json_encode($this->gateway->getWorkbenchData([]));
            return;
        }

        if ($method === "POST") {
            if (isset($data["job_code"]) && trim((string) $data["job_code"]) !== "") {
                echo json_encode($this->gateway->getRecentJobDetail($data));
                return;
            }

            echo json_encode($this->gateway->getWorkbenchData($data));
            return;
        }

        if ($method === "PATCH") {
            echo json_encode($this->gateway->processActionForUser($this->user_id, $data));
            return;
        }

        $this->respondMethodNotAllowed("GET, POST, PATCH");
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
