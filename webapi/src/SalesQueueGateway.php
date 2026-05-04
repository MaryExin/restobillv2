<?php

class SalesQueueGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /**
     * Create a new sales transaction, quotation and queue history entries
     *
     * @param string $user_id  The ID of the user creating this transaction
     * @param array  $data     The sales payload object
     */
    public function createForUser($user_id, array $data)
    {
        try {
            $this->conn->beginTransaction();

            // 1. Make sure PHP is in Manila time
            date_default_timezone_set('Asia/Manila');
            $now       = new DateTime();
            $dateCode  = $now->format('Ymd');   // e.g. "20250512"
            $todayDate = $now->format('Y-m-d'); // for binding in SQL

            // 2. Fetch the highest 6-digit sequence used today
            //    We assume tbl_sales_summary.sales_id is like "SSM-20250512000001"
            $sql = <<<SQL
              SELECT
                IFNULL(
                  MAX(
                    CAST( SUBSTRING(sales_id, INSTR(sales_id, '-') + 1 + 8, 6 ) AS UNSIGNED)
                  ),
                  0
                ) AS max_seq
              FROM tbl_sales_summary
              WHERE DATE(transdate) = :today
              SQL;

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':today', $todayDate, PDO::PARAM_STR);
            $stmt->execute();
            $maxSeq = (int) $stmt->fetch(PDO::FETCH_ASSOC)['max_seq'];

            // 3. Next sequence and overflow guard
            $sequence = $maxSeq + 1;
            if ($sequence > 999999) {
                throw new RuntimeException("Daily sequence limit (999999) exceeded for {$todayDate}");
            }

                                                                   // 4. Pad to 6 digits, build short code, then all your IDs
            $seqPadded = str_pad($sequence, 6, '0', STR_PAD_LEFT); // e.g. "000001", "001001", etc.
            $shortUuid = $dateCode . $seqPadded;                   // e.g. "20250512000001"

            $salesId      = "SSM-{$shortUuid}";
            $quotId       = "SQ-{$shortUuid}";
            $salesTransId = "STS-{$shortUuid}";
            $mopTransId   = "MPS-{$shortUuid}";
            $discountId   = "DCS-{$shortUuid}";
            $cashTransId  = $data['cashtrackingid'] ?? '';

            // 1) Insert into tbl_sales_summary
            $sql = "INSERT INTO tbl_sales_summary ()
                    VALUES (
                      default,
                      :sales_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      :busunitcode,
                      :poscode,
                      :sales_trans_id,
                      :cash_trans_id,
                      :mop_trans_id,
                      :sales_type_id,
                      :discount_id,
                      :total_sales,
                      :total_vat,
                      :total_discounts,
                      :total_other_mop,
                      :net_sales,
                      :cash_received,
                      :change,
                      :net_cash,
                      :gender,
                      :age_bracket,
                      :customerid,
                      :attendantid,
                      :description,
                      :user_tracker,
                      'Queued',
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $stmt = $this->conn->prepare($sql);
            $ts   = $data['transactionsummary'];
            // $netCash = (float)$ts['cash_received'] - (float)$ts['change'];

            $stmt->bindValue(':sales_id', $salesId, PDO::PARAM_STR);
            $stmt->bindValue(':busunitcode', $ts['busunit'], PDO::PARAM_STR);
            $stmt->bindValue(':poscode', $ts['poscode'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_trans_id', $salesTransId, PDO::PARAM_STR);
            $stmt->bindValue(':cash_trans_id', $cashTransId, PDO::PARAM_STR);
            $stmt->bindValue(':mop_trans_id', $mopTransId, PDO::PARAM_STR);
            $stmt->bindValue(':sales_type_id', $ts['type'], PDO::PARAM_STR);
            $stmt->bindValue(':discount_id', $discountId, PDO::PARAM_STR);
            $stmt->bindValue(':total_sales', $ts['total_sales'], PDO::PARAM_STR);
            $stmt->bindValue(':total_vat', $ts['total_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':total_discounts', $ts['total_discounts'], PDO::PARAM_STR);
            $stmt->bindValue(':total_other_mop', $ts['total_other_mop'], PDO::PARAM_STR);
            $stmt->bindValue(':net_sales', $ts['net_sales'], PDO::PARAM_STR);
            $stmt->bindValue(':cash_received', 0, PDO::PARAM_STR);
            $stmt->bindValue(':change', 0, PDO::PARAM_STR);
            $stmt->bindValue(':net_cash', 0, PDO::PARAM_STR);
            $stmt->bindValue(':gender', $data['gender'], PDO::PARAM_STR);
            $stmt->bindValue(':age_bracket', $data['age_bracket'] ?? $data['age'], PDO::PARAM_STR);
            $stmt->bindValue(':customerid', $data['customerid'], PDO::PARAM_STR);
            $stmt->bindValue(':attendantid', $data['attendantid'], PDO::PARAM_STR);
            $stmt->bindValue(':description', $data['particulars'], PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // 2) Insert into tbl_sales_quotation
            $sql = "INSERT INTO tbl_sales_quotation ()
                    VALUES (
                      default,
                      :sales_quotation_id,
                      :busunitcode,
                      :inv_code,
                      :uomval,
                      :uom,
                      :qty,
                      :cost_per_uom,
                      :total_cost,
                      :srp,
                      :sales_wo_vat,
                      :vat,
                      :sales_w_vat,
                      :discount_amount,
                      :net_sales,
                      :tax,
                      :shipping_fee,
                      :other_charges,
                      :total_bill,
                      :tax_type,
                      :discount_type_id,
                      :sales_id,
                      :user_tracker,
                      'Quotation Drafted',
                      'Active',
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $qstmt = $this->conn->prepare($sql);
            foreach ($data['salessummary'] as $item) {
                $qstmt->bindValue(':sales_quotation_id', $quotId, PDO::PARAM_STR);
                $qstmt->bindValue(':busunitcode', $data['transactionsummary']['busunit'], PDO::PARAM_STR);
                $qstmt->bindValue(':inv_code', $item['inv_code'], PDO::PARAM_STR);
                $qstmt->bindValue(':uomval', $item['uomval'], PDO::PARAM_INT);
                $qstmt->bindValue(':uom', $item['uom'], PDO::PARAM_STR);
                $qstmt->bindValue(':qty', $item['qty'], PDO::PARAM_INT);
                $qstmt->bindValue(':cost_per_uom', $item['cost_per_uom'], PDO::PARAM_STR);
                $qstmt->bindValue(':total_cost', $item['total_cost'], PDO::PARAM_STR);
                $qstmt->bindValue(':srp', $item['srp'], PDO::PARAM_STR);
                $qstmt->bindValue(':sales_wo_vat', $item['total_sales'] - $item['vat'], PDO::PARAM_STR);
                $qstmt->bindValue(':vat', $item['vat'], PDO::PARAM_STR);
                $qstmt->bindValue(':sales_w_vat', $item['total_sales'], PDO::PARAM_STR);
                $qstmt->bindValue(':discount_amount', 0, PDO::PARAM_STR);
                $qstmt->bindValue(':net_sales', $item['total_sales'] - $item['vat'], PDO::PARAM_STR);
                $qstmt->bindValue(':tax', 0, PDO::PARAM_STR);
                $qstmt->bindValue(':shipping_fee', 0, PDO::PARAM_STR);
                $qstmt->bindValue(':other_charges', 0, PDO::PARAM_STR);
                $qstmt->bindValue(':total_bill', $item['total_sales'], PDO::PARAM_STR);
                $qstmt->bindValue(':tax_type', $item['tax_type'], PDO::PARAM_STR);
                $qstmt->bindValue(':discount_type_id', 'NA', PDO::PARAM_STR);
                $qstmt->bindValue(':sales_id', $salesId, PDO::PARAM_STR);
                $qstmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
                $qstmt->execute();
            }

            //Insert discount summary

            if (! empty($data['discountsummary']) && is_array($data['discountsummary'])) {
                $sql = "INSERT INTO tbl_sales_quotation ()
                    VALUES (
                      default,
                      :sales_quotation_id,
                      :busunitcode,
                      :inv_code,
                      :uomval,
                      :uom,
                      :qty,
                      :cost_per_uom,
                      :total_cost,
                      :srp,
                      :sales_wo_vat,
                      :vat,
                      :sales_w_vat,
                      :discount_amount,
                      :net_sales,
                      :tax,
                      :shipping_fee,
                      :other_charges,
                      :total_bill,
                      :tax_type,
                      :discount_type_id,
                      :sales_id,
                      :user_tracker,
                      'Quotation Drafted',
                      'Active',
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
                $dstmt = $this->conn->prepare($sql);

                foreach ($data['discountsummary'] as $item) {
                    $dstmt->bindValue(':sales_quotation_id', $quotId, PDO::PARAM_STR);
                    $dstmt->bindValue(':busunitcode', $data['transactionsummary']['busunit'], PDO::PARAM_STR);
                    $dstmt->bindValue(':inv_code', $item['inv_code'], PDO::PARAM_STR);
                    $dstmt->bindValue(':uomval', $item['uomval'], PDO::PARAM_INT);
                    $dstmt->bindValue(':uom', $item['uom'], PDO::PARAM_STR);
                    $dstmt->bindValue(':qty', $item['qty'], PDO::PARAM_INT);
                    $dstmt->bindValue(':cost_per_uom', $item['cost_per_uom'], PDO::PARAM_STR);
                    $dstmt->bindValue(':total_cost', $item['total_cost'], PDO::PARAM_STR);
                    $dstmt->bindValue(':srp', $item['srp'], PDO::PARAM_STR);
                    $dstmt->bindValue(':sales_wo_vat', $item['total_sales'] - $item['vat'], PDO::PARAM_STR);
                    $dstmt->bindValue(':vat', $item['vat'], PDO::PARAM_STR);
                    $dstmt->bindValue(':sales_w_vat', $item['total_sales'], PDO::PARAM_STR);
                    $dstmt->bindValue(':discount_amount', $item['discount_value'], PDO::PARAM_STR);
                    $dstmt->bindValue(':net_sales', $item['total_sales'] - $item['vat'] - $item['discount_value'], PDO::PARAM_STR);
                    $dstmt->bindValue(':tax', 0, PDO::PARAM_STR);
                    $dstmt->bindValue(':shipping_fee', 0, PDO::PARAM_STR);
                    $dstmt->bindValue(':other_charges', 0, PDO::PARAM_STR);
                    $dstmt->bindValue(':total_bill', $item['total_sales'], PDO::PARAM_STR);
                    $dstmt->bindValue(':tax_type', $item['tax_type'], PDO::PARAM_STR);
                    $dstmt->bindValue(':discount_type_id', $item['discount_id'], PDO::PARAM_STR);
                    $dstmt->bindValue(':sales_id', $salesId, PDO::PARAM_STR);
                    $dstmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
                    $dstmt->execute();
                }
            }

            // 3) Insert into tbl_sales_queue_history
            $sql = "INSERT INTO tbl_sales_queue_history ()
                    VALUES (
                      default,
                      :sales_quotation_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      'Quotation Drafted',
                      'Active',
                      :user_tracker,
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $hstmt = $this->conn->prepare($sql);
            $hstmt->bindValue(':sales_quotation_id', $quotId, PDO::PARAM_STR);
            $hstmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $hstmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'Success', 'sales_id' => $salesId, 'quotation_id' => $quotId, 'queue_id' => $shortUuid]);

        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function getQueuedSalesTransactions($user_id, array $data)
    {
        try {
            $sql = "SELECT
                        t1.*, t2.*
                    FROM
                        tbl_sales_summary AS t1
                            LEFT JOIN
                        tbl_customer_details AS t2 ON t1.customer_id = t2.customer_id
                    WHERE t1.deletestatus = 'Queued'
                    AND t1.busunitcode = :busunitcode
                    ORDER BY t1.createdtime DESC";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':busunitcode', $data['busunitcode'], PDO::PARAM_STR);
            $stmt->execute();

            $result = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $result[] = $row;

            }

            echo json_encode($result);

        } catch (PDOException $e) {
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function getSalesDataPerQuotation($user_id, array $data)
    {
        try {
            $sql = "SELECT
                        t1.*, t2.desc
                    FROM
                        tbl_sales_quotation AS t1
                            LEFT OUTER JOIN
                        lkp_build_of_products AS t2 ON t1.inv_code = t2.build_code
                    WHERE
                        t1.sales_id = :salesid
                            AND t1.deletestatus = 'Active'
                            ORDER BY t2.desc ASC;";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':salesid', $data['salesid'], PDO::PARAM_STR);
            $stmt->execute();

            $result = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $result[] = $row;

            }

            echo json_encode($result);

        } catch (PDOException $e) {
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function getSalesDataPerOrder($user_id, array $data)
    {
        try {
            $sql = "SELECT
                        t1.*, t2.desc
                    FROM
                        tbl_sales_order AS t1
                            LEFT OUTER JOIN
                        lkp_build_of_products AS t2 ON t1.inv_code = t2.build_code
                    WHERE
                        t1.sales_id = :salesid
                            AND t1.deletestatus = 'Active'
                            ORDER BY t2.desc ASC;";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':salesid', $data['salesid'], PDO::PARAM_STR);
            $stmt->execute();

            $result = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $result[] = $row;

            }

            echo json_encode($result);

        } catch (PDOException $e) {
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function getSalesFulfillmentData($user_id, array $data)
    {
        if($data['action'] === 'initial'){
            try {
                $sql = "WITH
                        ending_balance AS (
                            SELECT
                                t.inv_code AS inv_code,
                                SUM(t.qty) AS ending_balance
                            FROM tbl_inventory_transactions t
                            WHERE
                                t.deletestatus  = 'Active'
                                AND t.busunitcode = :busunitcodeone
                                AND t.trans_date <= DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                            GROUP BY t.inv_code
                        ),
    
                        pending_delivery AS (
                            SELECT
                                pq.inv_code AS inv_code,
                                SUM(
                                    CASE WHEN pq.orderedby = :busunitcodetwo
                                        THEN pq.quantity
                                        ELSE 0
                                    END
                                ) AS pending_delivery_add,
                                SUM(
                                    CASE WHEN pqs.payee = :busunitcodethree
                                        THEN pq.quantity
                                        ELSE 0
                                    END
                                ) AS pending_delivery_deduct
                            FROM tbl_products_queue pq
                            JOIN tbl_products_queue_summary pqs
                                ON pq.prd_queue_code = pqs.prd_queue_code
                            WHERE
                                pqs.delivery_status <> 'Delivered'
                                AND pqs.po_status      = 'Approved'
                            GROUP BY pq.inv_code
                        ),
    
                        pending_production AS (
                            SELECT
                                COALESCE(bc.component_code, pq.inv_code) AS inv_code,
                                SUM(
                                    CASE WHEN pq.orderedby = :busunitcodefour
                                        THEN pq.quantity * COALESCE(bc.qty,1)
                                        ELSE 0
                                    END
                                ) AS pending_production_add,
                                SUM(
                                    CASE WHEN pqs.payee = :busunitcodefive
                                        THEN pq.quantity * COALESCE(bc.qty,1)
                                        ELSE 0
                                    END
                                ) AS pending_production_deduct
                            FROM tbl_products_queue pq
                            JOIN tbl_products_queue_summary pqs
                                ON pq.prd_queue_code = pqs.prd_queue_code
                            LEFT JOIN tbl_build_components bc
                                ON pq.inv_code = bc.build_code
                            WHERE
                                pqs.production_status = 'In Progress'
                                AND pqs.po_status      = 'Approved'
                            GROUP BY COALESCE(bc.component_code, pq.inv_code)
                        ),
    
                        ending_items AS (
                            SELECT
                                eb.inv_code,
                                -- net on‐hand after pending
                                COALESCE(eb.ending_balance,0)
                                + COALESCE(pd.pending_delivery_add,0)
                                - COALESCE(pd.pending_delivery_deduct,0)
                                + COALESCE(pp.pending_production_add,0)
                                - COALESCE(pp.pending_production_deduct,0)
                                AS ending_with_pending_items
                            FROM ending_balance eb
                            LEFT JOIN pending_delivery pd
                                ON pd.inv_code = eb.inv_code
                            LEFT JOIN pending_production pp
                                ON pp.inv_code = eb.inv_code
                        )
    
                        SELECT
                            f.*,
                            prod.`desc`,
                            -- original ending balance:
                            ROUND(COALESCE(ebalance.ending_balance, 0),2)        AS ending_items,
                            -- net balance after pending:
                            ROUND(COALESCE(ei.ending_with_pending_items, 0),2)  AS ending_with_pending_items
                        FROM tbl_sales_fulfillment AS f
                        LEFT JOIN lkp_build_of_products AS prod
                            ON f.inv_code = prod.build_code
                        -- bring in raw ending balance:
                        LEFT JOIN ending_balance AS ebalance
                            ON f.inv_code = ebalance.inv_code
                        -- bring in net pending:
                        LEFT JOIN ending_items   AS ei
                            ON f.inv_code = ei.inv_code
                        WHERE
                            f.sales_id      = :salesid
                            AND f.deletestatus = 'Active'
                        ORDER BY prod.`desc` ASC;";
    
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(':salesid', $data['salesid'], PDO::PARAM_STR);
                $stmt->bindValue(':busunitcodeone', $data['busunitcode'], PDO::PARAM_STR);
                $stmt->bindValue(':busunitcodetwo', $data['busunitcode'], PDO::PARAM_STR);
                $stmt->bindValue(':busunitcodethree', $data['busunitcode'], PDO::PARAM_STR);
                $stmt->bindValue(':busunitcodefour', $data['busunitcode'], PDO::PARAM_STR);
                $stmt->bindValue(':busunitcodefive', $data['busunitcode'], PDO::PARAM_STR);
                $stmt->execute();
    
                $result = [];
    
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    
                    $result[] = $row;
    
                }
    
                echo json_encode($result);
    
            } catch (PDOException $e) {
                throw new RuntimeException("DB Error: " . $e->getMessage());
            }
        }else{
            echo json_encode([]);
        }
   
    }

    public function getSalesQuotationHistory($user_id, array $data)
    {
        try {
            // Use SQL to compare only the numeric portion after the dash
            $sql = "SELECT *
                FROM tbl_sales_queue_history
                WHERE SUBSTRING_INDEX(sales_queue_id, '-', -1)
                      = SUBSTRING_INDEX(:salesid, '-', -1)
                ORDER BY seq ASC";

            $stmt = $this->conn->prepare($sql);
            // Bind the full salesid (e.g. 'SSM-20250515000001' or 'SQ-20250515000002')
            $stmt->bindValue(':salesid', $data['salesid'], PDO::PARAM_STR);
            $stmt->execute();

            $result = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $result[] = $row;
            }

            echo json_encode($result);

        } catch (PDOException $e) {
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function editQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "
                UPDATE tbl_sales_quotation
                SET
                    qty               = :qty,
                    cost_per_uom      = :cost_per_uom,
                    total_cost        = :total_cost,
                    srp               = :srp,
                    sales_wo_vat      = :sales_wo_vat,
                    vat               = :vat,
                    sales_w_vat       = :sales_w_vat,
                    discount_amount   = :discount_amount,
                    net_sales         = :net_sales,
                    total_bill        = :total_bill,
                    usertracker      = :user_tracker
                WHERE sales_id = :id
                AND inv_code = :inv_code
                AND deletestatus = 'Active'
            ";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data
            $stmt->bindValue(':qty', $data['qty'], PDO::PARAM_INT);
            $stmt->bindValue(':cost_per_uom', $data['cost_per_uom'], PDO::PARAM_STR);
            $stmt->bindValue(':total_cost', $data['total_cost'], PDO::PARAM_STR);
            $stmt->bindValue(':srp', $data['srp'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_wo_vat', $data['sales_wo_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':vat', $data['vat'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_w_vat', $data['sales_w_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':discount_amount', $data['discount_amount'], PDO::PARAM_STR);
            $stmt->bindValue(':net_sales', $data['net_sales'], PDO::PARAM_STR);
            $stmt->bindValue(':total_bill', $data['total_bill'], PDO::PARAM_STR);

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':id', $data['sales_id'], PDO::PARAM_INT);
            $stmt->bindValue(':inv_code', $data['inv_code'], PDO::PARAM_STR);

            $stmt->execute();
            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function editSalesOrder($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "
                UPDATE tbl_sales_order
                SET
                    qty               = :qty,
                    cost_per_uom      = :cost_per_uom,
                    total_cost        = :total_cost,
                    srp               = :srp,
                    sales_wo_vat      = :sales_wo_vat,
                    vat               = :vat,
                    sales_w_vat       = :sales_w_vat,
                    discount_amount   = :discount_amount,
                    net_sales         = :net_sales,
                    total_bill        = :total_bill,
                    usertracker      = :user_tracker
                WHERE sales_id = :id
                AND inv_code = :inv_code
                AND deletestatus = 'Active'
            ";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data
            $stmt->bindValue(':qty', $data['qty'], PDO::PARAM_INT);
            $stmt->bindValue(':cost_per_uom', $data['cost_per_uom'], PDO::PARAM_STR);
            $stmt->bindValue(':total_cost', $data['total_cost'], PDO::PARAM_STR);
            $stmt->bindValue(':srp', $data['srp'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_wo_vat', $data['sales_wo_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':vat', $data['vat'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_w_vat', $data['sales_w_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':discount_amount', $data['discount_amount'], PDO::PARAM_STR);
            $stmt->bindValue(':net_sales', $data['net_sales'], PDO::PARAM_STR);
            $stmt->bindValue(':total_bill', $data['total_bill'], PDO::PARAM_STR);

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':id', $data['sales_id'], PDO::PARAM_INT);
            $stmt->bindValue(':inv_code', $data['inv_code'], PDO::PARAM_STR);

            $stmt->execute();
            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function deleteQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "
                UPDATE tbl_sales_quotation
                SET
                    deletestatus = 'Inactive',
                    usertracker = :user_tracker
                WHERE sales_id = :id
                AND inv_code = :inv_code
            ";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':id', $data['sales_id'], PDO::PARAM_INT);
            $stmt->bindValue(':inv_code', $data['inv_code'], PDO::PARAM_STR);

            $stmt->execute();
            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function deleteSalesOrder($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "
                UPDATE tbl_sales_order
                SET
                    deletestatus = 'Inactive',
                    usertracker = :user_tracker
                WHERE sales_id = :id
                AND inv_code = :inv_code
            ";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':id', $data['sales_id'], PDO::PARAM_INT);
            $stmt->bindValue(':inv_code', $data['inv_code'], PDO::PARAM_STR);

            $stmt->execute();
            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }


    public function sendQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SQ-' . $digits;                     // "SQ-20250516000002"

            $sql = "INSERT INTO `tbl_sales_queue_history` ()
                    VALUES (
                      default,
                      :sales_queue_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      :type,
                      'Active',
                      :user_tracker,
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesQueueIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Quotation Sent', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Update Quotation

            $sql = "UPDATE tbl_sales_quotation
                    SET
                        current_status = 'Quotation Sent',
                        usertracker      = :user_tracker
                    WHERE sales_id = :sales_id
                    AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

    public function addProductsInQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SQ-' . $digits;                     // "SQ-20250516000002"

            $sql = "INSERT INTO `tbl_sales_quotation` ()
                    VALUES (
                      default,
                      :sales_quotation_id,
                      :busunitcode,
                      :inv_code,
                      :uomval,
                      :uom,
                      :qty,
                      :cost_per_uom,
                      :total_cost,
                      :srp,
                      :sales_wo_vat,
                      :vat,
                      :sales_w_vat,
                      0,
                      :net_sales,
                      0,
                      0,
                      0,
                      :total_bill,
                      :tax_type,
                      'NA',
                      :sales_id,
                      :user_tracker,
                      'Quotation Drafted',
                      'Active',
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            foreach ($data['cart'] as $item) {
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(':sales_quotation_id', $salesQueueIdNew, PDO::PARAM_STR);
                $stmt->bindValue(':busunitcode', $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(':inv_code', $item["inv_code"], PDO::PARAM_STR);
                $stmt->bindValue(':uomval', $item["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(':uom', $item["uom"], PDO::PARAM_STR);
                $stmt->bindValue(':qty', $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':cost_per_uom', $item["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(':total_cost', $item["cost_per_uom"] * $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':srp', $item["srp"], PDO::PARAM_STR);

                $stmt->bindValue(':sales_wo_vat', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':vat', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12 * .12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':sales_w_vat', $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':net_sales', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':total_bill', $item["srp"] * $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':tax_type', $item["tax_type"], PDO::PARAM_STR);
                $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_STR);

                $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(['message' => 'AddProductInQuotationSuccess']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

    public function addProductsInSalesOrder($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SO-' . $digits;                     // "SQ-20250516000002"

            // Get customer_id from tbl_sales_summary
            $sql = "SELECT customer_id FROM tbl_sales_summary
                        WHERE sales_id = :sales_id
                        AND deletestatus = 'Queued'";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_id', $originalId, PDO::PARAM_STR);
            $stmt->execute();
            $customerRow = $stmt->fetch(PDO::FETCH_ASSOC);
            $customerId  = $customerRow ? $customerRow['customer_id'] : null;

            $sql = "INSERT INTO `tbl_sales_order` ()
                    VALUES (
                      default,
                      :sales_order_id,
                      :busunitcode,
                      :inv_code,
                      :uomval,
                      :uom,
                      :qty,
                      :cost_per_uom,
                      :total_cost,
                      :srp,
                      :sales_wo_vat,
                      :vat,
                      :sales_w_vat,
                      0,
                      :net_sales,
                      0,
                      0,
                      0,
                      :total_bill,
                      :tax_type,
                      'NA',
                      :sales_id,
                      :customer_id,
                      '',
                      0,
                      :user_tracker,
                      'Sales Order Created',
                      'Active',
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            foreach ($data['cart'] as $item) {
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(':sales_order_id', $salesQueueIdNew, PDO::PARAM_STR);
                $stmt->bindValue(':busunitcode', $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(':inv_code', $item["inv_code"], PDO::PARAM_STR);
                $stmt->bindValue(':uomval', $item["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(':uom', $item["uom"], PDO::PARAM_STR);
                $stmt->bindValue(':qty', $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':cost_per_uom', $item["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(':total_cost', $item["cost_per_uom"] * $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':srp', $item["srp"], PDO::PARAM_STR);

                $stmt->bindValue(':sales_wo_vat', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':vat', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12 * .12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':sales_w_vat', $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':net_sales', $item["tax_type"] === 'VATABLE'
                    ? ROUND(($item["srp"] * $item["build_qty"]) / 1.12, 2)
                    : $item["srp"] * $item["build_qty"], PDO::PARAM_STR);

                $stmt->bindValue(':total_bill', $item["srp"] * $item["build_qty"], PDO::PARAM_STR);
                $stmt->bindValue(':tax_type', $item["tax_type"], PDO::PARAM_STR);
                $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_STR);
                $stmt->bindValue(':customer_id', $customerId, PDO::PARAM_STR);

                $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(['message' => 'AddProductInQuotationSuccess']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

    // public function acceptQuotation($user_id, $data)
    // {
    //     try {
    //         $this->conn->beginTransaction();

    //         // extract digits after "SSM-"
    //         $originalId       = $data['sales_id'];                     // e.g. "SSM-20250516000002"
    //         $digits           = substr($originalId, strlen('SSM-'));   // yields "20250516000002"
    //         $salesQueueIdNew  = 'SQ-' . $digits;                       // "SQ-20250516000002"

    //         $sql = "INSERT INTO `tbl_sales_queue_history` ()
    //                 VALUES (
    //                   default,
    //                   :sales_queue_id,
    //                   DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
    //                   :type,
    //                   'Active',
    //                   :user_tracker,
    //                   DATE_ADD(NOW(), INTERVAL 8 HOUR)
    //                 )";

    //         $stmt = $this->conn->prepare($sql);
    //         $stmt->bindValue(':sales_queue_id', $salesQueueIdNew,     PDO::PARAM_STR);
    //         $stmt->bindValue(':type',             'Quotation Accepted', PDO::PARAM_STR);
    //         $stmt->bindValue(':user_tracker',     $user_id,                PDO::PARAM_STR);

    //         $stmt->execute();

    //         //Update Quotation

    //         $sql = "UPDATE tbl_sales_quotation
    //                 SET
    //                     current_status = 'Quotation Accepted',
    //                     usertracker      = :user_tracker
    //                 WHERE sales_id = :sales_id
    //                 AND deletestatus = 'Active'";

    //             $stmt = $this->conn->prepare($sql);

    //             // Bind all the values from $data

    //             // Track which user made the change
    //             $stmt->bindValue(':user_tracker',    $user_id,   PDO::PARAM_INT);

    //             // The primary‐key of the row to update
    //             $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);

    //             $stmt->execute();

    //         $this->conn->commit();

    //         echo json_encode(['message' => 'Success']);
    //     } catch (PDOException $e) {
    //         $this->conn->rollBack();
    //         throw new RuntimeException("DB Error: " . $e->getMessage());
    //     }

    // }

    public function acceptQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $originalId      = $data['sales_id'];                   // e.g., "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SQ-' . $digits;                     // queue ID
            $salesOrderId    = 'SO-' . $digits;                     // new sales order ID

            // 1) Insert into tbl_sales_queue_history as Quotation Accepted
            $sql = "INSERT INTO `tbl_sales_queue_history` () VALUES (
                        default, :sales_queue_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                        :type, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesQueueIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Quotation Accepted', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // 2) Update tbl_sales_quotation to mark as accepted
            $sql = "UPDATE tbl_sales_quotation
                    SET current_status = 'Quotation Accepted',
                        usertracker = :user_tracker
                    WHERE sales_id = :sales_id AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->bindValue(':sales_id', $originalId, PDO::PARAM_STR);
            $stmt->execute();

            // 3) Fetch quotation details
            $sql = "SELECT *
                            FROM tbl_sales_quotation
                            WHERE sales_id = :sid
                            AND deletestatus = 'Active'";
            $q = $this->conn->prepare($sql);
            $q->bindValue(':sid', $originalId, PDO::PARAM_STR);
            $q->execute();
            $lines = $q->fetchAll(PDO::FETCH_ASSOC);
            if (empty($lines)) {
                throw new RuntimeException("No active quotation items found for $originalId");
            }

            // 4) Get customer_id from tbl_sales_summary
            $sql = "SELECT customer_id FROM tbl_sales_summary
                        WHERE sales_id = :sales_id
                        AND deletestatus = 'Queued'";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_id', $originalId, PDO::PARAM_STR);
            $stmt->execute();
            $customerRow = $stmt->fetch(PDO::FETCH_ASSOC);
            $customerId  = $customerRow ? $customerRow['customer_id'] : null;

            // 5) Insert into tbl_sales_order
            $insertSql = "INSERT INTO tbl_sales_order () VALUES (
                default,
                :soid,
                :busunitcode,
                :inv_code,
                :uomval,
                :uom,
                :qty,
                :cost_per_uom,
                :total_cost,
                :srp,
                :sales_wo_vat,
                :vat,
                :sales_w_vat,
                :discount_amount,
                :net_sales,
                :tax,
                :shipping_fee,
                :other_charges,
                :total_bill,
                :tax_type,
                :discount_type_id,
                :sales_id,
                :customer_id,
                '',
                0,
                :user_tracker,
                'Sales Order Created',
                'Active',
                DATE_ADD(NOW(), INTERVAL 8 HOUR)
            )";
            $iStmt = $this->conn->prepare($insertSql);

            foreach ($lines as $line) {
                $iStmt->bindValue(':soid', $salesOrderId, PDO::PARAM_STR);
                $iStmt->bindValue(':busunitcode', $line['busunitcode'], PDO::PARAM_STR);
                $iStmt->bindValue(':inv_code', $line['inv_code'], PDO::PARAM_STR);
                $iStmt->bindValue(':uomval', $line['uomval'], PDO::PARAM_STR);
                $iStmt->bindValue(':uom', $line['uom'], PDO::PARAM_STR);
                $iStmt->bindValue(':qty', $line['qty'], PDO::PARAM_INT);
                $iStmt->bindValue(':cost_per_uom', $line['cost_per_uom'], PDO::PARAM_STR);
                $iStmt->bindValue(':total_cost', $line['total_cost'], PDO::PARAM_STR);
                $iStmt->bindValue(':srp', $line['srp'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_wo_vat', $line['sales_wo_vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':vat', $line['vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_w_vat', $line['sales_w_vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':discount_amount', $line['discount_amount'], PDO::PARAM_STR);
                $iStmt->bindValue(':net_sales', $line['net_sales'], PDO::PARAM_STR);
                $iStmt->bindValue(':tax', $line['tax'], PDO::PARAM_STR);
                $iStmt->bindValue(':shipping_fee', $line['shipping_fee'], PDO::PARAM_STR);
                $iStmt->bindValue(':other_charges', $line['other_charges'], PDO::PARAM_STR);
                $iStmt->bindValue(':total_bill', $line['total_bill'], PDO::PARAM_STR);
                $iStmt->bindValue(':tax_type', $line['tax_type'], PDO::PARAM_STR);
                $iStmt->bindValue(':discount_type_id', $line['discount_type_id'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_id', $line['sales_id'], PDO::PARAM_STR);
                $iStmt->bindValue(':customer_id', $customerId, PDO::PARAM_STR);
                $iStmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
                $iStmt->execute();
            }

            // 6) Insert into tbl_sales_queue_history for Sales Order
            $salesOrderQueueId = 'SO-' . $digits;
            $sql               = "INSERT INTO `tbl_sales_queue_history` (
                        seq, sales_queue_id, transdate, type, deletestatus, usertracker, createdtime
                    ) VALUES (
                        default, :sales_queue_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                        :type, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesOrderQueueId, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Sales Order Created', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->execute();

            $this->conn->commit();
            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    public function approveSalesOrder($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SO-' . $digits;  
            $salesFulfillmentIdNew = 'SF-' . $digits;                        // "SQ-20250516000002"

            $sql = "INSERT INTO `tbl_sales_queue_history` ()
                    VALUES (
                      default,
                      :sales_queue_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      :type,
                      'Active',
                      :user_tracker,
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesQueueIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Approved Sales Order', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Update Quotation

            $sql = "UPDATE tbl_sales_order
                    SET
                        current_status = 'Approved Sales Order',
                        usertracker      = :user_tracker
                    WHERE sales_id = :sales_id
                    AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);
            

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);

            $stmt->execute();

            
            // Fetch sales order details
            $sql = "SELECT *
                            FROM tbl_sales_order
                            WHERE sales_id = :sid
                            AND deletestatus = 'Active'";
            $q = $this->conn->prepare($sql);
            $q->bindValue(':sid', $originalId, PDO::PARAM_STR);
            $q->execute();
            $lines = $q->fetchAll(PDO::FETCH_ASSOC);

            if (empty($lines)) {
                throw new RuntimeException("NoItemsFound");
            }

            // Insert into tbl_sales_fulfillment
            $insertSql = "INSERT INTO tbl_sales_fulfillment () VALUES (
                default,
                :sfid,
                :busunitcode,
                :inv_code,
                :uomval,
                :uom,
                :qty,
                :qty_allocated,
                :cost_per_uom,
                :total_cost,
                :srp,
                :sales_wo_vat,
                :vat,
                :sales_w_vat,
                :discount_amount,
                :net_sales,
                :tax,
                :shipping_fee,
                :other_charges,
                :total_bill,
                :tax_type,
                :discount_type_id,
                :sales_id,
                :customer_id,
                '',
                0,
                :user_tracker,
                'Forwarded to Fulfillment',
                'Active',
                DATE_ADD(NOW(), INTERVAL 8 HOUR)
            )";
            $iStmt = $this->conn->prepare($insertSql);

            foreach ($lines as $line) {
                $iStmt->bindValue(':sfid', $salesFulfillmentIdNew, PDO::PARAM_STR);
                $iStmt->bindValue(':busunitcode', $line['busunitcode'], PDO::PARAM_STR);
                $iStmt->bindValue(':inv_code', $line['inv_code'], PDO::PARAM_STR);
                $iStmt->bindValue(':uomval', $line['uomval'], PDO::PARAM_STR);
                $iStmt->bindValue(':uom', $line['uom'], PDO::PARAM_STR);
                $iStmt->bindValue(':qty', $line['qty'], PDO::PARAM_INT);
                $iStmt->bindValue(':qty_allocated', 0, PDO::PARAM_INT);
                $iStmt->bindValue(':cost_per_uom', $line['cost_per_uom'], PDO::PARAM_STR);
                $iStmt->bindValue(':total_cost', $line['total_cost'], PDO::PARAM_STR);
                $iStmt->bindValue(':srp', $line['srp'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_wo_vat', $line['sales_wo_vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':vat', $line['vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_w_vat', $line['sales_w_vat'], PDO::PARAM_STR);
                $iStmt->bindValue(':discount_amount', $line['discount_amount'], PDO::PARAM_STR);
                $iStmt->bindValue(':net_sales', $line['net_sales'], PDO::PARAM_STR);
                $iStmt->bindValue(':tax', $line['tax'], PDO::PARAM_STR);
                $iStmt->bindValue(':shipping_fee', $line['shipping_fee'], PDO::PARAM_STR);
                $iStmt->bindValue(':other_charges', $line['other_charges'], PDO::PARAM_STR);
                $iStmt->bindValue(':total_bill', $line['total_bill'], PDO::PARAM_STR);
                $iStmt->bindValue(':tax_type', $line['tax_type'], PDO::PARAM_STR);
                $iStmt->bindValue(':discount_type_id', $line['discount_type_id'], PDO::PARAM_STR);
                $iStmt->bindValue(':sales_id', $line['sales_id'], PDO::PARAM_STR);
                $iStmt->bindValue(':customer_id', $line['customer_id'], PDO::PARAM_STR);
                $iStmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
                $iStmt->execute();
            }

            // 6) Insert into tbl_sales_queue_history for Sales Order
            $sql               = "INSERT INTO `tbl_sales_queue_history` (
                        seq, sales_queue_id, transdate, type, deletestatus, usertracker, createdtime
                    ) VALUES (
                        default, :sales_queue_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                        :type, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesFulfillmentIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Forwarded to Fulfillment', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'approveSalesOrderSuccess']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }


    public function rejectQuotation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SQ-' . $digits;                     // "SQ-20250516000002"

            $sql = "INSERT INTO `tbl_sales_queue_history` ()
                    VALUES (
                      default,
                      :sales_queue_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      :type,
                      'Active',
                      :user_tracker,
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesQueueIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Quotation Rejected', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Update Quotation

            $sql = "UPDATE tbl_sales_quotation
                    SET
                        current_status = 'Quotation Rejected',
                        deletestatus = 'Inactive',
                        usertracker      = :user_tracker
                    WHERE sales_id = :sales_id
                    AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

    public function cancelSalesOrder($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesQueueIdNew = 'SQ-' . $digits;                     // "SQ-20250516000002"

            $sql = "INSERT INTO `tbl_sales_queue_history` ()
                    VALUES (
                      default,
                      :sales_queue_id,
                      DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                      :type,
                      'Active',
                      :user_tracker,
                      DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':sales_queue_id', $salesQueueIdNew, PDO::PARAM_STR);
            $stmt->bindValue(':type', 'Cancelled Sales Order', PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Update Quotation

            $sql = "UPDATE tbl_sales_order
                    SET
                        current_status = 'Cancelled Sales Order',
                        deletestatus = 'Inactive',
                        usertracker      = :user_tracker
                    WHERE sales_id = :sales_id
                    AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            // The primary‐key of the row to update
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'cancelSalesOrderSuccess']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

    
    public function allocateStocks($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                                                                    // extract digits after "SSM-"
            $originalId      = $data['sales_id'];                   // e.g. "SSM-20250516000002"
            $digits          = substr($originalId, strlen('SSM-')); // yields "20250516000002"
            $salesFulfillmentId = 'SF-' . $digits;

                // 1) Count existing active batches
                $sql = "SELECT COUNT(tracking_no) 
                FROM tbl_sf_stock_allocation 
                WHERE deletestatus = 'Active'";

                $stmt = $this->conn->prepare($sql);
                $stmt->execute();

                // 2) Fetch the count (zero if none)
                $currentCount = (int) $stmt->fetchColumn();

                // 3) Compute next sequence number
                $nextSeq = $currentCount + 1;

                // 4) Left-pad to 5 digits (e.g. 00001, 00002, …)
                $padded = str_pad($nextSeq, 5, '0', STR_PAD_LEFT);

                // 5) Build your batch code
                $batchNo = 'ALLOC-' . $padded;


                                 // "SF-20250516000002"
                $sql = "INSERT INTO tbl_sf_stock_allocation ()
                VALUES(
                default,
                :sales_fullfillment_id,
                :allocation_no,
                :busunitcode,
                :inv_code,
                :uomval,
                :uom,
                :qty,
                :cost_per_uom,
                :total_cost,
                :srp,
                :sales_wo_vat,
                :vat,
                :sales_w_vat,
                :discount_amount,
                :net_sales,
                0,
                0,
                0,
                :total_bill,
                :tax_type,
                0,
                :sales_id,
                :customer_id,
                '',
                0,
                :user_tracker,
                'Stocks Allocated',
                'Active',
                 DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Bind all the values from $data
            $stmt->bindValue(':sales_fullfillment_id', $salesFulfillmentId, PDO::PARAM_STR);
            $stmt->bindValue(':allocation_no', $batchNo, PDO::PARAM_STR);
            $stmt->bindValue(':busunitcode', $data['busunitcode'], PDO::PARAM_STR);
            $stmt->bindValue(':inv_code', $data['inv_code'], PDO::PARAM_STR);
            $stmt->bindValue(':uomval', $data['uomval'], PDO::PARAM_STR);
            $stmt->bindValue(':uom', $data['uom'], PDO::PARAM_STR);
            $stmt->bindValue(':qty', $data['qty'], PDO::PARAM_INT);
            $stmt->bindValue(':cost_per_uom', $data['cost_per_uom'], PDO::PARAM_STR);
            $stmt->bindValue(':total_cost', $data['total_cost'], PDO::PARAM_STR);
            $stmt->bindValue(':srp', $data['srp'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_wo_vat', $data['sales_wo_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':vat', $data['vat'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_w_vat', $data['sales_w_vat'], PDO::PARAM_STR);
            $stmt->bindValue(':discount_amount', $data['discount_amount'], PDO::PARAM_STR);
            $stmt->bindValue(':net_sales', $data['net_sales'], PDO::PARAM_STR);
            $stmt->bindValue(':total_bill', $data['total_bill'], PDO::PARAM_STR);
            $stmt->bindValue(':tax_type', $data['taxtype'], PDO::PARAM_STR);
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_STR);
            $stmt->bindValue(':customer_id', $data['customer_id'], PDO::PARAM_STR);

            // Track which user made the change
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_INT);

            $stmt->execute();

            //Get Allocated and total

            //Update Quotation

            $sql = "SELECT qty_allocated
            FROM tbl_sales_fulfillment
            WHERE sales_id     = :sales_id
              AND deletestatus = 'Active'
              AND inv_code     = :inv_code";

            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_INT);
            $stmt->bindValue(':inv_code',  $data['inv_code'],  PDO::PARAM_STR);
            
            $stmt->execute();
            
            $qtyAllocated = (int) $stmt->fetchColumn();


            //Update sales fulfillment

            $sql = "UPDATE tbl_sales_fulfillment
                    SET
                        qty_allocated = :qtyallocated,
                        usertracker      = :user_tracker
                    WHERE sales_id = :sales_id
                     AND inv_code     = :inv_code
                    AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(':sales_id', $data['sales_id'], PDO::PARAM_STR);
            $stmt->bindValue(':inv_code',  $data['inv_code'],  PDO::PARAM_STR);
            $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);
            $stmt->bindValue(':qtyallocated',  $qtyAllocated + $data['qty'],  PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(['message' => 'Success']);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }

    }

}
