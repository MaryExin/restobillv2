<?php

class ExcelCSVAccountingController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $menutransacted, $busunit, $dateFrom, $dateTo)
    {
        if ($method == "GET") {
          
            echo json_encode($this->gateway->getAllData($menutransacted, $busunit, $dateFrom, $dateTo));
        } 
    }
     public function processRequestPetty($method, $menutransacted, $busunit,$custodian, $dateFrom, $dateTo)
    {
        if ($method == "GET") {
          
            echo json_encode($this->gateway->getAllDatapetty($menutransacted, $busunit, $custodian, $dateFrom, $dateTo));
        } 
    }

    private function respondUnprocessableEntity(array $errors): void
    {
        http_response_code(422);
        echo json_encode(["errors" => $errors]);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
