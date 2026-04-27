<?php

class ModalSLRunningBalGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getSLRunningBal(string $busunit, string $dateTo, string $slCode): array
      {
          // Compute our date boundaries
          $ytdStart     = date('Y-01-01', strtotime($dateTo));
          $thisMonStart = date('Y-m-01',   strtotime($dateTo));

          // 1) Detailed transactions (sldata)
          $sql = <<<SQL
                SELECT 
                  ta.transdate,
                  ta.amount,
                  ta.particulars,
                  ta.reference,
                  COALESCE(tc.customername, 'NA')  AS customer,
                  COALESCE(ls.supplier_name, 'NA') AS supplier
                FROM tbl_accounting_transactions AS ta
                LEFT JOIN tbl_customer_details AS tc
                  ON ta.customer_id = tc.customer_id
                LEFT JOIN lkp_supplier AS ls
                  ON ta.supplier_code = ls.supplier_code
                WHERE ta.busunitcode    = :busunit
                  AND ta.slcode         = :slCode
                  AND ta.transdate BETWEEN :ytdStart AND :dateTo
                  AND ta.approvalstatus = 'Posted'
                  AND ta.deletestatus   = 'Active'
                ORDER BY ta.transdate DESC
                SQL;

          $stmt = $this->conn->prepare($sql);
          $stmt->bindValue(':busunit',  $busunit,   \PDO::PARAM_STR);
          $stmt->bindValue(':slCode',   $slCode,    \PDO::PARAM_STR);
          $stmt->bindValue(':ytdStart', $ytdStart,  \PDO::PARAM_STR);
          $stmt->bindValue(':dateTo',   $dateTo,    \PDO::PARAM_STR);
          $stmt->execute();
          $sldata = $stmt->fetchAll(\PDO::FETCH_ASSOC);

          // 2) Beginning balance (begdata)
          $begSql = <<<SQL
          SELECT
            COALESCE(SUM(amount), 0) AS begbal
          FROM tbl_accounting_transactions
          WHERE slcode         = :begSlCode
            AND transdate <    :begYtdStart
            AND approvalstatus = 'Posted'
            AND deletestatus   = 'Active'
          SQL;

          $begStmt = $this->conn->prepare($begSql);
          $begStmt->bindValue(':begSlCode',   $slCode,    \PDO::PARAM_STR);
          $begStmt->bindValue(':begYtdStart', $ytdStart,  \PDO::PARAM_STR);
          $begStmt->execute();
          $begdata = $begStmt->fetch(\PDO::FETCH_ASSOC);

          return [
            'sldata'  => $sldata,
            'begdata' => $begdata,
          ];
      }




}
