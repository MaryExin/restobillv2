<?php

class PostdatedCheckController
{
    private $gateway;
    private $user_id;

    public function __construct(PostdatedCheckGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method,  $data): void
    {
        if ($method === 'POST') {
            $result = $this->gateway->getPostdatedCheckData($data);
            header('Content-Type: application/json');
            echo json_encode($result);
        } else {
            $this->respondMethodNotAllowed('POST');
        }
    }

    public function processClearPdcSelected($method,  $data): void
    {
        if ($method === 'POST') {
            $this->gateway->clearPdcSelected($this->user_id, $data);
        } else {
            $this->respondMethodNotAllowed('POST');
        }
    }

    private function respondMethodNotAllowed(string $allowed): void
    {
        http_response_code(405);
        header("Allow: $allowed");
    }
}
