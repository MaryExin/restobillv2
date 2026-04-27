<?php

class InventoryOperationsActionController
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
        if ($method !== "POST") {
            http_response_code(405);
            header("Allow: POST");
            return;
        }

        echo json_encode($this->gateway->processActionForUser($this->user_id, $data));
    }
}
