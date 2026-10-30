<?php

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') exit;
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Use GET to preview or POST to undo a split bill.']);
    exit;
}
date_default_timezone_set('Asia/Manila');

try {
    require_once __DIR__ . '/../src/PosUnsplitBill.php';
    require_once __DIR__ . '/pos_report_mirror.php';
    $productGroupsHelper = __DIR__ . '/../src/PosOrderProductGroups.php';
    if (is_file($productGroupsHelper)) require_once $productGroupsHelper;
    require __DIR__ . '/pdo.php';
    if ($method === 'GET') {
        $result = posUnsplitBillPreview($pdo, $_GET['transaction_id'] ?? '',
            $_GET['Category_Code'] ?? '', $_GET['Unit_Code'] ?? '');
    } else {
        $input = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new InvalidArgumentException('A JSON object is required.');
        $result = posUnsplitBill($pdo, $input, static function (array $source, array $child) use ($pdo, $config): void {
            // Remove the child's report details before restoring the same IDs
            // to the parent. Both mutations preserve existing enrollment/maps.
            mirrorPosTransactionToReport($pdo, $config, (string)$child['transaction_id'],
                (string)$child['Category_Code'], (string)$child['Unit_Code']);
            mirrorPosTransactionToReport($pdo, $config, (string)$source['transaction_id'],
                (string)$source['Category_Code'], (string)$source['Unit_Code']);
        });
    }
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code($error instanceof DomainException ? 409
        : ($error instanceof InvalidArgumentException || $error instanceof JsonException ? 422 : 500));
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
