<?php

class GsheetsUsersGateway
{


    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    // ✅ NEW: return only the active row for the logged-in email
    public function getActiveByEmail(string $email): ?array
    {
        $sql = "
            SELECT email, endpoint, status
            FROM lkp_gsheets_users
            WHERE status = 'Active'
              AND LOWER(email) = LOWER(:email)
            LIMIT 1
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":email", $email, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    // (optional) keep your old method if you still need it somewhere else
    public function getAllData(): array
    {
        $sql = "SELECT * FROM lkp_gsheets_users WHERE status = 'Active' ORDER BY email";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $data[] = $row;

        return $data;
    }
}
