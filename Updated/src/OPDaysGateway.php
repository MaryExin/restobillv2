<?php

class OPDaysGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function ExcelGetOPDays($busunitCode)
    {

        $sql = "SELECT * FROM tbl_upload_op_days WHERE deletestatus = 'Active' AND busunitcode = :busunitcode ORDER BY busunitcode, op_date ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

}
