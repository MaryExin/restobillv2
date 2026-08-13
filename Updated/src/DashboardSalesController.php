<?php

class DashboardSalesController
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

                if ($data["filter"] === "STORE") {
                    echo json_encode($this->gateway->getAllDataByStore($data));
                }

                if ($data["filter"] === "AREA") {
                    echo json_encode($this->gateway->getAllDataByArea($data));
                }

                if ($data["filter"] === "YEAR") {
                    echo json_encode($this->gateway->getAllDataByYearAndArea($data));
                }

                if ($data["filter"] === "MONTH") {
                    echo json_encode($this->gateway->getAllDataByMonthAndArea($data));
                }

                if ($data["filter"] === "MONTHPERSTORE") {
                    echo json_encode($this->gateway->getAllDataByMonthAndAreaPerStore($data));
                }

                if ($data["filter"] === "YEARPERSTORE") {
                    echo json_encode($this->gateway->getAllDataByYearAndAreaPerStore($data));
                }

                if ($data["filter"] === "OPENSTORES") {
                    echo json_encode($this->gateway->getAllOpenStoresToday($data));
                }

                if ($data["filter"] === "CLOSEDSTORES") {
                    echo json_encode($this->gateway->getAllClosedStoresToday($data));
                }

                if ($data["filter"] === "OTHERMOP") {
                    echo json_encode($this->gateway->getAllMOPToday($data));
                }

                if ($data["filter"] === "PRODUCTSOLD") {
                    echo json_encode($this->gateway->getAllDataPerProductSold($data));
                }

                if ($data["filter"] === "SALESTABULAR") {
                    echo json_encode($this->gateway->getSalesTabular($data));
                }

                if ($data["filter"] === "SALESPERDAY") {
                    echo json_encode($this->gateway->getAllSalesPerDay($data));
                }

            } elseif ($method == "PATCH") {

                if (!array_key_exists("edit", $data)) {

                    $branchcode = $data["brand_code"];

                    $branchid = join($branchcode);

                    $rows = $this->gateway->rejectbranchs($this->user_id, $branchid);

                    echo json_encode(["message" => "Branch deleted", "rows" => $rows]);

                    exit;

                } else {

                    $rows = $this->gateway->editbranch($this->user_id, $data);

                    echo json_encode(["message" => "Branch Edit", "rows" => $rows]);

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

                    $branchcode = $data["brand_code"];

                    $rows = $this->gateway->rejectbranchs($data);

                    echo json_encode(["message" => "memberrejected", "rows" => $rows]);

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
