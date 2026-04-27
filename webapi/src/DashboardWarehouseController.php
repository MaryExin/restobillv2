<?php

class DashboardWarehouseController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;



    public function __construct($gateway,

        $user_id) {

        $this->gateway = $gateway;

        $this->user_id = $user_id;

    }

    public function processRequest(string $method): void
    {

        if ($method == "POST") 
        {
            $data = (array) json_decode(file_get_contents("php://input"), true);
            $this->gateway->getAllWarehouseData($this->user_id, $data);  

        }
    }

}
