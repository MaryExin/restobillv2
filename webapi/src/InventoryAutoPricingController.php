<?php







class InventoryAutoPricingController



{



    private $gateway;



    private $user_id;







    public function __construct($gateway, $user_id)



    {



        $this->gateway = $gateway;



        $this->user_id = $user_id;



    }







    public function processRequest($method,  $data): void



    {



        if ($method === 'POST') {



            $this->gateway->updateAutoInventoryPricing($data);



        } else {



            $this->respondMethodNotAllowed('POST');



        }



    }







    private function respondMethodNotAllowed(string $allowed): void



    {



        http_response_code(405);



        header("Allow: $allowed");



    }



}



