<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  header("Allow: POST");
  echo json_encode(["message" => "MethodNotAllowed"]);
  exit;
}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$conn = $database->getConnection();

$imageCompressor = new ImageCompressor();
$otpController = new OTP();
$otp = $otpController->generateOTP(); // used for user otp field like before

// ✅ Default roles for new signup (hardcoded JSON from super_admin.csv; edit later as needed)
$DEFAULT_ROLES_JSON = <<<'JSON'
[
  {
    "roleclass": "Route",
    "rolename": "/aboutus",
    "role_description": "/aboutus",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/productionrequest",
    "role_description": "/productionrequest",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventorystockstatus",
    "role_description": "/inventorystockstatus",
    "deletestatus": "Active"
  },
    {
    "roleclass": "Route",
    "rolename": "/reportpnlcomparative",
    "role_description": "/reportpnlcomparative",
    "deletestatus": "Active"
  },
    {
    "roleclass": "Route",
    "rolename": "/navigationpage",
    "role_description": "/navigationpage",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/renewalandplanupgrade",
    "role_description": "/renewalandplanupgrade",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/subscriptions",
    "role_description": "/subscriptions",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/accounting",
    "role_description": "/accounting",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/accountingsetup",
    "role_description": "/accountingsetup",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/accountsummary/:id",
    "role_description": "/accountsummary/:id",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/acctgtransmap",
    "role_description": "/acctgtransmap",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/allocation",
    "role_description": "/allocation",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/applyleave",
    "role_description": "/applyleave",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/applyot",
    "role_description": "/applyot",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/approvecreds",
    "role_description": "/approvecreds",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/areas",
    "role_description": "/areas",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/autopricing",
    "role_description": "/autopricing",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/bankrecon",
    "role_description": "/bankrecon",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/billingandcollections",
    "role_description": "/billingandcollections",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/brands",
    "role_description": "/brands",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/build",
    "role_description": "/build",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/buildcomponents",
    "role_description": "/buildcomponents",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/busunits",
    "role_description": "/busunits",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/cashieringreport",
    "role_description": "/cashieringreport",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/changepassword",
    "role_description": "/changepassword",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/chartofaccount",
    "role_description": "/chartofaccount",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/chartofaccountmap",
    "role_description": "/chartofaccountmap",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/charttype",
    "role_description": "/charttype",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/closependingsales",
    "role_description": "/closependingsales",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/closingaccountingentries",
    "role_description": "/closingaccountingentries",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/colorsettings",
    "role_description": "/colorsettings",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/corporation",
    "role_description": "/corporation",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/customeraccountsummary/:id",
    "role_description": "/customeraccountsummary/:id",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/customersinfo",
    "role_description": "/customersinfo",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/customersinfosummary",
    "role_description": "/customersinfosummary",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/customerspdcsreport",
    "role_description": "/customerspdcsreport",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/dashboard",
    "role_description": "/dashboard",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/dashboardmain",
    "role_description": "/dashboardmain",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/dashboardtwo",
    "role_description": "/dashboardtwo",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/daytype",
    "role_description": "/daytype",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/department",
    "role_description": "/department",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/deposits",
    "role_description": "/deposits",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/disbursements",
    "role_description": "/disbursements",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/discount",
    "role_description": "/discount",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/employee_position",
    "role_description": "/employee_position",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/employeeinfo",
    "role_description": "/employeeinfo",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/employeelocation",
    "role_description": "/employeelocation",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/employeemanagementdashboard",
    "role_description": "/employeemanagementdashboard",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/fixedasset",
    "role_description": "/fixedasset",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/glcode",
    "role_description": "/glcode",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/hris",
    "role_description": "/hris",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/ims",
    "role_description": "/ims",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/infinitescroll",
    "role_description": "/infinitescroll",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventoryaveragecosting",
    "role_description": "/inventoryaveragecosting",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventorydashboard",
    "role_description": "/inventorydashboard",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventoryforecasting",
    "role_description": "/inventoryforecasting",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventorygraph",
    "role_description": "/inventorygraph",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventorysetup",
    "role_description": "/inventorysetup",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/inventoryusage",
    "role_description": "/inventoryusage",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/invreportbybrandandproductcode",
    "role_description": "/invreportbybrandandproductcode",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/journalvoucher",
    "role_description": "/journalvoucher",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/memberprofile/:id",
    "role_description": "/memberprofile/:id",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/mop",
    "role_description": "/mop",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/noninventory",
    "role_description": "/noninventory",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/package",
    "role_description": "/package",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/packageuse",
    "role_description": "/packageuse",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pcfsetup",
    "role_description": "/pcfsetup",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pdcsreport",
    "role_description": "/pdcsreport",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pettycashfund",
    "role_description": "/pettycashfund",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pettycashtransaction",
    "role_description": "/pettycashtransaction",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pos",
    "role_description": "/pos",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/priceassignment",
    "role_description": "/priceassignment",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/priceselection",
    "role_description": "/priceselection",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pricing",
    "role_description": "/pricing",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/pricingbysaletype",
    "role_description": "/pricingbysaletype",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/product",
    "role_description": "/product",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/productcategory",
    "role_description": "/productcategory",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/profitandlossdashboard",
    "role_description": "/profitandlossdashboard",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/projectassignment",
    "role_description": "/projectassignment",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/projectsetup",
    "role_description": "/projectsetup",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/purchaseorder",
    "role_description": "/purchaseorder",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/purchaserequest",
    "role_description": "/purchaserequest",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/purchaserequest/:prId",
    "role_description": "/purchaserequest/:prId",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/rawmats",
    "role_description": "/rawmats",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/referral",
    "role_description": "/referral",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/reportbalancesheet",
    "role_description": "/reportbalancesheet",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/reportprofitandloss",
    "role_description": "/reportprofitandloss",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/role_class_function",
    "role_description": "/role_class_function",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salepackagemap",
    "role_description": "/salepackagemap",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salesdashboard",
    "role_description": "/salesdashboard",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salesdashboardsummary",
    "role_description": "/salesdashboardsummary",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salesqueue",
    "role_description": "/salesqueue",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salessummarytabular",
    "role_description": "/salessummarytabular",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salestracker",
    "role_description": "/salestracker",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salestrackercomponent",
    "role_description": "/salestrackercomponent",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/salestrackersummary",
    "role_description": "/salestrackersummary",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/saletype",
    "role_description": "/saletype",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/settings",
    "role_description": "/settings",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/slcode",
    "role_description": "/slcode",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/spoilages",
    "role_description": "/spoilages",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/stocklevel",
    "role_description": "/stocklevel",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/supplier",
    "role_description": "/supplier",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/tasks",
    "role_description": "/tasks",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/teamassignment",
    "role_description": "/teamassignment",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/teammembers/:id",
    "role_description": "/teammembers/:id",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/teams",
    "role_description": "/teams",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/teamsprofile",
    "role_description": "/teamsprofile",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/timelogs",
    "role_description": "/timelogs",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/timelogsummary",
    "role_description": "/timelogsummary",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/transfers",
    "role_description": "/transfers",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/tutorials",
    "role_description": "/tutorials",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/unitdistribution",
    "role_description": "/unitdistribution",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/uploadpage",
    "role_description": "/uploadpage",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/userroles",
    "role_description": "/userroles",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/userrolesetup",
    "role_description": "/userrolesetup",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/usersqueu",
    "role_description": "/usersqueu",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Route",
    "rolename": "/zreading",
    "role_description": "/zreading",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-ADMIN",
    "role_description": "ACCTG-ADMIN",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-ASSETS",
    "role_description": "ACCTG-ASSETS",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-DEPOSITS",
    "role_description": "ACCTG-DEPOSITS",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-DISBURSEMENT",
    "role_description": "ACCTG-DISBURSEMENT",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-JV",
    "role_description": "ACCTG-JV",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-PCF",
    "role_description": "ACCTG-PCF",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-REPORTS",
    "role_description": "ACCTG-REPORTS",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "ACCTG-TREASURY",
    "role_description": "ACCTG-TREASURY",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "DEPOSIT CLEARING",
    "role_description": "DEPOSIT CLEARING",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "DISBURSEMENT CLEARING",
    "role_description": "DISBURSEMENT CLEARING",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "DISBURSEMENT ENCODER",
    "role_description": "DISBURSEMENT ENCODER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "HRIS-ADMIN",
    "role_description": "HRIS-ADMIN",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "HRIS-PROJECT MANAGER",
    "role_description": "HRIS-PROJECT MANAGER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "HRIS-TEAM LEADER",
    "role_description": "HRIS-TEAM LEADER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "HRIS-TEAM PLAYER",
    "role_description": "HRIS-TEAM PLAYER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-ADMIN",
    "role_description": "IMS-ADMIN",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-ALLOCATOR",
    "role_description": "IMS-ALLOCATOR",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-BILLING OFFICER",
    "role_description": "IMS-BILLING OFFICER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-BILLING VIEW KEY",
    "role_description": "IMS-BILLING VIEW KEY",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-DELIVERY",
    "role_description": "IMS-DELIVERY",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-DRIVER",
    "role_description": "IMS-DRIVER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-INVENTORY SETUP",
    "role_description": "IMS-INVENTORY SETUP",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PO-APPROVER",
    "role_description": "IMS-PO-APPROVER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PR-APPROVER",
    "role_description": "IMS-PR-APPROVER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PR-FRANCHISE",
    "role_description": "IMS-PR-FRANCHISE",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PRICING EDITOR",
    "role_description": "IMS-PRICING EDITOR",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PRODUCTION",
    "role_description": "IMS-PRODUCTION",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PRODUCTION OFFICER",
    "role_description": "IMS-PRODUCTION OFFICER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-PURCHASER",
    "role_description": "IMS-PURCHASER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-SPOILAGE OFFICER",
    "role_description": "IMS-SPOILAGE OFFICER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-VIEW PO",
    "role_description": "IMS-VIEW PO",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "IMS-VIEW PR",
    "role_description": "IMS-VIEW PR",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SALES OFFICER",
    "role_description": "SALES OFFICER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SALES-ADMIN",
    "role_description": "SALES-ADMIN",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SALES-CASHIER",
    "role_description": "SALES-CASHIER",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SALES-QUEUE",
    "role_description": "SALES-QUEUE",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SALES-QUOTATION",
    "role_description": "SALES-QUOTATION",
    "deletestatus": "Active"
  },
  {
    "roleclass": "Function",
    "rolename": "SUPER ADMIN",
    "role_description": "SUPER ADMIN",
    "deletestatus": "Active"
  },
    {
    "roleclass": "Function",
    "rolename": "REPORTS-AREA",
    "role_description": "REPORTS-AREA",
    "deletestatus": "Active"
  },
    {
    "roleclass": "Function",
    "rolename": "REPORTS-CORPORATION",
    "role_description": "REPORTS-CORPORATION",
    "deletestatus": "Active"
  },
    {
    "roleclass": "Function",
    "rolename": "REPORTS-BRAND",
    "role_description": "REPORTS-BRAND",
    "deletestatus": "Active"
  }
  
]
JSON;

