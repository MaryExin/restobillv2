<?php

declare(strict_types=1);

final class UserRoleByUserController
{
    public function __construct(
        private UserRoleByUserGateway $gateway,
        private int|string $userId,
    ) {
    }

    public function processRequest(string $method): void
    {
        // Read-only endpoint; keep POST support for existing clients.
        if ($method === "GET" || $method === "POST") {
            try {
                $result = $this->gateway->getForUser($this->userId);
                echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            } catch (Throwable $e) {
                http_response_code(500);
                echo json_encode([
                    "message" => "Server error",
                    "error" => $e->getMessage(), // remove in production if you don't want to leak details
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }
            return;
        }

        $this->respondMethodNotAllowed("GET, POST");
    }

    private function respondUnprocessableEntity(array $errors): void
    {
        http_response_code(422);
        echo json_encode(["errors" => $errors], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }

    // Legacy helpers kept for compatibility with your other controller templates.
    private function respondNotFound(string $id): void
    {
        http_response_code(404);
        echo json_encode(["message" => "Task with ID $id not found"], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function respondCreated(string $id): void
    {
        http_response_code(201);
        echo json_encode(["message" => "Task created", "id" => $id], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function getValidationErrors(array $data, bool $is_new = true): array
    {
        $errors = [];

        if ($is_new && empty($data["name"])) {
            $errors[] = "name is required";
        }

        if (!empty($data["priority"])) {
            if (filter_var($data["priority"], FILTER_VALIDATE_INT) === false) {
                $errors[] = "priority must be an integer";
            }
        }

        return $errors;
    }
}
