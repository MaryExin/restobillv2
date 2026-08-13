
<?php

class ProductCategoryGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_product_category Where deletestatus = 'Active' ORDER BY seq";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_product_category Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function createForUser($user_id, $data)
{
$sldata = [
  [
    'glcodes' => '700',
    'descrip' => 'SALE - VATABLE - ',
  ],
  [
    'glcodes' => '701',
    'descrip' => 'SALE - VAT EXEMPT - ',
  ],
  [
    'glcodes' => '703',
    'descrip' => 'SALE - ZERO RATED - ',
  ],
  [
    'glcodes' => '800',
    'descrip' => 'COST OF SALES - ',
  ],
  [
    'glcodes' => '140',
    'descrip' => 'INVENTORY - ',
  ],
];

                $randomString = substr(bin2hex(random_bytes(5)), 0, 10);

                $currentYearMonth = date('Ym');

                $shortUuid = $currentYearMonth . $randomString;

                $shortUuid = str_pad($shortUuid, 16, '0', STR_PAD_RIGHT);

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_product_category WHERE category = :productcatdesc && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":productcatdesc", $data["productcatdesc"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

    $sql = "INSERT INTO lkp_slcodes () VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $this->conn->prepare($sql);
    
    $acctgsql = "INSERT INTO lkp_acctg_transactions_map () VALUES (default, CONCAT('ATM-', ShortUUID()), :acctgslcode, :slcodes, '/productcategory', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $acctgstmt = $this->conn->prepare($acctgsql);

    foreach ($sldata as $datas) {
    $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = :glcodes";
    $generateidstmt = $this->conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcodes", $datas['glcodes'], PDO::PARAM_STR);
    $generateidstmt->execute();
    $rowCount = $generateidstmt->fetchColumn();

    $uniqueNumber = $rowCount + 1;

    $slcode = $datas['glcodes'] . sprintf("%02d", $uniqueNumber);
    $sldesc = $datas['descrip'] . $data["productcatdesc"];

    $stmt->bindValue(":glcodes", $datas['glcodes'], PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $sldesc, PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

    $acctgstmt->bindValue(":acctgslcode", "PC-" . $shortUuid, PDO::PARAM_STR);
    $acctgstmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $acctgstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $acctgstmt->execute();
    }

        $sql = "INSERT INTO lkp_product_category () VALUES (default, :category_id, :productcatdesc, :sort, :slcodes, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":category_id", "PC-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":productcatdesc", $data["productcatdesc"], PDO::PARAM_STR);
        $stmt->bindValue(":sort", $data["sort"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $data["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["message" => "Success" , "sample" => $sldesc]);
    }
}

    public function rejectproductcategory($user_id, string $id)
    {

        $sql = "UPDATE lkp_product_category

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      uuid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();

        echo json_encode(["message" => "Deleted"]);

    }

    public function editproductcategory($user_id, $id)
    {

        // $productcatcode = $id["productcatcode"];

        // $productcatid = join($productcatcode);

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_product_category WHERE category = :productcatdesc && sort = :sorts && slcode = :slcodes && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":productcatdesc", $id["productcatdesc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":sorts", $id["sort"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":slcodes", $id["slcode"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE lkp_product_category
                SET
                    category  = :category,
                    sort  = :sort,
                    slcode = :slcodes,
                    usertracker  = :usertracker
                WHERE
                      uuid  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":category", $id["productcatdesc"], PDO::PARAM_STR);
        $stmt->bindValue(":sort", $id["sort"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $id["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["productcatcode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_product_category Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_product_category Where deletestatus = 'Active' AND category LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_product_category Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
