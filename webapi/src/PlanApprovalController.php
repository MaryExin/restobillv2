<?php

class PlanApprovalController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        if ($method === "GET") {
            $q = (string)($data["q"] ?? "");
            echo json_encode($this->gateway->getForReviewPlans($q));
            return;
        }

        if ($method === "POST") {
            $action = strtolower(trim((string)($data["action"] ?? "")));

            if ($action === "approveplanrequests") {
                echo json_encode($this->gateway->approvePlanRequests($this->user_id, $data));
                return;
            }

            http_response_code(400);
            echo json_encode(["message" => "Invalid action."]);
            return;
        }

        http_response_code(405);
        header("Allow: GET, POST");
    }
}
