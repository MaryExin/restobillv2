<?php

class APIEndpointGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }



     public function getAPIEndpoint($data)
    {

        $sql = "SELECT * FROM lkp_clients 
                    WHERE deletestatus = 'Active' 
                    AND company_code = :company_code;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":company_code", strtoupper($data["companycode"]), PDO::PARAM_STR);

        $stmt->execute();

        $result = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $result[] = $row;

        }

        return $result;

    }

    public function logSubscriptionDates($data, $user_id = "Exinnov")
{
    $companycode = strtoupper(trim($data["companycode"] ?? ""));
    $plan = strtoupper(trim($data["plan"] ?? ""));

    if ($companycode === "") {
        http_response_code(422);
        return ["message" => "companycode is required."];
    }

    // If you want to restrict plans:
    if ($plan !== "PRO" && $plan !== "PREMIUM" && $plan !== "") {
        http_response_code(422);
        return ["message" => "Invalid plan. Allowed: PRO, PREMIUM."];
    }

    // Set dates on the server (Manila style offset +8h)
    // datesubscribe = NOW()+8h
    // dateended = +1 year
    $sql = "UPDATE lkp_clients
            SET datesubscribed = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                dateended = DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL 1 MONTH),
                subscription = 'For Review',
                usertracker = :usertracker,
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE deletestatus = 'Active'
              AND company_code = :company_code
            LIMIT 1;";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":company_code", $companycode, PDO::PARAM_STR);
    // $stmt->bindValue(":plan", $plan, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", (string)$user_id, PDO::PARAM_STR);

    $stmt->execute();

    if ($stmt->rowCount() <= 0) {
        http_response_code(404);
        return ["message" => "No active client found for companycode: {$companycode}"];
    }

    return [
        "message" => "Master subscription dates updated.",
        "companycode" => $companycode,
        "plan" => $plan,
    ];
}

public function activateSubscription($data, $user_id = "Exinnov")
{
    $companycode = strtoupper(trim($data["companycode"] ?? ""));
    $plan = strtoupper(trim($data["plan"] ?? ""));

    if ($companycode === "") {
        http_response_code(422);
        return ["message" => "companycode is required."];
    }

    // Optional plan validation
    if ($plan !== "" && $plan !== "PRO" && $plan !== "PREMIUM" && $plan !== "UNLIMITED") {
        http_response_code(422);
        return ["message" => "Invalid plan. Allowed: PRO, PREMIUM, UNLIMITED."];
    }

    // ✅ Only status change (keeps datesubscribed/dateended already set by logSubscriptionDates)
    $sql = "UPDATE lkp_clients
            SET subscription = 'Active',
                usertracker = :usertracker,
                datesubscribed = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                dateended = DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL 1 MONTH),
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE deletestatus = 'Active'
              AND company_code = :company_code
            LIMIT 1;";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":company_code", $companycode, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", (string)$user_id, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->rowCount() <= 0) {
        http_response_code(404);
        return ["message" => "No active client found for companycode: {$companycode}"];
    }

    return [
        "message" => "Master subscription set to Active.",
        "companycode" => $companycode,
        "plan" => $plan,
    ];
}

public function expireSubscription($data, $user_id = "Exinnov")
{
    $companycode = strtoupper(trim($data["companycode"] ?? ""));

    if ($companycode === "") {
        http_response_code(422);
        return ["message" => "companycode is required."];
    }

    $sql = "UPDATE lkp_clients
            SET subscription = 'Expired',
                usertracker = :usertracker,
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE deletestatus = 'Active'
              AND company_code = :company_code
            LIMIT 1;";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":company_code", $companycode, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", (string)$user_id, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->rowCount() <= 0) {
        http_response_code(404);
        return ["message" => "No active client found for companycode: {$companycode}"];
    }

    return [
        "message" => "Master subscription set to Expired.",
        "companycode" => $companycode,
    ];
}



}
