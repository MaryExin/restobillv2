<?php

class SubledgerComparativeController
{


    private SubledgerComparativeGateway $gateway;
    private $user_id;

    public function __construct(SubledgerComparativeGateway $gateway, $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest($method, $data): void
    {
        if ($method !== 'POST') {
            http_response_code(405);
            header("Allow: POST");
            return;
        }

        $groupBy = strtoupper((string)($data['groupBy'] ?? 'BUSUNIT'));
        $groupCode = (string)($data['groupCode'] ?? '');
        $glcode = (int)($data['glcode'] ?? 0);
        $dateFrom = (string)($data['dateFrom'] ?? '');
        $dateTo   = (string)($data['dateTo'] ?? '');

        $result = $this->gateway->getSubledger(
            $groupBy,
            $groupCode,
            $glcode,
            $dateFrom,
            $dateTo
        );

        header('Content-Type: application/json');
        echo json_encode($result);
    }
}