$DEFAULT_ROLES = json_decode($DEFAULT_ROLES_JSON, true);
if (!is_array($DEFAULT_ROLES)) {
  http_response_code(500);
  echo json_encode(["message" => "InvalidRolesJSON"]);
  exit;
}

// ✅ RL-uuid generator (matches sample format: RL- + 32 hex chars)
function genRoleUuid(): string {
  return "RL-" . bin2hex(random_bytes(16));
}

// ---- Required fields (aligned with your form) ----
$payrollempid   = $_POST['payrollempid'] ?? "";
$firstname      = $_POST['firstname'] ?? "";
$middlename     = $_POST['middlename'] ?? "";
$lastname       = $_POST['lastname'] ?? "";
$position       = $_POST['position'] ?? "";
$department     = $_POST['department'] ?? "";
$birthdate      = $_POST['birthdate'] ?? "";
$sss            = $_POST['sss'] ?? "";
$phic           = $_POST['phic'] ?? "";
$mdf            = $_POST['mdf'] ?? "";
$tin            = $_POST['tin'] ?? "";
$contactno      = $_POST['contactno'] ?? "";
$email          = $_POST['email'] ?? "";
$address        = $_POST['address'] ?? "";
$salary         = $_POST['salary'] ?? "";
$salary_type    = $_POST['salarytype'] ?? "";
$business_unit  = $_POST['businessunit'] ?? "";
$tax_class      = $_POST['taxclass'] ?? "";
$spp_class      = $_POST['sppclass'] ?? "";
$day_factor     = $_POST['dayfactor'] ?? "";
$datestarted    = $_POST['datestarted'] ?? "";
$company_code   = $_POST['company_code'] ?? "";

