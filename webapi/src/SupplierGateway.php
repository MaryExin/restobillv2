<?php

class SupplierGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT busunitcode AS supplier_code, name AS supplier_name, apslcode AS slcode
        FROM lkp_busunits WHERE deletestatus = 'Active'";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $busUnits = $stmt->fetchAll(PDO::FETCH_ASSOC); 

        $sql = "SELECT * FROM lkp_supplier WHERE deletestatus = 'Active' ORDER BY supplier_name";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC); 

        $data = array_merge($busUnits, $suppliers);

        return $data;

    }

       public function ExcelGetSuppliers()
    {

        $sql = "SELECT * FROM lkp_supplier WHERE deletestatus = 'Active' ORDER BY supplier_name ASC";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

public function createForUser($user_id, $data)
{
    try {
        $this->conn->beginTransaction();

        $supplierName = strtoupper(trim((string) ($data["supplier_name"] ?? "")));
        $checkName = strtoupper(trim((string) ($data["check_name"] ?? "")));
        $tin = trim((string) ($data["tin"] ?? ""));
        $address = trim((string) ($data["address"] ?? ""));
        $zipcode = trim((string) ($data["zipcode"] ?? ""));
        $atc = trim((string) ($data["atc"] ?? ""));
        $whtx_rate = trim((string) ($data["whtx_rate"] ?? ""));
        $product_type = trim((string) ($data["product_type"] ?? ""));
        $pricingcategory = trim((string) ($data["pricingcategory"] ?? ""));
        $charttypedatas = isset($data["charttypedata"]) && is_array($data["charttypedata"])
            ? array_values(array_unique($data["charttypedata"]))
            : [];

        if ($supplierName === "") {
            $this->conn->rollBack();
            echo json_encode(["message" => "isNameEmpty"]);
            return;
        }

        $checkforduplisql = "SELECT COUNT(*)
                             FROM lkp_supplier
                             WHERE supplier_name = :supplier_name
                               AND deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":supplier_name", $supplierName, PDO::PARAM_STR);
        $checkforduplistmt->execute();

        if ((int) $checkforduplistmt->fetchColumn() > 0) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Duplicate Entry"]);
            return;
        }

        $glcode = "400";
        $glDescription = "ACCOUNTS PAYABLE";
        $glcodeLen = strlen($glcode);

        $generateidsql = "
            SELECT MAX(CAST(SUBSTRING(slcodes, :glcodeLenPlusOne) AS UNSIGNED)) AS last_seq
            FROM lkp_slcodes
            WHERE glcode = :glcode
              AND deletestatus = 'Active'
            FOR UPDATE
        ";
        $generateidstmt = $this->conn->prepare($generateidsql);
        $generateidstmt->bindValue(":glcodeLenPlusOne", $glcodeLen + 1, PDO::PARAM_INT);
        $generateidstmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
        $generateidstmt->execute();

        $lastSeq = (int) $generateidstmt->fetchColumn();
        $nextSeq = $lastSeq + 1;

        $slcode = $glcode . sprintf("%03d", $nextSeq);
        $sldescription = $glDescription . " - " . $supplierName;

        $checkSlSql = "SELECT COUNT(*)
                       FROM lkp_slcodes
                       WHERE glcode = :glcode
                         AND slcodes = :slcodes
                         AND deletestatus = 'Active'";
        $checkSlStmt = $this->conn->prepare($checkSlSql);
        $checkSlStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
        $checkSlStmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
        $checkSlStmt->execute();

        if ((int) $checkSlStmt->fetchColumn() > 0) {
            throw new Exception("Generated SL code already exists: " . $slcode);
        }

        $sql = "INSERT INTO lkp_slcodes
                (uuid, glcode, slcodes, sldescription, deletestatus, usertracker, createtime)
                VALUES
                (CONCAT('SL-', ShortUUID()), :glcode, :slcodes, :sldescription, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
        $stmt->bindValue(":sldescription", $sldescription, PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        if (!empty($charttypedatas)) {
            $acctgaccountsql = "INSERT INTO lkp_chart_of_accounts
                                (seq, chart_type_id, glcode, gl_description, slcode, sl_description, deletestatus, usertracker, createdtime)
                                VALUES
                                (default, :charttype, :glcode, :gldescription, :slcode, :sldescription, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            $acctgaccountstmt = $this->conn->prepare($acctgaccountsql);

            foreach ($charttypedatas as $charttype) {
                $acctgaccountstmt->bindValue(":charttype", $charttype, PDO::PARAM_STR);
                $acctgaccountstmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
                $acctgaccountstmt->bindValue(":gldescription", $glDescription, PDO::PARAM_STR);
                $acctgaccountstmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
                $acctgaccountstmt->bindValue(":sldescription", $sldescription, PDO::PARAM_STR);
                $acctgaccountstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $acctgaccountstmt->execute();
            }
        }

        $supplierSql = "INSERT INTO lkp_supplier
                        (seq, supplier_code, supplier_name, check_name, tin, address, zipcode, atc, whtx_rate, product_type, pricing_category, slcode, deletestatus, usertracker, createdtime)
                        VALUES
                        (default, CONCAT('SP-', ShortUUID()), :supplier_name, :check_name, :tin, :address, :zipcode, :atc, :whtx_rate, :product_type, :pricingcategory, :slcode, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $supplierStmt = $this->conn->prepare($supplierSql);
        $supplierStmt->bindValue(":supplier_name", $supplierName, PDO::PARAM_STR);
        $supplierStmt->bindValue(":check_name", $checkName, PDO::PARAM_STR);
        $supplierStmt->bindValue(":tin", $tin, PDO::PARAM_STR);
        $supplierStmt->bindValue(":address", $address, PDO::PARAM_STR);
        $supplierStmt->bindValue(":zipcode", $zipcode, PDO::PARAM_STR);
        $supplierStmt->bindValue(":atc", $atc, PDO::PARAM_STR);
        $supplierStmt->bindValue(":whtx_rate", $whtx_rate, PDO::PARAM_STR);
        $supplierStmt->bindValue(":product_type", $product_type, PDO::PARAM_STR);
        $supplierStmt->bindValue(":pricingcategory", $pricingcategory, PDO::PARAM_STR);
        $supplierStmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
        $supplierStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $supplierStmt->execute();

        $this->conn->commit();
        echo json_encode(["message" => "Success", "slcode" => $slcode]);
    } catch (\Throwable $e) {
        if ($this->conn->inTransaction()) {
            $this->conn->rollBack();
        }

        http_response_code(500);
        echo json_encode([
            "code" => $e->getCode(),
            "message" => $e->getMessage(),
            "file" => $e->getFile(),
            "line" => $e->getLine(),
        ]);
    }
}
    public function rejectsuppliers($user_id, string $id)
    {

        $sql = "UPDATE lkp_supplier
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
echo json_encode(["message" => "Deleted"]);
    }

    public function editsupplier($user_id, $id)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_supplier WHERE supplier_code != :id && supplier_name = :supplier_names &&
                    check_name  = :check_names &&
                    tin  = :tin &&
                    address  = :address &&
                    atc  = :atc &&
                    whtx_rate  = :whtx_rate &&
                    product_type  = :product_type &&
                    pricing_category  = :pricingcategory &&
                    zipcode = :zipcode &&
                    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":id", $id["supplier_code"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":supplier_names", $id["supplier_name"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":check_names", $id["check_name"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":atc", $id["atc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":whtx_rate", $id["whtx_rate"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":product_type", $id["product_type"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);
     $checkforduplistmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "UPDATE lkp_supplier
                SET
                    supplier_name  = :supplier_name,
                    check_name  = :check_names,
                    tin  = :tin,
                    address  = :address,
                    atc  = :atc,
                    whtx_rate  = :whtx_rate,
                    product_type  = :product_type,
                    pricing_category  = :pricingcategory,
                    zipcode = :zipcode,
                    usertracker  = :usertracker
                WHERE
                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":supplier_name", $id["supplier_name"], PDO::PARAM_STR);
        $stmt->bindValue(":check_names", $id["check_name"], PDO::PARAM_STR);
        $stmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
        $stmt->bindValue(":atc", $id["atc"], PDO::PARAM_STR);
        $stmt->bindValue(":whtx_rate", $id["whtx_rate"], PDO::PARAM_STR);
        $stmt->bindValue(":product_type", $id["product_type"], PDO::PARAM_STR);
        $stmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);
        $stmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["supplier_code"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' AND supplier_name  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function getClearingData()
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

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

    public function deletedataWithIds($ids)
    {

        foreach ($ids as $id) {

            $sql = "DELETE FROM tbl_sales







                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_STR);

            $stmt->execute();

        }

        return $stmt->rowCount();

    }

}
