<?php

class InventoryStockStatusController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;


    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        if (true) {

            if ($method == "GET") {
                // Optional: allow GET all active (for admin/debug)
                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {
                // ✅ Read statuses by BU (for module)
                if (!array_key_exists("busunitcode", $data)) {
                    http_response_code(400);
                    echo json_encode(["message" => "busunitcodeRequired"]);
                    exit;
                }

                $busunit = $data["busunitcode"];
                echo json_encode($this->gateway->getByBusunit($busunit));

            } elseif ($method == "PATCH") {
                // ✅ Upsert ON/OFF
                if (!array_key_exists("busunitcode", $data) || !array_key_exists("inv_code", $data)) {
                    http_response_code(400);
                    echo json_encode(["message" => "busunitcodeAndInvCodeRequired"]);
                    exit;
                }

                $rows = $this->gateway->upsertStatusForUser($this->user_id, $data);
                // gateway echoes message already; keep consistent with your style

            } else {
                $this->respondMethodNotAllowed("GET, POST, PATCH");
            }

        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
