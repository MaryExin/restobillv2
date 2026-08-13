<?php

class CustomerEditGateway
{

    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function editCustomer($user_id, $id)
    {
        $sql = "UPDATE tbl_customer_details
                SET
                    customername = :customername,
                    branchname = :branchname,
                    tin = :tin,
                    address = :address,
                    contact_no = :contact_no,
                    email = :email,
                    otherinfo = :otherinfo

                    -- usertracker  = :usertracker
                WHERE
                      customer_id  = :customer_id ";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":customername", $id["customername"], PDO::PARAM_STR);
        $stmt->bindValue(":branchname", $id["branchname"], PDO::PARAM_STR);
        $stmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
        $stmt->bindValue(":contact_no", $id["contact_no"], PDO::PARAM_STR);
        $stmt->bindValue(":email", $id["email"], PDO::PARAM_STR);
        $stmt->bindValue(":otherinfo", $id["otherinfo"], PDO::PARAM_STR);

        // $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":customer_id", $id["customer_id"], PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

}