// ✅ Password
$password       = $_POST['password'] ?? "";
$password2      = $_POST['password_confirm'] ?? "";

// --- Basic validations ---
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(["message" => "InvalidEmail"]);
  exit;
}

if (strlen($password) < 6) {
  http_response_code(400);
  echo json_encode(["message" => "PasswordTooShort"]);
  exit;
}
if ($password !== $password2) {
  http_response_code(400);
  echo json_encode(["message" => "PasswordMismatch"]);
  exit;
}

try {
  $conn->beginTransaction();

  // Duplicate checks
  $sql = "SELECT 1 FROM tbl_employees WHERE LOWER(email)=LOWER(:email) AND deletestatus='Active' LIMIT 1";
  $stmt = $conn->prepare($sql);
  $stmt->bindValue(":email", $email, PDO::PARAM_STR);
  $stmt->execute();
  if ($stmt->rowCount() > 0) {
    $conn->rollBack();
    echo json_encode(["message" => "DuplicateInfo"]);
    exit;
  }

  $sql = "SELECT 1 FROM tbl_users_global_assignment WHERE LOWER(email)=LOWER(:email) AND deletestatus='Active' LIMIT 1";
  $stmt = $conn->prepare($sql);
  $stmt->bindValue(":email", $email, PDO::PARAM_STR);
  $stmt->execute();
  if ($stmt->rowCount() > 0) {
    $conn->rollBack();
    echo json_encode(["message" => "DuplicateUser"]);
    exit;
  }

  if ($payrollempid !== "") {
    $sql = "SELECT 1 FROM tbl_employees WHERE payroll_empid=:payroll_empid AND deletestatus='Active' LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":payroll_empid", $payrollempid, PDO::PARAM_STR);
    $stmt->execute();
    if ($stmt->rowCount() > 0) {
      $conn->rollBack();
      echo json_encode(["message" => "DuplicatePayroll"]);
      exit;
    }
  }

  // Employee ID = YYYYMM + random
  $employeeId = date("Ym") . strval(random_int(100000, 999999));

  // ✅ usertracker: since no JWT, you can store "PUBLIC_SIGNUP" or "SYSTEM"
  $usertracker = "PUBLIC_SIGNUP";

  // Insert employee
  $sql = "INSERT INTO tbl_employees () VALUES
    (default, :payrollempid, :empid, ShortUUID(), :firstname, :middlename, :lastname, :position,
     :department, :birthdate, :sss, :phic, :mdf, :tin, :contact_no, :email, :address, :salary, :salary_type,
     :date_started,'Active', :tax_class, :spp_class, :business_unit, :day_factor,
     null, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

  $stmt = $conn->prepare($sql);
  $stmt->bindValue(":payrollempid", $payrollempid, PDO::PARAM_STR);
  $stmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
  $stmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
  $stmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
  $stmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
  $stmt->bindValue(":position", $position, PDO::PARAM_STR);
  $stmt->bindValue(":department", $department, PDO::PARAM_STR);
  $stmt->bindValue(":birthdate", $birthdate, PDO::PARAM_STR);
  $stmt->bindValue(":sss", $sss, PDO::PARAM_STR);
  $stmt->bindValue(":phic", $phic, PDO::PARAM_STR);
  $stmt->bindValue(":mdf", $mdf, PDO::PARAM_STR);
  $stmt->bindValue(":tin", $tin, PDO::PARAM_STR);
  $stmt->bindValue(":contact_no", $contactno, PDO::PARAM_STR);
  $stmt->bindValue(":email", strtolower($email), PDO::PARAM_STR);
  $stmt->bindValue(":address", $address, PDO::PARAM_STR);
  $stmt->bindValue(":salary", $salary, PDO::PARAM_STR);
  $stmt->bindValue(":salary_type", $salary_type, PDO::PARAM_STR);
  $stmt->bindValue(":business_unit", $business_unit, PDO::PARAM_STR);
  $stmt->bindValue(":tax_class", $tax_class, PDO::PARAM_STR);
  $stmt->bindValue(":spp_class", $spp_class, PDO::PARAM_STR);
  $stmt->bindValue(":day_factor", $day_factor, PDO::PARAM_STR);
  $stmt->bindValue(":date_started", $datestarted, PDO::PARAM_STR);
  $stmt->bindValue(":usertracker", $usertracker, PDO::PARAM_STR);
  $stmt->execute();

  // history
  $historysql = "INSERT INTO tbl_emp_history () VALUES
    (default, :emp_id, :historical_date, :activity, :particulars,'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
  $historystmt = $conn->prepare($historysql);
  $historystmt->bindValue(":emp_id", $employeeId, PDO::PARAM_STR);
  $historystmt->bindValue(":historical_date", $datestarted, PDO::PARAM_STR);
  $historystmt->bindValue(":activity", 'On-boarded', PDO::PARAM_STR);
  $historystmt->bindValue(":particulars", 'Employee started on this period', PDO::PARAM_STR);
  $historystmt->bindValue(":usertracker", $usertracker, PDO::PARAM_STR);
  $historystmt->execute();

  // Handle image upload (same style as yours)
  $imagePath = dirname(__DIR__, 1) . '/images/employees/';
  $imageFilename = $employeeId;

  if (isset($_FILES['employeeimage']) && $_FILES['employeeimage']['error'] === UPLOAD_ERR_OK) {
    $imageFilename = $employeeId . '_' . basename($_FILES['employeeimage']['name']);
    $targetPath = $imagePath . $imageFilename;

    if (move_uploaded_file($_FILES['employeeimage']['tmp_name'], $targetPath)) {
      $jpegQuality = 10;
      $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

      $updateSql = "UPDATE tbl_employees SET image_filename=:targetpath WHERE empid=:empid";
      $updateStmt = $conn->prepare($updateSql);
      $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
      $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
      $updateStmt->execute();
    }
  } else {
    $targetPath = $imagePath . $imageFilename;

    $updateSql = "UPDATE tbl_employees SET image_filename=:targetpath WHERE empid=:empid";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
    $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
    $updateStmt->execute();
  }

  // ✅ Create user (PASSWORD FROM FORM)
  $password_hash = password_hash($password, PASSWORD_DEFAULT);
  $emails = strtolower($email);

  $usersql = "INSERT INTO tbl_users_global_assignment
    (uuid,email,classification,password, firstname,middlename,lastname, company, department, contactnumber,
     status, verified, passlock, otp, otplock, usertracker, deletestatus, createtime)
    VALUES
    (:uuid, :email, :classification, :password, :firstname,:middlename, :lastname,
     :company, :department, :contactnumber, 'Active', 'Verified', 0, :otp , 0, :usertracker,'Active',DATE_ADD(NOW(), INTERVAL 8 HOUR))";

  $userstmt = $conn->prepare($usersql);
  $userstmt->bindValue(":uuid", $employeeId, PDO::PARAM_STR);
  $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);
  $userstmt->bindValue(":classification", $position, PDO::PARAM_STR);
  $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
  $userstmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
  $userstmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
  $userstmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
  $userstmt->bindValue(":company", $business_unit, PDO::PARAM_STR);
  $userstmt->bindValue(":department", $department, PDO::PARAM_STR);
  $userstmt->bindValue(":contactnumber", $contactno, PDO::PARAM_STR);
  $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);
  $userstmt->bindValue(":usertracker", $usertracker, PDO::PARAM_STR);
  $userstmt->execute();

  // ✅ Get the uuid assigned to the new user in tbl_users_global_assignment (safe fetch)
  $newUserUuid = $employeeId;
  $uuidStmt = $conn->prepare("
    SELECT uuid
    FROM tbl_users_global_assignment
    WHERE LOWER(email) = LOWER(:email)
      AND deletestatus = 'Active'
    ORDER BY createtime DESC
    LIMIT 1
  ");
  $uuidStmt->bindValue(":email", $emails, PDO::PARAM_STR);
  $uuidStmt->execute();
  $foundUuid = $uuidStmt->fetchColumn();
  if ($foundUuid) $newUserUuid = (string)$foundUuid;

  if (!$newUserUuid) {
    throw new Exception("Cannot resolve new user UUID for role assignment.");
  }

  // ✅ Add roles to tbl_user_roles (uuid = RL-..., userid = user's uuid)
  // NOTE: Adjust column list if your tbl_user_roles differs.
  $roleSql = "
    INSERT INTO tbl_user_roles
      (uuid, userid, roleclass, rolename, role_description, deletestatus, usertracker, createtime)
    VALUES
      (:uuid, :userid, :roleclass, :rolename, :role_description, :deletestatus, :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))
  ";
  $roleStmt = $conn->prepare($roleSql);

  foreach ($DEFAULT_ROLES as $r) {
    $roleclass = (string)($r["roleclass"] ?? "");
    $rolename  = (string)($r["rolename"] ?? "");
    $roledesc  = (string)($r["role_description"] ?? "");
    $delstat   = (string)($r["deletestatus"] ?? "Active");

    if ($roleclass === "" || $rolename === "") {
      continue; // skip invalid rows
    }

    $roleUuid = genRoleUuid();

    $roleStmt->bindValue(":uuid", $roleUuid, PDO::PARAM_STR);
    $roleStmt->bindValue(":userid", $newUserUuid, PDO::PARAM_STR);
    $roleStmt->bindValue(":roleclass", $roleclass, PDO::PARAM_STR);
    $roleStmt->bindValue(":rolename", $rolename, PDO::PARAM_STR);
    $roleStmt->bindValue(":role_description", $roledesc, PDO::PARAM_STR);
    $roleStmt->bindValue(":deletestatus", $delstat, PDO::PARAM_STR);
    $roleStmt->bindValue(":usertracker", $usertracker, PDO::PARAM_STR);

    $roleStmt->execute();
  }

  // ✅ Commit DB changes BEFORE attempting email (email must not block signup)
  $conn->commit();

  // Email Credentials
  try {
    $emailController = new EmailSendController();

    $userId = $firstname !== "" ? $firstname : "User";
    $safeEmail = strtolower($email);
    $safeCompany = htmlspecialchars((string)$business_unit, ENT_QUOTES, 'UTF-8');
    $safeCompanyCode = htmlspecialchars((string)$company_code, ENT_QUOTES, 'UTF-8');
    $safeUserEmail = htmlspecialchars((string)$safeEmail, ENT_QUOTES, 'UTF-8');

    $subject = "Welcome to Exinnov - Account Created";

    $html = "
    <html>
      <body style='margin:0; padding:0; background-color:#ffffff;'>
        <table align='center' width='100%' cellpadding='0' cellspacing='0'
          style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
          <tr>
            <td style='padding:20px; text-align:center; background-color:darkgray;'>
              <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo' width='120' style='display:block; margin:auto;'>
            </td>
          </tr>

          <tr>
            <td style='padding:30px;'>
              <p style='font-size:18px; margin:0 0 18px;'>Dear <strong>{$userId}</strong>,</p>

              <p style='font-size:16px; margin:0 0 10px;'>
                Your Exinnov account has been created successfully.
              </p>

              <div style='margin:18px 0; padding:16px; border:1px solid #eee; border-radius:10px; background:#fafafa;'>
                <p style='margin:0 0 8px; font-size:14px;'><strong>Company:</strong> {$safeCompany}</p>
                <p style='margin:0 0 8px; font-size:14px;'><strong>Company Code:</strong> {$safeCompanyCode}</p>
                <p style='margin:0; font-size:14px;'><strong>User Account (Email):</strong> {$safeUserEmail}</p>
              </div>

              <p style='font-size:14px; margin:0 0 18px;'>
                <strong>Note:</strong> Please use the password you registered during signup. (We do not send passwords via email.)
              </p>

              <p style='font-size:14px; margin:0;'>
                Thank you,<br>
                <strong>Exinnov Team</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
              © 2026 Exinnov. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>";

    $emailController->sendEmail(
      "mail.exinnovph.com",
      "admin@exinnovph.com",
      "ExinnovEmail@2025",
      "admin@exinnovph.com",
      $safeEmail,
      $subject,
      $html
    );
  } catch (Exception $mailErr) {
    // ✅ Do not block signup if email fails
    // error_log("Signup email failed: " . $mailErr->getMessage());
  }

  echo json_encode([
    "message" => "SignupUserCreated",
    "email" => strtolower($email),
    "company_code" => $company_code,
    "empid" => $employeeId,
    "uuid" => $newUserUuid
  ]);

} catch (Exception $e) {
  if ($conn->inTransaction()) $conn->rollBack();
  http_response_code(400);
  echo json_encode(["error" => "An error occurred: " . $e->getMessage()]);
}
