<?php
// DashboardInventoryController.php
declare(strict_types=1);

class DashboardInventoryController
{


    private DashboardInventoryGateway $gateway;
    private string $user_id;

    public function __construct(DashboardInventoryGateway $gateway, string $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, array $data): void
    {
        if ($method !== "POST") {
            $this->respondMethodNotAllowed("POST");
            return;
        }

        $filter = (string)($data["filter"] ?? "");

        $payload = [
            "busunitcode" => (string)($data["busunitcode"] ?? ""),
            "areacode"    => (string)($data["areacode"] ?? ""),
            "datefrom"    => (string)($data["datefrom"] ?? ""), // movement filters only
            "dateto"      => (string)($data["dateto"] ?? ""),   // required
            "month"       => (string)($data["month"] ?? ""),
            "year"        => (string)($data["year"] ?? ""),
        ];

        if ($payload["dateto"] === "") {
            $this->respondUnprocessableEntity(["dateto is required"]);
            return;
        }

        /**
         * ✅ SNAPSHOT FILTERS (PERPETUAL "AS OF dateto")
         * - IGNORE datefrom ALWAYS (even if frontend sends it)
         */
        if ($filter === "INVSUMMARY") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getInvSummaryAsOf($payload));
            return;
        }

        if ($filter === "LOWSTOCK") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getLowStockAsOf($payload));
            return;
        }

        if ($filter === "OUTOFSTOCK") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getOutOfStockAsOf($payload));
            return;
        }

        if ($filter === "INVCATEGORY") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getInvCategoryMixAsOf($payload));
            return;
        }

        // ✅ NEW: ENDING BALANCE REPORT (Perpetual as-of dateto)
        if ($filter === "ENDINGBALANCE") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getEndingBalanceReportAsOf($payload));
            return;
        }

        /**
         * ✅ MOVEMENT FILTERS (USE datefrom..dateto)
         */
        if ($filter === "TOPMOVERS") {
            echo json_encode($this->gateway->getTopMoversRange($payload));
            return;
        }

        /**
         * ✅ EXISTING (kept)
         * - treat report list as snapshot as-of dateto by default
         */
        if ($filter === "INVCOSTANDBALPERLEVEL") {
            $payload["datefrom"] = "";
            echo json_encode($this->gateway->getAllDataPerCostBalLevelAsOf($payload));
            return;
        }

        if ($filter === "INVUSAGE") {
            $payload["interval"] = (int)($data["interval"] ?? 30);
            echo json_encode($this->gateway->getInventoryUsage($payload));
            return;
        }

        $this->respondUnprocessableEntity(["Invalid filter."]);
    }

        public function processInventoryUsage(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getInventoryUsage($data));

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

        }

    }

    private function respondUnprocessableEntity(array $errors): void
    {
        http_response_code(422);
        echo json_encode(["message" => "Unprocessable entity.", "errors" => $errors]);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode(["message" => "methodNotAllowed"]);
    }
}
