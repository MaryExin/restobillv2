<?php

class PosShiftingController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }


    // public function processRequest(string $method): void
    // {   
    //     if ($method == "GET") 
    //     {
    //         echo json_encode($this->gateway->selectDate());

    //     }

    //     if ($method == "POST") 
    //     {
    //         $data = (array) json_decode(file_get_contents("php://input"), true);
    //         $this->gateway->openNewShift($this->user_id, $data);  

    //     }
    // }
    public function processRequest(string $method, $data): void
    {
        if (true) {
            if ($method == "GET") 
            {
                echo json_encode($this->gateway->selectDate($this->user_id));
            } elseif ($method == "POST") 
            {
                $this->gateway->loadItemsMenu($this->user_id, $data);
            } else 
            {
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
}
