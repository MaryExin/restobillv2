<?php

class QueuAndRegGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getAllData()
    {
        $sql = "SELECT * FROM tbl_users_global_assignment WHERE verified != 'Unverified'  ORDER BY firstname Asc";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        return $data;
    }

      public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

            $sql = "SELECT tbl_users_global_assignment.uuid , tbl_users_global_assignment.email, tbl_users_global_assignment.firstname, tbl_users_global_assignment.middlename,
            tbl_users_global_assignment.lastname, tbl_users_global_assignment.company, tbl_users_global_assignment.department,
            tbl_users_global_assignment.contactnumber, tbl_users_global_assignment.status, tbl_employees.position,
            IFNULL(tbl_employees.image_filename,tbl_customer_details.image_filename) As image_filename,
            tbl_employees.sss, tbl_employees.phic, tbl_employees.mdf, tbl_employees.tin, tbl_employees.date_started, tbl_employees.address
            FROM tbl_users_global_assignment
            LEFT OUTER JOIN tbl_employees ON tbl_users_global_assignment.uuid = tbl_employees.empid
            LEFT OUTER JOIN tbl_customer_details ON tbl_users_global_assignment.uuid = tbl_customer_details.customer_id
            WHERE tbl_users_global_assignment.deletestatus = 'Active'
            AND CONCAT(tbl_users_global_assignment.firstname, ' ',tbl_users_global_assignment.lastname) LIKE :search
            ORDER BY tbl_users_global_assignment.firstname
            LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getbyPageData($pageIndex, $pageData)
    {
        $sql = "SELECT tbl_users_global_assignment.uuid , tbl_users_global_assignment.email, tbl_users_global_assignment.firstname, tbl_users_global_assignment.middlename,
        tbl_users_global_assignment.lastname, tbl_users_global_assignment.company, tbl_users_global_assignment.department,
        tbl_users_global_assignment.contactnumber, tbl_users_global_assignment.status, tbl_employees.position,
        IFNULL(tbl_employees.birthdate, tbl_customer_details.birthdate) As birthdate, 
        IFNULL(tbl_employees.image_filename,tbl_customer_details.image_filename) As image_filename,
        tbl_employees.sss, tbl_employees.phic, tbl_employees.mdf, tbl_employees.tin, tbl_employees.date_started, tbl_employees.address
        FROM tbl_users_global_assignment
        LEFT OUTER JOIN tbl_employees ON tbl_users_global_assignment.uuid = tbl_employees.empid
		LEFT OUTER JOIN tbl_customer_details ON tbl_users_global_assignment.uuid = tbl_customer_details.customer_id
        WHERE tbl_users_global_assignment.deletestatus = 'Active'
        LIMIT $pageIndex, $pageData";

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
        $sql = "SELECT *
                FROM tbl_tasks
                WHERE id = :id
                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($data !== false) {

            $data['is_completed'] = (bool) $data['is_completed'];
        }

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

    public function updateForUser(int $user_id, string $id, array $data): int
    {
        $fields = [];

        if (!empty($data["name"])) {

            $fields["name"] = [
                $data["name"],
                PDO::PARAM_STR,
            ];
        }

        if (array_key_exists("priority", $data)) {

            $fields["priority"] = [
                $data["priority"],
                $data["priority"] === null ? PDO::PARAM_NULL : PDO::PARAM_INT,
            ];
        }

        if (array_key_exists("is_completed", $data)) {

            $fields["is_completed"] = [
                $data["is_completed"],
                PDO::PARAM_BOOL,
            ];
        }

        if (empty($fields)) {

            return 0;

        } else {

            $sets = array_map(function ($value) {

                return "$value = :$value";

            }, array_keys($fields));

            $sql = "UPDATE tbl_tasks"
            . " SET " . implode(", ", $sets)
                . " WHERE id = :id"
                . " AND user_id = :user_id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_INT);
            $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

            foreach ($fields as $name => $values) {

                $stmt->bindValue(":$name", $values[0], $values[1]);

            }

            $stmt->execute();

            return $stmt->rowCount();
        }
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
