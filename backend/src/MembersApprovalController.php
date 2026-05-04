<?php

class MembersApprovalController
{
    private $gateway;
    private $user_id;
    private $memberId;

    public function __construct($gateway, $user_id, $memberId)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
        $this->memberId = $memberId;
    }

    public function processRequest($method, $memberId, $status)
    {
        if ($memberId === null) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllForUser($this->user_id));

            } elseif ($method == "POST") {

                $data = (array) json_decode(file_get_contents("php://input"), true);

                $errors = $this->getValidationErrors($data);

                if (!empty($errors)) {

                    $this->respondUnprocessableEntity($errors);
                    return;

                }

                $id = $this->gateway->createForUser($this->user_id, $data);

                $this->respondCreated($id);

            } else {

                $this->respondMethodNotAllowed("GET, POST");
            }
        } else {

            $members = $this->gateway->getForUser($memberId);

            if ($members === false) {

                $this->respondNotFound($id);
                return;
            }

            switch ($method) {

                case "GET":
                    echo json_encode($task);
                    break;

                case "PATCH":

                    if ($status !== "rejected") {
                        $rows = $this->gateway->updateMemberQueuing($memberId);
                        echo json_encode(["message" => "memberregistered", "rows" => $rows]);
                        break;
                    } else {
                        $rows = $this->gateway->rejectMemberQueuing($memberId);
                        echo json_encode(["message" => "memberrejected", "rows" => $rows]);
                        break;
                    }

                case "DELETE":
                    $rows = $this->gateway->deleteForUser($this->user_id, $id);
                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);
                    break;

                default:
                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");
            }
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
