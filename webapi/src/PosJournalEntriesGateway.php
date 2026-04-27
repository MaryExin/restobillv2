<?php

class PosJournalEntriesGateway
{
    private $conn;
    private $buildComponentMap = null;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getInitialData(): array
    {
        $pendingShifts = $this->getPendingShifts();
        $slcodes = $this->getSLcodes();
        $busunits = $this->getBusunits();

        $shiftPayload = [];

        foreach ($pendingShifts as $shift) {
            $transactions = $this->getTransactionsForShift(
                $shift["Opening_DateTime"] ?? null,
                $shift["Closing_DateTime"] ?? null
            );

            $transactionIds = array_values(
                array_filter(
                    array_map(
                        fn($row) => $row["transaction_id"] ?? null,
                        $transactions
                    )
                )
            );

            $details = $this->getTransactionDetails($transactionIds);
            $discounts = $this->getTransactionDiscounts($transactionIds);
            $payments = $this->getTransactionPayments($transactionIds);
            $otherCharges = $this->getTransactionOtherCharges($transactionIds);

            $activeTransactions = array_values(
                array_filter($transactions, fn($row) => $this->normalize($row["status"] ?? "") === "ACTIVE")
            );
            $refundedTransactions = array_values(
                array_filter($transactions, fn($row) => $this->normalize($row["status"] ?? "") === "REFUNDED")
            );
            $voidedTransactions = array_values(
                array_filter($transactions, fn($row) => $this->normalize($row["status"] ?? "") === "VOIDED")
            );

            $activeIds = array_column($activeTransactions, "transaction_id");
            $refundedIds = array_column($refundedTransactions, "transaction_id");
            $voidedIds = array_column($voidedTransactions, "transaction_id");
            $journalIds = array_values(array_unique(array_merge($activeIds, $refundedIds)));

            $categoryRollups = $this->buildCategoryRollups($details, $discounts, $journalIds);
            $refundedCategoryRollups = $this->buildCategoryRollups($details, $discounts, $refundedIds);
            $refundedTransactionTotals = $this->buildTransactionSalesTotals($details, $refundedIds);
            $discountTotals = $this->buildDiscountTotals($discounts, $journalIds);
            $refundedDiscountTotals = $this->buildDiscountTotals($discounts, $refundedIds);
            $paymentTotals = $this->buildPaymentTotals(
                $payments,
                $journalIds
            );
            $refundedTransactionPaymentTotals = $this->buildTransactionPaymentTotals($payments, $refundedIds);
            $otherChargeTotals = $this->buildOtherChargeTotals($otherCharges, $activeIds);
            $summary = $this->buildSummary($activeTransactions, $refundedTransactions, $voidedTransactions);
            $componentSplits = $this->buildComponentBreakdownRows($details, $journalIds);

            $suggestions = $this->buildSuggestedEntries(
                $shift,
                $slcodes,
                $summary,
                $categoryRollups,
                $refundedCategoryRollups,
                $refundedTransactionTotals,
                $refundedTransactionPaymentTotals,
                $refundedDiscountTotals,
                $discountTotals,
                $paymentTotals
            );

            $unitCode = $shift["Unit_Code"] ?? "";
            $busunit = $busunits[$unitCode] ?? [
                "busunitcode" => $unitCode,
                "name" => "",
            ];

            $suggestedEntries = array_map(
                fn($entry) => array_merge($entry, [
                    "busunitName" => $busunit["name"] ?? "",
                    "busunitCode" => $busunit["busunitcode"] ?? $unitCode,
                ]),
                $suggestions["entries"]
            );

            $shiftPayload[] = [
                "shiftKey" => "SHIFT-" . ($shift["ID"] ?? uniqid()),
                "shift" => $shift,
                "busunit" => [
                    "busunitcode" => $busunit["busunitcode"] ?? $unitCode,
                    "name" => $busunit["name"] ?? "",
                ],
                "transactions" => $transactions,
                "transactionDetails" => $details,
                "transactionDiscounts" => $discounts,
                "transactionPayments" => $payments,
                "transactionOtherCharges" => $otherCharges,
                "breakdown" => [
                    "summary" => $summary,
                    "paymentTotals" => array_values($paymentTotals),
                    "discountTotals" => array_values($discountTotals),
                    "refundedDiscountTotals" => array_values($refundedDiscountTotals),
                    "otherChargeTotals" => array_values($otherChargeTotals),
                    "categoryRollups" => array_values($categoryRollups),
                    "componentSplits" => array_values($componentSplits),
                    "refundedCategoryRollups" => array_values($refundedCategoryRollups),
                    "refundedTransactionTotals" => array_values($refundedTransactionTotals),
                    "refundedTransactionPaymentTotals" => array_values($refundedTransactionPaymentTotals),
                    "activeTransactionIds" => $activeIds,
                    "refundedTransactionIds" => $refundedIds,
                    "voidedTransactionIds" => $voidedIds,
                ],
                "suggestedEntries" => $suggestedEntries,
                "mappingWarnings" => $suggestions["warnings"],
            ];
        }

        return [
            "generatedAt" => date(DATE_ATOM),
            "shifts" => $shiftPayload,
            "slcodes" => array_values($slcodes),
            "busunits" => array_values($busunits),
        ];
    }

    public function postEntries($user_id, array $data): array
    {
        $batches = array_values(
            array_filter($data["batches"] ?? [], fn($batch) => is_array($batch))
        );

        if (empty($batches)) {
            http_response_code(422);
            return [
                "message" => "No selected POS journal batches were provided for posting.",
            ];
        }

        try {
            $this->conn->beginTransaction();
            $this->conn->exec("SET time_zone = '+08:00'");

            $posted = [];

            foreach ($batches as $index => $batch) {
                $validation = $this->validatePostingBatch($batch);
                if (!($validation["ok"] ?? false)) {
                    $this->conn->rollBack();
                    http_response_code($validation["status"] ?? 422);
                    return [
                        "message" => $validation["message"] ?? "POS journal posting validation failed.",
                        "batchKey" => $batch["batchKey"] ?? "",
                    ];
                }

                $postingRef = $this->nextPostingReference();
                $postingDate = $validation["postingDate"];
                $busunitCode = $validation["busunitCode"];
                $lines = $validation["lines"];

                $this->insertAccountingTransactions(
                    $postingRef,
                    $postingDate,
                    $busunitCode,
                    $batch,
                    $lines,
                    $user_id
                );

                $salesInsertSummary = $this->insertSalesAndInventoryTransactions(
                    $postingRef,
                    $postingDate,
                    $busunitCode,
                    $batch,
                    $user_id
                );

                $this->markShiftJournalized(
                    $batch["shift"]["ID"] ?? null,
                    $busunitCode,
                    $postingRef
                );

                $posted[] = [
                    "batchKey" => $batch["batchKey"] ?? "",
                    "postingRef" => $postingRef,
                    "shiftId" => $batch["shift"]["ID"] ?? "",
                    "busunitCode" => $busunitCode,
                    "busunitName" => $batch["busunit"]["name"] ?? "",
                    "postingDate" => $postingDate,
                    "lineCount" => count($lines),
                    "salesSummaryCount" => $salesInsertSummary["salesSummaryCount"] ?? 0,
                    "salesTransactionCount" => $salesInsertSummary["salesTransactionCount"] ?? 0,
                    "inventoryTransactionCount" => $salesInsertSummary["inventoryTransactionCount"] ?? 0,
                ];
            }

            $this->conn->commit();

            return [
                "message" => "Success",
                "posted" => $posted,
            ];
        } catch (\Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return [
                "message" => $e->getMessage(),
            ];
        }
    }

    public function getPostedData(): array
    {
        $sql = "SELECT
                    menutransactedref AS postingRef,
                    busunitcode,
                    DATE(transdate) AS postingDate,
                    MIN(reference) AS reference,
                    COUNT(*) AS lineCount,
                    ROUND(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 2) AS totalDebit,
                    ROUND(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 2) AS totalCredit,
                    MAX(createdtime) AS postedAt
                FROM tbl_accounting_transactions
                WHERE menutransacted = '/posjournalentries'
                    AND deletestatus = 'Active'
                GROUP BY menutransactedref, busunitcode, DATE(transdate)
                ORDER BY MAX(createdtime) DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $shiftSql = "SELECT
                        ID,
                        Unit_Code,
                        Opening_DateTime,
                        Closing_DateTime,
                        Remarks
                    FROM tbl_pos_shifting_records
                    WHERE Remarks LIKE 'Journalized|%'";
        $shiftStmt = $this->conn->prepare($shiftSql);
        $shiftStmt->execute();
        $shiftRows = $shiftStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $shiftLookup = [];
        foreach ($shiftRows as $shift) {
            $remarks = (string) ($shift["Remarks"] ?? "");
            $postingRef = trim((string) substr($remarks, strlen("Journalized|")));
            if ($postingRef === "") {
                continue;
            }

            if (!isset($shiftLookup[$postingRef])) {
                $shiftLookup[$postingRef] = [];
            }

            $shiftLookup[$postingRef][] = [
                "shiftId" => $shift["ID"] ?? "",
                "busunitCode" => $shift["Unit_Code"] ?? "",
                "openingDateTime" => $shift["Opening_DateTime"] ?? "",
                "closingDateTime" => $shift["Closing_DateTime"] ?? "",
            ];
        }

        $salesSql = "SELECT
                        sales_id,
                        transdate,
                        busunitcode,
                        description,
                        total_sales,
                        total_vat,
                        total_discounts,
                        total_other_mop,
                        net_sales,
                        cash_received,
                        `change` AS change_amount,
                        net_cash
                    FROM tbl_sales_summary
                    WHERE description LIKE 'POS Journal Posting %'
                        AND deletestatus = 'Active'
                    ORDER BY createdtime DESC";
        $salesStmt = $this->conn->prepare($salesSql);
        $salesStmt->execute();
        $salesRows = $salesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $salesLookup = [];
        foreach ($salesRows as $row) {
            $description = (string) ($row["description"] ?? "");
            if (!preg_match('/POS Journal Posting ([^ ]+)/', $description, $matches)) {
                continue;
            }

            $postingRef = trim((string) ($matches[1] ?? ""));
            if ($postingRef === "") {
                continue;
            }

            if (!isset($salesLookup[$postingRef])) {
                $salesLookup[$postingRef] = [];
            }

            $salesLookup[$postingRef][] = $row;
        }

        return [
            "generatedAt" => date(DATE_ATOM),
            "items" => array_map(function ($row) use ($shiftLookup, $salesLookup) {
                $postingRef = $row["postingRef"] ?? "";
                return array_merge($row, [
                    "shifts" => $shiftLookup[$postingRef] ?? [],
                    "salesSummaries" => $salesLookup[$postingRef] ?? [],
                ]);
            }, $rows),
        ];
    }

