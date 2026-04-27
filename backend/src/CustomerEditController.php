<?php

class CustomerEditController
{

    public function __construct($gateway,

        $user_id) {

        $this->gateway = $gateway;

        $this->user_id = $user_id;

    }

    public function processRequest(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

            } elseif ($method == "POST") {
                $this->gateway->editCustomer($this->user_id, $data);
            } elseif ($method == "PATCH") {
                
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }

        } else {
           
            }

        }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {

        http_response_code(405);

        header("Allow: $allowed_methods");

    }

}
