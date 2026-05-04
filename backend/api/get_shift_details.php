<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

$configPath = __DIR__ . '/config.php';

if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode([
        "message" => "config.php not found in api folder."
    ]);
    exit;
}

$config = require_once $configPath;

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $config['user'], $config['pass'], $options);

    $user_id = $_GET['user_id'] ?? "";

    if (empty($user_id)) {
        http_response_code(400);
        echo json_encode([
            "message" => "User ID missing."
        ]);
        exit;
    }

    // --- Query 1: Current User Details ---
    $sql_user = "
        SELECT 
            CONCAT(firstname, ' ', lastname) AS full_name,
            classification AS User_Role
        FROM tbl_users_global_assignment
        WHERE uuid = :user_id
        LIMIT 1
    ";
    $stmt_user = $pdo->prepare($sql_user);
    $stmt_user->bindValue(':user_id', $user_id, PDO::PARAM_STR);
    $stmt_user->execute();
    $user_data = $stmt_user->fetch();

    // --- Query 2: Business Unit Info ---
    $sql_unit = "
        SELECT 
            Category_Code,
            Unit_Code,
            Unit_Name,
            Business_Type,
            Unit_TIN,
            Unit_Address
        FROM tbl_main_business_units
        ORDER BY id DESC
        LIMIT 1
    ";
    $stmt_unit = $pdo->prepare($sql_unit);
    $stmt_unit->execute();
    $unit_data = $stmt_unit->fetch();

    // --- Query 3: Last Shift Record ---
    $sql_shift = "
        SELECT 
            T1.Shift_Status, 
            T1.Shift_ID, 
            T1.Opening_DateTime, 
            T1.Closing_DateTime,
            CONCAT(T2.firstname, ' ', T2.lastname) AS opened_by_name,
            CASE 
                WHEN T1.Closing_User_ID IS NOT NULL AND T1.Closing_User_ID <> '0'
                THEN CONCAT(T3.firstname, ' ', T3.lastname)
                ELSE 'N/A'
            END AS closed_by_name
        FROM tbl_pos_shifting_records AS T1
        LEFT JOIN tbl_users_global_assignment AS T2
            ON T1.Opening_User_ID = T2.uuid
        LEFT JOIN tbl_users_global_assignment AS T3
            ON T1.Closing_User_ID = T3.uuid
        ORDER BY T1.Opening_DateTime DESC
        LIMIT 1
    ";
    $stmt_shift = $pdo->prepare($sql_shift);
    $stmt_shift->execute();
    $lastRecord = $stmt_shift->fetch();

// --- Query 4: All Accounts For Switch User ---
$sql_accounts = "
    SELECT 
        uga.uuid,
        uga.email,
        CONCAT(
            COALESCE(uga.firstname, ''),
            CASE 
                WHEN uga.firstname IS NOT NULL 
                     AND uga.firstname <> ''
                     AND uga.lastname IS NOT NULL 
                     AND uga.lastname <> ''
                THEN ' '
                ELSE ''
            END,
            COALESCE(uga.lastname, '')
        ) AS full_name,
        uga.classification AS user_role
    FROM tbl_users_global_assignment AS uga
    WHERE 
        (COALESCE(uga.firstname, '') <> '' OR COALESCE(uga.lastname, '') <> '')
        AND COALESCE(uga.email, '') <> ''
    ORDER BY full_name ASC
";
$stmt_accounts = $pdo->prepare($sql_accounts);
$stmt_accounts->execute();
$accounts = $stmt_accounts->fetchAll();

    $sql_terminal = "
        SELECT 
           * FROM tbl_pos_terminal_config
    ";
    $stmt_terminal = $pdo->prepare($sql_terminal);
    $stmt_terminal->execute();
    $terminal = $stmt_terminal->fetch();

$formattedAccounts = array_map(function ($row) {
    return [
        "id"       => $row["uuid"],
        "uuid"     => $row["uuid"],
        "username" => $row["email"] ?? "",
        "email"    => $row["email"] ?? "",
        "name"     => trim($row["full_name"]) !== "" ? trim($row["full_name"]) : "Unknown User",
        "userRole" => $row["user_role"] ?? null,
    ];
}, $accounts);

    // --- Final Date Logic ---
    $finalDate = ($lastRecord && !empty($lastRecord['Closing_DateTime']))
        ? $lastRecord['Closing_DateTime']
        : date("Y-m-d", strtotime("yesterday"));

    // --- Final Response ---
    $response = [
        "Category_Code"    => $unit_data['Category_Code'] ?? null,
        "Unit_Code"        => $unit_data['Unit_Code'] ?? null,
        "selectedDate"     => $finalDate,
        "Shift_Status"     => $lastRecord['Shift_Status'] ?? "Closed",
        "Shift_ID"         => $lastRecord['Shift_ID'] ?? "N/A",
        "Opening_DateTime" => $lastRecord['Opening_DateTime'] ?? null,
        "Closing_DateTime" => $lastRecord['Closing_DateTime'] ?? null,
        "opened_by_name"   => $lastRecord['opened_by_name'] ?? "N/A",
        "closed_by_name"   => $lastRecord['closed_by_name'] ?? "N/A",
        "Business_Type"    => $unit_data['Business_Type'] ?? "N/A",
        "Unit_TIN"        => $unit_data['Unit_TIN'] ?? "N/A",
        "Unit_Address"    => $unit_data['Unit_Address'] ?? "N/A",
        "Unit_Name"        => $unit_data['Unit_Name'] ?? "N/A",
        "userName"         => $user_data['full_name'] ?? "Unknown",
        "userRole"         => $user_data['User_Role'] ?? null,
        "accounts"         => $formattedAccounts,
        "terminal"         => $terminal
    ];
    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "message" => "Database Error: " . $e->getMessage()
    ]);
}
?>