    private function getPendingShifts(): array
    {
        $sql = "SELECT *
                FROM tbl_pos_shifting_records
                WHERE (
                    Remarks IS NULL
                    OR TRIM(Remarks) = ''
                    OR UPPER(TRIM(Remarks)) NOT LIKE 'JOURNALIZED%'
                )
                AND Closing_DateTime IS NOT NULL
                AND CAST(Closing_DateTime AS CHAR(19)) <> '0000-00-00 00:00:00'
                AND Opening_DateTime IS NOT NULL
                AND CAST(Opening_DateTime AS CHAR(19)) <> '0000-00-00 00:00:00'
                ORDER BY Opening_DateTime DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function getTransactionsForShift($openingDateTime, $closingDateTime): array
    {
        $openingDateTime = $this->sanitizeDateTime($openingDateTime);
        $closingDateTime = $this->sanitizeDateTime($closingDateTime);

        if ($openingDateTime === null || $closingDateTime === null) {
            return [];
        }

        if ($openingDateTime > $closingDateTime) {
            return [];
        }

        $sql = "SELECT *
                FROM tbl_pos_transactions
                WHERE UPPER(COALESCE(status, '')) IN ('ACTIVE', 'REFUNDED', 'VOIDED')
                AND date_recorded BETWEEN :openingDateTime AND :closingDateTime
                ORDER BY date_recorded ASC, transaction_id ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":openingDateTime", $openingDateTime);
        $stmt->bindValue(":closingDateTime", $closingDateTime);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function getTransactionDetails(array $transactionIds): array
    {
        if (empty($transactionIds)) {
            return [];
        }

        [$placeholders, $params] = $this->buildPlaceholders($transactionIds, "txn");

        $sql = "SELECT
                    T1.*,
                    T2.category AS category,
                    T2.`desc` AS product_desc,
                    T2.uomval AS product_uomval,
                    T2.uom AS product_uom,
                    T2.tax_type AS product_tax_type,
                    T2.isdiscountable AS product_isdiscountable
                FROM tbl_pos_transactions_detailed AS T1
                LEFT JOIN lkp_build_of_products AS T2
                    ON T1.product_id = T2.build_code
                WHERE T1.transaction_id IN (" . implode(", ", $placeholders) . ")
                AND UPPER(COALESCE(T1.order_status, '')) = 'ACTIVE'
                ORDER BY T1.transaction_id ASC, T1.ID ASC";

        return $this->fetchAllWithParams($sql, $params);
    }

    private function getTransactionDiscounts(array $transactionIds): array
    {
        if (empty($transactionIds)) {
            return [];
        }

        [$placeholders, $params] = $this->buildPlaceholders($transactionIds, "txn");

        $sql = "SELECT *
                FROM tbl_pos_transactions_discounts
                WHERE transaction_id IN (" . implode(", ", $placeholders) . ")
                AND UPPER(COALESCE(status, '')) = 'ACTIVE'
                ORDER BY transaction_id ASC, id ASC";

        return $this->fetchAllWithParams($sql, $params);
    }

    private function getTransactionPayments(array $transactionIds): array
    {
        if (empty($transactionIds)) {
            return [];
        }

        [$placeholders, $params] = $this->buildPlaceholders($transactionIds, "txn");

        $sql = "SELECT *
                FROM tbl_pos_transactions_payments
                WHERE transaction_id IN (" . implode(", ", $placeholders) . ")
                ORDER BY transaction_id ASC, ID ASC";

        return $this->fetchAllWithParams($sql, $params);
    }

    private function getTransactionOtherCharges(array $transactionIds): array
    {
        if (empty($transactionIds)) {
            return [];
        }

        [$placeholders, $params] = $this->buildPlaceholders($transactionIds, "txn");

        $sql = "SELECT *
                FROM tbl_pos_transactions_other_charges
                WHERE transaction_id IN (" . implode(", ", $placeholders) . ")
                ORDER BY transaction_id ASC, ID ASC";

        return $this->fetchAllWithParams($sql, $params);
    }

    private function getBuildComponentsByBuild(): array
    {
        if (is_array($this->buildComponentMap)) {
            return $this->buildComponentMap;
        }

        $sql = "SELECT
                    bc.build_code,
                    bc.component_code,
                    bc.component_class,
                    bc.qty,
                    COALESCE(rm.uomval, fg.uomval, 1) AS component_uomval,
                    COALESCE(rm.uom, fg.uom, 'PC') AS component_uom,
                    COALESCE(rm.category, fg.category, '') AS component_category
                FROM tbl_build_components AS bc
                LEFT JOIN lkp_raw_mats AS rm
                    ON bc.component_code = rm.mat_code
                    AND COALESCE(rm.deletestatus, 'Active') = 'Active'
                LEFT JOIN lkp_build_of_products AS fg
                    ON bc.component_code = fg.build_code
                    AND COALESCE(fg.deletestatus, 'Active') = 'Active'
                WHERE COALESCE(bc.deletestatus, 'Active') = 'Active'
                ORDER BY bc.build_code ASC, bc.seq ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $map = [];

        foreach ($rows as $row) {
            $buildCode = trim((string) ($row["build_code"] ?? ""));
            if ($buildCode === "") {
                continue;
            }

            $map[$buildCode][] = $row;
        }

        $this->buildComponentMap = $map;

        return $this->buildComponentMap;
    }

    private function buildInventoryComponentsForDetail(array $detail, int $maxDepth = 1): array
    {
        $productCode = trim((string) ($detail["product_id"] ?? ""));
        $quantity = $this->toFloat($detail["sales_quantity"] ?? 0);

        if ($productCode === "" || abs($quantity) < 0.0000001) {
            return [];
        }

        $fallbackCategory = trim((string) ($detail["category"] ?? ""));
        if ($fallbackCategory === "") {
            $fallbackCategory = "OTHERS";
        }

        $fallbackComponent = [
            "component_code" => $productCode,
            "component_class" => "FG",
            "uomval" => $this->toFloat($detail["product_uomval"] ?? 1) ?: 1,
            "uom" => trim((string) ($detail["product_uom"] ?? "PC")) ?: "PC",
            "category" => $fallbackCategory,
        ];

        $expandedComponents = $this->expandInventoryComponents(
            $productCode,
            $quantity,
            $this->getBuildComponentsByBuild(),
            $fallbackComponent,
            [],
            0,
            $maxDepth
        );

        $components = $this->collapseInventoryComponents($expandedComponents);
        if (empty($components)) {
            $components = [
                array_merge($fallbackComponent, [
                    "qty" => $quantity,
                ]),
            ];
        }

        $costAmount = $quantity * $this->toFloat($detail["unit_cost"] ?? 0);
        $totalBasis = array_reduce(
            $components,
            fn($carry, $component) => $carry + abs($this->toFloat($component["qty"] ?? 0)),
            0.0
        );

        $componentCount = count($components);
        $allocatedCost = 0.0;

        foreach ($components as $index => &$component) {
            $basis = abs($this->toFloat($component["qty"] ?? 0));

            if ($componentCount === 1 || $index === $componentCount - 1) {
                $component["allocatedCost"] = $costAmount - $allocatedCost;
                continue;
            }

            $component["allocatedCost"] = $totalBasis > 0
                ? $costAmount * ($basis / $totalBasis)
                : 0.0;

            $allocatedCost += $component["allocatedCost"];
        }
        unset($component);

        return array_values($components);
    }

    private function expandInventoryComponents(
        string $componentCode,
        float $quantity,
        array $componentsByBuild,
        array $fallbackComponent,
        array $path,
        int $depth,
        int $maxDepth
    ): array {
        $componentCode = trim($componentCode);
        if ($componentCode === "" || abs($quantity) < 0.0000001) {
            return [];
        }

        if (in_array($componentCode, $path, true)) {
            return [
                array_merge($fallbackComponent, [
                    "component_code" => $componentCode,
                    "qty" => $quantity,
                ]),
            ];
        }

        if ($depth >= $maxDepth) {
            return [
                array_merge($fallbackComponent, [
                    "component_code" => $componentCode,
                    "qty" => $quantity,
                ]),
            ];
        }

        $children = $componentsByBuild[$componentCode] ?? [];
        if (empty($children)) {
            return [
                array_merge($fallbackComponent, [
                    "component_code" => $componentCode,
                    "qty" => $quantity,
                ]),
            ];
        }

        $nextPath = array_merge($path, [$componentCode]);
        $expanded = [];

        foreach ($children as $child) {
            $childCode = trim((string) ($child["component_code"] ?? ""));
            $childQty = $quantity * $this->toFloat($child["qty"] ?? 0);

            if ($childCode === "" || abs($childQty) < 0.0000001) {
                continue;
            }

            $childFallback = [
                "component_code" => $childCode,
                "component_class" => trim((string) ($child["component_class"] ?? ""))
                    ?: $this->deriveInventoryClass($childCode, "FG"),
                "uomval" => $this->toFloat($child["component_uomval"] ?? 1) ?: 1,
                "uom" => trim((string) ($child["component_uom"] ?? "PC")) ?: "PC",
                "category" => trim((string) ($child["component_category"] ?? ""))
                    ?: ($fallbackComponent["category"] ?? "OTHERS"),
            ];

            $expanded = array_merge(
                $expanded,
                $this->expandInventoryComponents(
                    $childCode,
                    $childQty,
                    $componentsByBuild,
                    $childFallback,
                    $nextPath,
                    $depth + 1,
                    $maxDepth
                )
            );
        }

        if (empty($expanded)) {
            return [
                array_merge($fallbackComponent, [
                    "component_code" => $componentCode,
                    "qty" => $quantity,
                ]),
            ];
        }

        return $expanded;
    }

    private function collapseInventoryComponents(array $components): array
    {
        $collapsed = [];

        foreach ($components as $component) {
            $componentCode = trim((string) ($component["component_code"] ?? ""));
            if ($componentCode === "") {
                continue;
            }

            $componentClass = trim((string) ($component["component_class"] ?? ""))
                ?: $this->deriveInventoryClass($componentCode, "FG");
            $uomVal = $this->toFloat($component["uomval"] ?? 1) ?: 1;
            $uom = trim((string) ($component["uom"] ?? "PC")) ?: "PC";
            $category = trim((string) ($component["category"] ?? ""));
            if ($category === "") {
                $category = "OTHERS";
            }

            $key = implode("|", [
                $componentCode,
                $componentClass,
                (string) $uomVal,
                $uom,
                $category,
            ]);

            if (!isset($collapsed[$key])) {
                $collapsed[$key] = [
                    "component_code" => $componentCode,
                    "component_class" => $componentClass,
                    "uomval" => $uomVal,
                    "uom" => $uom,
                    "category" => $category,
                    "qty" => 0.0,
                ];
            }

            $collapsed[$key]["qty"] += $this->toFloat($component["qty"] ?? 0);
        }

        return $collapsed;
    }

    private function buildComponentBreakdownRows(array $details, array $transactionIds): array
    {
        if (empty($details) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $rows = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            $detailId = trim((string) ($detail["ID"] ?? ""));
            $quantity = $this->toFloat($detail["sales_quantity"] ?? 0);
            $unitCost = $this->toFloat($detail["unit_cost"] ?? 0);
            $sellingPrice = $this->toFloat($detail["selling_price"] ?? 0);
            $detailCostAmount = $quantity * $unitCost;
            $detailSalesAmount = $quantity * $sellingPrice;
            $components = $this->buildInventoryComponentsForDetail($detail, 1);
            $isMapped = count($components) === 1
                && trim((string) ($components[0]["component_code"] ?? "")) === trim((string) ($detail["product_id"] ?? ""))
                ? "No"
                : "Yes";

            foreach ($components as $component) {
                $allocatedCost = $this->toFloat($component["allocatedCost"] ?? 0);
                $allocationRatio = abs($detailCostAmount) > 0.0000001
                    ? $allocatedCost / $detailCostAmount
                    : 0.0;

                $rows[] = [
                    "detailId" => $detailId,
                    "transactionId" => $transactionId,
                    "sourceProductId" => trim((string) ($detail["product_id"] ?? "")),
                    "sourceProductDesc" => trim((string) ($detail["product_desc"] ?? "")),
                    "sourceCategory" => trim((string) ($detail["category"] ?? "")) ?: "OTHERS",
                    "salesQty" => $quantity,
                    "sellingPrice" => $sellingPrice,
                    "sourceSalesAmount" => $detailSalesAmount,
                    "unitCost" => $unitCost,
                    "sourceCostAmount" => $detailCostAmount,
                    "componentCode" => trim((string) ($component["component_code"] ?? "")),
                    "componentClass" => trim((string) ($component["component_class"] ?? "")) ?: "FG",
                    "componentCategory" => trim((string) ($component["category"] ?? "")) ?: "OTHERS",
                    "componentQty" => $this->toFloat($component["qty"] ?? 0),
                    "componentUomVal" => $this->toFloat($component["uomval"] ?? 1) ?: 1,
                    "componentUom" => trim((string) ($component["uom"] ?? "PC")) ?: "PC",
                    "allocatedCost" => $allocatedCost,
                    "allocationRatio" => $allocationRatio,
                    "isMapped" => $isMapped,
                    "mappingRule" => "Expanded only to the sold build's immediate components; direct BD components post as-is",
                ];
            }
        }

        return $rows;
    }

    private function deriveInventoryClass(string $code, string $fallback = "FG"): string
    {
        $prefix = strtoupper(substr(trim($code), 0, 2));

        if (in_array($prefix, ["RM", "BD", "FG"], true)) {
            return $prefix;
        }

        return $fallback;
    }

    private function getSLcodes(): array
    {
        $sql = "SELECT *
                FROM lkp_slcodes
                WHERE deletestatus = 'Active'
                ORDER BY CAST(glcode AS UNSIGNED), CAST(slcodes AS UNSIGNED)";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $indexed = [];

        foreach ($rows as $row) {
            $row["normalizedDescription"] = $this->normalize($row["sldescription"] ?? "");
            $indexed[] = $row;
        }

        return $indexed;
    }

    private function getBusunits(): array
    {
        $sql = "SELECT busunitcode, name
                FROM lkp_busunits
                WHERE deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $indexed = [];

        foreach ($rows as $row) {
            $indexed[$row["busunitcode"]] = $row;
        }

        return $indexed;
    }

    private function validatePostingBatch(array $batch): array
    {
        $busunitCode = trim((string) ($batch["busunit"]["busunitcode"] ?? ""));
        $shiftId = $batch["shift"]["ID"] ?? null;
        $lines = array_values(
            array_filter($batch["lines"] ?? [], fn($line) => is_array($line))
        );

        if ($busunitCode === "" || $shiftId === null) {
            return [
                "ok" => false,
                "status" => 422,
                "message" => "Selected batch is missing shift or business unit information.",
            ];
        }

        if (empty($lines)) {
            return [
                "ok" => false,
                "status" => 422,
                "message" => "Selected batch has no journal lines to post.",
            ];
        }

        $totalDebit = 0.0;
        $totalCredit = 0.0;

        foreach ($lines as $line) {
            $debit = round($this->toFloat($line["debit"] ?? 0), 2);
            $credit = round($this->toFloat($line["credit"] ?? 0), 2);

            if (abs($debit) < 0.005 && abs($credit) < 0.005) {
                continue;
            }

            if (trim((string) ($line["glcode"] ?? "")) === "" || trim((string) ($line["slcodes"] ?? "")) === "") {
                return [
                    "ok" => false,
                    "status" => 422,
                    "message" => "All posting lines must have a mapped GL and SL code before posting.",
                ];
            }

            $totalDebit += $debit;
            $totalCredit += $credit;
        }

        if (round($totalDebit, 2) !== round($totalCredit, 2)) {
            return [
                "ok" => false,
                "status" => 422,
                "message" => "Debit and credit are not balanced for Shift #{$shiftId}.",
            ];
        }

        $postingDate = $this->extractPostingDate($batch["shift"] ?? []);
        if ($postingDate === null) {
            return [
                "ok" => false,
                "status" => 422,
                "message" => "Shift #{$shiftId} does not have a valid posting date.",
            ];
        }

        if ($this->isAccountingPeriodClosed($busunitCode, $postingDate)) {
            return [
                "ok" => false,
                "status" => 409,
                "message" => "Accounting period for {$busunitCode} on {$postingDate} is already closed. Ask admin to open the period first.",
            ];
        }

        if ($this->isShiftJournalized((string) $shiftId, $busunitCode)) {
            return [
                "ok" => false,
                "status" => 409,
                "message" => "Shift #{$shiftId} is already journalized.",
            ];
        }

        return [
            "ok" => true,
            "busunitCode" => $busunitCode,
            "postingDate" => $postingDate,
            "lines" => $lines,
        ];
    }

    private function isAccountingPeriodClosed(string $busunitCode, string $postingDate): bool
    {
        $sql = "SELECT MAX(accounting_period) AS latest_closed_period
                FROM tbl_accounting_period
                WHERE busunitcode = :busunitcode
                    AND UPPER(COALESCE(status, '')) = 'CLOSED'
                    AND UPPER(COALESCE(deletestatus, 'ACTIVE')) = 'ACTIVE'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitCode);
        $stmt->execute();

        $latestClosedPeriod = $stmt->fetchColumn();
        if (!is_string($latestClosedPeriod) || trim($latestClosedPeriod) === "") {
            return false;
        }

        return $postingDate <= trim($latestClosedPeriod);
    }

