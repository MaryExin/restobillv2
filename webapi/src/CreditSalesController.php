<?php

class CreditSalesController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;



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

                $this->gateway->createForUser($this->user_id, $data);

            } elseif ($method == "PATCH") {

                $this->gateway->updateForUser($this->user_id, $data);

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

    public function processClearing(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getClearingData());

            } elseif ($method == "POST") {

                $this->gateway->clearForUser($this->user_id, $data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processInfiniteRequest(string $method, $page, $pageIndex, $pageData, $search): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getInfiniteData($page, $pageIndex, $pageData, $search));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($page, $pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processReadRequest(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getCreditByBusUnit($data));

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

    public function processReadCrediSalesInvoice(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getSalesInvoice($data));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processQueryRequest(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getPaidCreditSalesToday($this->user_id, $data));

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
