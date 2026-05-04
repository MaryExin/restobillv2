<?php

class FixedAssetsClassController
{
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
            $this->gateway->createForUser($this->user_id, $data);  
        }

    }

    public function processRead(string $method): void
    {
        if (true) {
            if ($method == "GET") {
                echo json_encode($this->gateway->getAllData());
            } 
        }
    }

}
?>
