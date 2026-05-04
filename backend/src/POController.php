<?php

class POController
{
    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {
                
                $data = (array) json_decode(file_get_contents("php://input"), true);

                $this->gateway->insertPO($this->user_id, $data);

            }elseif ($method == "PATCH") {
                
                $data = (array) json_decode(file_get_contents("php://input"), true);

                $this->gateway->updatePO($this->user_id, $data);

            }elseif ($method == "DELETE") {
                
                $data = (array) json_decode(file_get_contents("php://input"), true);

                $this->gateway->deletePO($this->user_id, $data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 
    }

    public function processproductRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {
                
                $data = (array) json_decode(file_get_contents("php://input"), true);

                $this->gateway->getProducts($this->user_id, $data);

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 
    }

    public function processReadInfiniteClearingItems(string $method, $page, $pageIndex, $pageData, $search): void
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

}
?>
