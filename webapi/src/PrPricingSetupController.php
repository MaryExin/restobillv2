<?php

class PrPricingSetupController
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

            } elseif ($method == "POST") {

                $this->gateway->editForUser($this->user_id, $data);

            } elseif ($method == "PATCH") {
                if (!array_key_exists("edit", $data)) {
                $suppliercode = $data["supplier_code"];
                $supplierid = join($suppliercode);

                        $rows = $this->gateway->rejectsuppliers($this->user_id,$supplierid);
                        // echo json_encode(["message" => "Supplier deleted", "rows" => $rows]);

                exit;
            } else{
                        $rows = $this->gateway->editsupplier($this->user_id,$data);
                        // echo json_encode(["message" => "Supplier Edit", "rows" => $rows]);
                }
            } else {

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
