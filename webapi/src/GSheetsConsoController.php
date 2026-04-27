<?php

final class GSheetsConsoController
{


    private ConsoGateway $gateway;
    private string $userId;

    public function __construct(ConsoGateway $gateway, string $userId)
    {
        $this->gateway = $gateway;
        $this->userId = $userId;
    }

    public function processRequest(string $method): void
    {
        if ($method === 'GET') {
            // same style as your controller’s GET->json_encode(...) :contentReference[oaicite:8]{index=8}
            echo json_encode($this->gateway->getConso());
            return;
        }

        http_response_code(405);
        header("Allow: GET");
        echo json_encode(["message" => "Method not allowed"]);
    }
}
