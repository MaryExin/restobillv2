<?php

class RawmatslistGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }
    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_raw_mats WHERE deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        return $data;
    }
    public function getForUser($user_id, $id): array
    {

    }

    public function AddRate(int $user_id, array $data): string
    {

    }

    public function updateForUser(int $user_id, string $id, array $data): int
    {

    }

    public function deleteForUser(int $user_id, string $id): int
    {

    }
}
