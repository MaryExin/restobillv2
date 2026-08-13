<?php

class PrinterController
{
    public function __construct(
        private PrinterGateway $gateway,
        private string $user_id
    ) {}

    public function processRequest(string $method, ?string $id): void
    {
        if ($id) {
            $this->processResourceRequest($method, $id);
        } else {
            $this->processCollectionRequest($method);
        }
    }

    private function processResourceRequest(string $method, string $id): void
    {
        $printer = $this->gateway->getById($id);
        if (!$printer) {
            http_response_code(404);
            echo json_encode(["message" => "Printer not found"]);
            return;
        }

        switch ($method) {
            case "GET":
                echo json_encode($printer);
                break;
            case "PATCH":
                $data = (array) json_decode(file_get_contents("php://input"), true);
                $rows = $this->gateway->update($id, $data, $this->user_id);
                echo json_encode(["message" => "Printer updated", "rows" => $rows]);
                break;
            case "DELETE":
                $rows = $this->gateway->delete($id, $this->user_id);
                echo json_encode(["message" => "Printer deleted", "rows" => $rows]);
                break;
            default:
                http_response_code(405);
                header("Allow: GET, PATCH, DELETE");
        }
    }

    private function processCollectionRequest(string $method): void
    {
        switch ($method) {
            case "GET":
                echo json_encode($this->gateway->getAll());
                break;
            case "POST":
                $data = (array) json_decode(file_get_contents("php://input"), true);
                
                // Simple Validation
                if (empty($data["printer_name"]) || empty($data["printer_type"])) {
                    http_response_code(422);
                    echo json_encode(["message" => "printer_name and printer_type are required"]);
                    return;
                }

                $id = $this->gateway->create($data, $this->user_id);
                http_response_code(201);
                echo json_encode([
                    "message" => "Printer created",
                    "id" => $id
                ]);
                break;
            default:
                http_response_code(405);
                header("Allow: GET, POST");
        }
    }
}