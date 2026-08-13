<?php

class TemplatedEntriesListController
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

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                $this->gateway->createForUser($this->user_id, $data);

            } elseif ($method == "PATCH") {

                $this->gateway->deleteForUser($this->user_id, $data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {

        http_response_code(405);

        header("Allow: $allowed_methods");

    }

}