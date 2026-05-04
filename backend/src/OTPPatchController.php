<?php

class OTPPatchController
{

    public function __construct($gateway) {

        $this->gateway = $gateway;

    

    }

    public function processRequest(string $method, $userIDToVerify): void
    {

        switch ($method) {

            case "GET":

                echo json_encode($task);

                break;

            case "PATCH":

                $rows = $this->gateway->patchUserVerified($userIDToVerify);

                echo json_encode(["message" => "User Verified", "rows" => $rows]);

                break;

            case "DELETE":

                $rows = $this->gateway->deletedataWithIds($ids);

                echo json_encode(["message" => "deletedRecords", "rows" => $rows]);

                break;

            default:

                $this->respondMethodNotAllowed("GET, PATCH, DELETE");

        }

    }

    private function respondUnprocessableEntity(array $errors): void
    {

        http_response_code(422);

        echo json_encode(["errors" => $errors]);

    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {

        http_response_code(405);

        header("Allow: $allowed_methods");

    }

    private function respondNotFound(string $id): void
    {

        http_response_code(404);

        echo json_encode(["message" => "Task with ID $id not found"]);

    }

    private function respondCreated(string $id): void
    {

        http_response_code(201);

        echo json_encode(["message" => "Task created", "id" => $id]);

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
