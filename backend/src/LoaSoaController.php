<?php

class LoaSoaController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id) 
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequestLoa(string $method): void
    {

        if ($method == "POST") 
        {
            $data = (array) json_decode(file_get_contents("php://input"), true);
            $this->gateway->getLoa($this->user_id, $data);  

        }
    }
    
    public function processRequestSoa(string $method): void
    {

        if ($method == "POST") 
        {
            $data = (array) json_decode(file_get_contents("php://input"), true);
            $this->gateway->getSoa($this->user_id, $data);  

        }
    }


}

