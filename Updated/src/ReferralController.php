<?php

class ReferralController
{
    public function __construct($gateway,
        $user_id) {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method): void
    {
        if($method == "GET")
        {
            echo json_encode($this->gateway->getAllReferral());
        } 
        elseif ($method == "POST") 
        {

        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->insertReferral($this->user_id, $data);
        
        }
        elseif ($method == "PATCH")
        {

        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->updateReferral($this->user_id, $data); 
        
        }
        elseif ($method == "DELETE")
        {
        
        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->deleteReferral($this->user_id, $data); 
        
        }
   
    }

    public function getRequest(string $method): void
    {
        if ($method == "POST") 
        {
        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->getReferral($this->user_id, $data);
        
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

}
