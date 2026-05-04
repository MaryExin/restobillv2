<?php
// api/reports_dashboard.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { exit; }

require __DIR__ . "/pdo.php";

$raw = file_get_contents("php://input");
$body = json_decode($raw, true) ?: [];

$datefrom = $body["datefrom"] ?? date("Y-m-d");
$dateto   = $body["dateto"] ?? date("Y-m-d");

$graph_datefrom = $body["graph_datefrom"] ?? $datefrom;
$graph_dateto   = $body["graph_dateto"] ?? $datefrom;

$includeVoided = !empty($body["includeVoided"]);
$voidOnly = !empty($body["voidOnly"]);

// status filter
$statusSql = "t.status = 'Active'";
if ($voidOnly) $statusSql = "t.status = 'Voided'";
else if ($includeVoided) $statusSql = "(t.status = 'Active' OR t.status = 'Voided')";

// ✅ transaction_time may be stored as 12-hour text (e.g. "1:05 PM")
// Parse robustly then bucket to 0..23.
$timeExpr = "COALESCE(
  STR_TO_DATE(t.transaction_time, '%h:%i:%s %p'),
  STR_TO_DATE(t.transaction_time, '%h:%i %p'),
  STR_TO_DATE(t.transaction_time, '%H:%i:%s'),
  STR_TO_DATE(t.transaction_time, '%H:%i')
)";
$hourExpr = "HOUR($timeExpr)";

/* ---------------------------
   KPI summary (TABLE range)
   ✅ FIX: txn_count must follow status filter
---------------------------- */
$sqlKpi = "
  SELECT
    SUM(CASE WHEN $statusSql THEN 1 ELSE 0 END) AS txn_count,
    SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS gross_sales,
    SUM(CASE WHEN $statusSql THEN t.Discount ELSE 0 END) AS discount_total,
    SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS net_sales,
    SUM(CASE WHEN $statusSql THEN t.VATableSales ELSE 0 END) AS vatable_sales,
    SUM(CASE WHEN $statusSql THEN t.VATableSales_VAT ELSE 0 END) AS vat_amount,
    SUM(CASE WHEN $statusSql THEN t.VATExemptSales ELSE 0 END) AS vat_exempt_sales,
    SUM(CASE WHEN $statusSql THEN t.VATExemptSales_VAT ELSE 0 END) AS vat_exemption
  FROM tbl_pos_transactions t
  WHERE t.transaction_date BETWEEN :datefrom AND :dateto
";
$stmt = $pdo->prepare($sqlKpi);
$stmt->execute([":datefrom" => $datefrom, ":dateto" => $dateto]);
$kpi = $stmt->fetch() ?: [
  "txn_count" => 0, "gross_sales" => 0, "discount_total" => 0, "net_sales" => 0,
  "vatable_sales" => 0, "vat_amount" => 0, "vat_exempt_sales" => 0, "vat_exemption" => 0
];

