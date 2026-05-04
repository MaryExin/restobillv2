<?php

class PosJournalEntriesController
{
    protected $gateway;
    protected $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processReadRequest(string $method): void
    {
        if ($method === "GET") {
            echo json_encode($this->gateway->getInitialData());
            return;
        }

        $this->respondMethodNotAllowed("GET");
    }

    public function processMutationRequest(string $method, array $data): void
    {
        if ($method === "POST") {
            echo json_encode($this->gateway->postEntries($this->user_id, $data));
            return;
        }

        $this->respondMethodNotAllowed("POST");
    }

    public function processPostedReadRequest(string $method): void
    {
        if ($method === "GET") {
            echo json_encode($this->gateway->getPostedData());
            return;
        }

        $this->respondMethodNotAllowed("GET");
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
