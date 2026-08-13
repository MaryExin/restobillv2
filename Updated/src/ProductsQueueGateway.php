<?php

class ProductsQueueGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($data)
    {

        $sql = "SELECT
    tbl_products_queue_multiple.prd_queue_code as prd_queue_code_new,
    tbl_products_queue.seq,
    tbl_products_queue_summary.orderedby,
    tbl_products_queue.prd_queue_code,
    tbl_products_queue.inv_code,  -- Make sure this is from tbl_products_queue
    tbl_products_queue.cost_per_uom,
    IT.expirydate AS expiryDate,
    tbl_products_queue.uomval,
    tbl_products_queue.uom,
    tbl_products_queue.quantity,
    tbl_products_queue.total,
    tbl_products_queue.transdate,
    tbl_products_queue.orderedby,
    tbl_products_queue.payee,
    tbl_products_queue.deletestatus,
    tbl_products_queue.usertracker,
    tbl_products_queue.createdtime,
    orderedBy.name AS orderedbyname,
    IF(LEFT(tbl_products_queue.payee, 2) = 'SP', lkp_supplier.supplier_name, payeeName.name) AS payeename,
    IF(LEFT(tbl_products_queue.inv_code, 2) = 'RM',
        lkp_raw_mats.desc,
        lkp_build_of_products.desc) AS productname,
    lkp_busunits.class AS classpayee,
    lkp_build_of_products.level AS level,
    tbl_products_queue_summary.notes,
    CONCAT(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.lastname) as fullname,
    CONCAT(PR.firstname, ' ', PR.lastname) as pr_fullname,
    CONCAT(PO.firstname, ' ', PO.lastname) as po_fullname,
    tbl_products_queue.deletestatus
FROM
    tbl_products_queue
    LEFT OUTER JOIN lkp_busunits AS orderedBy ON tbl_products_queue.orderedby = orderedBy.busunitcode
    LEFT OUTER JOIN lkp_busunits AS payeeName ON tbl_products_queue.payee = payeeName.busunitcode
    LEFT OUTER JOIN lkp_busunits ON tbl_products_queue.payee = lkp_busunits.busunitcode
    LEFT OUTER JOIN lkp_raw_mats ON tbl_products_queue.inv_code = lkp_raw_mats.mat_code
    LEFT OUTER JOIN lkp_build_of_products ON tbl_products_queue.inv_code = lkp_build_of_products.build_code
    LEFT OUTER JOIN lkp_supplier ON tbl_products_queue.payee = lkp_supplier.supplier_code
    LEFT OUTER JOIN tbl_products_queue_multiple ON tbl_products_queue_multiple.prd_queue_code_new = tbl_products_queue.prd_queue_code
    LEFT OUTER JOIN tbl_products_queue_summary ON tbl_products_queue.prd_queue_code = tbl_products_queue_summary.prd_queue_code
    LEFT OUTER JOIN tbl_users_global_assignment ON tbl_products_queue_summary.usertracker = tbl_users_global_assignment.uuid
    LEFT OUTER JOIN tbl_users_global_assignment as PR ON tbl_products_queue_summary.pr_approved_by = PR.uuid
    LEFT OUTER JOIN tbl_users_global_assignment as PO ON tbl_products_queue_summary.po_approved_by = PO.uuid
    LEFT OUTER JOIN tbl_inventory_transactions AS IT ON tbl_products_queue_summary.prd_queue_code = IT.pr_queue_code
WHERE
    tbl_products_queue_multiple.prd_queue_code = :prd_queue_code OR tbl_products_queue.prd_queue_code = :prd_queue_code2
    GROUP BY tbl_products_queue.inv_code
ORDER BY
    productname ASC
    ";
        // tbl_products_queue.deletestatus = 'Active'
        //             AND 
        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);

        $stmt->bindValue(":prd_queue_code2", $data["prd_queue_code"], PDO::PARAM_STR);
        

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllDataBySummary($data)
    {

        if (isset($data["searchvalue"])) {

            $searchValue = $data["searchvalue"];

        } else {

            $searchValue = null;

        }

        // Convert the $data["busunits"] array into an array of role names

        $busunitRoles = array_map(function ($busunit) {

            return $busunit["rolename"];

        }, $data["busunits"]);

        // Convert the array of role names into a comma-separated string

        $busunitRolesString = implode("','", $busunitRoles);

        $pageIndex = $data["pageIndex"] * $data['pageItems'] - $data['pageItems'];

        $pageData = $data["pageItems"];

        if ($searchValue === null) {

            // Construct the SQL query
            $sql = "SELECT
            tbl_products_queue_summary.*,
            lkp_supplier.*,
            orderedBy.name AS orderedbyname,
            CONCAT(T1.firstname, ' ', T1.lastname) AS full_name,
            IF(LEFT(tbl_products_queue_summary.payee, 2) = 'SP', lkp_supplier.supplier_name, payeeName.name) AS payeename,
            IF(t4.particulars IS NULL, '', 'Invoiced') AS invoice_status,
            IF(tbl_products_queue_summary.prd_queue_code = tbl_products_queue_multiple.prd_queue_code_new , tbl_products_queue_multiple.prd_queue_code, '' ) AS prd_queue_code_new,
            -- Concatenate PR approver name
            CONCAT(pr_approver.firstname, ' ', pr_approver.lastname) AS pr_approved_by_name,

            -- Concatenate PO approver name
            CONCAT(po_approver.firstname, ' ', po_approver.lastname) AS po_approved_by_name,
            tbl_products_queue_summary.deletestatus 

        FROM
            tbl_products_queue_summary
        LEFT OUTER JOIN
            lkp_busunits AS orderedBy ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode
        LEFT OUTER JOIN
            lkp_busunits AS payeeName ON tbl_products_queue_summary.payee = payeeName.busunitcode
        LEFT OUTER JOIN
            lkp_supplier ON tbl_products_queue_summary.payee = lkp_supplier.supplier_code
        LEFT OUTER JOIN
            (SELECT DISTINCT particulars FROM tbl_accounting_transactions WHERE deletestatus = 'Active') AS t4 
            ON t4.particulars LIKE CONCAT('%', tbl_products_queue_summary.prd_queue_code, '%')
        LEFT OUTER JOIN 
            tbl_users_global_assignment AS T1 ON tbl_products_queue_summary.usertracker = T1.uuid
        LEFT OUTER JOIN 
            tbl_users_global_assignment AS pr_approver ON tbl_products_queue_summary.pr_approved_by = pr_approver.uuid  -- Join for PR approver
        LEFT OUTER JOIN 
            tbl_users_global_assignment AS po_approver ON tbl_products_queue_summary.po_approved_by = po_approver.uuid  -- Join for PO approver
        LEFT JOIN tbl_products_queue_multiple ON tbl_products_queue_summary.prd_queue_code = tbl_products_queue_multiple.prd_queue_code_new
        WHERE
           (
    tbl_products_queue_summary.deletestatus = 'Active' 
    OR (tbl_products_queue_summary.deletestatus = 'Inactive' AND tbl_products_queue_summary.pr_status = 'Approved')
)
            AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))

        ORDER BY 
            tbl_products_queue_summary.createdtime DESC


                                LIMIT $pageIndex, $pageData";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }
            
            return $data;

        } else {

            // Construct the SQL query

            $sql = "SELECT

                        *,

                        orderedBy.name AS orderedbyname,

                        IF(LEFT(tbl_products_queue_summary.payee,2) = 'SP', lkp_supplier.supplier_name , payeeName.name) AS payeename

                    FROM

                        tbl_products_queue_summary

                            LEFT OUTER JOIN

                        lkp_busunits AS orderedBy ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode

                            LEFT OUTER JOIN

                        lkp_busunits AS payeeName ON tbl_products_queue_summary.payee = payeeName.busunitcode

                            LEFT OUTER JOIN

                        lkp_supplier  ON tbl_products_queue_summary.payee = lkp_supplier.supplier_code

                    WHERE

                        tbl_products_queue_summary.deletestatus = 'Active'

                                AND prd_queue_code LIKE :searchvalue

                                AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":searchvalue", '%' . $searchValue . '%', PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }
           
            return $data;

        }

    }

    public function getAllEditDataBySummary($data)
    {

        // Construct the SQL query

        $sql = "SELECT
                    *,
                    orderedBy.name AS orderedbyname,
                    IF(LEFT(payee, 2) = 'SP',
                        lkp_supplier.supplier_name,
                        payeeName.name) AS payeename
                FROM
                    tbl_products_queue_summary
                        LEFT OUTER JOIN
                    lkp_busunits AS orderedBy ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode
                        LEFT OUTER JOIN
                    lkp_busunits AS payeeName ON tbl_products_queue_summary.payee = payeeName.busunitcode
                        LEFT OUTER JOIN
                    lkp_supplier ON payee = lkp_supplier.supplier_code
                WHERE
                    tbl_products_queue_summary.deletestatus = 'Active'
                        AND prd_queue_code = :prd_queue_code
                ORDER BY tbl_products_queue_summary.createdtime DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT







                    buildcode,







                    lkp_build_of_products.desc,







                    componentname,







                    componentclass,







                    componentquantity







                FROM







                    (SELECT







                        tbl_build_components.build_code AS buildcode,







                            IF(LEFT(tbl_build_components.component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentname,







                            tbl_build_components.component_class AS componentclass,







                            tbl_build_components.qty AS componentquantity







                    FROM







                        tbl_build_components







                    LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code







                    LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code) tbl_build_summary







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

    public function createForUser($user_id, $data, $shortUuid)
    {

        try {

            $this->conn->beginTransaction();


            $yearMonthDay = date("Ymd"); // Get YYYYMMDD format
            
            // Fetch the latest valid prd_queue_code (ignoring incorrect formats)
            $sql = "SELECT prd_queue_code FROM tbl_products_queue_summary 
                    WHERE prd_queue_code REGEXP '^[0-9]{8}[0-9]{6}$' 
                    ORDER BY prd_queue_code DESC LIMIT 1";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $sequence = 1; // Default sequence
            
            if (!empty($result['prd_queue_code'])) {
                $lastCode = $result['prd_queue_code'];
            
                // Extract the last sequence number (last 6 digits)
                if (preg_match('/^\d{8}(\d{6})$/', $lastCode, $matches)) {
                    $lastSequence = intval($matches[1]);
                    $sequence = $lastSequence + 1; // Continue incrementing
                }
            }
            
            $formattedSequence = str_pad($sequence, 6, '0', STR_PAD_LEFT);
            $newPrdQueueCode = $yearMonthDay . $formattedSequence; // Format: YYYYMMDD000001
            
            // Ensure the generated code is unique
            $checkSql = "SELECT COUNT(*) FROM tbl_products_queue_summary WHERE prd_queue_code = :newCode";
            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->execute(['newCode' => $newPrdQueueCode]);
            $count = $checkStmt->fetchColumn();
            
            if ($count > 0) {
                die("Error: Duplicate prd_queue_code detected! Try again."); // Stop execution to prevent looping
            }
            
            // Now $newPrdQueueCode is guaranteed to be unique




            $sql = "INSERT INTO tbl_products_queue ()
            VALUES (default, :prd_queue_code, :inv_code, :cost_per_uom, :uomval,:uom,
            :quantity, :total, :transdate, :orderedby, :payee,
            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $stmt->bindValue(":prd_queue_code", $newPrdQueueCode, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $queueitem["uomval"], PDO::PARAM_STR);

                if($queueitem["uom"] === "KG"){
                    $stmt->bindValue(":quantity", $queueitem["quantity"] * 1000, PDO::PARAM_INT);
                    $stmt->bindValue(":uom", "G", PDO::PARAM_STR);
                } else if($queueitem["uom"] === "L"){
                    $stmt->bindValue(":quantity", $queueitem["quantity"] * 1000, PDO::PARAM_INT);
                    $stmt->bindValue(":uom", "ML", PDO::PARAM_STR);
                } else {
                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);
                $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);
                }

                    // $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                    // $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);

                $stmt->bindValue(":total", $queueitem["total"], PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $queueitem["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":orderedby", $queueitem["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":payee", $queueitem["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Second SQL statement

            $summarysql = "INSERT INTO tbl_products_queue_summary ()
            VALUES (default, :prd_queue_code, :subtotal, :orderedby, :payee,:pr_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
            null,null, :po_status, null, null,null, :production_status, null, null, :billing_status,
            null, null, :delivery_status, null ,null, null, :notes,
            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $summarystmt = $this->conn->prepare($summarysql);

            foreach ($data["queuestatus"] as $queuestatus) {

                $summarystmt->bindValue(":prd_queue_code", $newPrdQueueCode, PDO::PARAM_STR);

                $summarystmt->bindValue(":subtotal", $queuestatus["subtotal"], PDO::PARAM_STR);

                $summarystmt->bindValue(":orderedby", $queuestatus["orderedby"], PDO::PARAM_STR);

                $summarystmt->bindValue(":payee", $queuestatus["payee"], PDO::PARAM_STR);

                $summarystmt->bindValue(":pr_status", $queuestatus["pr_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":po_status", $queuestatus["po_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":production_status", $queuestatus["production_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":billing_status", $queuestatus["billing_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":delivery_status", $queuestatus["delivery_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":notes", $data["notes"], PDO::PARAM_STR);

                $summarystmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $summarystmt->execute();

            }

            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'Inventory', :action, :shortUuid, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    
            $logstmt = $this->conn->prepare($log);
            $action = "Purchase Request";
            if (isset($data["command"])) {
                $action = "Allocate";
            }


            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["queuestatus"][0]["orderedby"], PDO::PARAM_STR);
            $logstmt->bindValue(":action", $action, PDO::PARAM_STR);
            $logstmt->bindValue(":shortUuid", $newPrdQueueCode, PDO::PARAM_STR);
    
            $logstmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function createSpoilage($user_id, $data, $shortUuid)
    {

        try {

            $this->conn->beginTransaction();

            // First SQL statement

            $sql = "INSERT INTO tbl_products_queue ()







            VALUES (default, :prd_queue_code, :inv_code, :cost_per_uom, :uomval,:uom,







            :quantity, :total, :transdate, :orderedby, :payee,







            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $stmt->bindValue(":prd_queue_code", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);

                $stmt->bindValue(":total", $queueitem["total"], PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $queueitem["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":orderedby", $queueitem["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":payee", $queueitem["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Second SQL statement

            $summarysql = "INSERT INTO tbl_products_queue_summary ()

            VALUES (default, :prd_queue_code, :subtotal, :orderedby, :payee,:pr_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), null,:po_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

             null,:production_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :billing_status,

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), 'SPOILAGE', :delivery_status, 'SPOILAGE' ,DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :notes,

            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $summarystmt = $this->conn->prepare($summarysql);

            foreach ($data["queuestatus"] as $queuestatus) {

                $summarystmt->bindValue(":prd_queue_code", $shortUuid, PDO::PARAM_STR);

                $summarystmt->bindValue(":subtotal", $queuestatus["subtotal"], PDO::PARAM_STR);

                $summarystmt->bindValue(":orderedby", $queuestatus["orderedby"], PDO::PARAM_STR);

                $summarystmt->bindValue(":payee", $queuestatus["payee"], PDO::PARAM_STR);

                $summarystmt->bindValue(":pr_status", $queuestatus["pr_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":po_status", $queuestatus["po_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":production_status", $queuestatus["production_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":billing_status", $queuestatus["billing_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":delivery_status", $queuestatus["delivery_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":notes", $data["notes"], PDO::PARAM_STR);

                $summarystmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $summarystmt->execute();

            }

            //Handle deduct products from Ordered From

            $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $class = substr($queueitem["inv_code"], 0, 2);

                if ($class === "RM") {

                    $class = "RM";

                } else {

                    $class = "FG";

                }

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $queueitem["quantity"] * -1, PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $queuestatus["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            //Handle add products from Ordered By

            $sql = "INSERT INTO tbl_inventory_transactions () VALUES

                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,

                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $class = substr($queueitem["inv_code"], 0, 2);

                if ($class === "RM") {

                    $class = "RM";

                } else {

                    $class = "FG";

                }

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $queueitem["quantity"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $queuestatus["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

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

    public function createTransfer($user_id, $data, $shortUuid)
    {

        try {

            $this->conn->beginTransaction();

            // First SQL statement

            $sql = "INSERT INTO tbl_products_queue ()







            VALUES (default, :prd_queue_code, :inv_code, :cost_per_uom, :uomval,:uom,







            :quantity, :total, :transdate, :orderedby, :payee,







            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $stmt->bindValue(":prd_queue_code", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);

                $stmt->bindValue(":total", $queueitem["total"], PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $queueitem["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":orderedby", $queueitem["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":payee", $queueitem["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Second SQL statement

            $summarysql = "INSERT INTO tbl_products_queue_summary ()

            VALUES (default, :prd_queue_code, :subtotal, :orderedby, :payee,:pr_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),  null,:po_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            null,:production_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :billing_status,

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), 'TRANSFER', :delivery_status, 'TRANSFER' ,DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :notes,

            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $summarystmt = $this->conn->prepare($summarysql);

            foreach ($data["queuestatus"] as $queuestatus) {

                $summarystmt->bindValue(":prd_queue_code", $shortUuid, PDO::PARAM_STR);

                $summarystmt->bindValue(":subtotal", $queuestatus["subtotal"], PDO::PARAM_STR);

                $summarystmt->bindValue(":orderedby", $queuestatus["orderedby"], PDO::PARAM_STR);

                $summarystmt->bindValue(":payee", $queuestatus["payee"], PDO::PARAM_STR);

                $summarystmt->bindValue(":pr_status", $queuestatus["pr_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":po_status", $queuestatus["po_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":production_status", $queuestatus["production_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":billing_status", $queuestatus["billing_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":delivery_status", $queuestatus["delivery_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":notes", $data["notes"], PDO::PARAM_STR);

                $summarystmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $summarystmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function patchForUser($user_id, $data, $queueid)
    {

        try {

            $this->conn->beginTransaction();

            //Delete Existing Products

            $deleteProductssql = "DELETE FROM tbl_products_queue WHERE prd_queue_code=:queueid";

            $deleteProductsstmt = $this->conn->prepare($deleteProductssql);

            $deleteProductsstmt->bindValue(":queueid", $queueid, PDO::PARAM_STR);

            $deleteProductsstmt->execute();

            //Delete Existing Product Summary

            $deleteProductSummarysql = "DELETE FROM tbl_products_queue_summary WHERE prd_queue_code=:queueid";

            $deleteProductSummarystmt = $this->conn->prepare($deleteProductSummarysql);

            $deleteProductSummarystmt->bindValue(":queueid", $queueid, PDO::PARAM_STR);

            $deleteProductSummarystmt->execute();

            // First SQL statement

            $sql = "INSERT INTO tbl_products_queue ()
            VALUES (default, :prd_queue_code, :inv_code, :cost_per_uom, :uomval,:uom,
            :quantity, :total, :transdate, :orderedby, :payee,
            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $stmt->bindValue(":prd_queue_code", $queueid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);

                $stmt->bindValue(":total", $queueitem["total"], PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $queueitem["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":orderedby", $queueitem["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":payee", $queueitem["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Second SQL statement

            $summarysql = "INSERT INTO tbl_products_queue_summary ()

            VALUES (default, :prd_queue_code, :subtotal, :orderedby, :payee,:pr_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),  null,:po_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            null,:production_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :billing_status,

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), 'TRANSFER', :delivery_status, 'TRANSFER' ,DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

            DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :notes,

            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $summarystmt = $this->conn->prepare($summarysql);

            foreach ($data["queuestatus"] as $queuestatus) {

                $summarystmt->bindValue(":prd_queue_code", $queueid, PDO::PARAM_STR);

                $summarystmt->bindValue(":subtotal", $queuestatus["subtotal"], PDO::PARAM_STR);

                $summarystmt->bindValue(":orderedby", $queuestatus["orderedby"], PDO::PARAM_STR);

                $summarystmt->bindValue(":payee", $queuestatus["payee"], PDO::PARAM_STR);

                $summarystmt->bindValue(":pr_status", $queuestatus["pr_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":po_status", $queuestatus["po_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":production_status", $queuestatus["production_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":billing_status", $queuestatus["billing_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":delivery_status", $queuestatus["delivery_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":notes", $data["notes"], PDO::PARAM_STR);

                $summarystmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $summarystmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollback();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function deleteForUser($user_id, $data)
    {

        try {

            //Update table summary

            $sql = "UPDATE tbl_products_queue_summary







                SET







                    deletestatus = 'Inactive',







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

            $stmt->execute();

            //Update table details

            $sql = "UPDATE tbl_products_queue







                SET







                    deletestatus = 'Inactive',







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateForUser($user_id, $data)
    {

        if ($data["transactiontype"] === "PR") {

            try {

                $sql = "UPDATE tbl_products_queue_summary
                SET
                    pr_status = :status,
                    pr_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    po_created_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    pr_approved_by = :user_tracker
                WHERE
                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "PO") {

            try {

                $sql = "SELECT orderedby, payee FROM tbl_products_queue_summary WHERE prd_queue_code = :prd_queue_code";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":prd_queue_code", $data["id"], PDO::PARAM_STR);
                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);

                if(substr($result['orderedby'], 0, 2) === 'BU' && substr($result['payee'], 0, 2) === 'SP') {
                    $sql = "UPDATE tbl_products_queue_summary
                            SET
                                production_status = 'Skipped'
                            WHERE
                                prd_queue_code = :id";
                
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);
                    $stmt->execute();
                }
                
                



                $sql = "UPDATE tbl_products_queue_summary

                SET
                    po_status = :status,
                    po_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    po_approved_by = :user_tracker
                WHERE
                    prd_queue_code = :id";

                

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);
                $stmt->execute();
                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Production" && $data["status"] === "In Progress") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    production_status = :status,







                    production_started = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Production" && $data["status"] === "Completed") {

            $this->conn->beginTransaction();

            try {

                $sql = "UPDATE tbl_products_queue_summary
                SET
                    production_status = :status,
                    production_completed = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    usertracker = :user_tracker
                WHERE
                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                // Triggeres when completed

                if ($data["status"] === "Completed") {

                    //Insert components in inventory transactions

                    $sql = "INSERT INTO tbl_inventory_transactions () VALUES
                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,
                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, '0','Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    foreach ($data["buildcomponents"] as $component) {

                        $class = substr($component["component_code"], 0, 2);

                        if ($class === "RM") {

                            $class = "RM";

                        } else {

                            $class = "FG";

                        }

                        $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);

                        $stmt->bindValue(":qty", $component["qty"] * -1, PDO::PARAM_STR);

                        $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"], PDO::PARAM_STR);

                        $stmt->bindValue(":uom_val", $component["uomval"], PDO::PARAM_STR);

                        $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);

                        $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                        $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                        $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $stmt->execute();

                    }

                    //Insert main component in statement transactions

                    $sql = "INSERT INTO tbl_inventory_transactions () VALUES
                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,


                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expiry_date,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    foreach ($data["productsbuilt"] as $product) {

                        $class = substr($product["inv_code"], 0, 2);

                        $level = $product["level"];

                        $class = "FG";

                        $stmt->bindValue(":inv_code", $product["inv_code"], PDO::PARAM_STR);

                        $stmt->bindValue(":qty", $product["quantity"], PDO::PARAM_STR);

                        $stmt->bindValue(":cost_per_uom", $product["cost_per_uom"], PDO::PARAM_STR);

                        $stmt->bindValue(":uom_val", $product["uomval"], PDO::PARAM_STR);

                        $stmt->bindValue(":uom", $product["uom"], PDO::PARAM_STR);

                        $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                        $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                        $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                        $stmt->bindValue(":expiry_date", $product["expiryDate"], PDO::PARAM_STR);

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

        if ($data["transactiontype"] === "Production" && $data["status"] === "Skipped") {

            try {

                $sql = "UPDATE tbl_products_queue_summary

                SET
                    production_status = :status,
                    production_started = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    usertracker = :user_tracker
                WHERE
                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Billing" && $data["status"] === "Skipped") {

            try {

                $sql = "UPDATE tbl_products_queue_summary

                SET

                    billing_status = :status,
                    billing_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    usertracker = :user_tracker

                WHERE
                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }
        
        if ($data["transactiontype"] === "Billing" && $data["status"] === "Unpaid") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    billing_status = :status,







                    billing_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Billing" && ($data["status"] === "Partial" || $data["status"] === "Paid")) {

            try {

                $this->conn->beginTransaction();

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    billing_status = :status,







                    payment_code = :payment_code,







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_code", "PC-" . $data["id"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                //Insert payment details in statement transactions

                $sql = "INSERT INTO tbl_internal_billing_payments () VALUES







                    (default, :prd_queue_code, :payments, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    :payment_ref, :mop,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":prd_queue_code", "PC-" . $data["id"], PDO::PARAM_STR);

                $stmt->bindValue(":payments", $data["paymentdata"]["payment_amount"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_ref", $data["paymentdata"]["payment_ref"], PDO::PARAM_STR);

                $stmt->bindValue(":mop", $data["paymentdata"]["mop"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

                $this->conn->commit();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                $this->conn->rollBack();

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

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
    public function createNewPr($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $yearMonthDay = date("Ymd"); // Get YYYYMMDD format

            // Fetch the latest valid prd_queue_code (ignoring incorrect formats)
            $sql = "SELECT prd_queue_code FROM tbl_products_queue_summary 
                    WHERE prd_queue_code REGEXP '^[0-9]{8}[0-9]{6}$' 
                    ORDER BY prd_queue_code DESC LIMIT 1";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            $sequence = 1; // Default sequence

            if (!empty($result['prd_queue_code'])) {
                $lastCode = $result['prd_queue_code'];

                // Extract the last sequence number (last 6 digits)
                if (preg_match('/^\d{8}(\d{6})$/', $lastCode, $matches)) {
                    $lastSequence = intval($matches[1]);
                    $sequence = $lastSequence + 1; // Continue incrementing
                }
            }

            $formattedSequence = str_pad($sequence, 6, '0', STR_PAD_LEFT);
            $newPrdQueueCode = $yearMonthDay . $formattedSequence; // Format: YYYYMMDD000001

            // First SQL statement: Compute total cost
            $sql = "SELECT SUM(total) as total FROM tbl_products_queue WHERE inv_code = :inv_code AND prd_queue_code = :prd_queue_code";
            $stmt1 = $this->conn->prepare($sql);

            $totalCost = 0;
            foreach ($data["newPr"] as $queueitem) {
                $stmt1->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);
                $stmt1->bindValue(":prd_queue_code", $queueitem["prd_queue_code"], PDO::PARAM_STR);
                $stmt1->execute();

                if ($row = $stmt1->fetch(PDO::FETCH_ASSOC)) {
                    $totalCost += !empty($row['total']) ? $row['total'] : 0;
                }
            }

            // Update query
            $updateSql = "UPDATE tbl_products_queue SET prd_queue_code = :new_prd_queue_code WHERE prd_queue_code = :old_prd_queue_code AND inv_code = :inv_code";
            $stmt2 = $this->conn->prepare($updateSql);

            foreach ($data["newPr"] as $queueitem) {
                $stmt2->bindValue(":new_prd_queue_code", $newPrdQueueCode , PDO::PARAM_STR);
                $stmt2->bindValue(":old_prd_queue_code", $queueitem["prd_queue_code"], PDO::PARAM_STR);
                $stmt2->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);
                $stmt2->execute();
            }

            // Check if summary exists
            $summaryCheckSql = "SELECT * FROM tbl_products_queue_summary WHERE prd_queue_code = :prd_queue_code";
            $stmt3 = $this->conn->prepare($summaryCheckSql);
            
            // Use the first item's prd_queue_code
            $firstQueueItem = $data["newPr"][0] ?? null;
            if (!$firstQueueItem) {
                throw new Exception("No queue items found in newPr.");
            }

            $stmt3->bindValue(":prd_queue_code", $firstQueueItem["prd_queue_code"], PDO::PARAM_STR);
            $stmt3->execute();
            

            $dataChecksql = $stmt3->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($dataChecksql)) {
                $firstRow = $dataChecksql[0]; // Get first record
            } else {
                throw new Exception("No matching summary data found.");
            }

            $toMinus = $firstRow["subtotal"] - $totalCost;

            $summaryupdatetotalSql = "UPDATE tbl_products_queue_summary SET subtotal = :newtotal  WHERE prd_queue_code = :prd_queue_code";
            
            $stmtupdate = $this->conn->prepare($summaryupdatetotalSql);
            
            $stmtupdate->bindValue(":prd_queue_code", $firstQueueItem["prd_queue_code"], PDO::PARAM_STR);
            
            $stmtupdate->bindValue(":newtotal", $toMinus, PDO::PARAM_STR);
            
            $stmtupdate->execute();   

            // Insert new summary if necessary
            $summaryInsertSql = "INSERT INTO tbl_products_queue_summary (
                prd_queue_code, subtotal, orderedby, payee, pr_status, pr_created_date,pr_approved_date,
                po_status, production_status, billing_status, delivery_status, notes, deletestatus, usertracker, createdtime
            ) VALUES (
                :prd_queue_code, :subtotal, :orderedby, :payee, 'Partition',DATE_ADD(NOW(), INTERVAL 8 HOUR), DATE_ADD(NOW(), INTERVAL 8 HOUR),
                :po_status, :production_status, :billing_status, :delivery_status, :notes, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)
            )";

            $stmt4 = $this->conn->prepare($summaryInsertSql);
            $stmt4->bindValue(":prd_queue_code", $newPrdQueueCode, PDO::PARAM_STR);
            $stmt4->bindValue(":subtotal", $totalCost, PDO::PARAM_STR);
            $stmt4->bindValue(":orderedby", $firstRow["orderedby"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":payee", $firstRow["payee"] ?? '', PDO::PARAM_STR);
            // $stmt4->bindValue(":pr_status", 'Approved' ?? '', PDO::PARAM_STR);
            // $stmt4->bindValue(":pr_approved_date", 'Approved' ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":po_status", $firstRow["po_status"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":production_status", $firstRow["production_status"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":billing_status", $firstRow["billing_status"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":delivery_status", $firstRow["delivery_status"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":notes", $firstRow["notes"] ?? '', PDO::PARAM_STR);
            $stmt4->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt4->execute();

             $summaryInsertSqlmultiple = "INSERT INTO tbl_products_queue_multiple (seq,prd_queue_code,prd_queue_code_new,deletestatus,datecreated) 
             VALUES (default,:prd_queue_code,:prd_queue_code_new,'Active',DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt5 = $this->conn->prepare($summaryInsertSqlmultiple);
            $stmt5->bindValue(":prd_queue_code_new", $newPrdQueueCode, PDO::PARAM_STR);
            $stmt5->bindValue(":prd_queue_code",  $firstQueueItem["prd_queue_code"], PDO::PARAM_STR);
           
            $stmt5->execute();

            // Insert log
            // $logSql = "INSERT INTO tbl_logs (module, busunitcode, category, action, reference, user_id, status, timestamp)
            // VALUES ('LIGHTEM', :busunitcode, 'Inventory', :action, :prd_queue_code, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            // $logstmt = $this->conn->prepare($logSql);
            // $action = isset($data["command"]) ? "Allocate" : "Purchase Request";

            // $busunitcode = $data["queuestatus"][0]["orderedby"] ?? null;
            // if ($busunitcode === null) {
            //     throw new Exception("Missing orderedby in queuestatus.");
            // }

            // $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            // $logstmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
            // $logstmt->bindValue(":action", $action, PDO::PARAM_STR);
            // $logstmt->bindValue(":prd_queue_code", $firstQueueItem["prd_queue_code"], PDO::PARAM_STR);
            // $logstmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }
    public function updatesupplier($user_id, $data)
    {
       try{
            $this->conn->beginTransaction();

            $sql = "UPDATE tbl_products_queue_summary SET payee = :payee, usertracker = :usertracker WHERE prd_queue_code = :prd_queue_code ";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":payee", $data["payee"], PDO::PARAM_STR);
            $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            $sql2 = "UPDATE tbl_products_queue SET payee = :payee , usertracker = :usertracker WHERE prd_queue_code = :prd_queue_code ";
            $stmt2 = $this->conn->prepare($sql2);
            $stmt2->bindValue(":payee", $data["payee"], PDO::PARAM_STR);
            $stmt2->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);
            $stmt2->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt2->execute();
          $this->conn->commit();
          echo json_encode(["message" => "Success"]);
       } catch (Exception $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }
}
