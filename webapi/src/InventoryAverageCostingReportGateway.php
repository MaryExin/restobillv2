<?php

class InventoryAverageCostingReportGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "WITH RECURSIVE
                    parent_map AS (
                        SELECT
                        build_code AS parent,
                        component_code AS child
                        FROM tbl_build_components
                    ),
                    rec AS (
                        -- start each transaction’s inv_code as its own “parent”
                        SELECT
                        inv_code AS inv,
                        inv_code AS parent
                        FROM tbl_inventory_transactions

                        UNION ALL

                        -- follow build→component links
                        SELECT
                        r.inv,
                        pm.child AS parent
                        FROM rec r
                        JOIN parent_map pm
                        ON pm.parent = r.parent
                    ),
                    ultimate_parent AS (
                        -- pick only the final (leaf) parent for each inv
                        SELECT
                        inv,
                        parent AS parent_inv
                        FROM rec
                        WHERE parent NOT IN (SELECT parent FROM parent_map)
                        GROUP BY inv, parent
                    ),
                    tx_agg AS (
                        -- aggregate cost & qty, and carry forward a single uom_val per group
                        SELECT
                        tbl_inventory_transactions.busunitcode,
                        lkp_busunits.ownership_status,
                        inv_code               AS source_component,
                        SUM(cost_per_uom * qty) AS total_cost_remaining,
                        SUM(qty)                       AS remaining_qty,
                        MAX(uom_val)                   AS uom_val,
                        uom
                        FROM tbl_inventory_transactions
                        LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode
                        WHERE lkp_busunits.ownership_status = 'CompanyOwned'
                        GROUP BY busunitcode, inv_code
                    )

                    SELECT
                    t.busunitcode,
                    t.source_component,
                    t.uom,

                    -- lookup source component name
                    COALESCE(bp.desc, rm.desc)            AS source_component_name,

                    u.parent_inv,

                    -- lookup leaf/parent name
                    COALESCE(bp2.desc, rm2.desc)          AS inv_name,

                    -- round & default to 0
                    COALESCE( ROUND(t.total_cost_remaining, 2), 0 ) AS total_cost_remaining,
                    COALESCE( ROUND(t.remaining_qty,         2), 0 ) AS remaining_qty,
                    COALESCE( ROUND(t.uom_val,               2), 0 ) AS uom_val,

                    -- avg_cost = total_cost_remaining / (remaining_qty * uom_val)
                    COALESCE(
                        ROUND(
                        t.total_cost_remaining
                        / NULLIF(t.remaining_qty * t.uom_val, 0)
                        , 2)
                    , 0)                                    AS avg_cost,

                    -- converted_cost_remaining = total_cost_remaining / uom_val
                    COALESCE(
                        ROUND(
                        t.total_cost_remaining
                        / NULLIF(t.uom_val, 0)
                        , 2)
                    , 0)                                    AS converted_cost_remaining,

                    -- avg_overall = sum(converted_cost_remaining) / sum(remaining_qty) per parent_inv
                    COALESCE(
                        ROUND(
                        SUM(t.total_cost_remaining / NULLIF(t.uom_val, 0))
                            OVER (PARTITION BY u.parent_inv)
                        /
                        NULLIF(
                            SUM(t.remaining_qty)
                            OVER (PARTITION BY u.parent_inv)
                        , 0)
                        , 2)
                    , 0)                                    AS avg_overall,

                    -- new_cost_ea = avg_overall * uom_val
                    COALESCE(
                        ROUND(
                        (
                            SUM(t.total_cost_remaining / NULLIF(t.uom_val, 0))
                            OVER (PARTITION BY u.parent_inv)
                            /
                            NULLIF(
                            SUM(t.remaining_qty)
                                OVER (PARTITION BY u.parent_inv)
                            , 0)
                        )
                        * t.uom_val
                        , 2)
                    , 0)                                    AS new_cost_ea

                    FROM tx_agg t
                    JOIN ultimate_parent u
                    ON u.inv = t.source_component

                    LEFT JOIN lkp_build_of_products bp
                    ON bp.build_code = t.source_component
                    LEFT JOIN lkp_raw_mats rm
                    ON rm.mat_code   = t.source_component

                    LEFT JOIN lkp_build_of_products bp2
                    ON bp2.build_code = u.parent_inv
                    LEFT JOIN lkp_raw_mats rm2
                    ON rm2.mat_code   = u.parent_inv

                    ORDER BY
                    COALESCE(bp2.desc, rm2.desc),
                    t.source_component,
                    t.busunitcode;";

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

        $sql = "SELECT * FROM lkp_pricing_code Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_pricing_code WHERE pricing_code = :pricing_desc && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":pricing_desc", $data["pricingname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO lkp_pricing_code ()
                VALUES (default, CONCAT('PC-',ShortUUID()),:pricing_code,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR), :ownershiptype)";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":pricing_code", $data["pricingname"], PDO::PARAM_STR);
        $stmt->bindValue(":ownershiptype", $data["ownershiptype"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();
        echo json_encode(["message" => "Success"]);
        }
    }

    public function rejectprices($user_id, string $id)
    {

        $sql = "UPDATE lkp_pricing_code

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

    public function editprice($user_id, $id)
    {
$checkforduplisql = "SELECT COUNT(*) as count FROM lkp_pricing_code 
                    WHERE pricing_code = :productcatdesc 
                    AND deletestatus = 'Active'
                    AND uuid <> :uuid";


$checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":productcatdesc", $id["pricingname"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":uuid", $id["pricing_code"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE lkp_pricing_code

                SET

                    pricing_code  = :pricingname,

                    ownership_type  = :ownershiptype,

                    usertracker  = :usertracker

                WHERE

                      uuid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":pricingname", $id["pricingname"], PDO::PARAM_STR);

        $stmt->bindValue(":ownershiptype", $id["ownershiptype"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["pricing_code"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
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

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_pricing_code Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_pricing_code Where deletestatus = 'Active' AND pricing_code  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_pricing_code Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

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
