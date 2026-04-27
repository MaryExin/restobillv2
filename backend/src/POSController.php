<?php

class POSController
{
    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, $data): void
    {

        if (true) {

        if ($method == "GET") {
            echo json_encode($this->gateway->getAllData());
        }  elseif ($method == "POST") 
        {

            $this->gateway->createPOS($this->user_id, $data);  

        } elseif ($method == "PATCH") {
                if (!array_key_exists("edit", $data)) {
                $rows = $this->gateway->deletePOS($this->user_id,$data);
                exit;
                } else{
                        $rows = $this->gateway->editPOS($this->user_id,$data);
                        // echo json_encode(["message" => "mop Edit", "rows" => $rows]);
                }
            } else {

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

    public function posRequest(string $method): void
    {

        if (true) {

        if ($method == "GET") {
            echo json_encode($this->gateway->getAllData());
        }  elseif ($method == "POST") 
        {

            $this->gateway->createPOS($this->user_id, $data);  

        } elseif ($method == "PATCH") {
                if (!array_key_exists("edit", $data)) {
                $rows = $this->gateway->deletePOS($this->user_id,$data);
                exit;
                } else{
                        $rows = $this->gateway->editPOS($this->user_id,$data);
                        // echo json_encode(["message" => "mop Edit", "rows" => $rows]);
                }
            } else {

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



    public function processInfiniteReadRequest(string $method, $page, $pageIndex, $pageData, $search): void
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
