<?php

class DashboardSalesController
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
        // Normalize
        $data = is_array($data) ? $data : [];
        $method = strtoupper(trim($method));

        if ($method === "GET") {
            echo json_encode($this->gateway->getAllData());
            return;
        }

        if ($method === "POST") {
            $filter = strtoupper(trim((string)($data["filter"] ?? "")));

            // ✅ Your existing router (kept) + NEW HOURLYBI
            if ($filter === "STORE") {
                echo json_encode($this->gateway->getAllDataByStore($data));
                return;
            }

            if ($filter === "AREA") {
                echo json_encode($this->gateway->getAllDataByArea($data));
                return;
            }

            if ($filter === "YEAR") {
                echo json_encode($this->gateway->getAllDataByYearAndArea($data));
                return;
            }

            if ($filter === "MONTH") {
                echo json_encode($this->gateway->getAllDataByMonthAndArea($data));
                return;
            }

            if ($filter === "MONTHPERSTORE") {
                echo json_encode($this->gateway->getAllDataByMonthAndAreaPerStore($data));
                return;
            }

            if ($filter === "YEARPERSTORE") {
                echo json_encode($this->gateway->getAllDataByYearAndAreaPerStore($data));
                return;
            }

            if ($filter === "OPENSTORES") {
                echo json_encode($this->gateway->getAllOpenStoresToday($data));
                return;
            }

            if ($filter === "CLOSEDSTORES") {
                echo json_encode($this->gateway->getAllClosedStoresToday($data));
                return;
            }

            if ($filter === "OTHERMOP") {
                // echo json_encode($this->gateway->getAllMOPToday($data));
                     echo json_encode($this->gateway->getOtherMOPByDateRange($data));
                return;
            }

            if ($filter === "PRODUCTSOLD") {
                echo json_encode($this->gateway->getAllDataPerProductSold($data));
                return;
            }

            if ($filter === "SALESTABULAR") {
                echo json_encode($this->gateway->getSalesTabular($data));
                return;
            }

            if ($filter === "SALESPERDAY") {
                echo json_encode($this->gateway->getAllSalesPerDay($data));
                return;
            }

            // ✅ NEW: Powerful hourly BI report
            if ($filter === "HOURLYBI") {
                echo json_encode($this->gateway->getHourlyBIReport($data));
                return;
            }

            $this->respondUnprocessableEntity([
                "Invalid filter. Allowed filters: STORE, AREA, YEAR, MONTH, MONTHPERSTORE, YEARPERSTORE, OPENSTORES, CLOSEDSTORES, OTHERMOP, PRODUCTSOLD, SALESTABULAR, SALESPERDAY, HOURLYBI",
            ]);
            return;
        }

        if ($method === "PATCH") {
            // ✅ Your PATCH logic (kept)
            // - if no "edit": reject branch
            // - if has "edit": edit branch

            if (!array_key_exists("edit", $data)) {
                $branchid = $this->normalizeId($data["brand_code"] ?? "");

                if ($branchid === "") {
                    $this->respondUnprocessableEntity(["brand_code is required"]);
                    return;
                }

                $rows = $this->gateway->rejectbranchs($this->user_id, $branchid);
                echo json_encode(["message" => "Branch deleted", "rows" => $rows]);
                return;
            }

            $rows = $this->gateway->editbranch($this->user_id, $data);
            echo json_encode(["message" => "Branch Edit", "rows" => $rows]);
            return;
        }

        $this->respondMethodNotAllowed("GET, POST, PATCH");
    }

    // ✅ Your controller exposes these in your old code
    public function processReadRequest(string $method, $pageIndex, $pageData): void
    {
        $method = strtoupper(trim($method));

        if ($method === "GET") {
            echo json_encode($this->gateway->getAllData());
            return;
        }

        if ($method === "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
            return;
        }

        $this->respondMethodNotAllowed("GET, POST");
    }

    public function processQueryRequest(string $method): void
    {
        $method = strtoupper(trim($method));

        if ($method === "GET") {
            echo json_encode($this->gateway->getAllData());
            return;
        }

        $this->respondMethodNotAllowed("GET");
    }

    // =========================
    // Helpers
    // =========================
    private function normalizeId($v): string
    {
        if (is_array($v)) return implode("", $v);
        return trim((string)$v);
    }

    private function respondUnprocessableEntity(array $errors): void
    {
        http_response_code(422);
        echo json_encode([
            "message" => "Unprocessable entity",
            "errors" => $errors,
        ]);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode([
            "message" => "methodNotAllowed",
            "allowed" => $allowed_methods,
        ]);
    }
}
