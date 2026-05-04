<?php

class MembersApprovalGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getAllForUser(int $user_id): array
    {
        $sql = "SELECT *
                FROM tbl_tasks
                WHERE user_id = :user_id
                ORDER BY name";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $row['is_completed'] = (bool) $row['is_completed'];

            $data[] = $row;
        }

        return $data;
    }

    public function getForUser($id): array
    {
        $sql = "SELECT *
                FROM tbl_users_global_assignment
                WHERE uuid = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_INT);

        $stmt->execute();

        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        return $data;
    }

    public function createForUser(int $user_id, array $data): string
    {
        $sql = "INSERT INTO tbl_tasks (name, priority, is_completed, user_id)
                VALUES (:name, :priority, :is_completed, :user_id)";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":name", $data["name"], PDO::PARAM_STR);

        if (empty($data["priority"])) {

            $stmt->bindValue(":priority", null, PDO::PARAM_NULL);

        } else {

            $stmt->bindValue(":priority", $data["priority"], PDO::PARAM_INT);

        }

        $stmt->bindValue(":is_completed", $data["is_completed"] ?? false,
            PDO::PARAM_BOOL);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        return $this->conn->lastInsertId();
    }

    public function updateMemberQueuing(string $id)
    {

        $sql = "UPDATE tbl_users_global_assignment
                SET
                    Status = 'Active'
                WHERE
                    uuid = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function rejectMemberQueuing(string $id)
    {

        $sql = "UPDATE tbl_users_global_assignment
                SET
                    Status = 'Inactive'
                WHERE
                      uuid = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function deleteForUser(int $user_id, string $id): int
    {
        $sql = "DELETE FROM tbl_tasks
                WHERE id = :id
                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->rowCount();
    }
}
