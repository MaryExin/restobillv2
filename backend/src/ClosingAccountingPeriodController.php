<?php

class ClosingAccountingPeriodController
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
            echo json_encode($this->gateway->getAllData());
        } 
        elseif ($method == "POST") 
        {

        $data = (array) json_decode(file_get_contents("php://input"), true);
        if(isset($data['accounting_period_check']) && $data['accounting_period_check'] === "Check_month"){
          $id =  $this->gateway->checkingDate($this->user_id, $data);
        }else{
            $id = $this->gateway->closeAccountingEntries($this->user_id, $data);
        }
        
        }
        elseif ($method == "PATCH")
        {

        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->paymentDeduction($this->user_id, $data); 
        
        }
        elseif ($method == "PUT")
        {
        
        $data = (array) json_decode(file_get_contents("php://input"), true);

        $id = $this->gateway->paymentDeduction($this->user_id, $data); 
        
        }
   
    }
     public function processReadInfiniteClearingItems(string $method, $page, $search,  $busunitcode): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->closeAccountingEntriesMap($page,  $search,  $busunitcode));
            } elseif ($method == "POST") {
                // echo json_encode($this->gateway->checkingDate($data));
            } else {
                $this->respondMethodNotAllowed("GET, POST");
            }
        }
    }
  

}
