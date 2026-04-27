<?php
// MembersApprovalGateway.php ✅ approve => Status Active + reset password (transaction-safe)
class MembersApprovalGateway
{


    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    // If you still use these "tasks" methods elsewhere, keep them.
    // Otherwise you can safely delete them.
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
            $row["is_completed"] = (bool) $row["is_completed"];
            $data[] = $row;
        }

        return $data;
    }

    public function getForUser(string $id){
        $sql = "SELECT *
                FROM tbl_users_global_assignment
                WHERE uuid = :id
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);

        // ✅ uuid is string, not int
        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->fetch(PDO::FETCH_ASSOC);
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
            $stmt->bindValue(":priority", (int) $data["priority"], PDO::PARAM_INT);
        }

        $stmt->bindValue(":is_completed", (bool) ($data["is_completed"] ?? false), PDO::PARAM_BOOL);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        return (string) $this->conn->lastInsertId();
    }

    public function updateMemberQueuing(string $id): int
    {
        $sql = "UPDATE tbl_users_global_assignment
                SET Status = 'Active'
                WHERE uuid = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->rowCount();
    }

public function rejectMemberQueuing(string $id): int
{
    $this->conn->beginTransaction();

    try {
        $sql1 = "UPDATE tbl_users_global_assignment
                 SET status = 'Inactive'
                 WHERE uuid = :id";
        $stmt1 = $this->conn->prepare($sql1);
        $stmt1->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt1->execute();
        $affected1 = $stmt1->rowCount();

        $sql2 = "UPDATE tbl_employees
                 SET status = 'Inactive'
                 WHERE empid = :id";
        $stmt2 = $this->conn->prepare($sql2);
        $stmt2->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt2->execute();
        $affected2 = $stmt2->rowCount();

        $this->conn->commit();
        return $affected1 + $affected2;
    } catch (\Throwable $e) {
        $this->conn->rollBack();
        throw $e;
    }
}


    public function deleteForUser(int $user_id, string $id): int
    {
        $sql = "DELETE FROM tbl_tasks
                WHERE id = :id
                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", (int) $id, PDO::PARAM_INT);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->rowCount();
    }

    /**
     * ✅ Approve member:
     * 1) Status='Active'
     * 2) Generate random password
     * 3) Update password hash
     * Returns: ['rows'=>int, 'email'=>string|null, 'plainPassword'=>string]
     */
    public function approveMemberQueuingAndResetPassword(string $uuid, int $pwLength = 10, string $charset = ""): array
    {
        $email = $this->getEmailByUuid($uuid);

        $plainPassword = $this->generateRandomPassword($pwLength, $charset);
        $password_hash = password_hash($plainPassword, PASSWORD_DEFAULT);

        try {
            $this->conn->beginTransaction();

            // 1) Activate
            $sql1 = "UPDATE tbl_users_global_assignment
                     SET Status = 'Active'
                     WHERE uuid = :id";
            $stmt1 = $this->conn->prepare($sql1);
            $stmt1->bindValue(":id", $uuid, PDO::PARAM_STR);
            $stmt1->execute();
            $rows = $stmt1->rowCount();

            // 2) Reset password
            $sql2 = "UPDATE tbl_users_global_assignment
                     SET password = :password
                     WHERE uuid = :id";
            $stmt2 = $this->conn->prepare($sql2);
            $stmt2->bindValue(":password", $password_hash, PDO::PARAM_STR);
            $stmt2->bindValue(":id", $uuid, PDO::PARAM_STR);
            $stmt2->execute();

            $this->conn->commit();

            return [
                "rows"          => $rows,
                "email"         => $email,
                "plainPassword" => $plainPassword,
            ];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
    }

    private function getEmailByUuid(string $uuid): ?string
    {
        // ✅ Change "email" column name here if yours is different (ex: useremail)
        $sql = "SELECT email
                FROM tbl_users_global_assignment
                WHERE uuid = :id
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $uuid, PDO::PARAM_STR);
        $stmt->execute();

        $val = $stmt->fetchColumn();
        return $val !== false ? (string) $val : null;
    }

    private function generateRandomPassword(int $length = 10, string $charset = ""): string
    {
        // You previously used SECRET_KEY as the charset; keeping same behavior.
        $chars = $charset !== "" ? $charset : "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
        $max = strlen($chars) - 1;

        if ($max < 1) {
            $chars = "abc123!@#";
            $max = strlen($chars) - 1;
        }

        $password = "";
        for ($i = 0; $i < $length; $i++) {
            $password .= $chars[random_int(0, $max)];
        }

        return $password;
    }
}
