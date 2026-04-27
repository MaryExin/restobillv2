<?php

class PayrollController
{
    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }



    public function processReadInfiniteClearingItems(string $method, $page, $pageIndex, $pageData, $search,  $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->getPayroll($page, $pageIndex, $pageData, $search,  $busunitcode));
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
                echo json_encode($this->gateway->getClearingItems($busunitcode));
            } elseif ($method == "POST") {
                // echo json_encode($this->gateway->getClearingItems($data));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }



}
?>