    private function isShiftJournalized(string $shiftId, string $busunitCode): bool
    {
        $sql = "SELECT COUNT(*) AS total
                FROM tbl_pos_shifting_records
                WHERE ID = :shift_id
                    AND Unit_Code = :busunitcode
                    AND (
                        UPPER(TRIM(COALESCE(Remarks, ''))) = 'JOURNALIZED'
                        OR Remarks LIKE 'Journalized|%'
                    )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":shift_id", $shiftId);
        $stmt->bindValue(":busunitcode", $busunitCode);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function insertAccountingTransactions(
        string $postingRef,
        string $postingDate,
        string $busunitCode,
        array $batch,
        array $lines,
        $user_id
    ): void {
        $reference = $postingRef;
        $shiftId = (string) ($batch["shift"]["ID"] ?? "");

        $sql = "INSERT INTO tbl_accounting_transactions (
                    transdate,
                    document_date,
                    glcode,
                    slcode,
                    amount,
                    particulars,
                    reference,
                    approvalref,
                    approvalstatus,
                    customer_id,
                    supplier_code,
                    project_code,
                    cost_center_code,
                    othermapref,
                    othermaprefroute,
                    transactiontype,
                    transactionclass,
                    menutransacted,
                    busunitcode,
                    vattaxtype,
                    whtxatc,
                    whtxrate,
                    menutransactedref,
                    deletestatus,
                    usertracker,
                    createdtime
                ) VALUES (
                    :transdate,
                    :document_date,
                    :glcode,
                    :slcode,
                    :amount,
                    :particulars,
                    :reference,
                    :approvalref,
                    :approvalstatus,
                    :customer_id,
                    :supplier_code,
                    :project_code,
                    :cost_center_code,
                    :othermapref,
                    :othermaprefroute,
                    :transactiontype,
                    :transactionclass,
                    :menutransacted,
                    :busunitcode,
                    :vattaxtype,
                    :whtxatc,
                    :whtxrate,
                    :menutransactedref,
                    :deletestatus,
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);

