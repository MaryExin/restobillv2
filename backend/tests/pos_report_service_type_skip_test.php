<?php

declare(strict_types=1);

require_once __DIR__ . "/../api/pos_report_mirror.php";

function posReportServiceTypeAssertSame(
    mixed $expected,
    mixed $actual,
    string $message
): void {
    if ($expected !== $actual) {
        throw new RuntimeException(
            "Failed: {$message}; expected " .
            var_export($expected, true) .
            ", got " .
            var_export($actual, true)
        );
    }
}

$cases = [
    "Food Panda at skipped rank is posted" => [[], 3, 3, "FOOD PANDA", false],
    "Food Panda comparison ignores case and edge spaces" => [[], 6, 3, " food panda ", false],
    "Grab at skipped rank is posted" => [[], 3, 3, "GRAB", false],
    "Grab comparison ignores case and edge spaces" => [[], 6, 3, " grab ", false],
    "previously skipped Food Panda is repaired" => [["report_status" => "1"], 3, 3, "FOOD PANDA", false],
    "previously skipped Grab is repaired" => [["report_status" => "1"], 3, 3, "GRAB", false],
    "Dine In still skips at the configured rank" => [[], 3, 3, "DINE IN", true],
    "non-skipped Dine In remains posted" => [[], 2, 3, "DINE IN", false],
    "stored skipped status remains frozen for other types" => [["report_status" => "1"], 2, 3, "TAKE OUT", true],
    "stored posted status remains frozen for other types" => [["report_status" => "0"], 3, 3, "TAKE OUT", false],
    "GrabFood payment label is not a service-type exemption" => [[], 3, 3, "GrabFood", true],
];

foreach ($cases as $label => [$mapRow, $sourceRank, $skipInterval, $serviceType, $expected]) {
    posReportServiceTypeAssertSame(
        $expected,
        posReportMirrorShouldSkipTransaction(
            $mapRow,
            $sourceRank,
            $skipInterval,
            $serviceType
        ),
        $label
    );
}

$fetchReflection = new ReflectionFunction("posReportMirrorFetchSourceTransaction");
$mirrorReflection = new ReflectionFunction("mirrorPosTransactionToReport");
$sourcePath = $fetchReflection->getFileName();
if ($sourcePath === false || $sourcePath !== $mirrorReflection->getFileName()) {
    throw new RuntimeException("Failed: unable to locate report mirror source");
}

$sourceLines = file($sourcePath);
if ($sourceLines === false) {
    throw new RuntimeException("Failed: unable to read report mirror source");
}

$functionSource = static function (ReflectionFunction $reflection) use ($sourceLines): string {
    return implode("", array_slice(
        $sourceLines,
        $reflection->getStartLine() - 1,
        $reflection->getEndLine() - $reflection->getStartLine() + 1
    ));
};

posReportServiceTypeAssertSame(
    true,
    str_contains($functionSource($fetchReflection), "order_type"),
    "source transaction lookup must read order_type"
);
posReportServiceTypeAssertSame(
    true,
    str_contains(
        $functionSource($mirrorReflection),
        "posReportMirrorShouldSkipTransaction("
    ),
    "central mirror must use the service-type-aware skip decision"
);

echo "POS report service-type skip tests passed.\n";
