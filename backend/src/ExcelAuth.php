<?php

class ExcelAuth
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function authenticateExcelCreds($auth)
    {

        $sql = "SELECT * FROM tbl_excel_token WHERE token = :auth";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":auth", $auth, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $stmt->rowCount();

    }

}
