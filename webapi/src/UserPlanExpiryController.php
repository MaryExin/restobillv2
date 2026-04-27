<?php
// UserPlanExpiryController.php
//
// ✅ GLOBAL plan logic controller:
// - GET -> global plan status check
// - POST action "check" -> global plan status check (called after login)
// - POST action "renewPlan" or "upgradePlan" -> submits GLOBAL renewal/upgrade request for ALL users
//
// Notes:
// - Frontend should send action="renewPlan" for both renewal + upgrade, and just change plan.
// - This controller supports both "renewPlan" and "upgradePlan" as aliases.

class UserPlanExpiryController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        // ensure array
        if (!is_array($data)) $data = [];

        if ($method === "GET") {
            // GLOBAL: check whole system (optionally scoped by companycode if you pass it)
            // If your endpoint can parse querystring and pass it as $data, this will honor it.
            echo json_encode($this->gateway->checkGlobalPlanStatus($this->user_id, $data));
            return;
        }

        if ($method === "POST") {
            $action = (string)($data["action"] ?? "check");

            // ✅ Default (called after login): GLOBAL check
            if ($action === "check") {
                echo json_encode($this->gateway->checkGlobalPlanStatus($this->user_id, $data));
                return;
            }

            // ✅ Renewal / Upgrade request (GLOBAL for all users)
            // Frontend sends:
            // action: "renewPlan"
            // plan: "PRO"/"PREMIUM"/"UNLIMITED"
            if ($action === "renewPlan" || $action === "upgradePlan") {
                echo json_encode($this->gateway->requestGlobalPlanRenewalOrUpgrade($this->user_id, $data));
                return;
            }

            $this->respondUnprocessableEntity(["Invalid action."]);
            return;
        }

        $this->respondMethodNotAllowed("GET, POST");
    }

    private function respondUnprocessableEntity(array $errors): void
    {
        http_response_code(422);
        echo json_encode([
            "message" => "Unprocessable entity.",
            "errors" => $errors
        ]);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode(["message" => "Method not allowed"]);
    }
}
