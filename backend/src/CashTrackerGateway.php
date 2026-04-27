<?php

class CashTrackerGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_sales_type  WHERE deletestatus = 'Active' ORDER BY description ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getPendingSales()
    {

        $sql = "SELECT tbl_cash_sales_summary_tracker.cash_trans_id, tbl_cash_sales_summary_tracker.transdate,
            lkp_busunits.name AS busunitname, CONCAT(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.lastname) AS username
            FROM tbl_cash_sales_summary_tracker
            LEFT OUTER JOIN lkp_busunits ON tbl_cash_sales_summary_tracker.busunitcode = lkp_busunits.busunitcode
            LEFT OUTER JOIN tbl_users_global_assignment ON tbl_cash_sales_summary_tracker.usertracker = tbl_users_global_assignment.uuid
            WHERE tbl_cash_sales_summary_tracker.closing_time = 0
            AND tbl_cash_sales_summary_tracker.deletestatus = 'Active'
            ORDER BY tbl_cash_sales_summary_tracker.transdate ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getPendingSalesFigures($data)
    {

        // Cash Opening Balance

        $sql = "SELECT cash_opening_balance FROM tbl_cash_sales_summary_tracker
                WHERE cash_trans_id = :cashtransid
                AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $cashOpeningBalance = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $cashOpeningBalance[] = $row;

        }

        // Net Sales

        $sql = "SELECT IFNULL(SUM(net_sales),0) AS net_sales
                FROM tbl_sales_summary
                WHERE cash_trans_id = :cashtransid
                AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $netSales = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $netSales[] = $row;

        }

        // GET STORES TO FILTER

        $sql = "SELECT sales_id
            FROM tbl_sales_summary
            WHERE cash_trans_id = :cashtransid
            AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $salesIds = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $salesIds[] = $row;

        }

        // Convert the $data["busunits"] array into an array of role names

        // Extract sales_ids from $salesIds into an array
        $salesIdsArray = array_column($salesIds, 'sales_id');

        // Convert the array of sales_ids into a comma-separated string
        $salesIdsFilterString = "'" . implode("','", $salesIdsArray) . "'";

        // OtherMOpPayment On Credit Paid

        $sql = "SELECT IFNULL(SUM(amount),0) AS othermopbal
                FROM tbl_mop_summary
                WHERE sales_id IN ($salesIdsFilterString)
                AND (mop_id = 'MP-52d754926a3c' AND payment_status = 'Paid')";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $creditSalesPaid = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $creditSalesPaid[] = $row;

        }

        // OtherMOpPayment On Credit Unpaid

        $sql = "SELECT IFNULL(SUM(amount),0) AS othermopbal
                FROM tbl_mop_summary
                WHERE sales_id IN ($salesIdsFilterString)
                AND mop_id <> 'MP-60b729686a4c'
                AND (mop_id <> 'MP-52d754926a3c' AND payment_status = 'Paid')
                OR (mop_id = 'MP-52d754926a3c' AND payment_status = 'Unpaid')";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $creditSalesUnPaid = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $creditSalesUnPaid[] = $row;

        }

        // PCF Expense

        $sql = "SELECT IFNULL(SUM(amount),0) AS pcftotal
            FROM tbl_pcf
            WHERE cash_trans_id = :cashtransid
            AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $pcfTotal = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $pcfTotal[] = $row;

        }

        return ["cashopeningbalance" => $cashOpeningBalance,
            "netSales" => $netSales,
            "othermoponcreditpaid" => $creditSalesPaid,
            "othermoponcreditunpaid" => $creditSalesUnPaid,
            "pcftotal" => $pcfTotal,
        ];

    }

    public function getFilteredData()
    {

        $sql = "SELECT * FROM lkp_busunits WHERE class IN ('DEPARTMENT', 'COMMISSARY') ORDER BY class ASC, name ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getFilteredDataByStores()
    {

        $sql = "SELECT * FROM lkp_busunits WHERE class IN ('STORE') ORDER BY class ASC, name ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_busunits ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getForUser($user_id): array
    {
        
        $sql = "SELECT *



        FROM tbl_cash_sales_summary_tracker



        WHERE  transdate = :transdate



        AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getCashOpening($user_id, $data)
    {
        $sql = "SELECT * FROM tbl_cash_sales_summary_tracker
                WHERE transdate = :transdate
                AND deletestatus = 'Active'
                AND poscode = :poscode";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->bindValue(":poscode", $data["poscode"], PDO::PARAM_STR);

        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

      echo json_encode($data);
    }

    public function getCashClosing($user_id, $data)
    {

        $sql = "SELECT * FROM tbl_sales_summary WHERE
                transdate = :transdate
                AND deletestatus = 'Active'
                AND busunitcode = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

      echo json_encode($data);

    }

    public function createForUser($user_id, $data)
    {

        if ($data["type"] === "cashOpening") {

            $sql = "INSERT INTO tbl_cash_sales_summary_tracker () VALUES (default, CONCAT('CT-',shortUUID()),

                DATE_ADD(NOW(), INTERVAL 8 HOUR), 0, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :cashbalance, 0, 0, 0, :busunitcode,
                :poscode, 'UNDEPOSITED', 'TBD', 0, 'TBD',
                :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":cashbalance", $data["cashbalance"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->bindValue(":poscode", $data["poscode"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

        }

    }

    public function closePendingSales($user_id, $data)
    {

        if ($data["type"] === "cashOpening") {

            $sql = "INSERT INTO tbl_cash_sales_summary_tracker () VALUES (default, CONCAT('CT-',shortUUID()),

                DATE_ADD(NOW(), INTERVAL 8 HOUR), 0, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :cashbalance, 0, 0, 0, 0,

                'UNDEPOSITED', 'TBD', 0, 'TBD',
                :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":cashbalance", $data["cashbalance"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

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
