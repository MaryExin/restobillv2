<?php

class EmployeeDataController
{

    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $pageIndex, $pageData): void
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

    public function processEmployeeDetails(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getEmployeeDetails($data));

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

    public function processEmployeeDetailsForId(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getEmployeeDetailsForId($data));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processEmployeeAll(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getEmployeeAll($data));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processReadRequest(string $method): void
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

    public function processReadRequestPerBusi(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllDatas());

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

    public function processExcelReadMonthlies(string $method, $busunitcode): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetMonthlies($busunitcode));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadDailies(string $method, $busunitcode): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetDailies($busunitcode));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadAllEmployees(string $method, $busunitcode): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadAllowancesAndDeductions(string $method, $busunitcode, $dateuntil): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllowancesAndDeductions($busunitcode, $dateuntil));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadActualTimelogs(string $method, $busunitcode, $datefrom, $dateto): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetActualTimeLogs($busunitcode, $datefrom, $dateto));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadSchedules(string $method, $busunitcode, $datefrom, $dateto): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetSchedules($busunitcode, $datefrom, $dateto));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelReadPayrollConso(string $method, $busunitcode, $yearParams, $monthParams): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetPayrollConso($busunitcode, $yearParams, $monthParams));

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPostEmployees(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostEmployeeScheds($data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPostActualLogs(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostEmployeeActualLogs($data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPayslips(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostPayslips($data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPostAllowancesAndDeductions(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostDeductionsAndAllowances($data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelEntries(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostEntries($data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPayslipsHistory(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetAllEmployees($busunitcode));

            } elseif ($method == "POST") {

                $this->gateway->ExcelPostPayslipsHistory($data);

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
