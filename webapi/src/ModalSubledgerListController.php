<?php

class ModalSubledgerListController
{
    private $gateway;
    private $user_id;

    public function __construct(ModalSubledgerListGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $data): void
    {
        if ($method === 'POST') {

            $busunit = $data['busunitcode'] ?? '';
            $dateTo  = $data['dateTo'] ?? '';
            $glcode  = $data['glcode'] ?? '';

            // ✅ NEW optional
            $filterType  = $data['filterType'] ?? '';
            $filterValue = $data['filterValue'] ?? '';

            $result = $this->gateway->getSubledgerList(
                $busunit,
                $dateTo,
                $glcode,
                $filterType,
                $filterValue
            );

            header('Content-Type: application/json');
            echo json_encode($result);

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
