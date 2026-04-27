<?php

class RawmatsController
{
    private $gateway;
    private $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    /**
     * ✅ Default single CRUD handler
     * - GET returns list
     * - POST create (supports multipart image)
     * - PATCH edit/delete (supports multipart image on edit)
     */
    public function processRequest(string $method, $data, $files = []): void
    {
        if ($method === "GET") {
            echo json_encode($this->gateway->getAllData());
            return;
        }

 if ($method === "POST") {

    $action = strtoupper(trim((string)($data["Action"] ?? $data["action"] ?? "")));

    // ✅ EDIT via POST (supports multipart + $_FILES)
    if ($action === "EDIT") {

        if (!array_key_exists("rawmatsdesc", $data) || trim((string)$data["rawmatsdesc"]) === "") {
            http_response_code(400);
            echo json_encode(["message" => "isNameEmpty"]);
            return;
        }

        if (!array_key_exists("mat_code", $data) || trim((string)$data["mat_code"]) === "") {
            http_response_code(400);
            echo json_encode(["message" => "missingMatCode"]);
            return;
        }

        $this->gateway->editrawmats($this->user_id, $data, $files);
        return;
    }

    // ✅ CREATE via POST
    // Require rawmatsdesc for create
    if (!array_key_exists("rawmatsdesc", $data) || trim((string)$data["rawmatsdesc"]) === "") {
        http_response_code(400);
        echo json_encode(["message" => "isNameEmpty"]);
        return;
    }

    $this->gateway->createForUser($this->user_id, $data, $files);
    return;
}


        if ($method === "PATCH") {
            // Your old behavior:
            // - if no "edit" => delete
            // - else edit
            if (!array_key_exists("edit", $data)) {
                $rawmatscode = $data["mat_code"] ?? [];
                // You used join() previously, keep same intent:
                $rawmatsid = is_array($rawmatscode) ? join($rawmatscode) : (string)$rawmatscode;

                $this->gateway->rejectrawmatss($this->user_id, $rawmatsid);
                return;
            } else {
                // Require rawmatsdesc for edit as well (same as before)
                if (!array_key_exists("rawmatsdesc", $data) || trim((string)$data["rawmatsdesc"]) === "") {
                    http_response_code(400);
                    echo json_encode(["message" => "isNameEmpty"]);
                    return;
                }

                // ✅ NEW: Require mat_code on edit (prevents false duplicates when mat_code missing/blank)
                if (!array_key_exists("mat_code", $data) || trim((string)$data["mat_code"]) === "") {
                    http_response_code(400);
                    echo json_encode(["message" => "missingMatCode"]);
                    return;
                }

                $this->gateway->editrawmats($this->user_id, $data, $files);
                return;
            }
        }

        $this->respondMethodNotAllowed("GET, POST, PATCH");
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

    public function processQueryRequest(string $method): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->getAllData());

            } elseif ($method == "POST") {

                echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

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


    /**
     * ✅ Batch handler (Build-template equivalent)
     * Expects:
     * - Action=multiadd
     * - multiproduct: array OR JSON string (decoded in endpoint)
     * - imageMap: array mapping index->field (posimage_{idx})
     * - files: posimage_{idx}
     */
    public function multiprocessRequest(string $method, $data, $files = []): void
    {
        if ($method !== "POST") {
            $this->respondMethodNotAllowed("POST");
            return;
        }

        $multiproduct = $data["multiproduct"] ?? null;
        if (!is_array($multiproduct)) {
            http_response_code(422);
            echo json_encode(["message" => "invalidMultiproduct"]);
            return;
        }

        $imageMap = $data["imageMap"] ?? [];
        if (!is_array($imageMap)) $imageMap = [];

        $this->gateway->createForMultiProduce($this->user_id, $multiproduct, $imageMap, $files);
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode(["message" => "methodNotAllowed"]);
    }
}
