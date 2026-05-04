<?php

class FixedAssetController
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

        $data = (array) json_decode(file_get_contents("php://input"), true);
        
        if ($method == "POST") 
        {

            $this->gateway->insertEntries($this->user_id, $data);  

        }elseif ($method == "PATCH")
        {

            $this->gateway->approval($this->user_id, $data);
        }
    }

    public function processReadInfiniteClearingItems(string $method, $page, $pageIndex, $pageData, $search,  $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->getClearingItems($page, $pageIndex, $pageData, $search,  $busunitcode));
            } elseif ($method == "POST") {
                // echo json_encode($this->gateway->getClearingItems($data));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    public function processSumarry(string $method, $page, $pageIndex, $pageData, $search,  $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->summaryofFixedAssetsValue($page, $pageIndex, $pageData, $search,  $busunitcode));
            } elseif ($method == "POST") {
                // echo json_encode($this->gateway->getClearingItems($data));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    public function processDepreciation(string $method, $page, $pageIndex, $pageData, $search,  $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->depreciation($page, $pageIndex, $pageData, $search,  $busunitcode));
            } elseif ($method == "POST") {
                $this->gateway->depreciation($this->user_id, $data);  
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    public function processFixedAssetsData(string $method, $page, $pageIndex, $pageData, $search, $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->depreciationData($page, $pageIndex, $pageData, $search, $busunitcode));
            } elseif ($method == "POST") {
                $this->gateway->depreciation($this->user_id, $data);  
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    public function processExcelRequest(string $method, $data): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->depreciationData($page, $pageIndex, $pageData, $search, $busunitcode));
            } elseif ($method == "POST") {
                $this->gateway->depreciationExcelData($this->user_id, $data);  
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    public function processDisbursementVoucherDetails(string $method, $data): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->getAllData());
            } elseif ($method == "POST") {
                echo json_encode($this->gateway->getDisbursementVoucherDetails($data));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }

}
?>
