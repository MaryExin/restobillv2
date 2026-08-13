<?php

class BudgetController
{

    public function __construct($gateway,

        $user_id) {

        $this->gateway = $gateway;

        $this->user_id = $user_id;

    }

    public function processExcelReadData(string $method, $busunitCode): void

    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetBudget($busunitCode));

            } elseif ($method == "POST") {


            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

}
