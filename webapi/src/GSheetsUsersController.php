<?php

class GSheetsUsersController
{


    private GsheetsUsersGateway $gateway;
    private UserGateway $userGateway;
    private int $user_id;

    public function __construct(GsheetsUsersGateway $gateway, UserGateway $userGateway, string $user_id)
    {
        $this->gateway = $gateway;
        $this->userGateway = $userGateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method): void
    {
        if ($method !== "GET") {
            $this->respondMethodNotAllowed("GET");
            return;
        }

        // ✅ Get logged-in user's email from your main users table (via user_id from JWT)
        $user = $this->userGateway->getById($this->user_id); // must return ['email'=>...]
        $email = $user["email"] ?? null;

        if (!$email) {
            http_response_code(401);
            echo json_encode(["ok" => false, "error" => "User email not found for this token."]);
            return;
        }

        // ✅ Return only the endpoint row for this email
        $row = $this->gateway->getActiveByEmail($email);

        if (!$row) {
            http_response_code(404);
            echo json_encode([
                "ok" => false,
                "error" => "No active Google Sheets endpoint configured for this account.",
            ]);
            return;
        }

        echo json_encode([
            "ok" => true,
            "email" => $row["email"],
            "endpoint" => $row["endpoint"],
        ]);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    }
}
