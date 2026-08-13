<?php

class BuildComponentsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT
                tbl_build_components_name.seq,
                tbl_build_components_name.build_code,
                tbl_build_components_name.component_code,
                tbl_build_components_name.component_class,
                tbl_build_components_name.qty,
                tbl_build_components_name.deletestatus,
                tbl_build_components_name.usertracker,
                tbl_build_components_name.createdtime,
                UPPER(lkp_build_of_products.desc) AS builddesc,
                UPPER(tbl_build_components_name.componentdesc) AS componentdesc,
                tbl_build_components_name.uomval,
                tbl_build_components_name.uom,
                tbl_build_components_name.cost_per_uom,
                tbl_build_components_name.pricing_code,
                tbl_build_components_name.portion_parent,
                lkp_portions.desc AS portion_parent_description,
                lkp_portions.cost_per_uom AS portion_parent_cost_per_uom
            FROM
                (SELECT
                    tbl_build_components.seq,
                        tbl_build_components.build_code,
                        tbl_build_components.component_code,
                        tbl_build_components.component_class,
                        tbl_build_components.qty,
                        tbl_build_components.deletestatus,
                        tbl_build_components.usertracker,
                        tbl_build_components.createdtime,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentdesc,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uomval, lkp_build_of_products.uomval) AS uomval,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uom, lkp_build_of_products.uom) AS uom,
                        tbl_pricing_details.cost_per_uom AS cost_per_uom,
                        tbl_pricing_details.pricing_code,
                        lkp_build_of_products.portion_parent
                FROM
                    tbl_build_components
                LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code
                LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code
                LEFT OUTER JOIN tbl_pricing_details ON tbl_build_components.component_code = tbl_pricing_details.inv_code
                WHERE
                    tbl_build_components.deletestatus = 'Active') AS tbl_build_components_name
                    LEFT OUTER JOIN
                lkp_build_of_products ON tbl_build_components_name.build_code = lkp_build_of_products.build_code
                    LEFT OUTER JOIN
                lkp_build_of_products AS lkp_portions ON tbl_build_components_name.portion_parent = lkp_portions.build_code";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

       public function deleteForUser($user_id, $data)
    {

        $sql = "DELETE FROM tbl_build_components WHERE seq = :seq";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":seq", $data["seq"], PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function getDataByActualComponents($data)
    {

        $sql = "SELECT IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'BD',lkp_build_of_products.desc , lkp_raw_mats.desc) AS `desc`,
                tbl_inventory_transactions.qty * -1 AS qty, tbl_inventory_transactions.uom_val,
                tbl_inventory_transactions.uom, tbl_inventory_transactions.cost_per_uom, lkp_busunits.class
                FROM
                tbl_inventory_transactions
                    LEFT OUTER JOIN
                        lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code
                    LEFT OUTER JOIN
                        lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code
                    LEFT OUTER JOIN
                        lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode
                    WHERE tbl_inventory_transactions.pr_queue_code = :prd_queue_code
                    AND tbl_inventory_transactions.deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllDataWithNamesbyId($data)
    {

        $combinedData = [];

        foreach ($data["buildcode"] as $component) {

            $sql = "SELECT
                tbl_build_components_name.seq,
                tbl_build_components_name.build_code,
                tbl_build_components_name.component_code,
                tbl_build_components_name.component_class,
                tbl_build_components_name.qty,
                tbl_build_components_name.deletestatus,
                tbl_build_components_name.usertracker,
                tbl_build_components_name.createdtime,
                UPPER(lkp_build_of_products.desc) AS builddesc,
                UPPER(tbl_build_components_name.componentdesc) AS componentdesc,
                tbl_build_components_name.uomval,
                tbl_build_components_name.uom,
                tbl_pricing_details.cost_per_uom,
                tbl_build_components_name.rawmats_parent,
                tbl_pricing_details.pricing_code
            FROM
                (SELECT
                    tbl_build_components.seq,
                        tbl_build_components.build_code,
                        tbl_build_components.component_code,
                        tbl_build_components.component_class,
                        tbl_build_components.qty,
                        tbl_build_components.deletestatus,
                        tbl_build_components.usertracker,
                        tbl_build_components.createdtime,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentdesc,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uomval, lkp_build_of_products.uomval) AS uomval,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uom, lkp_build_of_products.uom) AS uom,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.cost_per_uom, lkp_build_of_products.cost_per_uom) AS cost_per_uom,
                        IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, NULL) AS rawmats_parent
                FROM
                    tbl_build_components
                LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code
                LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code
                WHERE
                    tbl_build_components.deletestatus = 'Active'
                        AND tbl_build_components.build_code = :buildcode) AS tbl_build_components_name
                    LEFT OUTER JOIN
                lkp_build_of_products ON tbl_build_components_name.build_code = lkp_build_of_products.build_code
                    LEFT OUTER JOIN
                tbl_pricing_details ON tbl_build_components_name.component_code = tbl_pricing_details.inv_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":buildcode", $component["inv_code"], PDO::PARAM_STR);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $combinedData[] = $row; // Append the row to $combinedData

            }

        }

        return $combinedData;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT
                    buildcode,
                    lkp_build_of_products.desc,
                    componentname,
                    componentclass,
                    componentquantity,
                    tbl_build_summary.uomval,
                    tbl_build_summary.uom,
                    lkp_build_of_products.level
                FROM
                    (SELECT
                        tbl_build_components.build_code AS buildcode,
                            IF(LEFT(tbl_build_components.component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentname,
                            IF(LEFT(tbl_build_components.component_code, 2) = 'RM', lkp_raw_mats.uomval, lkp_build_of_products.uomval) AS uomval,
                            IF(LEFT(tbl_build_components.component_code, 2) = 'RM', lkp_raw_mats.uom, lkp_build_of_products.uom) AS uom,
                            tbl_build_components.component_class AS componentclass,
                            tbl_build_components.qty AS componentquantity
                    FROM
                        tbl_build_components
                    LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code
                    LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code
                    WHERE
                        tbl_build_components.deletestatus = 'Active') tbl_build_summary
                        LEFT OUTER JOIN
                    lkp_build_of_products ON tbl_build_summary.buildcode = lkp_build_of_products.build_code
                ORDER BY lkp_build_of_products.desc ASC , componentname ASC
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

    public function createForUser($user_id, $data)
    {
        try {

            $sql = "SELECT * FROM tbl_build_components
            WHERE deletestatus = 'Active'
            AND build_code = :buildcode
            AND component_code = :componentcode";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["components"] as $component) {
                $stmt->bindValue(":buildcode", $data["buildcode"], PDO::PARAM_STR);
                $stmt->bindValue(":componentcode", $component["component_code"], PDO::PARAM_STR);
                $stmt->execute();

                $rowCount = $stmt->rowCount();

                if ($rowCount > 0) {
                    echo json_encode(["message" => "Duplicate"]);
                    exit;
                }

            }

            $sql = "INSERT INTO tbl_build_components ()
                VALUES (default, :buildcode, :componentcode, :componentclass, :qty,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["components"] as $component) {
                $stmt->bindValue(":buildcode", $data["buildcode"], PDO::PARAM_STR);
                $stmt->bindValue(":componentcode", $component["component_code"], PDO::PARAM_STR);
                $stmt->bindValue(":componentclass", $component["component_class"], PDO::PARAM_STR);
                $stmt->bindValue(":qty", $component["qty"], PDO::PARAM_INT);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {
            echo json_encode(["error" => "Database error: " . $e->getMessage()]);
        } catch (Exception $e) {
            echo json_encode(["error" => "An error occurred: " . $e->getMessage()]);
        }
    }

   

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_build_components Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT
                    tbl_sub.seq,
                    tbl_sub.build_code,
                    tbl_sub.component_code,
                    tbl_sub.component_class,
                    tbl_sub.qty,
                    tbl_sub.deletestatus,
                    tbl_sub.usertracker,
                    tbl_sub.createdtime,
                    tbl_sub.componentdesc,
                    tbl_sub.uomval,
                    tbl_sub.uom,
                    lkp_build_of_products.desc AS builddesc
                FROM
                    (SELECT
                        tbl_build_components.seq,
                            tbl_build_components.build_code,
                            tbl_build_components.component_code,
                            tbl_build_components.component_class,
                            tbl_build_components.qty,
                            tbl_build_components.deletestatus,
                            tbl_build_components.usertracker,
                            tbl_build_components.createdtime,
                            IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentdesc,
                            IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uomval, lkp_build_of_products.uomval) AS uomval,
                            IF(LEFT(component_code, 2) = 'RM', lkp_raw_mats.uom, lkp_build_of_products.uom) AS uom
                    FROM
                        tbl_build_components
                    LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code
                    LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code
                    WHERE
                        tbl_build_components.deletestatus = 'Active') tbl_sub
                        LEFT OUTER JOIN
                    lkp_build_of_products ON tbl_sub.build_code = lkp_build_of_products.build_code
                       WHERE lkp_build_of_products.desc LIKE :search
                    ORDER BY lkp_build_of_products.desc ASC
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

    public function getClearingData()
    {

        $sql = "SELECT * FROM tbl_build_components Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
