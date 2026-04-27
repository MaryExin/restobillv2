<?php

class SLCodeController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id) 
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method): void
    {

        if($method == "GET")
        {

            $data = [
                'glcode' => 803
            ];
            echo json_encode($this->gateway->getslCode($data));
        } 
        elseif ($method == "POST") 
        {
            $data = (array) json_decode(file_get_contents("php://input"), true);
            $this->gateway->paramsSlCode($this->user_id, $data);  

        }
    }

    public function slRequest(string $method): void
    {

        if($method == "POST")
        {
            
            $data = (array) json_decode(file_get_contents("php://input"), true);
            
            $id = $this->gateway->paramsSlCode($this->user_id, $data);
        
        } 

    }
}

