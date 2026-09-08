<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/ShiftSalesSyncLocalReadGateway.php';

function shiftSyncMethodSource(ReflectionMethod $method): string
{
    $lines = file($method->getFileName());
    if ($lines === false) {
        throw new RuntimeException('Failed: unable to read gateway source.');
    }

    return implode('', array_slice(
        $lines,
        $method->getStartLine() - 1,
        $method->getEndLine() - $method->getStartLine() + 1
    ));
}

$gatewayClass = new ReflectionClass(ShiftSalesSyncLocalReadGateway::class);
$gateway = $gatewayClass->newInstanceWithoutConstructor();

$dateMethod = $gatewayClass->getMethod('getTransactionDateCandidates');
$dateCandidates = $dateMethod->invoke($gateway, '2026-03-08 09:15:00');
if ($dateCandidates !== ['2026-03-08', '3/8/2026', '03/08/2026']) {
    throw new RuntimeException('Failed: transaction date formats are incomplete.');
}

$usDateCandidates = $dateMethod->invoke($gateway, '3/8/2026 9:15 AM');
if ($usDateCandidates !== $dateCandidates) {
    throw new RuntimeException('Failed: US shift dates must resolve to the same exact-match values.');
}

if ($dateMethod->invoke($gateway, 'not-a-date') !== []) {
    throw new RuntimeException('Failed: invalid shift dates must not trigger a transaction scan.');
}

$scopeMethod = $gatewayClass->getMethod('buildScopedTransactionWhere');
$refs = [
    [
        'Category_Code' => 'CAT',
        'Unit_Code' => 'UNIT',
        'terminal_number' => '1',
        'transaction_id' => 'TX-1',
    ],
    [
        'Category_Code' => 'CAT',
        'Unit_Code' => 'UNIT',
        'terminal_number' => '1',
        'transaction_id' => 'TX-2',
    ],
    [
        'Category_Code' => 'CAT',
        'Unit_Code' => 'UNIT',
        'terminal_number' => '1',
        'transaction_id' => 'TX-1',
    ],
];
$scope = $scopeMethod->invoke($gateway, $refs);
if (
    $scope['where'] !== '((Category_Code = ? AND Unit_Code = ? AND transaction_id IN (?,?)))'
    || $scope['values'] !== ['CAT', 'UNIT', 'TX-1', 'TX-2']
) {
    throw new RuntimeException('Failed: transaction scopes must group IDs into one IN lookup.');
}

$shiftReadSource = shiftSyncMethodSource($gatewayClass->getMethod('getOfflineShiftRows'));
foreach ([
    "COALESCE(Shift_Status, '') <> 'Closed'",
    "COALESCE(Closing_DateTime, '') = ''",
    "COALESCE(Remarks, '') <> 'Synced'",
    'ORDER BY ID DESC',
] as $contract) {
    if (!str_contains($shiftReadSource, $contract)) {
        throw new RuntimeException("Failed: pending-shift read is missing {$contract}.");
    }
}
if (str_contains($shiftReadSource, 'STR_TO_DATE')) {
    throw new RuntimeException('Failed: the pending-shift list must not sort every row with STR_TO_DATE.');
}

$transactionReadSource = shiftSyncMethodSource(
    $gatewayClass->getMethod('getOfflineTransactionRefsForShift')
);
if (
    !str_contains($transactionReadSource, 'transaction_date IN')
    || str_contains($transactionReadSource, 'STR_TO_DATE')
) {
    throw new RuntimeException('Failed: transaction reads must use exact date matches.');
}

$webGatewaySource = file_get_contents(
    __DIR__ . '/../src/ShiftSalesSyncWebStatusReadGateway.php'
);
if (
    $webGatewaySource === false
    || !str_contains($webGatewaySource, 'findWebSyncedShiftKeys')
    || !str_contains($webGatewaySource, 'array_chunk($shifts, 250)')
    || str_contains($webGatewaySource, 'existsWebSyncedShift')
) {
    throw new RuntimeException('Failed: WEB status checks must remain batched.');
}

echo "shift sales sync read optimization tests passed\n";
