<?php

class IMSDeliveryWorkbenchController
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
        try {
            if ($method === "POST") {
                $mode = strtolower(trim((string) ($data["mode"] ?? "jobs")));
                if ($mode === "job_detail") {
                    echo json_encode($this->gateway->getJobDetail($data));
                    return;
                }

                if ($mode === "candidates") {
                    echo json_encode($this->gateway->getCandidates($data));
                    return;
                }

                echo json_encode($this->gateway->getJobs($data));
                return;
            }

            if ($method === "PATCH") {
                $action = strtolower(trim((string) ($data["action"] ?? "save_job")));

                if ($action === "cancel_job") {
                    echo json_encode($this->gateway->cancelJob($data, $this->user_id));
                    return;
                }

                if ($action === "undo_cancel_job") {
                    echo json_encode($this->gateway->undoCancelJob($data, $this->user_id));
                    return;
                }

                if ($action === "sync_job_phase") {
                    echo json_encode($this->gateway->syncJobPhase($data, $this->user_id));
                    return;
                }

                if ($action === "set_order_phase") {
                    echo json_encode($this->gateway->setOrderPhase($data, $this->user_id));
                    return;
                }

                if ($action === "set_order_phase_all") {
                    echo json_encode($this->gateway->setOrderPhaseAll($data, $this->user_id));
                    return;
                }

                if ($action === "deliver_order_item") {
                    echo json_encode($this->gateway->deliverOrderItem($data, $this->user_id));
                    return;
                }

                if ($action === "deliver_order_all") {
                    echo json_encode($this->gateway->deliverOrderAll($data, $this->user_id));
                    return;
                }

                if ($action === "deliver_all_orders") {
                    echo json_encode($this->gateway->deliverAllOrders($data, $this->user_id));
                    return;
                }

                if ($action === "save_job" || $action === "") {
                    echo json_encode($this->gateway->saveJob($data, $this->user_id));
                    return;
                }

                http_response_code(422);
                echo json_encode([
                    "message" => "actionNotSupported",
                    "action" => $action,
                ]);
                return;
            }

            $this->respondMethodNotAllowed("POST, PATCH");
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Error: " . $e->getMessage(),
            ]);
        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
    }
}
