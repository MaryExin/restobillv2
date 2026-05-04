<?php

class BusUnitControllerNoToken
{

    public function __construct($gateway)
    {

        $this->gateway = $gateway;

    }

    public function processRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                $this->gateway->createForUser($this->user_id, $data);

            } elseif ($method == "PATCH") {

                if (!array_key_exists("edit", $data)) {

                    $busunitcode = $data["busunitcode"];

                    $busunitid = join($busunitcode);

                    $rows = $this->gateway->rejectbusunits($this->user_id, $busunitid);

                    echo json_encode(["message" => "Business unit deleted", "rows" => $rows]);

                    exit;

                } else {

                    $rows = $this->gateway->editbusunit($this->user_id, $data);

                    echo json_encode(["message" => "Business Edit", "rows" => $rows]);

                }

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } else {

            $task = $this->gateway->getForUser($this->user_id, $id);

            if ($task === false) {

                $this->respondNotFound($id);

                return;

            }

            switch ($method) {

                case "GET":

                    echo json_encode($task);

                    break;

                case "PATCH":

                    $data = (array) json_decode(file_get_contents("php://input"), true);

                    $errors = $this->getValidationErrors($data, false);

                    if (!empty($errors)) {

                        $this->respondUnprocessableEntity($errors);

                        return;

                    }

                    $rows = $this->gateway->updateForUser($this->user_id, $id, $data);

                    echo json_encode(["message" => "Task updated", "rows" => $rows]);

                    break;

                case "DELETE":

                    $rows = $this->gateway->deleteForUser($this->user_id, $id);

                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);

                    break;

                default:

                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");

            }

        }

    }

    public function processReadRequest(string $method, $pageIndex, $pageData): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } else {

            $task = $this->gateway->getForUser($this->user_id, $id);

            if ($task === false) {

                $this->respondNotFound($id);

                return;

            }

            switch ($method) {

                case "GET":

                    echo json_encode($task);

                    break;

                case "PATCH":

                    $data = (array) json_decode(file_get_contents("php://input"), true);

                    $errors = $this->getValidationErrors($data, false);

                    if (!empty($errors)) {

                        $this->respondUnprocessableEntity($errors);

                        return;

                    }

                    $rows = $this->gateway->updateForUser($this->user_id, $id, $data);

                    echo json_encode(["message" => "Task updated", "rows" => $rows]);

                    break;

                case "DELETE":

                    $rows = $this->gateway->deleteForUser($this->user_id, $id);

                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);

                    break;

                default:

                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");

            }

        }

    }

    public function processQueryRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } else {

            $task = $this->gateway->getForUser($this->user_id, $id);

            if ($task === false) {

                $this->respondNotFound($id);

                return;

            }

            switch ($method) {

                case "GET":

                    echo json_encode($task);

                    break;

                case "PATCH":

                    $data = (array) json_decode(file_get_contents("php://input"), true);

                    $errors = $this->getValidationErrors($data, false);

                    if (!empty($errors)) {

                        $this->respondUnprocessableEntity($errors);

                        return;

                    }

                    $rows = $this->gateway->updateForUser($this->user_id, $id, $data);

                    echo json_encode(["message" => "Task updated", "rows" => $rows]);

                    break;

                case "DELETE":

                    $rows = $this->gateway->deleteForUser($this->user_id, $id);

                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);

                    break;

                default:

                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");

            }

        }

    }

    public function processFilteredRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getFilteredData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } else {

            $task = $this->gateway->getForUser($this->user_id, $id);

            if ($task === false) {

                $this->respondNotFound($id);

                return;

            }

            switch ($method) {

                case "GET":

                    echo json_encode($task);

                    break;

                case "PATCH":

                    $data = (array) json_decode(file_get_contents("php://input"), true);

                    $errors = $this->getValidationErrors($data, false);

                    if (!empty($errors)) {

                        $this->respondUnprocessableEntity($errors);

                        return;

                    }

                    $rows = $this->gateway->updateForUser($this->user_id, $id, $data);

                    echo json_encode(["message" => "Task updated", "rows" => $rows]);

                    break;

                case "DELETE":

                    $rows = $this->gateway->deleteForUser($this->user_id, $id);

                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);

                    break;

                default:

                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");

            }

        }

    }

    public function processFilteredRequestByStores(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getFilteredDataByStores());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

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