/* ---------------------------
   Daily Sales (TABLE range)
---------------------------- */
$sqlDaily = "
  SELECT
    t.transaction_date AS Date,

    SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS `Gross Sales`,

    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Senior%' THEN t.Discount ELSE 0 END) AS `SRC Disc.`,
    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%PWD%' THEN t.Discount ELSE 0 END) AS `PWD Disc.`,
    SUM(CASE WHEN $statusSql AND (t.discount_type LIKE '%NAAC%' OR t.discount_type LIKE '%NACC%') THEN t.Discount ELSE 0 END) AS `NAAC Disc.`,
    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Solo%' THEN t.Discount ELSE 0 END) AS `Solo Parent Disc.`,

    SUM(CASE
      WHEN $statusSql
       AND t.Discount > 0
       AND t.discount_type NOT LIKE '%Senior%'
       AND t.discount_type NOT LIKE '%PWD%'
       AND t.discount_type NOT LIKE '%NAAC%'
       AND t.discount_type NOT LIKE '%NACC%'
       AND t.discount_type NOT LIKE '%Solo%'
       AND t.discount_type NOT LIKE '%No Discount%'
      THEN t.Discount ELSE 0 END
    ) AS `Other Disc.`,

    SUM(CASE WHEN $statusSql AND t.payment_method = 'Cash'
      THEN (t.payment_amount - IFNULL(t.change_amount,0))
      ELSE 0 END) AS `Cash Payment`,

    SUM(CASE WHEN $statusSql AND t.payment_method LIKE '%Cheque%'
      THEN t.payment_amount ELSE 0 END) AS `Cheque Payment`,

    SUM(CASE WHEN $statusSql AND (t.payment_method LIKE '%Card%' OR t.payment_method LIKE '%BDO%')
      THEN t.payment_amount ELSE 0 END) AS `Card Payment`,

    SUM(CASE WHEN $statusSql AND t.payment_method LIKE '%GCash%'
      THEN t.payment_amount ELSE 0 END) AS `GCash Payment`,

    SUM(CASE WHEN $statusSql AND (t.payment_method LIKE '%PayMaya%' OR t.payment_method LIKE '%Maya%')
      THEN t.payment_amount ELSE 0 END) AS `Maya Payment`,

    SUM(CASE WHEN $statusSql AND (
        t.payment_method LIKE '%,%'
        OR (
          t.payment_method NOT LIKE '%Cash%'
          AND t.payment_method NOT LIKE '%Cheque%'
          AND t.payment_method NOT LIKE '%Card%'
          AND t.payment_method NOT LIKE '%BDO%'
          AND t.payment_method NOT LIKE '%GCash%'
          AND t.payment_method NOT LIKE '%PayMaya%'
          AND t.payment_method NOT LIKE '%Maya%'
        )
      )
      THEN t.payment_amount ELSE 0 END) AS `Other Payment`,

    SUM(CASE WHEN $statusSql THEN t.VATableSales ELSE 0 END) AS `VATable Sales`,
    SUM(CASE WHEN $statusSql THEN t.VATableSales_VAT ELSE 0 END) AS `VAT Amount`,
    SUM(CASE WHEN $statusSql THEN t.VATExemptSales ELSE 0 END) AS `VAT Exempt Sales`,
    SUM(CASE WHEN $statusSql THEN t.VATExemptSales_VAT ELSE 0 END) AS `VAT Exemption`,

    SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS `Net Sales`

  FROM tbl_pos_transactions t
  WHERE t.transaction_date BETWEEN :datefrom AND :dateto
  GROUP BY t.transaction_date
  ORDER BY t.transaction_date ASC
";
$stmt = $pdo->prepare($sqlDaily);
$stmt->execute([":datefrom" => $datefrom, ":dateto" => $dateto]);
$dailyRows = $stmt->fetchAll();

/* ---------------------------
   Daily Sales (GRAPH range)
   ✅ month start → FROM
---------------------------- */
$sqlDailyGraph = "
  SELECT
    t.transaction_date AS Date,

    SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS `Gross Sales`,

    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Senior%' THEN t.Discount ELSE 0 END) AS `SRC Disc.`,
    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%PWD%' THEN t.Discount ELSE 0 END) AS `PWD Disc.`,
    SUM(CASE WHEN $statusSql AND (t.discount_type LIKE '%NAAC%' OR t.discount_type LIKE '%NACC%') THEN t.Discount ELSE 0 END) AS `NAAC Disc.`,
    SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Solo%' THEN t.Discount ELSE 0 END) AS `Solo Parent Disc.`,
    SUM(CASE
      WHEN $statusSql
       AND t.Discount > 0
       AND t.discount_type NOT LIKE '%Senior%'
       AND t.discount_type NOT LIKE '%PWD%'
       AND t.discount_type NOT LIKE '%NAAC%'
       AND t.discount_type NOT LIKE '%NACC%'
       AND t.discount_type NOT LIKE '%Solo%'
       AND t.discount_type NOT LIKE '%No Discount%'
      THEN t.Discount ELSE 0 END
    ) AS `Other Disc.`,

    SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS `Net Sales`

  FROM tbl_pos_transactions t
  WHERE t.transaction_date BETWEEN :gfrom AND :gto
  GROUP BY t.transaction_date
  ORDER BY t.transaction_date ASC
";
$stmt = $pdo->prepare($sqlDailyGraph);
$stmt->execute([":gfrom" => $graph_datefrom, ":gto" => $graph_dateto]);
$dailyGraphRows = $stmt->fetchAll();

/* ---------------------------
   Hourly Sales (TABLE range)
   ✅ 12-hour transaction_time supported
---------------------------- */
$sqlHourly = "
  SELECT
    t.transaction_date AS Date,
    $hourExpr AS hr,
    SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS amount
  FROM tbl_pos_transactions t
  WHERE t.transaction_date BETWEEN :datefrom AND :dateto
  GROUP BY t.transaction_date, $hourExpr
  ORDER BY t.transaction_date ASC, hr ASC
