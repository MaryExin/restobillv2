<?php



class CustomerDataGateway

{



    private $conn;



    public function __construct(Database $database)

    {



        $this->conn = $database->getConnection();



    }



    public function getbyPageData($pageIndex, $pageData)

    {



        $sql = "SELECT * FROM tbl_employees ORDER BY seq DESC LIMIT $pageIndex, $pageData";



        $stmt = $this->conn->prepare($sql);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }

        public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_customer_details Where deletestatus = 'Active' AND customername  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

       public function ExcelGetCustomers()
    {

        $sql = "SELECT * FROM tbl_customer_details WHERE deletestatus = 'Active' ORDER BY customername ASC";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }



    public function getAllData()

    {



        $sql = "SELECT * FROM tbl_employees ORDER BY position ASC, firstname ASC";



        $stmt = $this->conn->prepare($sql);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getCustomerDetails($data)

    {

        try {

            $sql = "SELECT * FROM tbl_customer_details WHERE deletestatus = 'Active'

            AND customer_id = :customer_id;";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);

            $stmt->execute();



            $customerData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $customerData[] = $row;

            }



            $sql = "SELECT tbl_user_roles.uuid, tbl_user_roles.userid, tbl_user_roles.rolename,

                tbl_user_roles.roleclass, tbl_user_roles.role_description , lkp_busunits.name

                FROM tbl_user_roles

                LEFT OUTER JOIN lkp_busunits ON  tbl_user_roles.rolename = lkp_busunits.busunitcode

                WHERE tbl_user_roles.deletestatus = 'Active'

                AND tbl_user_roles.userid = :customer_id ;";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);

            $stmt->execute();



            $roleData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $roleData[] = $row;

            }



            return ["customerdata" => $customerData, "roledata" => $roleData];

        } catch (PDOException $e) {

            // Handle database errors

            // For example, you can log the error or throw a custom exception

            // Log error

            error_log("Database error: " . $e->getMessage());

            // Or throw a custom exception

            throw new Exception("Database error occurred");

        } catch (Exception $e) {

            // Handle other types of errors

            // For example, you can log the error or re-throw it

            // Log error

            error_log("Error: " . $e->getMessage());

            // Re-throw the exception to let the caller handle it

            throw $e;

        }



    }



    public function getCustomersDetailsForId($data)

    {



        $sql = "SELECT *  FROM `tbl_customer_details` WHERE deletestatus = 'Active'

            AND customername LIKE :name ;";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":name", '%' . $data["name"] . '%', PDO::PARAM_STR);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getInfiniteData($page, $pageIndex, $pageData, $search)

    {



        $sql = "SELECT * FROM tbl_customer_details

            WHERE deletestatus = 'Active'

            AND customername LIKE :search

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



    public function getCustomerHistory($data)

    {



        $sql = "SELECT tbl_sales_transactions.transdate, tbl_sales_transactions.inv_code,

                IF(LEFT(tbl_sales_transactions.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS productname,

                IF(LEFT(tbl_sales_transactions.inv_code,2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

                tbl_sales_transactions.qty, tbl_sales_transactions.cost_per_uom ,

                tbl_sales_transactions.uomval, tbl_sales_transactions.uom, tbl_sales_transactions.total_cost,

                tbl_sales_transactions.srp, tbl_sales_transactions.total_sales, tbl_sales_transactions.vat,

                tbl_sales_transactions.tax_type, tbl_sales_transactions.discount_type_id, tbl_sales_transactions.discount_amount,

                tbl_sales_transactions.sales_id,

                tbl_sales_summary.customer_id

                FROM tbl_sales_transactions

                    LEFT OUTER JOIN tbl_sales_summary ON tbl_sales_transactions.sales_id = tbl_sales_summary.sales_id

                    LEFT OUTER JOIN	lkp_raw_mats ON tbl_sales_transactions.inv_code = lkp_raw_mats.mat_code

                    LEFT OUTER JOIN	lkp_build_of_products ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code

                WHERE tbl_sales_transactions.deletestatus = 'Active'

                AND tbl_sales_summary.customer_id = :customerid

                ORDER BY tbl_sales_transactions.transdate DESC";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }

    public function editCustomerDetails($user_id, $data)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_customer_details 
                    WHERE customername = :customername AND
                    branchname = :branchname AND
                    tin  = :tin AND
                    address  = :address AND
                    contact_no  = :contactno AND
                    email  = :email AND
                    otherinfo  = :otherinfo AND
                    customer_id <> :customerid AND 
                    deletestatus = 'Active'";

    $checkforduplistmt = $this->conn->prepare($checkforduplisql);

    $checkforduplistmt->bindValue(":customername", $data["customername"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":branchname", $data["branchname"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":tin", $data["tin"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":address", $data["address"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":contactno", $data["contactno"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":email", $data["email"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":otherinfo", $data["otherinfo"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);
   
    $checkforduplistmt->execute();
   
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "UPDATE tbl_customer_details
                SET
                    customername = :customername,
                    branchname = :branchname,
                    tin  = :tin,
                    address  = :address,
                    contact_no  = :contactno,
                    email  = :email,
                    otherinfo  = :otherinfo
                WHERE
                    customer_id  = :customerid
                AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":customername", $data["customername"], PDO::PARAM_STR);
        $stmt->bindValue(":branchname", $data["branchname"], PDO::PARAM_STR);
        $stmt->bindValue(":tin", $data["tin"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);
        $stmt->bindValue(":contactno", $data["contactno"], PDO::PARAM_STR);
        $stmt->bindValue(":email", $data["email"], PDO::PARAM_STR);
        $stmt->bindValue(":otherinfo", $data["otherinfo"], PDO::PARAM_STR);
        $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    
    public function deleteCustomerDetails($user_id, $data)
    {
        $sql = "UPDATE tbl_customer_details
                SET
                    deletestatus = 'Inactive'
                WHERE
                    customer_id  = :customerid
                AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);
    }
    

}

