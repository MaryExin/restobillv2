<?php

class SalesQueueController
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


    public function processRequest(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->createForUser($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } else {

            $task = $this->gateway->getForUser($this->user_id, $id);

            if ($task === false) {

                $this->respondNotFound($id);

                return;

            }

            switch ($method) {

                case "GET":

                    echo json_encode($task);

                    break;

                case "PATCH":

                    $data = (array) json_decode(file_get_contents("php://input"), true);

                    $errors = $this->getValidationErrors($data, false);

                    if (!empty($errors)) {

                        $this->respondUnprocessableEntity($errors);

                        return;

                    }

                    $rows = $this->gateway->updateForUser($this->user_id, $id, $data);

                    echo json_encode(["message" => "Task updated", "rows" => $rows]);

                    break;

                case "DELETE":

                    $rows = $this->gateway->deleteForUser($this->user_id, $id);

                    echo json_encode(["message" => "Task deleted", "rows" => $rows]);

                    break;

                default:

                    $this->respondMethodNotAllowed("GET, PATCH, DELETE");

            }

        }

    }

    public function fetchQueuedSalesTransactions(string $method, $data): void
    {

        if (true) {
           
             if($method == "POST") {

                $this->gateway->getQueuedSalesTransactions($this->user_id, $data);

            }

        }

    }

    public function fetchSalesDataPerQuotation(string $method, $data): void
    {

        if (true) {
           
             if($method == "POST") {

                $this->gateway->getSalesDataPerQuotation($this->user_id, $data);

            }

        }

    }

    public function fetchSalesDataPerOrder(string $method, $data): void
    {

        if (true) {
           
             if($method == "POST") {

                $this->gateway->getSalesDataPerOrder($this->user_id, $data);

            }

        }

    }

    public function fetchSalesFulfillmentData(string $method, $data): void
    {

        if (true) {
           
             if($method == "POST") {

                $this->gateway->getSalesFulfillmentData($this->user_id, $data);

            }

        }

    }


    public function fetchSalesQueueHistory(string $method, $data): void
    {

        if (true) {
           
             if($method == "POST") {

                $this->gateway->getSalesQuotationHistory($this->user_id, $data);

            }

        }

    }

    public function processEditQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->editQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processEditSalesOrder(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->editSalesOrder($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processDeleteQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->deleteQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processDeleteSalesOrder(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->deleteSalesOrder($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }
    
    public function processSendQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->sendQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processaddProductsInQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->addProductsInQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processaddProductsInSalesOrder(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->addProductsInSalesOrder($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processAcceptQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->acceptQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processApproveSalesOrder(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->approveSalesOrder($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processRejectQuotation(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->rejectQuotation($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processCancelSalesOrder(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->cancelSalesOrder($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }

    public function processAllocateStocks(string $method, $data): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            }elseif ($method == "PUT"){
                $this->gateway->fetchSalesId($this->user_id, $data);
            }
             elseif ($method == "POST") {

             $this->gateway->allocateStocks($this->user_id, $data);

            }elseif ($method == "DELETE") {

                $this->gateway->deleteForUser($this->user_id, $data);

            }
             else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        } 

    }



   

    private function respondUnprocessableEntity(array $errors): void
    {

        http_response_code(422);

        echo json_encode(["errors" => $errors]);

    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {

        http_response_code(405);

        header("Allow: $allowed_methods");

    }

    private function respondNotFound(string $id): void
    {

        http_response_code(404);

        echo json_encode(["message" => "Task with ID $id not found"]);

    }

    private function respondCreated(string $id): void
    {

        http_response_code(201);

        echo json_encode(["message" => "Task created", "id" => $id]);

    }

    private function getValidationErrors(array $data, bool $is_new = true): array
    {

        $errors = [];

        if ($is_new && empty($data["name"])) {

            $errors[] = "name is required";

        }

        if (!empty($data["priority"])) {

            if (filter_var($data["priority"], FILTER_VALIDATE_INT) === false) {

                $errors[] = "priority must be an integer";

            }

        }

        return $errors;

    }

}
