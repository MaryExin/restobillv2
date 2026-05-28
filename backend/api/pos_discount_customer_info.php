<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function normalizeDiscountType($value)
{
    $value = trim((string)$value);

    $map = [
        "senior" => "Senior Citizen Discount",
        "senior citizen" => "Senior Citizen Discount",
        "senior citizen discount" => "Senior Citizen Discount",
        "pwd" => "PWD Discount",
        "pwd discount" => "PWD Discount",
        "naac" => "NAAC Discount",
        "naac discount" => "NAAC Discount",
        "national athletes and coaches" => "NAAC Discount",
        "national athletes and coaches discount" => "NAAC Discount",
        "solo parent" => "Solo Parent Discount",
        "solo parent discount" => "Solo Parent Discount",
        "soloparent" => "Solo Parent Discount",
        "manual" => "Manual Discount",
        "manual discount" => "Manual Discount",
    ];

    $key = strtolower($value);
    return $map[$key] ?? $value;
}

function moneyRound($value)
{
    return round((float)$value, 2);
}

function normalizeNullable($value)
{
    $value = trim((string)$value);
    return $value === "" ? null : $value;
}

function splitAmountAcrossCount($totalAmount, $count)
{
    $count = (int)$count;
    $totalAmount = moneyRound($totalAmount);

    if ($count <= 0 || $totalAmount <= 0) {
        return [];
    }

    $base = floor(($totalAmount / $count) * 100) / 100;
    $rows = array_fill(0, $count, $base);
    $assigned = moneyRound($base * $count);
    $difference = moneyRound($totalAmount - $assigned);
    $rows[$count - 1] = moneyRound($rows[$count - 1] + $difference);

    return $rows;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $transactionId = isset($body["transaction_id"]) ? (int)$body["transaction_id"] : 0;
    $categoryCode = trim((string)($body["category_code"] ?? $body["Category_Code"] ?? ""));
    $unitCode = trim((string)($body["unit_code"] ?? $body["Unit_Code"] ?? ""));
    $usertracker = trim((string)($body["user_name"] ?? $body["cashier"] ?? "Store Crew"));
    $customerHeadCount = isset($body["customer_head_count"]) ? (int)$body["customer_head_count"] : 1;
    $customerDiscountCount = isset($body["customer_count_for_discount"]) ? (int)$body["customer_count_for_discount"] : 0;
    $discountTypeSummary = trim((string)($body["discount_type"] ?? ""));
    $customerInfo = isset($body["customer_info"]) && is_array($body["customer_info"])
        ? array_values($body["customer_info"])
        : [];
    $discountBreakdown = isset($body["discount_breakdown"]) && is_array($body["discount_breakdown"])
        ? $body["discount_breakdown"]
        : [];

    if ($transactionId <= 0) {
        throw new Exception("transaction_id is required.");
    }

    if ($categoryCode === "" || $unitCode === "") {
        $stmtTxn = $pdo->prepare("
            SELECT Category_Code, Unit_Code
            FROM tbl_pos_transactions
            WHERE transaction_id = :transaction_id
            LIMIT 1
        ");
        $stmtTxn->execute([":transaction_id" => $transactionId]);
        $txn = $stmtTxn->fetch(PDO::FETCH_ASSOC);

        if (!$txn) {
            throw new Exception("Transaction not found.");
        }

        $categoryCode = $categoryCode !== "" ? $categoryCode : trim((string)$txn["Category_Code"]);
        $unitCode = $unitCode !== "" ? $unitCode : trim((string)$txn["Unit_Code"]);
    }

    $pdo->beginTransaction();

    $firstCustomerId = "";
    foreach ($customerInfo as $card) {
        if (!is_array($card)) {
            continue;
        }

        $candidate = trim((string)($card["customer_exclusive_id"] ?? ""));
        if ($candidate !== "") {
            $firstCustomerId = $candidate;
            break;
        }
    }

    $stmtMain = $pdo->prepare("
        UPDATE tbl_pos_transactions
        SET customer_exclusive_id = :customer_exclusive_id,
            customer_head_count = :customer_head_count,
            customer_count_for_discount = :customer_count_for_discount,
            discount_type = :discount_type,
            date_recorded = NOW()
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
    ");
    $stmtMain->execute([
        ":customer_exclusive_id" => $firstCustomerId,
        ":customer_head_count" => max($customerHeadCount, 1),
        ":customer_count_for_discount" => max($customerDiscountCount, 0),
        ":discount_type" => $discountTypeSummary,
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);

    $stmtExisting = $pdo->prepare("
        SELECT id, customer_id
        FROM tbl_pos_transactions_discounts
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
        ORDER BY id ASC
    ");
    $stmtExisting->execute([
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);
    $existingRows = $stmtExisting->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsert = $pdo->prepare("
        INSERT INTO tbl_pos_transactions_discounts (
            transaction_id,
            Category_Code,
            Unit_Code,
            customer_id,
            discount_type,
            discount_amount,
            customer_name,
            date_of_birth,
            gender,
            tin,
            contact_no,
            status,
            usertracker,
            created_at
        ) VALUES (
            :transaction_id,
            :category_code,
            :unit_code,
            :customer_id,
            :discount_type,
            :discount_amount,
            :customer_name,
            :date_of_birth,
            :gender,
            :tin,
            :contact_no,
            'Active',
            :usertracker,
            NOW()
        )
    ");

    $stmtUpdate = $pdo->prepare("
        UPDATE tbl_pos_transactions_discounts
        SET customer_id = :customer_id,
            discount_type = :discount_type,
            discount_amount = :discount_amount,
            customer_name = :customer_name,
            date_of_birth = :date_of_birth,
            gender = :gender,
            tin = :tin,
            contact_no = :contact_no,
            status = 'Active',
            usertracker = :usertracker
        WHERE id = :id
    ");

    $usedRowIds = [];
    $rowIndex = 0;
    $savedRows = 0;

    foreach ($discountBreakdown as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $discountType = normalizeDiscountType($entry["discount_type"] ?? "");
        $qualifiedCount = isset($entry["qualified_count"]) ? (int)$entry["qualified_count"] : 0;
        $discountAmount = isset($entry["discount_amount"]) ? (float)$entry["discount_amount"] : 0;

        if ($qualifiedCount <= 0 || $discountAmount <= 0) {
            continue;
        }

        foreach (splitAmountAcrossCount($discountAmount, $qualifiedCount) as $rowAmount) {
            $card = $customerInfo[$rowIndex] ?? [];
            if (!is_array($card)) {
                $card = [];
            }

            $typedCustomerId = trim((string)($card["customer_exclusive_id"] ?? ""));
            $customerId = $typedCustomerId !== "" ? $typedCustomerId : (string)($rowIndex + 1);
            $customerName = trim((string)($card["customer_name"] ?? ""));
            $dateOfBirth = trim((string)($card["date_of_birth"] ?? ""));
            $gender = trim((string)($card["gender"] ?? ""));
            $tin = trim((string)($card["tin"] ?? ""));
            $contactNo = trim((string)($card["contact_no"] ?? ""));

            if (isset($existingRows[$rowIndex])) {
                $existingId = (int)$existingRows[$rowIndex]["id"];
                $stmtUpdate->execute([
                    ":id" => $existingId,
                    ":customer_id" => $customerId,
                    ":discount_type" => $discountType,
                    ":discount_amount" => moneyRound($rowAmount),
                    ":customer_name" => normalizeNullable($customerName),
                    ":date_of_birth" => normalizeNullable($dateOfBirth),
                    ":gender" => normalizeNullable($gender),
                    ":tin" => normalizeNullable($tin),
                    ":contact_no" => normalizeNullable($contactNo),
                    ":usertracker" => $usertracker,
                ]);
                $usedRowIds[] = $existingId;
            } else {
                $stmtInsert->execute([
                    ":transaction_id" => $transactionId,
                    ":category_code" => $categoryCode,
                    ":unit_code" => $unitCode,
                    ":customer_id" => $customerId,
                    ":discount_type" => $discountType,
                    ":discount_amount" => moneyRound($rowAmount),
                    ":customer_name" => normalizeNullable($customerName),
                    ":date_of_birth" => normalizeNullable($dateOfBirth),
                    ":gender" => normalizeNullable($gender),
                    ":tin" => normalizeNullable($tin),
                    ":contact_no" => normalizeNullable($contactNo),
                    ":usertracker" => $usertracker,
                ]);
                $usedRowIds[] = (int)$pdo->lastInsertId();
            }

            $savedRows++;
            $rowIndex++;
        }
    }

    $existingRowIds = array_map(fn($row) => (int)$row["id"], $existingRows);
    $unusedRowIds = array_values(array_diff($existingRowIds, $usedRowIds));
    if (!empty($unusedRowIds)) {
        $placeholders = implode(",", array_fill(0, count($unusedRowIds), "?"));
        $stmtInactive = $pdo->prepare("
            UPDATE tbl_pos_transactions_discounts
            SET status = 'Inactive',
                usertracker = ?
            WHERE transaction_id = ?
              AND Category_Code = ?
              AND Unit_Code = ?
              AND id IN ($placeholders)
              AND status = 'Active'
        ");
        $stmtInactive->execute(array_merge(
            [$usertracker, $transactionId, $categoryCode, $unitCode],
            $unusedRowIds
        ));
    }

    $pdo->commit();

    respond(true, "Customer info saved.", [
        "saved_rows" => $savedRows,
        "customer_head_count" => max($customerHeadCount, 1),
        "customer_count_for_discount" => max($customerDiscountCount, 0),
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    respond(false, $e->getMessage(), null, 500);
}