        foreach ($lines as $line) {
            $debit = round($this->toFloat($line["debit"] ?? 0), 2);
            $credit = round($this->toFloat($line["credit"] ?? 0), 2);
            $amount = round($debit - $credit, 2);

            if (abs($amount) < 0.005) {
                continue;
            }

            $stmt->bindValue(":transdate", $postingDate);
            $stmt->bindValue(":document_date", $postingDate);
            $stmt->bindValue(":glcode", trim((string) ($line["glcode"] ?? "")));
            $stmt->bindValue(":slcode", trim((string) ($line["slcodes"] ?? "")));
            $stmt->bindValue(":amount", $amount);
            $stmt->bindValue(":particulars", trim((string) ($line["particulars"] ?? "POS Journal Entry")));
            $stmt->bindValue(":reference", $reference);
            $stmt->bindValue(":approvalref", "AUTO");
            $stmt->bindValue(":approvalstatus", "Posted");
            $stmt->bindValue(":customer_id", null, PDO::PARAM_NULL);
            $stmt->bindValue(":supplier_code", null, PDO::PARAM_NULL);
            $stmt->bindValue(":project_code", null, PDO::PARAM_NULL);
            $stmt->bindValue(":cost_center_code", null, PDO::PARAM_NULL);
            $stmt->bindValue(":othermapref", $shiftId);
            $stmt->bindValue(":othermaprefroute", "/posjournalentries");
            $stmt->bindValue(":transactiontype", "SALES");
            $stmt->bindValue(":transactionclass", strtoupper(trim((string) ($line["entryGroup"] ?? "POS JOURNAL"))));
            $stmt->bindValue(":menutransacted", "/posjournalentries");
            $stmt->bindValue(":busunitcode", $busunitCode);
            $stmt->bindValue(":vattaxtype", "");
            $stmt->bindValue(":whtxatc", "");
            $stmt->bindValue(":whtxrate", 0);
            $stmt->bindValue(":menutransactedref", $postingRef);
            $stmt->bindValue(":deletestatus", "Active");
            $stmt->bindValue(":usertracker", (string) $user_id);
            $stmt->execute();
        }
    }

    private function insertSalesAndInventoryTransactions(
        string $postingRef,
        string $postingDate,
        string $busunitCode,
        array $batch,
        $user_id
    ): array {
        $transactions = array_values(
            array_filter(
                $batch["transactions"] ?? [],
                fn($row) => $this->normalize($row["status"] ?? "") === "ACTIVE"
            )
        );
        $details = array_values($batch["transactionDetails"] ?? []);
        $discounts = array_values($batch["transactionDiscounts"] ?? []);
        $payments = array_values($batch["transactionPayments"] ?? []);

        if (empty($transactions)) {
            return [
                "salesSummaryCount" => 0,
                "salesTransactionCount" => 0,
                "inventoryTransactionCount" => 0,
            ];
        }

        $activeIds = array_column($transactions, "transaction_id");
        $activeLookup = $this->buildIdentifierLookup($activeIds);
        $paymentBreakdownByTransaction = $this->buildPaymentBreakdownByTransaction($payments, $activeIds);
        $discountTotalsByTransaction = $this->buildTotalsByTransaction($discounts, "discount_amount", $activeIds);
        $proratedTransactionDiscounts = $this->buildProratedTransactionDiscounts($details, $transactions);
        $vatExemptAllocations = $this->buildVatExemptAllocations($details, $discounts, $activeIds);
        $detailsByTransaction = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($activeLookup[$transactionId])) {
                continue;
            }

            $detailsByTransaction[$transactionId][] = $detail;
        }

        $summarySql = "INSERT INTO tbl_sales_summary (
                            sales_id,
                            transdate,
                            busunitcode,
                            poscode,
                            sales_trans_id,
                            cash_trans_id,
                            mop_trans_id,
                            sales_type_id,
                            discount_id,
                            total_sales,
                            total_vat,
                            total_discounts,
                            total_other_mop,
                            net_sales,
                            cash_received,
                            `change`,
                            net_cash,
                            gender,
                            age_bracket,
                            customer_id,
                            attendant_id,
                            description,
                            usertracker,
                            deletestatus,
                            createdtime
                        ) VALUES (
                            :sales_id,
                            :transdate,
                            :busunitcode,
                            :poscode,
                            :sales_trans_id,
                            :cash_trans_id,
                            :mop_trans_id,
                            :sales_type_id,
                            :discount_id,
                            :total_sales,
                            :total_vat,
                            :total_discounts,
                            :total_other_mop,
                            :net_sales,
                            :cash_received,
                            :change_amount,
                            :net_cash,
                            :gender,
                            :age_bracket,
                            :customer_id,
                            :attendant_id,
                            :description,
                            :usertracker,
                            'Active',
                            DATE_ADD(NOW(), INTERVAL 8 HOUR)
                        )";
        $summaryStmt = $this->conn->prepare($summarySql);

        $salesTxnSql = "INSERT INTO tbl_sales_transactions (
                            sales_trans_id,
                            transdate,
                            inv_code,
                            qty,
                            cost_per_uom,
                            uomval,
                            uom,
                            total_cost,
                            srp,
                            total_sales,
                            vat,
                            tax_type,
                            discount_type_id,
                            discount_amount,
                            sales_id,
                            usertracker,
                            deletestatus,
                            createdtime
                        ) VALUES (
                            :sales_trans_id,
                            :transdate,
                            :inv_code,
                            :qty,
                            :cost_per_uom,
                            :uomval,
                            :uom,
                            :total_cost,
                            :srp,
                            :total_sales,
                            :vat,
                            :tax_type,
                            :discount_type_id,
                            :discount_amount,
                            :sales_id,
                            :usertracker,
                            'Active',
                            DATE_ADD(NOW(), INTERVAL 8 HOUR)
                        )";
        $salesTxnStmt = $this->conn->prepare($salesTxnSql);

        $inventorySql = "INSERT INTO tbl_inventory_transactions (
                            trans_date,
                            inv_code,
                            qty,
                            cost_per_uom,
                            uom_val,
                            uom,
                            pr_queue_code,
                            busunitcode,
                            inv_class,
                            expirydate,
                            deletestatus,
                            usertracker,
                            createddate
                        ) VALUES (
                            :trans_date,
                            :inv_code,
                            :qty,
                            :cost_per_uom,
                            :uom_val,
                            :uom,
                            :pr_queue_code,
                            :busunitcode,
                            :inv_class,
                            :expirydate,
                            'Active',
                            :usertracker,
                            DATE_ADD(NOW(), INTERVAL 8 HOUR)
                        )";
        $inventoryStmt = $this->conn->prepare($inventorySql);

        $salesSummaryCount = 0;
        $salesTransactionCount = 0;
        $inventoryTransactionCount = 0;

        foreach ($transactions as $transaction) {
            $transactionId = trim((string) ($transaction["transaction_id"] ?? ""));
            $salesId = "SSM-POS-" . $transactionId;
            $salesTransId = "STS-POS-" . $transactionId;
            $cashTransId = "CTS-POS-" . $transactionId;
            $mopTransId = "MPS-POS-" . $transactionId;
            $discountId = "DCS-POS-" . $transactionId;
            $paymentBreakdown = $paymentBreakdownByTransaction[$transactionId] ?? [
                "cash_received" => 0.0,
                "total_other_mop" => 0.0,
            ];
            $cashReceived = round($paymentBreakdown["cash_received"] ?? 0, 2);
            $discountTotal = round($discountTotalsByTransaction[$transactionId] ?? $this->toFloat($transaction["Discount"] ?? 0), 2);
            $changeAmount = round($this->toFloat($transaction["change_amount"] ?? 0), 2);
            $customerId = trim((string) ($transaction["customer_exclusive_id"] ?? ""));
            $attendantId = trim((string) ($transaction["cashier"] ?? ""));
            $totalVat = round($this->toFloat($transaction["VATableSales_VAT"] ?? 0), 2);

            $summaryStmt->bindValue(":sales_id", $salesId);
            $summaryStmt->bindValue(":transdate", $postingDate);
            $summaryStmt->bindValue(":busunitcode", $busunitCode);
            $summaryStmt->bindValue(":poscode", "POS-" . trim((string) ($transaction["terminal_number"] ?? "1")));
            $summaryStmt->bindValue(":sales_trans_id", $salesTransId);
            $summaryStmt->bindValue(":cash_trans_id", $cashTransId);
            $summaryStmt->bindValue(":mop_trans_id", $mopTransId);
            $summaryStmt->bindValue(":sales_type_id", trim((string) ($transaction["order_type"] ?? "POS")));
            $summaryStmt->bindValue(":discount_id", $discountId);
            $summaryStmt->bindValue(":total_sales", round($this->toFloat($transaction["TotalSales"] ?? 0), 2));
            $summaryStmt->bindValue(":total_vat", $totalVat);
            $summaryStmt->bindValue(":total_discounts", $discountTotal);
            $summaryStmt->bindValue(":total_other_mop", round($paymentBreakdown["total_other_mop"] ?? 0, 2));
            $summaryStmt->bindValue(":net_sales", round($this->toFloat($transaction["TotalAmountDue"] ?? 0), 2));
            $summaryStmt->bindValue(":cash_received", $cashReceived);
            $summaryStmt->bindValue(":change_amount", $changeAmount);
            $summaryStmt->bindValue(":net_cash", round($cashReceived - $changeAmount, 2));
            $summaryStmt->bindValue(":gender", null, PDO::PARAM_NULL);
            $summaryStmt->bindValue(":age_bracket", null, PDO::PARAM_NULL);
            if ($customerId === "") {
                $summaryStmt->bindValue(":customer_id", null, PDO::PARAM_NULL);
            } else {
                $summaryStmt->bindValue(":customer_id", $customerId);
            }
            if ($attendantId === "") {
                $summaryStmt->bindValue(":attendant_id", null, PDO::PARAM_NULL);
            } else {
                $summaryStmt->bindValue(":attendant_id", $attendantId);
            }
            $summaryStmt->bindValue(":description", "POS Journal Posting {$postingRef} Transaction {$transactionId}");
            $summaryStmt->bindValue(":usertracker", (string) $user_id);
            $summaryStmt->execute();
            $salesSummaryCount++;

            foreach ($detailsByTransaction[$transactionId] ?? [] as $detail) {
                $quantity = round($this->toFloat($detail["sales_quantity"] ?? 0), 2);
                $sellingPrice = round($this->toFloat($detail["selling_price"] ?? 0), 2);
                $unitCost = round($this->toFloat($detail["unit_cost"] ?? 0), 2);
                $salesAmount = round($quantity * $sellingPrice, 2);
                $costAmount = round($quantity * $unitCost, 2);
                $detailId = trim((string) ($detail["ID"] ?? ""));
                $allocatedDiscount = round($vatExemptAllocations[$detailId] ?? 0, 2);
                $proratedDiscountAmount = round(
                    $proratedTransactionDiscounts[$detailId] ?? 0,
                    2
                );
                $vatable = $this->normalize($detail["vatable"] ?? "");
                $vatBase = 0.0;
                $taxType = trim((string) ($detail["product_tax_type"] ?? ""));

                if ($vatable === "YES") {
                    $vatBase = max(round($salesAmount - $allocatedDiscount, 2), 0);
                    $taxType = $vatBase > 0 ? "VATABLE" : "VAT EXEMPT";
                } elseif ($vatable === "NO") {
                    $taxType = "VAT EXEMPT";
                } else {
                    $taxType = $taxType !== "" ? strtoupper($taxType) : "ZERO RATED";
                }

                $vatAmount = $taxType === "VATABLE"
                    ? round($vatBase - ($vatBase / 1.12), 2)
                    : 0.0;

                $salesTxnStmt->bindValue(":sales_trans_id", $salesTransId);
                $salesTxnStmt->bindValue(":transdate", $postingDate);
                $salesTxnStmt->bindValue(":inv_code", trim((string) ($detail["product_id"] ?? "")));
                $salesTxnStmt->bindValue(":qty", $quantity);
                $salesTxnStmt->bindValue(":cost_per_uom", $unitCost);
                $salesTxnStmt->bindValue(":uomval", round($this->toFloat($detail["product_uomval"] ?? 1), 2));
                $salesTxnStmt->bindValue(":uom", trim((string) ($detail["product_uom"] ?? "PC")));
                $salesTxnStmt->bindValue(":total_cost", $costAmount);
                $salesTxnStmt->bindValue(":srp", $sellingPrice);
                $salesTxnStmt->bindValue(":total_sales", $salesAmount);
                $salesTxnStmt->bindValue(":vat", $vatAmount);
                $salesTxnStmt->bindValue(":tax_type", $taxType);
                $salesTxnStmt->bindValue(":discount_type_id", 0);
                $salesTxnStmt->bindValue(":discount_amount", $proratedDiscountAmount);
                $salesTxnStmt->bindValue(":sales_id", $salesId);
                $salesTxnStmt->bindValue(":usertracker", (string) $user_id);
                $salesTxnStmt->execute();
                $salesTransactionCount++;

                foreach ($this->buildInventoryComponentsForDetail($detail) as $component) {
                    $componentQty = $this->toFloat($component["qty"] ?? 0);
                    if (abs($componentQty) < 0.0000001) {
                        continue;
                    }

                    $allocatedCost = $this->toFloat($component["allocatedCost"] ?? 0);
                    $costPerUom = $componentQty != 0.0
                        ? $allocatedCost / $componentQty
                        : 0.0;

                    $inventoryStmt->bindValue(":trans_date", $postingDate);
                    $inventoryStmt->bindValue(":inv_code", trim((string) ($component["component_code"] ?? "")));
                    $inventoryStmt->bindValue(":qty", round($componentQty * -1, 6));
                    $inventoryStmt->bindValue(":cost_per_uom", round($costPerUom, 6));
                    $inventoryStmt->bindValue(":uom_val", round($this->toFloat($component["uomval"] ?? 1) ?: 1, 6));
                    $inventoryStmt->bindValue(":uom", trim((string) ($component["uom"] ?? "PC")) ?: "PC");
                    $inventoryStmt->bindValue(":pr_queue_code", "POS");
                    $inventoryStmt->bindValue(":busunitcode", $busunitCode);
                    $inventoryStmt->bindValue(
                        ":inv_class",
                        trim((string) ($component["component_class"] ?? "")) ?: "FG"
                    );
                    $inventoryStmt->bindValue(":expirydate", "0000-00-00");
                    $inventoryStmt->bindValue(":usertracker", (string) $user_id);
                    $inventoryStmt->execute();
                    $inventoryTransactionCount++;
                }
            }
        }

        return [
            "salesSummaryCount" => $salesSummaryCount,
            "salesTransactionCount" => $salesTransactionCount,
            "inventoryTransactionCount" => $inventoryTransactionCount,
        ];
    }

    private function markShiftJournalized($shiftId, string $busunitCode, string $postingRef): void
    {
        $sql = "UPDATE tbl_pos_shifting_records
                SET Remarks = :remarks
                WHERE ID = :shift_id
                    AND Unit_Code = :busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":remarks", "Journalized|" . $postingRef);
        $stmt->bindValue(":shift_id", $shiftId);
        $stmt->bindValue(":busunitcode", $busunitCode);
        $stmt->execute();
    }

    private function buildCategoryRollups(array $details, array $discounts, array $transactionIds): array
    {
        if (empty($details) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $vatExemptAllocations = $this->buildVatExemptAllocations($details, $discounts, $transactionIds);
        $rollups = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            $category = trim((string) ($detail["category"] ?? ""));
            if ($category === "") {
                $category = "OTHERS";
            }

            if (!isset($rollups[$category])) {
                $rollups[$category] = [
                    "category" => $category,
                    "salesAmount" => 0.0,
                    "costAmount" => 0.0,
                    "vatableSalesAmount" => 0.0,
                    "vatExemptSalesAmount" => 0.0,
                    "zeroRatedSalesAmount" => 0.0,
                ];
            }

            $quantity = $this->toFloat($detail["sales_quantity"] ?? 0);
            $sellingPrice = $this->toFloat($detail["selling_price"] ?? 0);
            $salesAmount = $quantity * $sellingPrice;
            $detailId = trim((string) ($detail["ID"] ?? ""));
            $allocatedVatExemptAmount = $vatExemptAllocations[$detailId] ?? 0.0;

            $rollups[$category]["salesAmount"] += $salesAmount;

            $vatable = $this->normalize($detail["vatable"] ?? "");
            if ($vatable === "YES") {
                $vatableAmount = ($salesAmount / 1.12) - $allocatedVatExemptAmount;
                $rollups[$category]["vatableSalesAmount"] += $vatableAmount;
                $rollups[$category]["vatExemptSalesAmount"] += $allocatedVatExemptAmount;
            } elseif ($vatable === "NO") {
                $rollups[$category]["vatExemptSalesAmount"] += $salesAmount;
            } else {
                $rollups[$category]["zeroRatedSalesAmount"] += $salesAmount;
            }

            foreach ($this->buildInventoryComponentsForDetail($detail) as $component) {
                $componentCategory = trim((string) ($component["category"] ?? ""));
                if ($componentCategory === "") {
                    $componentCategory = $category;
                }

                if (!isset($rollups[$componentCategory])) {
                    $rollups[$componentCategory] = [
                        "category" => $componentCategory,
                        "salesAmount" => 0.0,
                        "costAmount" => 0.0,
                        "vatableSalesAmount" => 0.0,
                        "vatExemptSalesAmount" => 0.0,
                        "zeroRatedSalesAmount" => 0.0,
                    ];
                }

                $rollups[$componentCategory]["costAmount"] += $this->toFloat($component["allocatedCost"] ?? 0);
            }
        }

        return $rollups;
    }

    private function buildVatExemptAllocations(array $details, array $discounts, array $transactionIds): array
    {
        if (empty($details) || empty($discounts) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $discountGrossByTransaction = [];

        foreach ($discounts as $discount) {
            $transactionId = trim((string) ($discount["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            $discountGrossByTransaction[$transactionId] = ($discountGrossByTransaction[$transactionId] ?? 0.0)
                + ($this->toFloat($discount["discount_amount"] ?? 0) / 0.20);
        }

        if (empty($discountGrossByTransaction)) {
            return [];
        }

        $discountableBaseByTransaction = [];
        $detailsByTransaction = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($discountGrossByTransaction[$transactionId])) {
                continue;
            }

            $isDiscountable = $this->normalize($detail["isDiscountable"] ?? "");
            if ($isDiscountable !== "YES") {
                continue;
            }

            $detailId = trim((string) ($detail["ID"] ?? ""));
            if ($detailId === "") {
                continue;
            }

            $lineAmount = $this->toFloat($detail["sales_quantity"] ?? 0) * $this->toFloat($detail["selling_price"] ?? 0);
            $discountableBaseByTransaction[$transactionId] = ($discountableBaseByTransaction[$transactionId] ?? 0.0) + $lineAmount;
            $detailsByTransaction[$transactionId][] = [
                "detailId" => $detailId,
                "lineAmount" => $lineAmount,
            ];
        }

        $allocations = [];

        foreach ($detailsByTransaction as $transactionId => $transactionDetails) {
            $discountableBase = $discountableBaseByTransaction[$transactionId] ?? 0.0;
            $grossVatExemptAmount = $discountGrossByTransaction[$transactionId] ?? 0.0;

            if ($discountableBase == 0.0 || $grossVatExemptAmount == 0.0) {
                continue;
            }

            foreach ($transactionDetails as $detail) {
                $allocations[$detail["detailId"]] = ($allocations[$detail["detailId"]] ?? 0.0)
                    + ($grossVatExemptAmount * $detail["lineAmount"] / $discountableBase);
            }
        }

        return $allocations;
    }

    private function buildDiscountTotals(array $discounts, array $activeIds): array
    {
        if (empty($discounts) || empty($activeIds)) {
            return [];
        }

        $activeLookup = $this->buildIdentifierLookup($activeIds);
        $totals = [];

        foreach ($discounts as $discount) {
            $transactionId = trim((string) ($discount["transaction_id"] ?? ""));
            if (!isset($activeLookup[$transactionId])) {
                continue;
            }

            $type = trim((string) ($discount["discount_type"] ?? ""));
            if ($type === "") {
                $type = "Other Discounts";
            }

            if (!isset($totals[$type])) {
                $totals[$type] = [
                    "discountType" => $type,
                    "amount" => 0.0,
                ];
            }

            $totals[$type]["amount"] += $this->toFloat($discount["discount_amount"] ?? 0);
        }

        foreach ($totals as &$total) {
            $total["amount"] = $this->roundMoney($total["amount"]);
        }

        return $totals;
    }

    private function buildPaymentTotals(array $payments, array $activeIds): array
    {
        if (empty($payments) || empty($activeIds)) {
            return [];
        }

        $activeLookup = $this->buildIdentifierLookup($activeIds);
        $totals = [];

        foreach ($payments as $payment) {
            $transactionId = trim((string) ($payment["transaction_id"] ?? ""));
            if (!isset($activeLookup[$transactionId])) {
                continue;
            }

            $method = trim((string) ($payment["payment_method"] ?? ""));
            if ($method === "") {
                $method = "Unspecified Payment";
            }

            if (!isset($totals[$method])) {
                $totals[$method] = [
                    "paymentMethod" => $method,
                    "amount" => 0.0,
                ];
            }

            $totals[$method]["amount"] += $this->toFloat($payment["payment_amount"] ?? 0);
        }

        foreach ($totals as &$total) {
            $total["amount"] = $this->roundMoney($total["amount"]);
        }

        return $totals;
    }

    private function buildTransactionPaymentTotals(array $payments, array $transactionIds): array
    {
        if (empty($payments) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $totals = [];

        foreach ($payments as $payment) {
            $transactionId = trim((string) ($payment["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            $paymentMethod = trim((string) ($payment["payment_method"] ?? ""));
            if ($paymentMethod === "") {
                $paymentMethod = "Unspecified Payment";
            }

            $key = $transactionId . "|" . $this->normalize($paymentMethod);

            if (!isset($totals[$key])) {
                $totals[$key] = [
                    "transaction_id" => $transactionId,
                    "paymentMethod" => $paymentMethod,
                    "amount" => 0.0,
                ];
            }

            $totals[$key]["amount"] += $this->toFloat($payment["payment_amount"] ?? 0);
        }

        foreach ($totals as &$total) {
            $total["amount"] = $this->roundMoney($total["amount"]);
        }

        return $totals;
    }

    private function buildOtherChargeTotals(array $otherCharges, array $activeIds): array
    {
        if (empty($otherCharges) || empty($activeIds)) {
            return [];
        }

        $activeLookup = $this->buildIdentifierLookup($activeIds);
        $totals = [];

        foreach ($otherCharges as $charge) {
            $transactionId = trim((string) ($charge["transaction_id"] ?? ""));
            if (!isset($activeLookup[$transactionId])) {
                continue;
            }

            $particulars = trim((string) ($charge["particulars"] ?? ""));
            if ($particulars === "") {
                $particulars = "Other Charge";
            }

            if (!isset($totals[$particulars])) {
                $totals[$particulars] = [
                    "particulars" => $particulars,
                    "amount" => 0.0,
                ];
            }

            $totals[$particulars]["amount"] += $this->toFloat($charge["amount"] ?? 0);
        }

        foreach ($totals as &$total) {
            $total["amount"] = $this->roundMoney($total["amount"]);
        }

        return $totals;
    }

    private function buildSummary(array $activeTransactions, array $refundedTransactions, array $voidedTransactions): array
    {
        $journalTransactions = array_merge($activeTransactions, $refundedTransactions);
        $summary = [
            "activeTransactionCount" => count($activeTransactions),
            "journalTransactionCount" => count($journalTransactions),
            "refundedTransactionCount" => count($refundedTransactions),
            "voidedTransactionCount" => count($voidedTransactions),
            "activeTotalSales" => 0.0,
            "journalTotalSales" => 0.0,
            "activeDiscountTotal" => 0.0,
            "journalDiscountTotal" => 0.0,
            "activeOtherChargesTotal" => 0.0,
            "journalOtherChargesTotal" => 0.0,
            "activeTotalAmountDue" => 0.0,
            "journalTotalAmountDue" => 0.0,
            "activeVATableSales" => 0.0,
            "journalVATableSales" => 0.0,
            "activeVATableSalesVAT" => 0.0,
            "journalVATableSalesVAT" => 0.0,
            "activeVATExemptSales" => 0.0,
            "journalVATExemptSales" => 0.0,
            "activeVATExemptSalesVAT" => 0.0,
            "journalVATExemptSalesVAT" => 0.0,
            "activeVATZeroRatedSales" => 0.0,
            "journalVATZeroRatedSales" => 0.0,
            "activeShortOverTotal" => 0.0,
            "journalShortOverTotal" => 0.0,
            "refundedTotalAmountDue" => 0.0,
            "refundedVATableSalesVAT" => 0.0,
            "refundedVATExemptSalesVAT" => 0.0,
            "voidedTotalAmountDue" => 0.0,
        ];

        foreach ($activeTransactions as $transaction) {
            $summary["activeTotalSales"] += $this->toFloat($transaction["TotalSales"] ?? 0);
            $summary["activeDiscountTotal"] += $this->toFloat($transaction["Discount"] ?? 0);
            $summary["activeOtherChargesTotal"] += $this->toFloat($transaction["OtherCharges"] ?? 0);
            $summary["activeTotalAmountDue"] += $this->toFloat($transaction["TotalAmountDue"] ?? 0);
            $summary["activeVATableSales"] += $this->toFloat($transaction["VATableSales"] ?? 0);
            $summary["activeVATableSalesVAT"] += $this->toFloat($transaction["VATableSales_VAT"] ?? 0);
            $summary["activeVATExemptSales"] += $this->toFloat($transaction["VATExemptSales"] ?? 0);
            $summary["activeVATExemptSalesVAT"] += $this->toFloat($transaction["VATExemptSales_VAT"] ?? 0);
            $summary["activeVATZeroRatedSales"] += $this->toFloat($transaction["VATZeroRatedSales"] ?? 0);
            $summary["activeShortOverTotal"] += $this->toFloat($transaction["short_over"] ?? 0);
        }

        foreach ($refundedTransactions as $transaction) {
            $summary["refundedTotalAmountDue"] += $this->toFloat($transaction["TotalAmountDue"] ?? 0);
            $summary["refundedVATableSalesVAT"] += $this->toFloat($transaction["VATableSales_VAT"] ?? 0);
            $summary["refundedVATExemptSalesVAT"] += $this->toFloat($transaction["VATExemptSales_VAT"] ?? 0);
        }

        foreach ($voidedTransactions as $transaction) {
            $summary["voidedTotalAmountDue"] += $this->toFloat($transaction["TotalAmountDue"] ?? 0);
        }

        foreach ($journalTransactions as $transaction) {
            $summary["journalTotalSales"] += $this->toFloat($transaction["TotalSales"] ?? 0);
            $summary["journalDiscountTotal"] += $this->toFloat($transaction["Discount"] ?? 0);
            $summary["journalOtherChargesTotal"] += $this->toFloat($transaction["OtherCharges"] ?? 0);
            $summary["journalTotalAmountDue"] += $this->toFloat($transaction["TotalAmountDue"] ?? 0);
            $summary["journalVATableSales"] += $this->toFloat($transaction["VATableSales"] ?? 0);
            $summary["journalVATableSalesVAT"] += $this->toFloat($transaction["VATableSales_VAT"] ?? 0);
            $summary["journalVATExemptSales"] += $this->toFloat($transaction["VATExemptSales"] ?? 0);
            $summary["journalVATExemptSalesVAT"] += $this->toFloat($transaction["VATExemptSales_VAT"] ?? 0);
            $summary["journalVATZeroRatedSales"] += $this->toFloat($transaction["VATZeroRatedSales"] ?? 0);
            $summary["journalShortOverTotal"] += $this->toFloat($transaction["short_over"] ?? 0);
        }

        foreach ($summary as $key => $value) {
            if (is_float($value)) {
                $summary[$key] = $this->roundMoney($value);
            }
        }

        return $summary;
    }

    private function buildTransactionSalesTotals(array $details, array $transactionIds): array
    {
        if (empty($details) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $totals = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            if (!isset($totals[$transactionId])) {
                $totals[$transactionId] = [
                    "transaction_id" => $transactionId,
                    "salesAmount" => 0.0,
                ];
            }

            $quantity = $this->toFloat($detail["sales_quantity"] ?? 0);
            $sellingPrice = $this->toFloat($detail["selling_price"] ?? 0);
            $totals[$transactionId]["salesAmount"] += $quantity * $sellingPrice;
        }

        foreach ($totals as &$total) {
            $total["salesAmount"] = $this->roundMoney($total["salesAmount"]);
        }

        return $totals;
    }

    private function buildSuggestedEntries(
        array $shift,
        array $slcodes,
        array $summary,
        array $categoryRollups,
        array $refundedCategoryRollups,
        array $refundedTransactionTotals,
        array $refundedTransactionPaymentTotals,
        array $refundedDiscountTotals,
        array $discountTotals,
        array $paymentTotals
    ): array {
        $entries = [];
        $warnings = [];
        $busunitCode = $shift["Unit_Code"] ?? "";
        $busunitName = $shift["Category_Code"] ?? "";

        $pushEntry = function (
            $account,
            float $debit,
            float $credit,
            string $particulars,
            string $sourceTable,
            string $sourceField,
            array $meta = []
        ) use (&$entries, &$warnings, $busunitCode, $busunitName) {
            $debit = $this->roundMoney($debit);
            $credit = $this->roundMoney($credit);

            if (abs($debit) < 0.005 && abs($credit) < 0.005) {
                return;
            }

            if (!$account) {
                $warnings[] = [
                    "particulars" => $particulars,
                    "message" => "No exact lkp_slcodes mapping found. Please review this journal card manually.",
                    "sourceTable" => $sourceTable,
                    "sourceField" => $sourceField,
                ];
            }

            $entries[] = array_merge([
                "entryId" => "ENTRY-" . (count($entries) + 1),
                "glcode" => $account["glcode"] ?? "",
                "slcodes" => $account["slcodes"] ?? "",
                "sldescription" => $account["sldescription"] ?? "",
                "debit" => $debit,
                "credit" => $credit,
                "particulars" => $particulars,
                "busunitName" => $busunitName,
                "busunitCode" => $busunitCode,
                "sourceTable" => $sourceTable,
                "sourceField" => $sourceField,
                "isAutoMapped" => $account ? true : false,
            ], $meta);
        };

        foreach ($paymentTotals as $payment) {
            $method = $payment["paymentMethod"];
            $amount = $this->toFloat($payment["amount"] ?? 0);
            $account = $this->resolvePaymentAccount($slcodes, $method);

            $pushEntry(
                $account,
                $amount,
                0.0,
                $method,
                "tbl_pos_transactions_payments",
                "payment_method & payment_amount",
                [
                    "paymentMethod" => $method,
                    "entryGroup" => "payments",
                ]
            );
        }

        foreach ($discountTotals as $discount) {
            $type = $discount["discountType"];
            $amount = $this->toFloat($discount["amount"] ?? 0);
            $account = $this->resolveDiscountAccount($slcodes, $type);

            $pushEntry(
                $account,
                $amount,
                0.0,
                $type,
                "tbl_pos_transactions_discounts",
                "discount_type & discount_amount",
                [
                    "discountType" => $type,
                    "entryGroup" => "discounts",
                ]
            );
        }

        $trackedDiscountTotal = array_reduce(
            $discountTotals,
            fn($carry, $row) => $carry + $this->toFloat($row["amount"] ?? 0),
            0.0
        );
        $discountResidual = $this->roundMoney(
            $this->toFloat($summary["journalDiscountTotal"] ?? 0) - $trackedDiscountTotal
        );

        if (abs($discountResidual) > 0.01) {
            $pushEntry(
                $this->findAccount($slcodes, ["SALES DISCOUNT - OTHER DISCOUNTS"]),
                $discountResidual > 0 ? $discountResidual : 0.0,
                $discountResidual < 0 ? abs($discountResidual) : 0.0,
                "Other Discounts",
                "tbl_pos_transactions",
                "Discount residual",
                [
                    "entryGroup" => "discounts",
                    "isResidual" => true,
                ]
            );
        }

        $accruedVat = $this->findAccount($slcodes, ["ACCRUED VAT"]);
        $journalVatTotal = $this->toFloat($summary["journalVATableSalesVAT"] ?? 0)
            + $this->toFloat($summary["journalVATExemptSalesVAT"] ?? 0);

        $pushEntry(
            $accruedVat,
            0.0,
            $journalVatTotal,
            "VATableSales_VAT + VATExemptSales_VAT",
            "tbl_pos_transactions",
            "VATableSales_VAT + VATExemptSales_VAT",
            [
                "entryGroup" => "vat",
            ]
        );

        $pushEntry(
            $accruedVat,
            $this->toFloat($summary["journalVATExemptSalesVAT"] ?? 0),
            0.0,
            "VATExemptSales_VAT",
            "tbl_pos_transactions",
            "VATExemptSales_VAT",
            [
                "entryGroup" => "vat",
            ]
        );

        foreach ($categoryRollups as $rollup) {
            $category = $rollup["category"];
            $vatableSales = $this->toFloat($rollup["vatableSalesAmount"] ?? 0);
            $vatExemptSales = $this->toFloat($rollup["vatExemptSalesAmount"] ?? 0);
            $zeroRatedSales = $this->toFloat($rollup["zeroRatedSalesAmount"] ?? 0);
            $costAmount = $this->toFloat($rollup["costAmount"] ?? 0);

            $pushEntry(
                $this->findAccount($slcodes, ["SALES - VATABLE - {$category}"]),
                0.0,
                $vatableSales,
                "Vatable Sales - {$category}",
                "tbl_pos_transactions_detailed",
                "(selling_price * sales_quantity / 1.12) less prorated VAT exempt allocation per category",
                [
                    "category" => $category,
                    "entryGroup" => "sales",
                ]
            );

            $pushEntry(
                $this->findAccount($slcodes, ["SALES - VAT EXEMPT - {$category}"]),
                0.0,
                $vatExemptSales,
                "VAT Exempt Sales - {$category}",
                "tbl_pos_transactions_discounts",
                "discount_amount / 0.20 prorated to discountable detail rows per category",
                [
                    "category" => $category,
                    "entryGroup" => "sales",
                ]
            );

            $pushEntry(
                $this->findAccount($slcodes, ["SALES - ZERO RATED - {$category}"]),
                0.0,
                $zeroRatedSales,
                "Zero Rated Sales - {$category}",
                "tbl_pos_transactions_detailed",
                "selling_price * sales_quantity per category & zero rated",
                [
                    "category" => $category,
                    "entryGroup" => "sales",
                ]
            );

            $pushEntry(
                $this->findAccount($slcodes, ["COST OF SALES - {$category}"]),
                $costAmount,
                0.0,
                "Cost of Sales - {$category}",
                "tbl_pos_transactions_detailed",
                "unit_cost * sales_quantity prorated by mapped component quantities per category",
                [
                    "category" => $category,
                    "entryGroup" => "cost",
                ]
            );

            $pushEntry(
                $this->findAccount($slcodes, ["INVENTORY - {$category}"]),
                0.0,
                $costAmount,
                "Inventory Relief - {$category}",
                "tbl_pos_transactions_detailed",
                "unit_cost * sales_quantity prorated by mapped component quantities per category",
                [
                    "category" => $category,
                    "entryGroup" => "cost",
                ]
            );
        }

        foreach ($refundedCategoryRollups as $rollup) {
            $category = $rollup["category"];
            $vatableSales = $this->toFloat($rollup["vatableSalesAmount"] ?? 0);
            $vatExemptSales = $this->toFloat($rollup["vatExemptSalesAmount"] ?? 0);
            $zeroRatedSales = $this->toFloat($rollup["zeroRatedSalesAmount"] ?? 0);
            $costAmount = $this->toFloat($rollup["costAmount"] ?? 0);

            $refundSalesMappings = [
                [
                    "amount" => $vatableSales,
                    "account" => $this->findAccount($slcodes, ["SALES - VATABLE - {$category}"]),
                    "particulars" => "Vatable Sales - {$category}",
                    "sourceField" => "(selling_price * sales_quantity / 1.12) less prorated refunded VAT exempt allocation per category",
                ],
                [
                    "amount" => $vatExemptSales,
                    "account" => $this->findAccount($slcodes, ["SALES - VAT EXEMPT - {$category}"]),
                    "particulars" => "VAT Exempt Sales - {$category}",
                    "sourceField" => "refunded discount_amount / 0.20 prorated to discountable detail rows per category",
                ],
                [
                    "amount" => $zeroRatedSales,
                    "account" => $this->findAccount($slcodes, ["SALES - ZERO RATED - {$category}"]),
                    "particulars" => "Zero Rated Sales - {$category}",
                    "sourceField" => "selling_price * sales_quantity per refunded category & zero rated",
                ],
            ];

            foreach ($refundSalesMappings as $mapping) {
                $amount = $this->toFloat($mapping["amount"] ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $pushEntry(
                    $mapping["account"],
                    $amount,
                    0.0,
                    "Refund",
                    "tbl_pos_transactions_detailed",
                    $mapping["sourceField"],
                    [
                        "category" => $category,
                        "entryGroup" => "refund",
                    ]
                );
            }

            $pushEntry(
                $this->findAccount($slcodes, ["INVENTORY - {$category}"]),
                $costAmount,
                0.0,
                "Refund Inventory - {$category}",
                "tbl_pos_transactions_detailed",
                "unit_cost * sales_quantity prorated by refunded mapped component quantities per category",
                [
                    "category" => $category,
                    "entryGroup" => "refund-cost",
                ]
            );

            $pushEntry(
                $this->findAccount($slcodes, ["COST OF SALES - {$category}"]),
                0.0,
                $costAmount,
                "Refund Cost of Sales - {$category}",
                "tbl_pos_transactions_detailed",
                "unit_cost * sales_quantity prorated by refunded mapped component quantities per category",
                [
                    "category" => $category,
                    "entryGroup" => "refund-cost",
                ]
            );
        }

        foreach ($refundedTransactionPaymentTotals as $refundPayment) {
            $transactionId = trim((string) ($refundPayment["transaction_id"] ?? ""));
            $paymentMethod = trim((string) ($refundPayment["paymentMethod"] ?? ""));
            $amount = $this->toFloat($refundPayment["amount"] ?? 0);

            if ($transactionId === "" || $amount <= 0) {
                continue;
            }

            $pushEntry(
                $this->resolvePaymentAccount($slcodes, $paymentMethod),
                0.0,
                $amount,
                "Refund-{$transactionId}",
                "tbl_pos_transactions_payments",
                "payment_method & payment_amount for refunded transaction",
                [
                    "transactionId" => $transactionId,
                    "paymentMethod" => $paymentMethod,
                    "entryGroup" => "refund",
                ]
            );
        }

        foreach ($refundedDiscountTotals as $discount) {
            $type = $discount["discountType"] ?? "";
            $amount = $this->toFloat($discount["amount"] ?? 0);
            $account = $this->resolveDiscountAccount($slcodes, $type);

            $pushEntry(
                $account,
                0.0,
                $amount,
                "Refund - {$type}",
                "tbl_pos_transactions_discounts",
                "discount_type & discount_amount for refunded transaction",
                [
                    "discountType" => $type,
                    "entryGroup" => "refund-discounts",
                ]
            );
        }

        $refundedVatTotal = $this->toFloat($summary["refundedVATableSalesVAT"] ?? 0)
            + $this->toFloat($summary["refundedVATExemptSalesVAT"] ?? 0);

        $pushEntry(
            $accruedVat,
            $refundedVatTotal,
            0.0,
            "Refund VAT",
            "tbl_pos_transactions",
            "Refunded VATableSales_VAT + VATExemptSales_VAT",
            [
                "entryGroup" => "refund-vat",
            ]
        );

        $pushEntry(
            $accruedVat,
            0.0,
            $this->toFloat($summary["refundedVATExemptSalesVAT"] ?? 0),
            "Refund VATExemptSales_VAT",
            "tbl_pos_transactions",
            "Refunded VATExemptSales_VAT",
            [
                "entryGroup" => "refund-vat",
            ]
        );

        $shortOver = $this->toFloat($summary["activeShortOverTotal"] ?? 0);
        if (abs($shortOver) >= 0.005) {
            $otherRevenue = $this->findAccount($slcodes, ["OTHER REVENUE"]);
            $pushEntry(
                $otherRevenue,
                $shortOver < 0 ? abs($shortOver) : 0.0,
                $shortOver > 0 ? $shortOver : 0.0,
                "(Over)/Short",
                "tbl_pos_transactions",
                "short_over",
                [
                    "entryGroup" => "other",
                ]
            );
        }

        $paymentTracked = array_reduce(
            $paymentTotals,
            fn($carry, $row) => $carry + $this->toFloat($row["amount"] ?? 0),
            0.0
        );
        $paymentResidual = $this->roundMoney(
            $this->toFloat($summary["journalTotalAmountDue"] ?? 0) - $paymentTracked
        );

        if (abs($paymentResidual) > 0.01) {
            $pushEntry(
                null,
                $paymentResidual > 0 ? $paymentResidual : 0.0,
                $paymentResidual < 0 ? abs($paymentResidual) : 0.0,
                "Unmapped Payment Balance",
                "tbl_pos_transactions",
                "TotalAmountDue",
                [
                    "entryGroup" => "payments",
                    "isResidual" => true,
                ]
            );
        }

        return [
            "entries" => $entries,
            "warnings" => $warnings,
        ];
    }

    private function resolvePaymentAccount(array $slcodes, string $paymentMethod): ?array
    {
        $normalized = $this->normalize($paymentMethod);

        if ($normalized === "CASH") {
            return $this->findAccount($slcodes, ["CASH ON HAND FROM SALES", "CASH ON HAND"]);
        }

        $account = $this->findAccount($slcodes, [
            $paymentMethod,
            "CASH ON HAND CHARGES",
        ]);

        if ($account) {
            return $account;
        }

        return null;
    }

    private function resolveDiscountAccount(array $slcodes, string $discountType): ?array
    {
        $normalized = $this->normalize($discountType);
        $map = [
            "EMPLOYEE" => "SALES DISCOUNT - EMPLOYEE DISCOUNT",
            "SENIOR" => "SALES DISCOUNT - SENIOR CITIZEN DISCOUNT",
            "PWD" => "SALES DISCOUNT - PWD DISCOUNT",
            "LOYALTY" => "SALES DISCOUNT - LOYALTY DISCOUNT",
            "PACKAGE" => "SALES DISCOUNT - PACKAGE DISCOUNT",
            "MANUAL" => "SALES DISCOUNT - MANUAL DISCOUNT",
        ];

        foreach ($map as $needle => $description) {
            if (str_contains($normalized, $needle)) {
                return $this->findAccount($slcodes, [$description]);
            }
        }

        return $this->findAccount($slcodes, ["SALES DISCOUNT - OTHER DISCOUNTS"]);
    }

    private function findAccount(array $slcodes, array $candidates): ?array
    {
        if (empty($slcodes)) {
            return null;
        }

        $normalizedCandidates = array_map(fn($value) => $this->normalize($value), $candidates);

        foreach ($normalizedCandidates as $candidate) {
            foreach ($slcodes as $slcode) {
                if (($slcode["normalizedDescription"] ?? "") === $candidate) {
                    return $slcode;
                }
            }
        }

        foreach ($normalizedCandidates as $candidate) {
            foreach ($slcodes as $slcode) {
                if (str_contains($slcode["normalizedDescription"] ?? "", $candidate)) {
                    return $slcode;
                }
            }
        }

        return null;
    }

    private function buildPlaceholders(array $values, string $prefix): array
    {
        $placeholders = [];
        $params = [];

        foreach (array_values($values) as $index => $value) {
            $key = ":" . $prefix . $index;
            $placeholders[] = $key;
            $params[$key] = $value;
        }

        return [$placeholders, $params];
    }

    private function fetchAllWithParams(string $sql, array $params): array
    {
        $stmt = $this->conn->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function extractPostingDate(array $shift): ?string
    {
        $closingDateTime = $this->sanitizeDateTime($shift["Closing_DateTime"] ?? null);
        if ($closingDateTime !== null) {
            return substr($closingDateTime, 0, 10);
        }

        $openingDateTime = $this->sanitizeDateTime($shift["Opening_DateTime"] ?? null);
        if ($openingDateTime !== null) {
            return substr($openingDateTime, 0, 10);
        }

        return null;
    }

    private function nextPostingReference(): string
    {
        $sql = "SELECT COUNT(DISTINCT menutransactedref) AS total
                FROM tbl_accounting_transactions
                WHERE menutransacted = '/posjournalentries'";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $total = (int) $stmt->fetchColumn();
        $next = $total + 1;

        return "PJE-" . date("Ymd") . str_pad((string) $next, 6, "0", STR_PAD_LEFT);
    }

    private function buildTotalsByTransaction(array $rows, string $amountField, array $transactionIds): array
    {
        if (empty($rows) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $totals = [];

        foreach ($rows as $row) {
            $transactionId = trim((string) ($row["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            $totals[$transactionId] = round(
                ($totals[$transactionId] ?? 0.0) + $this->toFloat($row[$amountField] ?? 0),
                2
            );
        }

        return $totals;
    }

    private function buildPaymentBreakdownByTransaction(array $payments, array $transactionIds): array
    {
        if (empty($payments) || empty($transactionIds)) {
            return [];
        }

        $transactionLookup = $this->buildIdentifierLookup($transactionIds);
        $totals = [];

        foreach ($payments as $payment) {
            $transactionId = trim((string) ($payment["transaction_id"] ?? ""));
            if (!isset($transactionLookup[$transactionId])) {
                continue;
            }

            if (!isset($totals[$transactionId])) {
                $totals[$transactionId] = [
                    "cash_received" => 0.0,
                    "total_other_mop" => 0.0,
                ];
            }

            $amount = round($this->toFloat($payment["payment_amount"] ?? 0), 2);
            $paymentMethod = $this->normalize($payment["payment_method"] ?? "");

            if ($paymentMethod === "CASH") {
                $totals[$transactionId]["cash_received"] += $amount;
            } else {
                $totals[$transactionId]["total_other_mop"] += $amount;
            }
        }

        foreach ($totals as &$total) {
            $total["cash_received"] = round($total["cash_received"], 2);
            $total["total_other_mop"] = round($total["total_other_mop"], 2);
        }

        return $totals;
    }

    private function buildProratedTransactionDiscounts(array $details, array $transactions): array
    {
        if (empty($details) || empty($transactions)) {
            return [];
        }

        $transactionDiscounts = [];
        foreach ($transactions as $transaction) {
            $transactionId = trim((string) ($transaction["transaction_id"] ?? ""));
            if ($transactionId === "") {
                continue;
            }

            $transactionDiscounts[$transactionId] = round(
                $this->toFloat($transaction["Discount"] ?? 0),
                2
            );
        }

        if (empty($transactionDiscounts)) {
            return [];
        }

        $detailGroups = [];
        $transactionSalesTotals = [];

        foreach ($details as $detail) {
            $transactionId = trim((string) ($detail["transaction_id"] ?? ""));
            if (!isset($transactionDiscounts[$transactionId])) {
                continue;
            }

            $detailId = trim((string) ($detail["ID"] ?? ""));
            if ($detailId === "") {
                continue;
            }

            $salesAmount = round(
                $this->toFloat($detail["sales_quantity"] ?? 0) *
                $this->toFloat($detail["selling_price"] ?? 0),
                2
            );

            $detailGroups[$transactionId][] = [
                "detailId" => $detailId,
                "salesAmount" => $salesAmount,
            ];
            $transactionSalesTotals[$transactionId] = round(
                ($transactionSalesTotals[$transactionId] ?? 0.0) + $salesAmount,
                2
            );
        }

        $allocations = [];

        foreach ($detailGroups as $transactionId => $group) {
            $discountTotal = $transactionDiscounts[$transactionId] ?? 0.0;
            $transactionSalesTotal = $transactionSalesTotals[$transactionId] ?? 0.0;

            if ($discountTotal == 0.0 || $transactionSalesTotal == 0.0) {
                foreach ($group as $detail) {
                    $allocations[$detail["detailId"]] = 0.0;
                }
                continue;
            }

            $allocatedSoFar = 0.0;
            $lastIndex = count($group) - 1;

            foreach ($group as $index => $detail) {
                if ($index === $lastIndex) {
                    $allocation = round($discountTotal - $allocatedSoFar, 2);
                } else {
                    $allocation = round(
                        $discountTotal * ($detail["salesAmount"] / $transactionSalesTotal),
                        2
                    );
                    $allocatedSoFar = round($allocatedSoFar + $allocation, 2);
                }

                $allocations[$detail["detailId"]] = $allocation;
            }
        }

        return $allocations;
    }

    private function normalize(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/\s+/', ' ', $value);
        return strtoupper($value ?? "");
    }

    private function toFloat($value): float
    {
        if ($value === null || $value === "") {
            return 0.0;
        }

        return (float) $value;
    }

    private function roundMoney(float $value): float
    {
        return round($value, 2);
    }

    private function buildIdentifierLookup(array $values): array
    {
        $lookup = [];

        foreach ($values as $value) {
            if (!is_scalar($value)) {
                continue;
            }

            $normalized = trim((string) $value);
            if ($normalized === "") {
                continue;
            }

            $lookup[$normalized] = true;
        }

        return $lookup;
    }

    private function sanitizeDateTime($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === "" || $value === "0000-00-00 00:00:00") {
            return null;
        }

        $dateTime = \DateTime::createFromFormat("Y-m-d H:i:s", $value);

        if (!$dateTime || $dateTime->format("Y-m-d H:i:s") !== $value) {
            return null;
        }

        return $value;
    }
}
