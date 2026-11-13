<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../src/QrOrderGateway.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('Asia/Manila');

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST, OPTIONS');
        throw new RuntimeException('Method not allowed.', 405);
    }
    $data = $_GET;
    if ($method === 'POST') {
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (strlen((string)$raw) > 65536) throw new RuntimeException('Order is too large.', 413);
        try {
            $body = json_decode((string)$raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new InvalidArgumentException('Send a valid JSON object.');
        }
        if (!is_array($body) || array_values($body) === $body) throw new InvalidArgumentException('Send a JSON object.');
        $data = array_merge($_GET, $body);
    }
    $action = QrOrderGateway::text($data['action'] ?? '', 20, 'action', true);
    $methods = ['menu' => 'GET', 'status' => 'GET', 'pending' => 'GET',
        'setup' => 'POST', 'submit' => 'POST', 'accept' => 'POST', 'reject' => 'POST'];
    if (!isset($methods[$action])) throw new InvalidArgumentException('Unknown QR ordering action.');
    if ($methods[$action] !== $method) throw new RuntimeException('Method not allowed for this action.', 405);

    $category = QrOrderGateway::text($data['category_code'] ?? '', 100, 'category_code', true);
    $unit = QrOrderGateway::text($data['unit_code'] ?? '', 100, 'unit_code', true);
    $public = in_array($action, ['menu', 'submit', 'status'], true);
    if (!$public) {
        // Keep the same JWT/developer-session validation as existing POS role endpoints.
        foreach (['CorsPolicy', 'JWTCodec', 'Auth', 'InvalidSignatureException', 'TokenExpiredException'] as $class) {
            require_once __DIR__ . '/../src/' . $class . '.php';
        }
        require_once __DIR__ . '/bootstrap.php';
        if (trim((string)($_ENV['SECRET_KEY'] ?? getenv('SECRET_KEY') ?: '')) === '') {
            throw new RuntimeException('POS authentication is not configured. Configure SECRET_KEY and the backend environment loader.', 503);
        }
        require __DIR__ . '/pos_role_access_guard.php';
        require_once __DIR__ . '/pos_role_authorization.php';
    }
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO("mysql:host={$config['host']};dbname={$config['db']};charset=utf8mb4",
        $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
    $gateway = new QrOrderGateway($pdo, $config);
    if ($public) {
        $gateway->verifyHost($category, $unit, (string)($_SERVER['HTTP_X_QR_HOST_TOKEN'] ?? ''));
    } else {
        posRoleAuthRequirePermission($pdo, $pos_user_id, 'routes', 'newTransaction');
        $gateway->branch($category, $unit);
    }

    switch ($action) {
        case 'setup':
            $result = $gateway->setup($category, $unit);
            break;
        case 'menu':
            $result = $gateway->menu($category, $unit, strtoupper(QrOrderGateway::text($data['order_type'] ?? 'DINE IN', 30, 'order_type')), $data);
            break;
        case 'submit':
            $result = $gateway->submit($category, $unit, $data);
            break;
        case 'status':
            $result = $gateway->status($category, $unit, $data);
            break;
        case 'pending':
            $result = $gateway->pending($category, $unit);
            break;
        default:
            define('RESTOBILL_SAVE_ORDER_LIBRARY', true);
            require_once __DIR__ . '/save_order.php';
            $account = posRoleAuthRequireActiveAccount($pdo, $pos_user_id);
            $cashier = (string)($account['email'] ?? $pos_user_id);
            $result = $gateway->process($category, $unit, $action, $data, $pos_user_id, $cashier);
    }
    echo json_encode(['success' => true, 'data' => $result], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $code = $error instanceof InvalidArgumentException ? 400 : (int)$error->getCode();
    if (!in_array($code, [400, 401, 403, 404, 405, 409, 413, 429, 503], true)) $code = 500;
    $message = $error->getMessage();
    if ($error instanceof PDOException && in_array((string)$error->getCode(), ['42S02', '42S22'], true)) {
        $code = 503;
        $message = 'QR ordering needs a database update. Apply database/2026-11-12_qr_ordering.sql, database/2026-11-13_qr_order_continuation.sql and the required POS migrations.';
    } elseif ($code === 500) {
        $message = 'Unable to complete the QR order. Please try again or contact the cashier.';
    }
    if ($code >= 500) error_log('QR ordering: ' . $error->getMessage());
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message,
        'code' => $error instanceof QrOrderConflict ? $error->errorCode : null]);
}