";
$stmt = $pdo->prepare($sqlHourly);
$stmt->execute([":datefrom" => $datefrom, ":dateto" => $dateto]);
$hourlyRaw = $stmt->fetchAll();

$hourlyMap = [];
foreach ($hourlyRaw as $r) {
  $d = $r["Date"];
  $h = (int)$r["hr"];
  $amt = (float)$r["amount"];
  if (!isset($hourlyMap[$d])) {
    $hourlyMap[$d] = ["Date"=>$d, "Total Sales"=>0, "hours"=>array_fill(0, 24, 0)];
  }
  if ($h >= 0 && $h <= 23) {
    $hourlyMap[$d]["hours"][$h] += $amt;
    $hourlyMap[$d]["Total Sales"] += $amt;
  }
}
$hourlyRows = array_values($hourlyMap);

/* ---------------------------
   Sales Per Product (TABLE range)
---------------------------- */
$sqlPerProduct = "
  SELECT
    d.product_id AS Code,
    COALESCE(m.item_name, d.product_id) AS `Product Name`,
    COALESCE(m.inventory_type, 'PRODUCT') AS `Item Type`,
    SUM(d.sales_quantity) AS `Total Qty Sold`,
    SUM(d.sales_quantity * d.selling_price) AS `Gross Sales`
  FROM tbl_pos_transactions_detailed d
  INNER JOIN tbl_pos_transactions t
    ON t.transaction_id = d.transaction_id
  LEFT JOIN tbl_inventory_products_masterlist m
    ON m.product_id = d.product_id
  WHERE d.transaction_date BETWEEN :datefrom AND :dateto
    AND $statusSql
  GROUP BY d.product_id, m.item_name, m.inventory_type
  ORDER BY `Product Name` ASC
";
$stmt = $pdo->prepare($sqlPerProduct);
$stmt->execute([":datefrom" => $datefrom, ":dateto" => $dateto]);
$perProductRows = $stmt->fetchAll();

/* ---------------------------
   Hourly Sales (Per Product)
   ✅ 12-hour transaction_time supported
---------------------------- */
$sqlHourlyPerProduct = "
  SELECT
    d.product_id AS Code,
    COALESCE(m.item_category, COALESCE(m.category_code, 'UNCATEGORIZED')) AS Category,
    COALESCE(m.item_name, d.product_id) AS `Product Name`,
    $hourExpr AS hr,
    SUM(d.sales_quantity) AS qty
  FROM tbl_pos_transactions_detailed d
  INNER JOIN tbl_pos_transactions t
    ON t.transaction_id = d.transaction_id
  LEFT JOIN tbl_inventory_products_masterlist m
    ON m.product_id = d.product_id
  WHERE d.transaction_date BETWEEN :datefrom AND :dateto
    AND $statusSql
  GROUP BY d.product_id, Category, `Product Name`, $hourExpr
  ORDER BY `Product Name` ASC, hr ASC
";
$stmt = $pdo->prepare($sqlHourlyPerProduct);
$stmt->execute([":datefrom" => $datefrom, ":dateto" => $dateto]);
$hppRaw = $stmt->fetchAll();

$hppMap = [];
foreach ($hppRaw as $r) {
  $code = $r["Code"];
  $cat = $r["Category"];
  $name = $r["Product Name"];
  $hr = (int)$r["hr"];
  $qty = (float)$r["qty"];

  if (!isset($hppMap[$code])) {
    $hppMap[$code] = [
      "Code"=>$code,
      "Category"=>$cat,
      "Product Name"=>$name,
      "hours"=>array_fill(0, 24, 0),
      "TOTAL"=>0
    ];
  }
  if ($hr >= 0 && $hr <= 23) {
    $hppMap[$code]["hours"][$hr] += $qty;
    $hppMap[$code]["TOTAL"] += $qty;
  }
}
$hourlyPerProductRows = array_values($hppMap);

/* ---------------------------
   Response
---------------------------- */
echo json_encode([
  "filters" => [
    "datefrom" => $datefrom,
    "dateto" => $dateto,
    "graph_datefrom" => $graph_datefrom,
    "graph_dateto" => $graph_dateto,
    "includeVoided" => $includeVoided,
    "voidOnly" => $voidOnly,
  ],
  "kpi" => $kpi,
  "dailySales" => $dailyRows,
  "dailyGraph" => $dailyGraphRows,
  "hourlySales" => $hourlyRows,
  "salesPerProduct" => $perProductRows,
  "hourlySalesPerProduct" => $hourlyPerProductRows,
]);