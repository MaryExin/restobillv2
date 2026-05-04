<?php

class DeliveryDetailsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($data)
    {

        $sql = "SELECT DISTINCT
            tbl_delivery_assignment.del_code,
            tbl_delivery_details.del_details_code,
            tbl_products_queue_summary.prd_queue_code,
            tbl_delivery_details.level,
            tbl_delivery_details.sender,
            sender.firstname AS senderfirstname,
            sender.lastname AS senderlastname,
            tbl_delivery_details.receiver,
            receiver.firstname AS receiverfirstname,
            receiver.lastname AS receiverlastname,
            tbl_delivery_details.inv_code,
            IF(LEFT(tbl_delivery_details.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS inv_name,
            sender_qty,
            receiver_qty,
            variance,
            tbl_product_values.cost_per_uom,
            tbl_product_values.uomval AS uom_val,
            tbl_product_values.uom,
            tbl_delivery_details.status,
            queued_transdate,
            completed_transdate,
            IF(LEFT(tbl_delivery_details.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, NULL) AS rawmats_parent
        FROM tbl_delivery_details
        LEFT OUTER JOIN lkp_raw_mats ON tbl_delivery_details.inv_code = lkp_raw_mats.mat_code
        LEFT OUTER JOIN tbl_employees AS sender ON tbl_delivery_details.sender = sender.empid
        LEFT OUTER JOIN tbl_employees AS receiver ON tbl_delivery_details.receiver = receiver.empid
        LEFT OUTER JOIN lkp_build_of_products ON tbl_delivery_details.inv_code = lkp_build_of_products.build_code
        LEFT OUTER JOIN tbl_delivery_assignment ON tbl_delivery_details.del_details_code = tbl_delivery_assignment.del_details_code
        LEFT OUTER JOIN tbl_products_queue_summary ON tbl_delivery_assignment.del_code = tbl_products_queue_summary.del_code
        LEFT OUTER JOIN (
            SELECT DISTINCT tbl_products_queue_summary.del_code,
                tbl_delivery_assignment.del_details_code,
                tbl_products_queue.prd_queue_code,
                tbl_products_queue.inv_code,
                tbl_products_queue.cost_per_uom,
                tbl_products_queue.uomval,
                tbl_products_queue.uom
            FROM tbl_products_queue
            LEFT OUTER JOIN tbl_products_queue_summary ON tbl_products_queue.prd_queue_code = tbl_products_queue_summary.prd_queue_code
            LEFT OUTER JOIN tbl_delivery_assignment ON tbl_products_queue_summary.del_code = tbl_delivery_assignment.del_code
        ) tbl_product_values ON tbl_delivery_details.del_details_code = tbl_product_values.del_details_code
        AND tbl_delivery_details.inv_code =  tbl_product_values.inv_code
        WHERE tbl_delivery_details.deletestatus = 'Active'
        AND tbl_delivery_assignment.del_code = :deliverydetailscode
        ORDER BY tbl_delivery_details.seq DESC;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":deliverydetailscode", "DL-" . $data["deliverydetailscode"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getShippingData($data)
    {

        $sql = "SELECT del_code, sender, tbl_sender.firstname AS sendersfirstname, tbl_sender.lastname AS senderslastname,

                receiver, tbl_receiver.firstname AS receiversfirstname, tbl_receiver.lastname AS receiverslastname, vehicle, del_details_code

                FROM tbl_delivery_assignment

                LEFT OUTER JOIN tbl_employees AS tbl_sender  ON tbl_delivery_assignment.sender = tbl_sender.empid

                LEFT OUTER JOIN tbl_employees AS tbl_receiver ON tbl_delivery_assignment.receiver = tbl_receiver.empid

                WHERE tbl_delivery_assignment.deletestatus = 'Active'

                AND del_code = :del_code";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":del_code", "DL-" . $data["del_code"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

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

    public function updateForUser($user_id, $data)
    {

        //Update delivery when DISPATCHED

        try {

            $this->conn->beginTransaction();

            if ($data["deliveryitems"][0]["status"] === "Queued") {

                $sql = "UPDATE tbl_delivery_details

                SET

                    receiver_qty = :quantity,

                    usertracker = :user_tracker,

                    variance = :variance,

                    status = :status

                WHERE

                    del_details_code = :del_details_code

                AND level = :level

                AND inv_code = :inv_code";

                $stmt = $this->conn->prepare($sql);

                foreach ($data["deliveryitems"] as $delivery) {

                    $stmt->bindValue(":quantity", $delivery["receiver_qty"], PDO::PARAM_INT);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->bindValue(":variance", $delivery["variance"], PDO::PARAM_STR);

                    $stmt->bindValue(":status", "Confirmed", PDO::PARAM_STR);

                    $stmt->bindValue(":del_details_code", $delivery["del_details_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":level", $delivery["level"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            if ($data["deliveryitems"][0]["status"] === "Confirmed") {

                $sql = "UPDATE tbl_delivery_details

                SET

                    usertracker = :user_tracker,

                    status = :status,

                    completed_transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    del_details_code = :del_details_code

                AND level = :level

                AND inv_code = :inv_code";

                $stmt = $this->conn->prepare($sql);

                foreach ($data["deliveryitems"] as $delivery) {

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->bindValue(":status", "Completed", PDO::PARAM_STR);

                    $stmt->bindValue(":del_details_code", $delivery["del_details_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":level", $delivery["level"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                }

                //Update tbl_queue

                $sql = "UPDATE tbl_products_queue_summary

                SET

                    usertracker = :user_tracker,

                    delivery_status = :status,

                    shipping_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    del_code = :del_code";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", "For Shipping", PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":del_code", $data["deliveryitems"][0]["del_code"], PDO::PARAM_STR);

                $stmt->execute();

                //Update Inventory Table

                //Insert main component in statement transactions

                $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class,'', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);

                $converteditems = [];

                foreach ($data["deliveryitems"] as $delivery) {

                    $class = substr($delivery["inv_code"], 0, 2);

                    if ($class === "RM") {

                        $class = "RM";

                    } else {

                        $class = "FG";

                    }

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":qty", $delivery["receiver_qty"] * -1, PDO::PARAM_STR);

                    $stmt->bindValue(":cost_per_uom", $delivery["cost_per_uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom_val", $delivery["uom_val"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom", $delivery["uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":pr_queue_code", $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":busunitcode", $data["queuedetails"][0]["payee"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }


      public function getNetDeliveryItems($data)
    {

      $sql = "SELECT 
                    tbl_inventory_transactions.inv_code,
                    SUM(tbl_inventory_transactions.qty) AS qty,
                    tbl_products_queue_summary.delivery_status
                FROM
                    tbl_inventory_transactions
                        LEFT OUTER JOIN
                    tbl_products_queue_summary ON tbl_inventory_transactions.pr_queue_code = tbl_products_queue_summary.prd_queue_code
                WHERE
                    tbl_inventory_transactions.pr_queue_code = :prqueuecode
                        AND tbl_inventory_transactions.deletestatus = 'Active'
                        AND tbl_products_queue_summary.delivery_status = 'Partial'
                GROUP BY inv_code";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prqueuecode", $data["prqueuecode"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function updateForUserSupplier($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(5)), 0, 10);

            $currentYearMonth = date('Ym');

            $shortUuid = $currentYearMonth . $randomString;

            $shortUuid = str_pad($shortUuid, 16, '0', STR_PAD_RIGHT);

            // Post to Delivery Assignment

            $sql = "INSERT INTO  tbl_delivery_assignment ()
                    VALUES (default, :deliverycode, :sender, :receiver, 'SUPPLIER',
                    :deliverydetailscode, 'Active', :user_tracker,  DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":deliverycode", "DL-" . $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":sender", $data["queuedetails"][0]["payee"], PDO::PARAM_STR);

            $stmt->bindValue(":receiver", $data["queuedetails"][0]["orderedby"], PDO::PARAM_STR);

            $stmt->bindValue(":deliverydetailscode", "DD-" . $shortUuid, PDO::PARAM_STR);

            $stmt->execute();

            

            // Post to delivery details

            $sql = "INSERT INTO  tbl_delivery_details ()
                    VALUES (default, :deliverydetailscode, 'Delivery',  :sender, :receiver, :invcode,
                    :senderqty, :receiverqty, :variance, 'Completed', :queueddate, :completeddate,
                    'Active', :user_tracker,  DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queuedetails"] as $delivery) {

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":deliverydetailscode", "DD-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":sender", $delivery["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":receiver", $delivery["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":invcode", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":senderqty", $delivery["qtyreceivedsupplier"], PDO::PARAM_STR);

                $stmt->bindValue(":receiverqty", $delivery["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":variance", $delivery["qtyreceivedsupplier"] - $delivery["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":queueddate", $delivery["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":completeddate", $delivery["transdate"], PDO::PARAM_STR);

                $stmt->execute();

            }

            //Update tbl_queue

            $sql = "UPDATE tbl_products_queue_summary
                SET
                    usertracker = :user_tracker,

                    delivery_status = :status,

                    date_delivered = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    prd_queue_code = :prd_queue_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":prd_queue_code", $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->execute();

            //Update Inventory Table

            //Insert main component in statement transactions



            $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expirydate, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queuedetails"] as $delivery) {

                $class = substr($delivery["inv_code"], 0, 2);


                $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $delivery["qtyreceivedsupplier"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $delivery["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $delivery["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $delivery["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", $delivery["prd_queue_code"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $delivery["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                $stmt->bindValue(":expirydate", $delivery['expiryDate'], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateForUserDepartment($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(5)), 0, 10);

            $currentYearMonth = date('Ym');

            $shortUuid = $currentYearMonth . $randomString;

            $shortUuid = str_pad($shortUuid, 16, '0', STR_PAD_RIGHT);

            // Post to Delivery Assignment

            $sql = "INSERT INTO  tbl_delivery_assignment ()
                    VALUES (default, :deliverycode, :sender, :receiver, 'DEPARTMENT',
                    :deliverydetailscode, 'Active', :user_tracker,  DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":deliverycode", "DL-" . $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":sender", $data["queuedetails"][0]["payee"], PDO::PARAM_STR);

            $stmt->bindValue(":receiver", $data["queuedetails"][0]["orderedby"], PDO::PARAM_STR);

            $stmt->bindValue(":deliverydetailscode", "DD-" . $shortUuid, PDO::PARAM_STR);

            $stmt->execute();

            // Post to delivery details Take note that raw data has supplier text on it but can be utilized on this usecase

            $sql = "INSERT INTO  tbl_delivery_details ()
                    VALUES (default, :deliverydetailscode, 'Delivery',  :sender, :receiver, :invcode,
                    :senderqty, :receiverqty, :variance, 'Completed', :queueddate, :completeddate,
                    'Active', :user_tracker,  DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queuedetails"] as $delivery) {

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":deliverydetailscode", "DD-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":sender", $delivery["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":receiver", $delivery["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":invcode", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":senderqty", $delivery["qtyreceivedsupplier"], PDO::PARAM_STR);

                $stmt->bindValue(":receiverqty", $delivery["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":variance", $delivery["qtyreceivedsupplier"] - $delivery["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":queueddate", $delivery["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":completeddate", $delivery["transdate"], PDO::PARAM_STR);

                $stmt->execute();

            }

            //Update tbl_queue

            $sql = "UPDATE tbl_products_queue_summary
                SET
                    usertracker = :user_tracker,

                    delivery_status = :status,

                    date_delivered = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    prd_queue_code = :prd_queue_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", "Delivered", PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":prd_queue_code", $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

            $stmt->execute();

            //Update Inventory Table

            //Insert main component in statement transactions ADdition to Commi

            $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expirydate, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queuedetails"] as $delivery) {

                $class = substr($delivery["inv_code"], 0, 2);

                if ($class === "RM") {

                    $class = "RM";

                    $selectsql = 'SELECT expiry_days FROM lkp_raw_mats WHERE mat_code = :mat_code';
                    $selectstmt = $this->conn->prepare($selectsql);
                    $selectstmt->bindValue(":mat_code", $delivery["inv_code"], PDO::PARAM_STR);
                    $selectstmt->execute();
                    $result = $selectstmt->fetch(PDO::FETCH_ASSOC); 
                    $expiry = $result['expiry_days'];

                    $date = new DateTime(); 
                    $date->modify("+$expiry days");
                    $newDate = $date->format('Y-m-d'); 
                    

                } else {

                            $class = "FG";
              
                            $selectsql = 'SELECT expiry_days FROM lkp_build_of_products WHERE build_code = :build_code';
                            $selectstmt = $this->conn->prepare($selectsql);
                            $selectstmt->bindValue(":build_code", $delivery["inv_code"], PDO::PARAM_STR);
                            $selectstmt->execute();
                            $result = $selectstmt->fetch(PDO::FETCH_ASSOC); 
                            $expiry = $result['expiry_days'];

                            $date = new DateTime(); 
                            $date->modify("+$expiry days");
                            $newDate = $date->format('Y-m-d'); 
                
                }

                $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $delivery["qtyreceivedsupplier"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $delivery["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $delivery["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $delivery["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", $delivery["prd_queue_code"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $delivery["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                $stmt->bindValue(":expirydate", $delivery['expiryDate'], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            //Insert main component in statement transactions DEDUCTED to Commi

            $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expirydate, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queuedetails"] as $delivery) {

                $class = substr($delivery["inv_code"], 0, 2);

                if ($class === "RM") {

                    $class = "RM";

                    $selectsql = 'SELECT expiry_days FROM lkp_raw_mats WHERE mat_code = :mat_code';
                    $selectstmt = $this->conn->prepare($selectsql);
                    $selectstmt->bindValue(":mat_code", $delivery["inv_code"], PDO::PARAM_STR);
                    $selectstmt->execute();
                    $result = $selectstmt->fetch(PDO::FETCH_ASSOC); 
                    $expiry = $result['expiry_days'];

                    $date = new DateTime(); 
                    $date->modify("+$expiry days");
                    $newDate = $date->format('Y-m-d'); 
                    

                } else {

                            $class = "FG";
              
                            $selectsql = 'SELECT expiry_days FROM lkp_build_of_products WHERE build_code = :build_code';
                            $selectstmt = $this->conn->prepare($selectsql);
                            $selectstmt->bindValue(":build_code", $delivery["inv_code"], PDO::PARAM_STR);
                            $selectstmt->execute();
                            $result = $selectstmt->fetch(PDO::FETCH_ASSOC); 
                            $expiry = $result['expiry_days'];

                            $date = new DateTime(); 
                            $date->modify("+$expiry days");
                            $newDate = $date->format('Y-m-d'); 
                
                }

                $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $delivery["qtyreceivedsupplier"] * -1, PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $delivery["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $delivery["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $delivery["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", $delivery["prd_queue_code"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $delivery["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                $stmt->bindValue(":expirydate", $delivery['expiryDate'], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateShippingAssignmentForUser($user_id, $data)
    {

        //Update delivery when DISPATCHED

        try {

            $this->conn->beginTransaction();

            // Update delivery assignment for shipping details

            $sql = "UPDATE tbl_delivery_assignment

                SET

                    sender = :sender,

                    receiver = :receiver,

                    vehicle = :vehicle,

                    user_tracker = :user_tracker,

                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)

                WHERE

                    del_code = :del_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sender", $data["sender"], PDO::PARAM_STR);

            $stmt->bindValue(":receiver", $data["receiver"], PDO::PARAM_STR);

            $stmt->bindValue(":vehicle", $data["vehicle"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":del_code", $data["shippingdetails"][0]["del_code"], PDO::PARAM_STR);

            $stmt->execute();

            //Post to Delivery Details

            $sql = "INSERT INTO tbl_delivery_details () VALUES (default, :del_details_code, :level,

            :sender, :receiver,:inv_code, :sender_qty, :receiver_qty, :variance, :status,

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), null, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["deliveryitems"] as $delivery) {

                $stmt->bindValue(":del_details_code", $delivery["del_details_code"], PDO::PARAM_STR);

                $stmt->bindValue(":level", "Delivery", PDO::PARAM_STR);

                // $stmt->bindValue(":sender", $data["shippingdetails"][0]["sender"], PDO::PARAM_STR);

                // $stmt->bindValue(":receiver", $data["shippingdetails"][0]["receiver"], PDO::PARAM_STR);

                $stmt->bindValue(":sender", $data["sender"], PDO::PARAM_STR);

                $stmt->bindValue(":receiver", $data["receiver"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                // $stmt->bindValue(":sender_qty", $delivery["receiver_qty"], PDO::PARAM_STR);
                $stmt->bindValue(":sender_qty", $delivery["sender_qty"], PDO::PARAM_STR);

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

                    usertracker = :user_tracker

                WHERE

                    del_code= :del_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", "Shipped", PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":del_code", $data["deliveryitems"][0]["del_code"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateShippingDetailsForUser($user_id, $data)
    {

        //Update delivery when DISPATCHED

        try {

            $this->conn->beginTransaction();

            if ($data["deliveryitems"][0]["status"] === "Queued") {

                $sql = "UPDATE tbl_delivery_details

                SET

                    receiver_qty = :quantity,

                    usertracker = :user_tracker,

                    variance = :variance,

                    status = :status

                WHERE

                    del_details_code = :del_details_code

                AND inv_code = :inv_code

                AND level = 'Delivery'";

                $stmt = $this->conn->prepare($sql);

                foreach ($data["deliveryitems"] as $delivery) {

                    $stmt->bindValue(":quantity", $delivery["receiver_qty"], PDO::PARAM_INT);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->bindValue(":variance", $delivery["variance"], PDO::PARAM_STR);

                    $stmt->bindValue(":status", "Confirmed", PDO::PARAM_STR);

                    $stmt->bindValue(":del_details_code", $delivery["del_details_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            if ($data["deliveryitems"][0]["status"] === "Confirmed") {

                $sql = "UPDATE tbl_delivery_details

                SET

                    usertracker = :user_tracker,

                    status = :status,

                    completed_transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    del_details_code = :del_details_code

                AND inv_code = :inv_code

                AND level = 'Delivery'";

                $stmt = $this->conn->prepare($sql);

                foreach ($data["deliveryitems"] as $delivery) {

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->bindValue(":status", "Completed", PDO::PARAM_STR);

                    $stmt->bindValue(":del_details_code", $delivery["del_details_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                }

                //Update tbl_queue

                $sql = "UPDATE tbl_products_queue_summary

                SET

                    usertracker = :user_tracker,

                    delivery_status = :status,

                    date_delivered = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))

                WHERE

                    del_code = :del_code";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", "Delivered", PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":del_code", $data["deliveryitems"][0]["del_code"], PDO::PARAM_STR);

                $stmt->execute();

                //Update Inventory Table

                //Insert main component in statement transactions



                foreach ($data["deliveryitems"] as $delivery) {

                    $sql = "SELECT expirydate FROM tbl_inventory_transactions where inv_code = :inv_code and pr_queue_code = :pr_queue_code and qty > 0 limit 1";
                    
                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":pr_queue_code", $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

                    $stmt->execute();

                    $fetch = $stmt->fetch(PDO::FETCH_ASSOC);

                    $expiryDate = $fetch['expirydate'];
                
                    $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expiry_date, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $class = substr($delivery["inv_code"], 0, 2);

                    if ($class === "RM") {

                        $class = "RM";

                    } else {

                        $class = "FG";

                    }

                    $stmt->bindValue(":inv_code", $delivery["inv_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":qty", $delivery["receiver_qty"], PDO::PARAM_STR);

                    $stmt->bindValue(":cost_per_uom", $delivery["cost_per_uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom_val", $delivery["uom_val"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom", $delivery["uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":pr_queue_code", $data["queuedetails"][0]["prd_queue_code"], PDO::PARAM_STR);

                    $stmt->bindValue(":busunitcode", $data["queuedetails"][0]["orderedby"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                    $stmt->bindValue(":expiry_date", $expiryDate, PDO::PARAM_STR);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

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
