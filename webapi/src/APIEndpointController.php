<?php

class APIEndpointController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getAllData());
        } elseif ($method == "POST") {
            $action = strtoupper(trim($data["action"] ?? ""));

            if ($action === "LOGSUBSCRIPTIONDATES") {
                echo json_encode($this->gateway->logSubscriptionDates($data, $this->user_id));
                exit;
            }

            if ($action === "ACTIVATESUBSCRIPTION") {
                echo json_encode($this->gateway->activateSubscription($data, $this->user_id));
                exit;
            }

            if ($action === "EXPIRESUBSCRIPTION") {
                echo json_encode($this->gateway->expireSubscription($data, $this->user_id));
                exit;
            }

            // default (existing)
            echo json_encode($this->gateway->getAPIEndpoint($data));
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
    }

    public function processExcelReadData(string $method, $pageIndex, $pageData): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->ExcelGetChartOfAccounts());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
        }
    }

    public function processDistinctRequest(string $method, $data): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getAllDistinctData());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getFilteredDataByStore($data));
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
    }

    public function processReadRequest(string $method, $pageIndex, $pageData): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getAllData());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
        }
    }

    public function processQueryRequest(string $method, $pageIndex, $pageData): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getAllData());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
        }
    }

    public function processFilteredRequest(string $method, $pageIndex, $pageData): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getFilteredData());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
        }
    }

    public function processFilteredRequestByStores(string $method, $pageIndex, $pageData): void
    {
        if ($method == "GET") {
            echo json_encode($this->gateway->getFilteredDataByStores());
        } elseif ($method == "POST") {
            echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));
        } else {
            $this->respondMethodNotAllowed("GET, POST");
        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
