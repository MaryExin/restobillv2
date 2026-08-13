<?php

class ProductsQueueNotificationGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($data)
    {

        try {

            $this->conn->beginTransaction();

            $consoData = [];

            $busunitRoles = array_map(function ($busunit) {

                return $busunit["rolename"];

            }, $data["busunits"]);

            $busunitRolesString = implode("','", $busunitRoles);

            //GET PR STATUS THAT ARE PENDING

            $sql = "SELECT

                prd_queue_code, pr_status AS status, 'Purchase Request' AS type

                FROM

                    `tbl_products_queue_summary` 
               

                WHERE

                    pr_status = 'Pending'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))


        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET PO STATUS THAT ARE PENDING

            $sql = "SELECT

                    prd_queue_code, po_status AS status, 'Purchase Order' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    po_status = 'Pending'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET PRODUCTION STATUS THAT ARE PENDING

            $sql = "SELECT

                    prd_queue_code, production_status AS status, 'Production' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    production_status = 'Pending'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET PRODUCTION STATUS THAT ARE IN PROGRESS

            $sql = "SELECT

                    prd_queue_code, production_status AS status, 'Production' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    production_status = 'In Progress'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET BILLING  STATUS THAT ARE PENDING

            $sql = "SELECT

                    prd_queue_code, billing_status AS status, 'Billing' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    billing_status = 'Pending'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET BILLING  STATUS THAT ARE Unpaid

            $sql = "SELECT

                    prd_queue_code, billing_status AS status, 'Billing' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    billing_status = 'Unpaid'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET DELIVERY DATA  STATUS HAT ARE Unpaid

            $sql = "SELECT

                    prd_queue_code, delivery_status AS status, 'Delivery' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    delivery_status = 'Pending'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET DELIVERY DATA  STATUS THAT ARE Dispatching

            $sql = "SELECT

                    prd_queue_code, delivery_status AS status, 'Delivery' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    delivery_status = 'For Dispatching'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            //GET DELIVERY DATA  STATUS THAT ARE Shipping

            $sql = "SELECT

                    prd_queue_code, delivery_status AS status, 'Delivery' AS type

                FROM

                    `tbl_products_queue_summary`

                WHERE

                    delivery_status = 'For Shipping'

                        AND deletestatus = 'Active'

                        AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $consoData[] = $row;

            }

            // Conso Data

            $this->conn->commit();

            return $consoData;

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_raw_mats ORDER BY seq LIMIT $pageIndex, $pageData";

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

            //Post to Delivery Assignment

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(5)), 0, 10);

            $currentYearMonth = date('Ym');

            $shortUuid = $currentYearMonth . $randomString;

            $shortUuid = str_pad($shortUuid, 16, '0', STR_PAD_RIGHT);

            $sql = "INSERT INTO tbl_delivery_assignment () VALUES (default, :del_code, :sender, :receiver,

            :vehicle, :del_details_code, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":del_code", "DL-" . $data["deliveryitems"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":sender", $data["deliveryassignment"]["sender"], PDO::PARAM_STR);

            $stmt->bindValue(":receiver", $data["deliveryassignment"]["receiver"], PDO::PARAM_STR);

            $stmt->bindValue(":vehicle", $data["deliveryassignment"]["vehicle"], PDO::PARAM_STR);

            $stmt->bindValue(":del_details_code", 'DD-' . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Post to Delivery Details

            $sql = "INSERT INTO tbl_delivery_details () VALUES (default, :del_details_code, :level,

            :sender, :receiver,:inv_code, :sender_qty, :receiver_qty, :variance, :status,

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), null, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["deliveryitems"] as $delivery) {

                $stmt->bindValue(":del_details_code", "DD-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":level", "Dispatching", PDO::PARAM_STR);

                $stmt->bindValue(":sender", $data["deliveryassignment"]["sender"], PDO::PARAM_STR);

                $stmt->bindValue(":receiver", $data["deliveryassignment"]["receiver"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":sender_qty", $delivery["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":receiver_qty", 0, PDO::PARAM_STR);

                $stmt->bindValue(":variance", 0, PDO::PARAM_STR);

                $stmt->bindValue(":status", "Queued", PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            //Update Queue delivery status

            $sql = "UPDATE tbl_products_queue_summary

                SET

                    delivery_status = :status,

                    usertracker = :user_tracker,

                    del_code= :del_code



                WHERE

                    prd_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", "For Dispatching", PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":del_code", "DL-" . $data["deliveryitems"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":id", $data["deliveryitems"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->execute();

            //Commit Changes

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

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
