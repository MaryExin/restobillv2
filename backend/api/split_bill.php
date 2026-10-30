<?php

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') exit;
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Use GET to preview or POST to split a bill.']);
    exit;
}

date_default_timezone_set('Asia/Manila');

try {
    // Bootstrap failures must use the same JSON error response as split errors.
    require_once __DIR__ . '/../src/PosSplitBill.php';
    require_once __DIR__ . '/../src/PosSplitBillReport.php';
    $productGroupsHelper = __DIR__ . '/../src/PosOrderProductGroups.php';
    if (is_file($productGroupsHelper)) {
        require_once $productGroupsHelper;
    }
    require __DIR__ . '/pdo.php';

    if ($method === 'GET') {
        $result = posSplitBillPreview($pdo, $_GET['transaction_id'] ?? '',
            $_GET['Category_Code'] ?? '', $_GET['Unit_Code'] ?? '');
    } else {
        $input = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new InvalidArgumentException('A JSON object is required.');
        $result = posSplitBill($pdo, $input, static function (array $source, array $new) use ($pdo, $config): void {
            // Remove moved detail IDs from the old mirror before enrolling the
            // new transaction, since mirror child rows preserve source IDs.
            mirrorPosTransactionToReport($pdo, $config, (string)$source['transaction_id'],
                (string)$source['Category_Code'], (string)$source['Unit_Code']);
            posSplitBillEnrollReport($pdo, $config, (string)$new['ID'], (string)$new['transaction_id'],
                (string)$new['transaction_date'], (string)$new['Category_Code'], (string)$new['Unit_Code']);
        });
    }
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code($error instanceof DomainException ? 409
        : ($error instanceof InvalidArgumentException || $error instanceof JsonException ? 422 : 500));
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
