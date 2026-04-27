<?php

class AccountingFileLinksController
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
            echo json_encode($this->gateway->getAllData());
            return;
        }

        if ($method === "POST") {
            $action = $data["action"] ?? "";

            // READ MODE
            if ($action === "read") {
                if (!empty($data["reference"])) {
                    echo json_encode(
                        $this->gateway->getByReference($data["reference"])
                    );
                    return;
                }

                if (!empty($data["references"]) && is_array($data["references"])) {
                    echo json_encode(
                        $this->gateway->getByReferences($data["references"])
                    );
                    return;
                }

                http_response_code(400);
                echo json_encode(["message" => "Missing reference or references"]);
                return;
            }

            // SAVE / UPDATE MODE
            if (!array_key_exists("reference", $data) || !array_key_exists("link", $data)) {
                http_response_code(400);
                echo json_encode(["message" => "Missing reference or link"]);
                return;
            }

            if (trim((string) $data["reference"]) === "") {
                http_response_code(400);
                echo json_encode(["message" => "Reference is required"]);
                return;
            }

            if (trim((string) $data["link"]) === "") {
                http_response_code(400);
                echo json_encode(["message" => "Link is required"]);
                return;
            }

            $this->gateway->createOrUpdateForUser($this->user_id, $data);
            return;
        }

        $this->respondMethodNotAllowed("GET, POST");
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}