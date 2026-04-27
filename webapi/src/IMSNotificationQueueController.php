<?php

class IMSNotificationQueueController
{
    protected $gateway;
    protected $user_id;

    public function __construct($gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, array $data): void
    {
        if ($method === "GET") {
            echo json_encode($this->gateway->getSummary([]));
            return;
        }

        if ($method === "POST") {
            $mode = strtolower(trim((string) ($data["mode"] ?? "summary")));

            if ($mode === "queue") {
                echo json_encode($this->gateway->getQueueRows($data));
                return;
            }

            if ($mode === "log") {
                echo json_encode($this->gateway->getLogRows($data));
                return;
            }

            echo json_encode($this->gateway->getSummary($data));
            return;
        }

        if ($method === "PATCH") {
            $operation = strtolower(trim((string) ($data["operation"] ?? "enqueue")));

            if ($operation === "enqueue") {
                echo json_encode($this->gateway->enqueueForUser($this->user_id, $data));
                return;
            }

            if ($operation === "mark-status") {
                echo json_encode($this->gateway->markQueueStatusForUser($this->user_id, $data));
                return;
            }

            if ($operation === "log") {
                echo json_encode($this->gateway->createLogForUser($this->user_id, $data));
                return;
            }

            http_response_code(422);
            echo json_encode(["message" => "invalidOperation"]);
            return;
        }

        $this->respondMethodNotAllowed("GET, POST, PATCH");
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
