<?php

class BudgetController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;



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
