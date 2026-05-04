<?php

class BuildController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function multiprocessRequest(string $method, $data): void
    {
        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                // ✅ NEW: multiadd handler now exists in gateway
                $this->gateway->createForMultiProduce($this->user_id, $data);

            } elseif ($method == "PATCH") {

                // (kept as you wrote it; not used by multiadd modal)
                if (!array_key_exists("edit", $data)) {
                    $branchcode = $data["brand_code"];
                    $branchid = join($branchcode);

                    $rows = $this->gateway->rejectbranchs($this->user_id, $branchid);
                    exit;
                } else {
                    $rows = $this->gateway->editbranch($this->user_id, $data);
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

    public function processRequest(string $method, $data): void
    {
        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                // ✅ Your single-add remains the same (uses $_POST/$_FILES inside gateway)
                $this->gateway->createForUser($this->user_id, $data);

            } elseif ($method == "DELETE") {

                $this->gateway->deleteData($this->user_id, $data);

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

    public function processPatchRequest(string $method, $data): void
    {
        if (true) {

            if ($method == "GET") {
                echo json_encode($this->gateway->getAllData());
            } elseif ($method == "POST") {
                $this->gateway->editData($this->user_id, $data);
            } elseif ($method == "PATCH") {
                $this->gateway->editData($this->user_id, $data);
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

    public function processBuild(string $method, $page, $pageIndex, $pageData, $search): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->getBuildData($page, $pageIndex, $pageData, $search));
            } elseif ($method == "POST") {
                echo json_encode($this->gateway->getbyPageData($page, $pageIndex, $pageData));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
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

    public function processInfiniteReadRequest(string $method, $page, $pageIndex, $pageData, $search): void
    {
        if (true) {

            if ($method == "GET") {
                echo json_encode($this->gateway->getInfiniteReadData($page, $pageIndex, $pageData, $search));
            } elseif ($method == "POST") {
                echo json_encode($this->gateway->getbyPageData($page, $pageIndex, $pageData));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }

        }
    }

     public function processExportExcelRequest(string $method, string $search, string $pricingFilter): void
    {
        if ($method !== "GET") {
            $this->respondMethodNotAllowed("GET");
            return;
        }

        $rows = $this->gateway->getExportReadData($search, $pricingFilter);
        $this->outputExcelFile($rows, $pricingFilter);
    }

    private function outputExcelFile(array $rows, string $pricingFilter): void
    {
        $safePricing = preg_replace('/[^A-Za-z0-9_\-]/', '_', $pricingFilter ?: 'ALL');
        $filename = "products_" . $safePricing . "_" . date("Ymd_His") . ".xls";

        header("Content-Type: application/vnd.ms-excel; charset=UTF-8");
        header("Content-Disposition: attachment; filename=\"$filename\"");
        header("Pragma: public");
        header("Expires: 0");

        $xmlEscape = function ($value): string {
            return htmlspecialchars((string)($value ?? ""), ENT_QUOTES | ENT_XML1, 'UTF-8');
        };

        echo '<?xml version="1.0"?>' . "\n";
        echo '<?mso-application progid="Excel.Sheet"?>' . "\n";
        echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
                xmlns:o="urn:schemas-microsoft-com:office:office"
                xmlns:x="urn:schemas-microsoft-com:office:excel"
                xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
                xmlns:html="http://www.w3.org/TR/REC-html40">' . "\n";

        echo '<Styles>
                <Style ss:ID="Header">
                    <Font ss:Bold="1"/>
                    <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
                    <Borders>
                        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
                        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
                        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
                        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
                    </Borders>
                </Style>
              </Styles>' . "\n";

        echo '<Worksheet ss:Name="Products">' . "\n";
        echo '<Table>' . "\n";

        $headers = [
            "Build Code",
            "Product Code",
            "Description",
            "Brand",
            "Pricing",
            "Quantity",
            "UOM Value",
            "UOM",
            "Level",
            "Tax Type",
            "Category",
            "Discountable",
            "Expiry Days",
            "Cost Per UOM",
            "SRP",
        ];

        echo '<Row>';
        foreach ($headers as $header) {
            echo '<Cell ss:StyleID="Header"><Data ss:Type="String">' . $xmlEscape($header) . '</Data></Cell>';
        }
        echo '</Row>' . "\n";

        foreach ($rows as $row) {
            echo '<Row>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["build_code"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["productcode"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["desc"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["brand_desc"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["pricing_code"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["build_qty"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["uomval"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["uom"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["level"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["tax_type"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["category"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["isdiscountable"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["expiry_days"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["cost_per_uom"] ?? "") . '</Data></Cell>';
            echo '<Cell><Data ss:Type="String">' . $xmlEscape($row["srp"] ?? "") . '</Data></Cell>';
            echo '</Row>' . "\n";
        }

        echo '</Table>' . "\n";
        echo '</Worksheet>' . "\n";
        echo '</Workbook>';
        exit;
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
