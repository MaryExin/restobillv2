<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/QrOrderGateway.php';

$checks = 0;
function qrCheck(bool $condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function qrReject(array $data, string $field): void
{
    try {
        QrOrderGateway::normalizeSubmission($data);
    } catch (InvalidArgumentException $expected) {
        qrCheck(true, $field);
        return;
    }
    throw new RuntimeException('Accepted invalid ' . $field);
}
$base = ['request_id' => '4b01eab8-edda-449c-b2c5-514c63b4ca55', 'order_type' => 'DINE IN',
    'table_number' => 'Table 01', 'items' => [['product_id' => 'P1', 'quantity' => 2, 'item_instruction' => 'No ice']]];
$valid = QrOrderGateway::normalizeSubmission($base + ['selling_price' => 0.01, 'customer_head_count' => 3]);
qrCheck($valid['customer_head_count'] === 3 && !isset($valid['selling_price']), 'Ignore client prices.');
qrCheck($valid['items'][0]['item_instruction'] === 'No ice', 'Preserve instructions.');
$takeout = $base;
$takeout['order_type'] = 'take out';
$takeout['table_number'] = 'untrusted table';
qrCheck(QrOrderGateway::normalizeSubmission($takeout)['table_number'] === '', 'Takeout has no table.');
foreach ([0, -1, 1.5, 100, 'NaN', [], true] as $quantity) {
    $input = $base;
    $input['items'][0]['quantity'] = $quantity;
    qrReject($input, 'quantity');
}
foreach (['', '1', str_repeat('a', 36)] as $id) {
    $input = $base;
    $input['request_id'] = $id;
    qrReject($input, 'request ID');
}
foreach ([['items', []], ['items', ['first' => $base['items'][0]]], ['table_number', ''],
    ['order_type', 'GRAB'], ['notes', str_repeat('x', 1001)], ['customer_head_count', 0], ['customer_name', []]] as [$key, $value]) {
    $input = $base;
    $input[$key] = $value;
    qrReject($input, $key);
}
$input = $base;
$input['items'] = array_fill(0, 51, $base['items'][0]);
qrReject($input, 'line count');
$input['items'] = array_fill(0, 3, ['product_id' => 'P1', 'quantity' => 99]);
qrReject($input, 'total quantity');

$catalog = ['P1' => ['selling_price' => 112, 'vatable' => 'Yes'], 'P2' => ['selling_price' => 100, 'vatable' => 'No']];
$items = [['product_id' => 'P1', 'quantity' => 1], ['product_id' => 'P2', 'quantity' => 1]];
$settings = ['enabled' => true, 'basis' => 'vat_exclusive_less_discount',
    'charges' => [['rate_type' => 'Percentage', 'amount' => 5], ['rate_type' => 'Fixed', 'amount' => 20]]];
$estimate = QrOrderGateway::estimateCharges($items, $catalog, $settings);
qrCheck($estimate === ['subtotal_amount' => 212.0, 'service_charge_amount' => 30.0, 'total_amount' => 242.0], 'VAT-exclusive mixed products plus fixed charge.');
$settings['basis'] = 'net_after_deductions';
$estimate = QrOrderGateway::estimateCharges($items, $catalog, $settings);
qrCheck($estimate['service_charge_amount'] === 29.46, 'Legacy basis matches POS subtotal / 1.12.');
$settings['enabled'] = false;
qrCheck(QrOrderGateway::estimateCharges($items, $catalog, $settings)['total_amount'] === 212.0, 'Disabled charges are excluded.');

define('RESTOBILL_SAVE_ORDER_LIBRARY', true);
ob_start();
require_once __DIR__ . '/../api/save_order.php';
$output = ob_get_clean();
qrCheck($output === '' && function_exists('posSaveOrder'), 'Shared writer loads without HTTP output or a database connection.');
echo "Passed {$checks} QR ordering checks.\n";
