<?php

class IMSProductionWorkbenchGateway
{
    private $conn;
    private $tableColumnCache = [];

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getWorkbenchData(array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        if ($busunitcode === "") {
            http_response_code(422);
            return ["message" => "busunitcodeRequired"];
        }

        $busunit = $this->getBusunitRecord($busunitcode);
        if ($busunit === null) {
            http_response_code(404);
            return ["message" => "busunitNotFound"];
        }

        $bufferPct = $this->normalizePercent($data["buffer_pct"] ?? 10);
        $referenceDate = $this->normalizeDate($data["reference_date"] ?? date("Y-m-d"));
        $eligibleRows = $this->getEligibleQueueRows($busunitcode);
        $inventoryBalanceMap = $this->getInventoryBalanceMap($busunitcode);
        $bomMap = $this->getBomMap(array_values(array_unique(array_map(
            static fn($row) => (string) ($row["inv_code"] ?? ""),
            $eligibleRows
        ))));
        $jobsEnabled = $this->tableExists("tbl_ims_production_job") &&
            $this->tableExists("tbl_ims_production_job_line");
        $outputsEnabled = $jobsEnabled &&
            $this->tableExists("tbl_ims_production_output");
        $reservationsEnabled = $jobsEnabled &&
            $this->tableExists("tbl_ims_production_component_reservation");
        $openJobMap = $jobsEnabled ? $this->getOpenJobMap($busunitcode) : [];
        $recentJobs = $jobsEnabled ? $this->getRecentJobs($busunitcode) : [];

        $plannerMap = [];
        $pendingQueueCodes = [];
        $inProgressQueueCodes = [];

        foreach ($eligibleRows as $row) {
            $invCode = (string) ($row["inv_code"] ?? "");
            if ($invCode === "") {
                continue;
            }

            $queueCode = (string) ($row["prd_queue_code"] ?? "");
            $productionStatus = trim((string) ($row["production_status"] ?? ""));
            $orderedByLabel = trim((string) ($row["orderedby_name"] ?? "")) !== ""
                ? (string) $row["orderedby_name"]
                : (string) ($row["orderedby"] ?? "");

            if (!array_key_exists($invCode, $plannerMap)) {
                $plannerMap[$invCode] = [
                    "inv_code" => $invCode,
                    "product_name" => (string) ($row["product_name"] ?? $invCode),
                    "category" => (string) ($row["category"] ?? "Uncategorized"),
                    "uomval" => (float) ($row["uomval"] ?? 1),
                    "uom" => (string) ($row["uom"] ?? "UNIT"),
                    "expiry_days" => (int) ($row["expiry_days"] ?? 0),
                    "pending_demand_qty" => 0.0,
                    "in_progress_qty" => 0.0,
                    "total_demand_qty" => 0.0,
                    "on_hand_fg_qty" => (float) ($inventoryBalanceMap[$invCode]["qty"] ?? 0),
                    "open_job_qty" => (float) ($openJobMap[$invCode] ?? 0),
                    "buffer_qty" => 0.0,
                    "suggested_production_qty" => 0.0,
                    "component_shortage_count" => 0,
                    "readiness_status" => "Ready",
                    "queue_codes" => [],
                    "source_stores" => [],
                    "queue_refs" => [],
                    "components" => [],
                ];
            }

            $qty = (float) ($row["quantity"] ?? 0);
            $plannerMap[$invCode]["total_demand_qty"] += $qty;
            if (strcasecmp($productionStatus, "In Progress") === 0) {
                $plannerMap[$invCode]["in_progress_qty"] += $qty;
                if ($queueCode !== "") {
                    $inProgressQueueCodes[$queueCode] = true;
                }
            } else {
                $plannerMap[$invCode]["pending_demand_qty"] += $qty;
                if ($queueCode !== "") {
                    $pendingQueueCodes[$queueCode] = true;
                }
            }

            if ($queueCode !== "") {
                $plannerMap[$invCode]["queue_codes"][$queueCode] = true;
            }
            if ($orderedByLabel !== "") {
                $plannerMap[$invCode]["source_stores"][$orderedByLabel] = true;
            }

            $plannerMap[$invCode]["queue_refs"][] = [
                "prd_queue_code" => $queueCode,
                "orderedby" => (string) ($row["orderedby"] ?? ""),
                "orderedby_name" => $orderedByLabel,
                "quantity" => $qty,
                "production_status" => $productionStatus,
                "delivery_status" => (string) ($row["delivery_status"] ?? ""),
            ];
        }

        $shortageItems = 0;
        $suggestedTotalQty = 0.0;

        foreach ($plannerMap as $invCode => &$item) {
            $item["buffer_qty"] = round($item["pending_demand_qty"] * ($bufferPct / 100), 2);
            $item["suggested_production_qty"] = round(max(
                0,
                $item["pending_demand_qty"] + $item["buffer_qty"] - max(0, $item["on_hand_fg_qty"]) - max(0, $item["open_job_qty"])
            ), 2);
            $suggestedTotalQty += $item["suggested_production_qty"];

            $componentRows = $bomMap[$invCode] ?? [];
            if (empty($componentRows)) {
                $item["readiness_status"] = $item["suggested_production_qty"] > 0
                    ? "No BOM"
                    : "Covered";
                $item["queue_codes"] = array_values(array_keys($item["queue_codes"]));
                $item["source_stores"] = array_values(array_keys($item["source_stores"]));
                continue;
            }

            $components = [];
            $shortages = 0;
            foreach ($componentRows as $component) {
                $componentCode = (string) ($component["component_code"] ?? "");
                $requiredQty = round($item["suggested_production_qty"] * (float) ($component["component_qty"] ?? 0), 2);
                $availableQty = round((float) ($inventoryBalanceMap[$componentCode]["qty"] ?? 0), 2);
                $shortageQty = round(max(0, $requiredQty - max(0, $availableQty)), 2);

                if ($shortageQty > 0) {
                    $shortages++;
                }

                $components[] = [
                    "component_code" => $componentCode,
                    "component_name" => (string) ($component["component_name"] ?? $componentCode),
                    "component_class" => (string) ($component["component_class"] ?? ""),
                    "uomval" => (float) ($component["uomval"] ?? 1),
                    "uom" => (string) ($component["uom"] ?? "UNIT"),
                    "required_qty" => $requiredQty,
                    "available_qty" => $availableQty,
                    "shortage_qty" => $shortageQty,
                ];
            }

            $item["components"] = $components;
            $item["component_shortage_count"] = $shortages;
            if ($item["suggested_production_qty"] <= 0) {
                $item["readiness_status"] = "Covered";
            } elseif ($shortages > 0) {
                $item["readiness_status"] = "Needs Raw Mats";
                $shortageItems++;
            } else {
                $item["readiness_status"] = "Ready";
            }

            $item["queue_codes"] = array_values(array_keys($item["queue_codes"]));
            $item["source_stores"] = array_values(array_keys($item["source_stores"]));
        }
        unset($item);

        $plannerItems = array_values($plannerMap);
        usort($plannerItems, function ($left, $right) {
            $suggestedCompare = (float) ($right["suggested_production_qty"] ?? 0) <=> (float) ($left["suggested_production_qty"] ?? 0);
            if ($suggestedCompare !== 0) {
                return $suggestedCompare;
            }

            return (float) ($right["pending_demand_qty"] ?? 0) <=> (float) ($left["pending_demand_qty"] ?? 0);
        });

        return [
            "message" => "Success",
            "busunit" => [
                "busunitcode" => $busunitcode,
                "name" => (string) ($busunit["name"] ?? $busunitcode),
                "class" => (string) ($busunit["class"] ?? ""),
                "ownership_status" => (string) ($busunit["ownership_status"] ?? ""),
            ],
            "config" => [
                "reference_date" => $referenceDate,
                "buffer_pct" => $bufferPct,
                "jobs_enabled" => $jobsEnabled,
                "outputs_enabled" => $outputsEnabled,
                "reservations_enabled" => $reservationsEnabled,
            ],
            "metrics" => [
                "pending_refs" => count($pendingQueueCodes),
                "in_progress_refs" => count($inProgressQueueCodes),
                "planner_items" => count($plannerItems),
                "suggested_total_qty" => round($suggestedTotalQty, 2),
                "shortage_items" => $shortageItems,
                "open_jobs" => count($recentJobs),
            ],
            "planner_items" => $plannerItems,
            "recent_jobs" => $recentJobs,
        ];
    }

    public function getRecentJobDetail(array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        $jobCode = trim((string) ($data["job_code"] ?? ""));

        if ($busunitcode === "" || $jobCode === "") {
            http_response_code(422);
            return ["message" => "busunitcodeAndJobCodeRequired"];
        }

        $busunit = $this->getBusunitRecord($busunitcode);
        if ($busunit === null) {
            http_response_code(404);
            return ["message" => "busunitNotFound"];
        }

        $job = $this->getRecentJobByCode($busunitcode, $jobCode);
        if ($job === null) {
            http_response_code(404);
            return ["message" => "recentJobNotFound"];
        }

        return [
            "message" => "Success",
            "job" => $job,
        ];
    }

    public function processActionForUser(string $user_id, array $data): array
    {
        $action = strtolower(trim((string) ($data["action"] ?? "")));

        if ($action === "release_production") {
            return $this->releaseProductionForUser($user_id, $data);
        }

        if ($action === "complete_production" || $action === "complete_production_partial") {
            return $this->completeProductionForUser($user_id, $data);
        }

        if ($action === "skip_production_line") {
            return $this->skipProductionLineForUser($user_id, $data);
        }

        if ($action === "unskip_production_line") {
            return $this->unskipProductionLineForUser($user_id, $data);
        }

        http_response_code(422);
        return ["message" => "invalidAction"];
    }

    private function releaseProductionForUser(string $user_id, array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        $queueCodes = $this->normalizeQueueCodes($data["queue_codes"] ?? []);
        $notes = trim((string) ($data["notes"] ?? ""));
        $bufferPct = $this->normalizePercent($data["buffer_pct"] ?? 10);

        if ($busunitcode === "" || empty($queueCodes)) {
            http_response_code(422);
            return ["message" => "busunitcodeAndQueueCodesRequired"];
        }

        $summaryRows = $this->getQueueSummaryRows($busunitcode, $queueCodes);
        $pendingRows = array_values(array_filter($summaryRows, static function ($row) {
            return strcasecmp((string) ($row["production_status"] ?? ""), "Pending") === 0;
        }));

        if (empty($pendingRows)) {
            http_response_code(422);
            return ["message" => "noPendingProductionQueue"];
        }

        $pendingQueueCodes = array_values(array_map(
            static fn($row) => (string) ($row["prd_queue_code"] ?? ""),
            $pendingRows
        ));

        $lineRows = $this->getQueueItemRows($pendingQueueCodes);
        $jobsEnabled = $this->tableExists("tbl_ims_production_job") &&
            $this->tableExists("tbl_ims_production_job_line");
        $reservationsEnabled = $jobsEnabled &&
            $this->tableExists("tbl_ims_production_component_reservation");
        $jobCode = null;
        $today = date("Y-m-d");
        $plannedTotalQty = array_reduce($lineRows, static function ($carry, $row) use ($bufferPct) {
            $quantity = (float) ($row["quantity"] ?? 0);
            $bufferQty = round($quantity * ($bufferPct / 100), 4);
            return $carry + $quantity + $bufferQty;
        }, 0.0);
        $bomMap = $reservationsEnabled ? $this->getBomMap(array_values(array_unique(array_map(
            static fn($row) => (string) ($row["inv_code"] ?? ""),
            $lineRows
        )))) : [];

        try {
            $this->conn->beginTransaction();

            if ($jobsEnabled) {
                $jobCode = $this->generateJobCode();
                $this->insertJobHeader(
                    $jobCode,
                    $busunitcode,
                    $today,
                    $bufferPct,
                    $plannedTotalQty,
                    $notes,
                    $user_id
                );

                foreach ($lineRows as $lineRow) {
                    $lineQuantity = (float) ($lineRow["quantity"] ?? 0);
                    $lineBufferQty = round($lineQuantity * ($bufferPct / 100), 4);
                    $lineSuggestedQty = round($lineQuantity + $lineBufferQty, 4);
                    $jobLineSeq = $this->insertJobLine(
                        $jobCode,
                        [
                            ...$lineRow,
                            "buffer_qty" => $lineBufferQty,
                            "suggested_qty" => $lineSuggestedQty,
                        ],
                        $user_id,
                    );

                    if ($reservationsEnabled) {
                        $invCode = (string) ($lineRow["inv_code"] ?? "");
                        $productQty = $lineSuggestedQty;

                        foreach (($bomMap[$invCode] ?? []) as $component) {
                            $reservedQty = round(
                                $productQty * (float) ($component["component_qty"] ?? 0),
                                4
                            );

                            if ($reservedQty <= 0) {
                                continue;
                            }

                            $this->insertComponentReservation(
                                $jobCode,
                                $jobLineSeq,
                                (string) ($lineRow["prd_queue_code"] ?? ""),
                                $invCode,
                                (string) ($component["component_code"] ?? ""),
                                $reservedQty,
                                0.0,
                                "Reserved",
                                $busunitcode,
                                null,
                                $user_id
                            );
                        }
                    }
                }
            }

            $this->markQueueSummariesInProgress($pendingQueueCodes, $user_id);

            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }

        return [
            "message" => "Success",
            "action" => "release_production",
            "busunitcode" => $busunitcode,
            "job_code" => $jobCode,
            "jobs_enabled" => $jobsEnabled,
            "reservations_enabled" => $reservationsEnabled,
            "processed_queue_codes" => $pendingQueueCodes,
        ];
    }

    private function completeProductionForUser(string $user_id, array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        $queueCodes = $this->normalizeQueueCodes($data["queue_codes"] ?? []);

        if ($busunitcode === "" || empty($queueCodes)) {
            http_response_code(422);
            return ["message" => "busunitcodeAndQueueCodesRequired"];
        }

        $busunit = $this->getBusunitRecord($busunitcode);
        if ($busunit === null) {
            http_response_code(404);
            return ["message" => "busunitNotFound"];
        }
        $purchasePriceCategory = trim((string) ($busunit["purchase_price_category"] ?? ""));

        $summaryRows = $this->getQueueSummaryRows($busunitcode, $queueCodes);
        $validRows = array_values(array_filter($summaryRows, static function ($row) {
            $status = trim((string) ($row["production_status"] ?? ""));
            return in_array($status, ["Pending", "In Progress"], true);
        }));

        if (empty($validRows)) {
            http_response_code(422);
            return ["message" => "noCompletableProductionQueue"];
        }

        $selectedQueueCodes = array_values(array_map(
            static fn($row) => (string) ($row["prd_queue_code"] ?? ""),
            $validRows
        ));

        $lineRows = $this->getQueueItemRows($selectedQueueCodes);
        if (empty($lineRows)) {
            http_response_code(422);
            return ["message" => "queueItemsNotFound"];
        }

        $jobsEnabled = $this->tableExists("tbl_ims_production_job") &&
            $this->tableExists("tbl_ims_production_job_line");
        $outputsEnabled = $jobsEnabled &&
            $this->tableExists("tbl_ims_production_output");
        $reservationsEnabled = $jobsEnabled &&
            $this->tableExists("tbl_ims_production_component_reservation");
        $existingProducedMap = $outputsEnabled
            ? $this->getProducedOutputMap($selectedQueueCodes)
            : [];
        $latestJobLineMap = $jobsEnabled
            ? $this->getLatestJobLineMap($selectedQueueCodes)
            : [];
        $requestedOutputsMap = $this->normalizeProductionOutputs(
            $data["production_outputs"] ?? []
        );

        if (!$outputsEnabled && !empty($requestedOutputsMap)) {
            http_response_code(422);
            return ["message" => "partialProductionNeedsOutputTable"];
        }

        try {
            $requestedRows = $this->buildRequestedProductionRows(
                $lineRows,
                $existingProducedMap,
                $requestedOutputsMap,
                $latestJobLineMap,
            );
        } catch (RuntimeException $e) {
            http_response_code(422);
            return ["message" => $e->getMessage()];
        }

        if (empty($requestedRows)) {
            http_response_code(422);
            return ["message" => "noRemainingProductionQty"];
        }

        $inventoryBalanceMap = $this->getInventoryBalanceMap($busunitcode);
        $bomMap = $this->getBomMap(array_values(array_unique(array_map(
            static fn($row) => (string) ($row["inv_code"] ?? ""),
            $requestedRows
        ))));

        $pricingInvCodes = [];
        foreach ($requestedRows as $row) {
            $invCode = trim((string) ($row["inv_code"] ?? ""));
            if ($invCode !== "") {
                $pricingInvCodes[$invCode] = true;
            }
        }
        foreach ($bomMap as $components) {
            foreach ((array) $components as $component) {
                $componentCode = trim((string) ($component["component_code"] ?? ""));
                if ($componentCode !== "") {
                    $pricingInvCodes[$componentCode] = true;
                }
            }
        }
        $pricingCostMap = $this->getPricingCostMapByCategory(
            $purchasePriceCategory,
            array_keys($pricingInvCodes),
        );

        $componentNeeds = [];
        foreach ($requestedRows as $row) {
            $productQty = (float) ($row["produce_qty"] ?? 0);
            foreach (($bomMap[(string) ($row["inv_code"] ?? "")] ?? []) as $component) {
                $componentCode = (string) ($component["component_code"] ?? "");
                if ($componentCode === "") {
                    continue;
                }

                if (!array_key_exists($componentCode, $componentNeeds)) {
                    $componentNeeds[$componentCode] = [
                        "component_code" => $componentCode,
                        "component_name" => (string) ($component["component_name"] ?? $componentCode),
                        "required_qty" => 0.0,
                        "available_qty" => (float) ($inventoryBalanceMap[$componentCode]["qty"] ?? 0),
                        "uom" => (string) ($component["uom"] ?? "UNIT"),
                    ];
                }

                $componentNeeds[$componentCode]["required_qty"] += round(
                    $productQty * (float) ($component["component_qty"] ?? 0),
                    4
                );
            }
        }

        $shortages = [];
        foreach ($componentNeeds as $componentCode => $componentNeed) {
            $shortageQty = round(
                max(0, (float) $componentNeed["required_qty"] - max(0, (float) $componentNeed["available_qty"])),
                4
            );
            if ($shortageQty > 0) {
                $shortages[] = [
                    "component_code" => $componentCode,
                    "component_name" => $componentNeed["component_name"],
                    "required_qty" => round((float) $componentNeed["required_qty"], 4),
                    "available_qty" => round((float) $componentNeed["available_qty"], 4),
                    "shortage_qty" => $shortageQty,
                    "uom" => $componentNeed["uom"],
                ];
            }
        }

        if (!empty($shortages)) {
            http_response_code(422);
            return [
                "message" => "componentShortage",
                "shortages" => $shortages,
            ];
        }

        $today = date("Y-m-d");
        $producedItems = [];
        $jobLineMap = $latestJobLineMap;

        try {
            $this->conn->beginTransaction();

            foreach ($requestedRows as $row) {
                $invCode = (string) ($row["inv_code"] ?? "");
                $productQty = round((float) ($row["produce_qty"] ?? 0), 4);
                $prQueueCode = (string) ($row["prd_queue_code"] ?? "");
                $uomVal = (float) ($row["uomval"] ?? 1);
                $uom = (string) ($row["uom"] ?? "UNIT");
                $lineKey = $this->buildQueueInvKey($prQueueCode, $invCode);
                $jobLine = $jobLineMap[$lineKey] ?? null;

                if ($jobsEnabled && $jobLine === null) {
                    $autoJobCode = $this->generateJobCode();
                    $this->insertJobHeader(
                        $autoJobCode,
                        $busunitcode,
                        $today,
                        0.0,
                        $productQty,
                        "Auto-created during production completion.",
                        $user_id
                    );

                    $jobLineSeq = $this->insertJobLine(
                        $autoJobCode,
                        [
                            "prd_queue_code" => $prQueueCode,
                            "inv_code" => $invCode,
                            "quantity" => $productQty,
                        ],
                        $user_id
                    );

                $jobLine = [
                    "seq" => $jobLineSeq,
                    "job_code" => $autoJobCode,
                    "planned_qty" => $productQty,
                    "suggested_qty" => $productQty,
                    "completed_qty" => 0.0,
                ];
                    $jobLineMap[$lineKey] = $jobLine;
                }

                $expiryDate = $this->normalizeDateString($row["requested_expiry_date"] ?? null)
                    ?? $this->computeExpiryDate($today, (int) ($row["expiry_days"] ?? 0));

                foreach (($bomMap[$invCode] ?? []) as $component) {
                    $requiredQty = round($productQty * (float) ($component["component_qty"] ?? 0), 4);
                    if ($requiredQty <= 0) {
                        continue;
                    }

                    $componentCode = (string) ($component["component_code"] ?? "");
                    $resolvedComponentCost = array_key_exists($componentCode, $pricingCostMap)
                        ? (float) $pricingCostMap[$componentCode]
                        : (float) ($component["component_cost_per_uom"] ?? 0);

                    $this->insertInventoryTransaction(
                        $today,
                        $componentCode,
                        -1 * $requiredQty,
                        $resolvedComponentCost,
                        (float) ($component["uomval"] ?? 1),
                        (string) ($component["uom"] ?? "UNIT"),
                        $prQueueCode,
                        $busunitcode,
                        strtoupper(trim((string) ($component["component_class"] ?? ""))) === "RM" ? "RM" : "FG",
                        "0000-00-00",
                        $user_id,
                        $purchasePriceCategory === "" ? null : $purchasePriceCategory
                    );

                    if ($reservationsEnabled && $jobLine !== null) {
                        $this->issueOrCreateComponentReservation(
                            (string) $jobLine["job_code"],
                            (int) $jobLine["seq"],
                            $prQueueCode,
                            $invCode,
                            (string) ($component["component_code"] ?? ""),
                            $requiredQty,
                            $busunitcode,
                            $user_id
                        );
                    }
                }

                $resolvedFgCost = array_key_exists($invCode, $pricingCostMap)
                    ? (float) $pricingCostMap[$invCode]
                    : (float) ($row["cost_per_uom"] ?? 0);
                $this->insertInventoryTransaction(
                    $today,
                    $invCode,
                    $productQty,
                    $resolvedFgCost,
                    $uomVal,
                    $uom,
                    $prQueueCode,
                    $busunitcode,
                    str_starts_with($invCode, "RM-") ? "RM" : "FG",
                    $expiryDate,
                    $user_id,
                    $purchasePriceCategory === "" ? null : $purchasePriceCategory
                );

                if ($outputsEnabled && $jobLine !== null) {
                    $this->insertProductionOutput(
                        (string) $jobLine["job_code"],
                        (int) $jobLine["seq"],
                        $prQueueCode,
                        $invCode,
                        $productQty,
                        $today,
                        $expiryDate === "0000-00-00" ? null : $expiryDate,
                        "Completed from production workbench.",
                        $user_id
                    );
                }

                if ($jobsEnabled && $jobLine !== null) {
                    $this->incrementJobLineCompletion(
                        (int) $jobLine["seq"],
                        $productQty,
                        (float) ($jobLine["suggested_qty"] ?? $jobLine["planned_qty"] ?? $productQty),
                        $expiryDate === "0000-00-00" ? null : $expiryDate,
                        $user_id
                    );
                }

                $producedItems[] = [
                    "prd_queue_code" => $prQueueCode,
                    "inv_code" => $invCode,
                    "quantity" => $productQty,
                    "expiry_date" => $expiryDate,
                ];
            }

            $completedQueueCodes = [];
            $skippedQueueCodes = [];
            $inProgressQueueCodes = [];

            if ($jobsEnabled) {
                $queueStatusMap = $this->getQueueLineCompletionState($selectedQueueCodes);
                foreach ($selectedQueueCodes as $queueCode) {
                    $state = $queueStatusMap[$queueCode] ?? null;
                    if (!$state || !($state["has_lines"] ?? false)) {
                        $inProgressQueueCodes[] = $queueCode;
                        continue;
                    }

                    if ($state["all_done"] ?? false) {
                        if ($state["all_skipped"] ?? false) {
                            $skippedQueueCodes[] = $queueCode;
                        } else {
                            $completedQueueCodes[] = $queueCode;
                        }
                    } else {
                        $inProgressQueueCodes[] = $queueCode;
                    }
                }
            } else {
                $queueProgress = $this->buildQueueProgressMap(
                    $lineRows,
                    $existingProducedMap,
                    $requestedRows
                );

                foreach ($queueProgress as $queueCode => $progress) {
                    if ((float) $progress["remaining_qty"] <= 0.0001) {
                        $completedQueueCodes[] = $queueCode;
                    } else {
                        $inProgressQueueCodes[] = $queueCode;
                    }
                }
            }

            $this->markQueueSummariesCompleted($completedQueueCodes, $user_id);
            $this->markQueueSummariesSkipped($skippedQueueCodes, $user_id);
            $this->markQueueSummariesInProgress($inProgressQueueCodes, $user_id, true);

            if ($jobsEnabled) {
                $this->syncRelatedJobHeaders($user_id);
            }

            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }

        return [
            "message" => "Success",
            "action" => "complete_production",
            "busunitcode" => $busunitcode,
            "jobs_enabled" => $jobsEnabled,
            "outputs_enabled" => $outputsEnabled,
            "reservations_enabled" => $reservationsEnabled,
            "processed_queue_codes" => $selectedQueueCodes,
            "produced_items" => $producedItems,
        ];
    }

    private function skipProductionLineForUser(string $user_id, array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        $jobLineSeq = (int) ($data["job_line_seq"] ?? 0);
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $prQueueCode = trim((string) ($data["prd_queue_code"] ?? ""));
        $invCode = trim((string) ($data["inv_code"] ?? ""));

        if (
            $busunitcode === "" ||
            ($jobLineSeq <= 0 && ($jobCode === "" || $prQueueCode === "" || $invCode === ""))
        ) {
            http_response_code(422);
            return ["message" => "skipLineIdentifierRequired"];
        }

        if (
            !$this->tableExists("tbl_ims_production_job") ||
            !$this->tableExists("tbl_ims_production_job_line")
        ) {
            http_response_code(422);
            return ["message" => "jobTablesNotAvailable"];
        }

        $sql = "SELECT
                    jl.seq,
                    jl.job_code,
                    jl.prd_queue_code,
                    jl.inv_code,
                    jl.planned_qty,
                    jl.suggested_qty,
                    jl.status
                FROM tbl_ims_production_job_line AS jl
                INNER JOIN tbl_ims_production_job AS j
                    ON j.job_code = jl.job_code
                WHERE " . ($jobLineSeq > 0
                    ? "jl.seq = :seq"
                    : "jl.job_code = :job_code
                  AND jl.prd_queue_code = :prd_queue_code
                  AND jl.inv_code = :inv_code") . "
                  AND jl.deletestatus = 'Active'
                  AND j.deletestatus = 'Active'
                  AND j.busunitcode = :busunitcode
                ORDER BY jl.seq DESC
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        if ($jobLineSeq > 0) {
            $stmt->bindValue(":seq", $jobLineSeq, PDO::PARAM_INT);
        } else {
            $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $stmt->bindValue(":prd_queue_code", $prQueueCode, PDO::PARAM_STR);
            $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        }
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();
        $line = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$line) {
            http_response_code(404);
            return ["message" => "jobLineNotFound"];
        }

        $currentStatus = trim((string) ($line["status"] ?? ""));
        if (strcasecmp($currentStatus, "Completed") === 0) {
            http_response_code(422);
            return ["message" => "completedLineCannotBeSkipped"];
        }

        $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
        $targetQty = round(max(
            (float) ($line["planned_qty"] ?? 0),
            (float) ($line["suggested_qty"] ?? 0),
        ), 4);

        try {
            $this->conn->beginTransaction();

            $this->markJobLineSkipped(
                (int) ($line["seq"] ?? 0),
                null,
                $user_id
            );

            if ($queueCode !== "") {
                $statusSql = "SELECT status
                              FROM tbl_ims_production_job_line
                              WHERE prd_queue_code = :prd_queue_code
                                AND deletestatus = 'Active'";
                $statusStmt = $this->conn->prepare($statusSql);
                $statusStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
                $statusStmt->execute();
                $queueLineStatuses = $statusStmt->fetchAll(PDO::FETCH_COLUMN);

                $allDone = !empty($queueLineStatuses);
                $allSkipped = !empty($queueLineStatuses);
                foreach ($queueLineStatuses as $status) {
                    $normalized = strtolower(trim((string) $status));
                    if (!in_array($normalized, ["completed", "skipped"], true)) {
                        $allDone = false;
                    }
                    if ($normalized !== "skipped") {
                        $allSkipped = false;
                    }
                }

                if ($allDone) {
                    if ($allSkipped) {
                        $this->markQueueSummariesSkipped([$queueCode], $user_id);
                    } else {
                        $this->markQueueSummariesCompleted([$queueCode], $user_id);
                    }
                } else {
                    $this->markQueueSummariesInProgress([$queueCode], $user_id, true);
                }
            }

            $this->syncRelatedJobHeaders($user_id);
            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }

        return [
            "message" => "Success",
            "action" => "skip_production_line",
            "busunitcode" => $busunitcode,
            "job_line_seq" => (int) ($line["seq"] ?? 0),
            "job_code" => (string) ($line["job_code"] ?? ""),
            "prd_queue_code" => $queueCode,
            "inv_code" => (string) ($line["inv_code"] ?? ""),
            "skipped_qty" => $targetQty,
        ];
    }

    private function unskipProductionLineForUser(string $user_id, array $data): array
    {
        $busunitcode = trim((string) ($data["busunitcode"] ?? ""));
        $jobLineSeq = (int) ($data["job_line_seq"] ?? 0);

        if ($busunitcode === "" || $jobLineSeq <= 0) {
            http_response_code(422);
            return ["message" => "busunitcodeAndJobLineSeqRequired"];
        }

        if (
            !$this->tableExists("tbl_ims_production_job") ||
            !$this->tableExists("tbl_ims_production_job_line")
        ) {
            http_response_code(422);
            return ["message" => "jobTablesNotAvailable"];
        }

        $sql = "SELECT
                    jl.seq,
                    jl.job_code,
                    jl.seq,
                    jl.prd_queue_code,
                    jl.inv_code,
                    jl.planned_qty,
                    jl.suggested_qty,
                    jl.completed_qty,
                    jl.status
                FROM tbl_ims_production_job_line AS jl
                INNER JOIN tbl_ims_production_job AS j
                    ON j.job_code = jl.job_code
                WHERE jl.seq = :seq
                  AND jl.deletestatus = 'Active'
                  AND j.deletestatus = 'Active'
                  AND j.busunitcode = :busunitcode
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();
        $line = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$line) {
            http_response_code(404);
            return ["message" => "jobLineNotFound"];
        }

        $currentStatus = trim((string) ($line["status"] ?? ""));
        if (strcasecmp($currentStatus, "Skipped") !== 0) {
            http_response_code(422);
            return ["message" => "jobLineNotSkipped"];
        }

        $plannedQty = (float) ($line["planned_qty"] ?? 0);
        $suggestedQty = (float) ($line["suggested_qty"] ?? 0);
        $targetQty = round(max($plannedQty, $suggestedQty), 4);
        $producedQty = $this->getProducedOutputQtyByJobLineSeq($jobLineSeq);
        $nextCompletedQty = round(min($targetQty, max(0, $producedQty)), 4);

        $nextStatus = "Released";
        if ($nextCompletedQty >= $targetQty && $targetQty > 0) {
            $nextStatus = "Completed";
        } elseif ($nextCompletedQty > 0) {
            $nextStatus = "In Progress";
        }

        try {
            $this->conn->beginTransaction();

            $updateSql = "UPDATE tbl_ims_production_job_line
                          SET
                              completed_qty = :completed_qty,
                              status = :status,
                              usertracker = :usertracker
                          WHERE seq = :seq
                            AND deletestatus = 'Active'";

            $updateStmt = $this->conn->prepare($updateSql);
            $updateStmt->bindValue(":completed_qty", $nextCompletedQty);
            $updateStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
            $updateStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $updateStmt->bindValue(":seq", $jobLineSeq, PDO::PARAM_INT);
            $updateStmt->execute();

            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            if ($queueCode !== "") {
                $this->markQueueSummariesInProgress([$queueCode], $user_id, true);
            }

            $this->syncRelatedJobHeaders($user_id);
            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }

        return [
            "message" => "Success",
            "action" => "unskip_production_line",
            "busunitcode" => $busunitcode,
            "job_line_seq" => $jobLineSeq,
            "job_code" => (string) ($line["job_code"] ?? ""),
            "prd_queue_code" => (string) ($line["prd_queue_code"] ?? ""),
            "inv_code" => (string) ($line["inv_code"] ?? ""),
            "status" => $nextStatus,
            "completed_qty" => $nextCompletedQty,
        ];
    }

    private function getBusunitRecord(string $busunitcode): ?array
    {
        $sql = "SELECT busunitcode, class, name, ownership_status, purchase_price_category
                FROM lkp_busunits
                WHERE busunitcode = :busunitcode
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function getEligibleQueueRows(string $busunitcode): array
    {
        $sql = "SELECT
                    pq.prd_queue_code,
                    pq.inv_code,
                    pq.quantity,
                    pq.cost_per_uom,
                    pq.uomval,
                    pq.uom,
                    pq.orderedby,
                    pqs.production_status,
                    pqs.delivery_status,
                    pqs.production_started,
                    pqs.production_completed,
                    orderedBy.name AS orderedby_name,
                    payeeBu.name AS payee_name,
                    COALESCE(bp.`desc`, rm.`desc`, pq.inv_code) AS product_name,
                    COALESCE(bp.category, rm.category, 'Uncategorized') AS category,
                    COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                FROM tbl_products_queue AS pq
                INNER JOIN tbl_products_queue_summary AS pqs
                    ON pq.prd_queue_code = pqs.prd_queue_code
                LEFT JOIN lkp_busunits AS orderedBy
                    ON pq.orderedby = orderedBy.busunitcode
                LEFT JOIN lkp_busunits AS payeeBu
                    ON pqs.payee = payeeBu.busunitcode
                LEFT JOIN lkp_build_of_products AS bp
                    ON pq.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats AS rm
                    ON pq.inv_code = rm.mat_code
                WHERE pq.deletestatus = 'Active'
                  AND pqs.deletestatus = 'Active'
                  AND pqs.payee = :busunitcode
                  AND pqs.po_status = 'Approved'
                  AND pqs.production_status IN ('Pending', 'In Progress')
                ORDER BY pq.prd_queue_code ASC, pq.inv_code ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getInventoryBalanceMap(string $busunitcode): array
    {
        $sql = "SELECT inv_code, SUM(qty) AS qty
                FROM tbl_inventory_transactions
                WHERE deletestatus = 'Active'
                  AND busunitcode = :busunitcode
                GROUP BY inv_code";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $map[(string) $row["inv_code"]] = [
                "qty" => (float) ($row["qty"] ?? 0),
            ];
        }

        return $map;
    }

    private function getBomMap(array $invCodes): array
    {
        $filtered = array_values(array_filter($invCodes, static fn($value) => trim((string) $value) !== ""));
        if (empty($filtered)) {
            return [];
        }

        $placeholders = [];
        foreach ($filtered as $index => $invCode) {
            $placeholders[] = ":build_" . $index;
        }

        $sql = "SELECT
                    bc.build_code,
                    bc.component_code,
                    bc.component_class,
                    bc.qty AS component_qty,
                    COALESCE(rm.`desc`, fg.`desc`, bc.component_code) AS component_name,
                    COALESCE(rm.uomval, fg.uomval, 1) AS uomval,
                    COALESCE(rm.uom, fg.uom, 'UNIT') AS uom,
                    COALESCE(rm.cost_per_uom, fg.cost_per_uom, 0) AS component_cost_per_uom
                FROM tbl_build_components AS bc
                LEFT JOIN lkp_raw_mats AS rm
                    ON bc.component_code = rm.mat_code
                LEFT JOIN lkp_build_of_products AS fg
                    ON bc.component_code = fg.build_code
                WHERE bc.deletestatus = 'Active'
                  AND bc.build_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        foreach ($filtered as $index => $invCode) {
            $stmt->bindValue(":build_" . $index, $invCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $buildCode = (string) ($row["build_code"] ?? "");
            if ($buildCode === "") {
                continue;
            }

            if (!array_key_exists($buildCode, $map)) {
                $map[$buildCode] = [];
            }

            $map[$buildCode][] = $row;
        }

        return $map;
    }

    private function getPricingCostMapByCategory(string $pricingCode, array $invCodes): array
    {
        $code = trim($pricingCode);
        $filteredInvCodes = array_values(array_filter(
            array_map(static fn($value) => trim((string) $value), $invCodes),
            static fn($value) => $value !== ""
        ));
        $filteredInvCodes = array_values(array_unique($filteredInvCodes));

        if ($code === "" || empty($filteredInvCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($filteredInvCodes as $index => $invCode) {
            $placeholders[] = ":inv_" . $index;
        }

        $sql = "SELECT inv_code, cost_per_uom
                FROM tbl_pricing_details
                WHERE pricing_code = :pricing_code
                  AND deletestatus = 'Active'
                  AND inv_code IN (" . implode(", ", $placeholders) . ")
                ORDER BY seq DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":pricing_code", $code, PDO::PARAM_STR);
        foreach ($filteredInvCodes as $index => $invCode) {
            $stmt->bindValue(":inv_" . $index, $invCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $invCode = trim((string) ($row["inv_code"] ?? ""));
            if ($invCode === "" || array_key_exists($invCode, $map)) {
                continue;
            }
            $map[$invCode] = (float) ($row["cost_per_uom"] ?? 0);
        }

        return $map;
    }

    private function getOpenJobMap(string $busunitcode): array
    {
        $sql = "SELECT
                    jl.inv_code,
                    SUM(jl.planned_qty - jl.completed_qty) AS open_qty
                FROM tbl_ims_production_job_line AS jl
                INNER JOIN tbl_ims_production_job AS j
                    ON jl.job_code = j.job_code
                WHERE j.deletestatus = 'Active'
                  AND jl.deletestatus = 'Active'
                  AND j.busunitcode = :busunitcode
                  AND j.status IN ('Released', 'In Progress')
                  AND jl.status IN ('Released', 'In Progress')
                GROUP BY jl.inv_code";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $map[(string) $row["inv_code"]] = (float) ($row["open_qty"] ?? 0);
        }

        return $map;
    }

    private function getRecentJobs(string $busunitcode): array
    {
        $sql = "SELECT
                    j.job_code,
                    j.job_date,
                    j.reference_date,
                    j.status,
                    j.buffer_pct,
                    j.planned_total_qty,
                    j.completed_total_qty,
                    COUNT(jl.seq) AS line_count
                FROM tbl_ims_production_job AS j
                LEFT JOIN tbl_ims_production_job_line AS jl
                    ON j.job_code = jl.job_code
                   AND jl.deletestatus = 'Active'
                WHERE j.deletestatus = 'Active'
                  AND j.busunitcode = :busunitcode
                GROUP BY
                    j.job_code,
                    j.job_date,
                    j.reference_date,
                    j.status,
                    j.buffer_pct,
                    j.planned_total_qty,
                    j.completed_total_qty
                ORDER BY j.createdtime DESC
                LIMIT 8";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($rows)) {
            return [];
        }

        $jobCodes = array_values(array_unique(array_map(
            static fn($row) => (string) ($row["job_code"] ?? ""),
            $rows
        )));
        $lineMap = $this->getRecentJobLineMap($jobCodes);

        foreach ($rows as &$row) {
            $jobCode = (string) ($row["job_code"] ?? "");
            $row["job_lines"] = $lineMap[$jobCode] ?? [];
        }
        unset($row);

        return $rows;
    }

    private function getRecentJobByCode(string $busunitcode, string $jobCode): ?array
    {
        $sql = "SELECT
                    j.job_code,
                    j.job_date,
                    j.reference_date,
                    j.status,
                    j.buffer_pct,
                    j.planned_total_qty,
                    j.completed_total_qty,
                    COUNT(jl.seq) AS line_count
                FROM tbl_ims_production_job AS j
                LEFT JOIN tbl_ims_production_job_line AS jl
                    ON j.job_code = jl.job_code
                   AND jl.deletestatus = 'Active'
                WHERE j.deletestatus = 'Active'
                  AND j.busunitcode = :busunitcode
                  AND j.job_code = :job_code
                GROUP BY
                    j.job_code,
                    j.job_date,
                    j.reference_date,
                    j.status,
                    j.buffer_pct,
                    j.planned_total_qty,
                    j.completed_total_qty
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        $lineMap = $this->getRecentJobLineMap([$jobCode]);
        $row["job_lines"] = $lineMap[$jobCode] ?? [];
        return $row;
    }

    private function getRecentJobLineMap(array $jobCodes): array
    {
        if (empty($jobCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($jobCodes as $index => $jobCode) {
            $placeholders[] = ":job_" . $index;
        }

        $sql = "SELECT
                    jl.job_code,
                    jl.seq,
                    jl.prd_queue_code,
                    jl.inv_code,
                    jl.planned_qty,
                    jl.buffer_qty,
                    jl.suggested_qty,
                    jl.completed_qty,
                    jl.expiry_date,
                    jl.status,
                    COALESCE(bp.`desc`, rm.`desc`, jl.inv_code) AS product_name,
                    COALESCE(bp.`category`, rm.`category`, 'Uncategorized') AS category,
                    COALESCE(qi.orderedby, qs.orderedby, '') AS orderedby,
                    COALESCE(bu.name, qi.orderedby, qs.orderedby, '') AS orderedby_name
                FROM tbl_ims_production_job_line AS jl
                LEFT JOIN lkp_build_of_products AS bp
                    ON jl.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats AS rm
                    ON jl.inv_code = rm.mat_code
                LEFT JOIN (
                    SELECT
                        prd_queue_code,
                        MIN(orderedby) AS orderedby
                    FROM tbl_products_queue
                    WHERE deletestatus = 'Active'
                    GROUP BY prd_queue_code
                ) AS qi
                    ON jl.prd_queue_code = qi.prd_queue_code
                LEFT JOIN tbl_products_queue_summary AS qs
                    ON jl.prd_queue_code = qs.prd_queue_code
                   AND qs.deletestatus = 'Active'
                LEFT JOIN lkp_busunits AS bu
                    ON COALESCE(qi.orderedby, qs.orderedby, '') = bu.busunitcode
                WHERE jl.deletestatus = 'Active'
                  AND jl.job_code IN (" . implode(", ", $placeholders) . ")
                ORDER BY jl.createdtime ASC, jl.seq ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($jobCodes as $index => $jobCode) {
            $stmt->bindValue(":job_" . $index, $jobCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $lineRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $invCodes = array_values(array_unique(array_filter(array_map(
            static fn($row) => trim((string) ($row["inv_code"] ?? "")),
            $lineRows
        ))));
        $bomMap = $this->getBomMap($invCodes);

        $map = [];
        foreach ($lineRows as $row) {
            $jobCode = (string) ($row["job_code"] ?? "");
            if ($jobCode === "") {
                continue;
            }

            $invCode = trim((string) ($row["inv_code"] ?? ""));
            $bomComponents = array_values(array_map(static function ($component) {
                return [
                    "component_code" => (string) ($component["component_code"] ?? ""),
                    "component_name" => (string) ($component["component_name"] ?? ""),
                    "component_class" => (string) ($component["component_class"] ?? ""),
                    "component_qty" => (float) ($component["component_qty"] ?? 0),
                    "uomval" => (float) ($component["uomval"] ?? 1),
                    "uom" => (string) ($component["uom"] ?? "UNIT"),
                ];
            }, $bomMap[$invCode] ?? []));

            $row["bom_components"] = $bomComponents;
            $row["has_bom"] = !empty($bomComponents);
            $row["bom_component_count"] = count($bomComponents);

            if (!isset($map[$jobCode])) {
                $map[$jobCode] = [];
            }

            $map[$jobCode][] = $row;
        }

        return $map;
    }

    private function getQueueSummaryRows(string $busunitcode, array $queueCodes): array
    {
        if (empty($queueCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT
                    prd_queue_code,
                    payee,
                    po_status,
                    production_status,
                    production_started,
                    production_completed
                FROM tbl_products_queue_summary
                WHERE deletestatus = 'Active'
                  AND payee = :busunitcode
                  AND prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getQueueItemRows(array $queueCodes): array
    {
        if (empty($queueCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT
                    pq.prd_queue_code,
                    pq.inv_code,
                    pq.quantity,
                    pq.cost_per_uom,
                    pq.uomval,
                    pq.uom,
                    COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                FROM tbl_products_queue AS pq
                LEFT JOIN lkp_build_of_products AS bp
                    ON pq.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats AS rm
                    ON pq.inv_code = rm.mat_code
                WHERE pq.deletestatus = 'Active'
                  AND pq.prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getProducedOutputMap(array $queueCodes): array
    {
        if (empty($queueCodes) ||
            !$this->tableExists("tbl_ims_production_output")) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT
                    prd_queue_code,
                    inv_code,
                    SUM(produced_qty) AS produced_qty
                FROM tbl_ims_production_output
                WHERE deletestatus = 'Active'
                  AND prd_queue_code IN (" . implode(", ", $placeholders) . ")
                GROUP BY prd_queue_code, inv_code";

        $stmt = $this->conn->prepare($sql);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $map[$this->buildQueueInvKey(
                (string) ($row["prd_queue_code"] ?? ""),
                (string) ($row["inv_code"] ?? "")
            )] = (float) ($row["produced_qty"] ?? 0);
        }

        return $map;
    }

    private function getProducedOutputQtyByJobLineSeq(int $jobLineSeq): float
    {
        if ($jobLineSeq <= 0 || !$this->tableExists("tbl_ims_production_output")) {
            return 0.0;
        }

        $sql = "SELECT COALESCE(SUM(produced_qty), 0)
                FROM tbl_ims_production_output
                WHERE job_line_seq = :job_line_seq
                  AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_line_seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->execute();

        return (float) ($stmt->fetchColumn() ?: 0);
    }

    private function getQueueLineCompletionState(array $queueCodes): array
    {
        $filtered = array_values(array_unique(array_filter(array_map(
            static fn($value) => trim((string) $value),
            $queueCodes
        ), static fn($value) => $value !== "")));

        if (empty($filtered) || !$this->tableExists("tbl_ims_production_job_line")) {
            return [];
        }

        $placeholders = [];
        foreach ($filtered as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT prd_queue_code, status
                FROM tbl_ims_production_job_line
                WHERE deletestatus = 'Active'
                  AND prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        foreach ($filtered as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        foreach ($filtered as $queueCode) {
            $map[$queueCode] = [
                "has_lines" => false,
                "all_done" => false,
                "all_skipped" => false,
            ];
        }

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $queueCode = trim((string) ($row["prd_queue_code"] ?? ""));
            if ($queueCode === "" || !isset($map[$queueCode])) {
                continue;
            }

            if (!$map[$queueCode]["has_lines"]) {
                $map[$queueCode]["has_lines"] = true;
                $map[$queueCode]["all_done"] = true;
                $map[$queueCode]["all_skipped"] = true;
            }

            $status = strtolower(trim((string) ($row["status"] ?? "")));
            if (!in_array($status, ["completed", "skipped"], true)) {
                $map[$queueCode]["all_done"] = false;
            }
            if ($status !== "skipped") {
                $map[$queueCode]["all_skipped"] = false;
            }
        }

        return $map;
    }

    private function getLatestJobLineMap(array $queueCodes): array
    {
        if (empty($queueCodes) ||
            !$this->tableExists("tbl_ims_production_job") ||
            !$this->tableExists("tbl_ims_production_job_line")) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT
                    jl.seq,
                    jl.job_code,
                    jl.prd_queue_code,
                    jl.inv_code,
                    jl.planned_qty,
                    jl.suggested_qty,
                    jl.completed_qty
                FROM tbl_ims_production_job_line AS jl
                INNER JOIN tbl_ims_production_job AS j
                    ON jl.job_code = j.job_code
                WHERE jl.deletestatus = 'Active'
                  AND j.deletestatus = 'Active'
                  AND jl.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                ORDER BY jl.seq DESC";

        $stmt = $this->conn->prepare($sql);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = $this->buildQueueInvKey(
                (string) ($row["prd_queue_code"] ?? ""),
                (string) ($row["inv_code"] ?? "")
            );

            if (isset($map[$key])) {
                continue;
            }

            $map[$key] = [
                "seq" => (int) ($row["seq"] ?? 0),
                "job_code" => (string) ($row["job_code"] ?? ""),
                "planned_qty" => (float) ($row["planned_qty"] ?? 0),
                "suggested_qty" => (float) ($row["suggested_qty"] ?? 0),
                "completed_qty" => (float) ($row["completed_qty"] ?? 0),
            ];
        }

        return $map;
    }

    private function markQueueSummariesInProgress(array $queueCodes, string $user_id, bool $clearCompletedDate = false): void
    {
        if (empty($queueCodes)) {
            return;
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "UPDATE tbl_products_queue_summary
                SET
                    production_status = 'In Progress',
                    production_started = CASE
                        WHEN production_started IS NULL OR production_started = ''
                            THEN DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                        ELSE production_started
                    END,
                    production_completed = " . ($clearCompletedDate ? "NULL" : "production_completed") . ",
                    usertracker = :usertracker
                WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $this->holdQueueSummariesForDeliveryPlanning($queueCodes, $user_id);
    }

    private function markQueueSummariesCompleted(array $queueCodes, string $user_id): void
    {
        if (empty($queueCodes)) {
            return;
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "UPDATE tbl_products_queue_summary
                SET
                    production_status = 'Completed',
                    production_started = CASE
                        WHEN production_started IS NULL OR production_started = ''
                            THEN DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                        ELSE production_started
                    END,
                    production_completed = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    usertracker = :usertracker
                WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $this->holdQueueSummariesForDeliveryPlanning($queueCodes, $user_id);
    }

    private function insertInventoryTransaction(
        string $transDate,
        string $invCode,
        float $qty,
        float $costPerUom,
        float $uomVal,
        string $uom,
        string $prQueueCode,
        string $busunitcode,
        string $invClass,
        string $expiryDate,
        string $user_id,
        ?string $priceCategory = null
    ): void {
        $columns = [
            "trans_date",
            "inv_code",
            "qty",
            "cost_per_uom",
            "uom_val",
            "uom",
            "pr_queue_code",
            "busunitcode",
            "inv_class",
            "expirydate",
        ];
        $valueTokens = [
            ":trans_date",
            ":inv_code",
            ":qty",
            ":cost_per_uom",
            ":uom_val",
            ":uom",
            ":pr_queue_code",
            ":busunitcode",
            ":inv_class",
            ":expirydate",
        ];

        $params = [
            ":trans_date" => $transDate,
            ":inv_code" => $invCode,
            ":qty" => round($qty, 4),
            ":cost_per_uom" => round($costPerUom, 4),
            ":uom_val" => round($uomVal, 4),
            ":uom" => $uom,
            ":pr_queue_code" => $prQueueCode,
            ":busunitcode" => $busunitcode,
            ":inv_class" => $invClass,
            ":expirydate" => $expiryDate,
            ":usertracker" => $user_id,
        ];

        if ($this->tableHasColumn("tbl_inventory_transactions", "price")) {
            $columns[] = "price";
            $valueTokens[] = ":price";
            $params[":price"] = round($costPerUom, 4);
        }

        if ($this->tableHasColumn("tbl_inventory_transactions", "amount")) {
            $columns[] = "amount";
            $valueTokens[] = ":amount";
            $params[":amount"] = round($qty * $costPerUom, 4);
        }

        if ($this->tableHasColumn("tbl_inventory_transactions", "price_category")) {
            $columns[] = "price_category";
            $valueTokens[] = ":price_category";
            $params[":price_category"] = $priceCategory === null || trim($priceCategory) === ""
                ? null
                : trim($priceCategory);
        }

        $columns[] = "deletestatus";
        $valueTokens[] = "'Active'";
        $columns[] = "usertracker";
        $valueTokens[] = ":usertracker";
        $columns[] = "createddate";
        $valueTokens[] = "DATE_ADD(NOW(), INTERVAL 8 HOUR)";

        $sql = "INSERT INTO tbl_inventory_transactions
                (" . implode(", ", $columns) . ")
                VALUES
                (" . implode(", ", $valueTokens) . ")";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $name => $value) {
            if ($value === null) {
                $stmt->bindValue($name, null, PDO::PARAM_NULL);
                continue;
            }
            if (is_int($value)) {
                $stmt->bindValue($name, $value, PDO::PARAM_INT);
                continue;
            }
            if (is_float($value)) {
                $stmt->bindValue($name, $value);
                continue;
            }
            $stmt->bindValue($name, (string) $value, PDO::PARAM_STR);
        }
        $stmt->execute();
    }

    private function markQueueSummariesSkipped(array $queueCodes, string $user_id): void
    {
        if (empty($queueCodes)) {
            return;
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "UPDATE tbl_products_queue_summary
                SET
                    production_status = 'Skipped',
                    production_started = CASE
                        WHEN production_started IS NULL OR production_started = ''
                            THEN DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                        ELSE production_started
                    END,
                    production_completed = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    usertracker = :usertracker
                WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $this->holdQueueSummariesForDeliveryPlanning($queueCodes, $user_id);
    }

    private function holdQueueSummariesForDeliveryPlanning(array $queueCodes, string $user_id): void
    {
        $codes = array_values(array_filter(
            array_map(static fn($value) => trim((string) $value), $queueCodes),
            static fn($value) => $value !== ""
        ));
        $codes = array_values(array_unique($codes));
        if (empty($codes)) {
            return;
        }

        $placeholders = [];
        foreach ($codes as $index => $_queueCode) {
            $placeholders[] = ":delivery_queue_" . $index;
        }

        $activeDeliveryJobGuard = "";
        if (
            $this->tableExists("tbl_ims_delivery_job") &&
            $this->tableExists("tbl_ims_delivery_job_line")
        ) {
            $activeDeliveryJobGuard = "AND NOT EXISTS (
                    SELECT 1
                    FROM tbl_ims_delivery_job_line AS djl
                    INNER JOIN tbl_ims_delivery_job AS dj
                        ON dj.job_code = djl.job_code
                        AND dj.deletestatus = 'Active'
                    WHERE djl.prd_queue_code = pqs.prd_queue_code
                      AND djl.deletestatus = 'Active'
                      AND LOWER(TRIM(COALESCE(dj.status, ''))) <> 'cancelled'
                      AND (
                          LOWER(TRIM(COALESCE(djl.status, ''))) IN (
                              'for dispatching',
                              'for shipping',
                              'for receiving',
                              'shipped',
                              'partial delivery',
                              'delivered'
                          )
                          OR LOWER(TRIM(COALESCE(dj.status, ''))) IN (
                              'for dispatching',
                              'for shipping',
                              'for receiving',
                              'shipped',
                              'partial delivery',
                              'delivered'
                          )
                      )
                )";
        }

        $sql = "UPDATE tbl_products_queue_summary AS pqs
                SET
                    delivery_status = 'Pending',
                    shipping_date = NULL,
                    date_delivered = NULL,
                    usertracker = :delivery_usertracker
                WHERE pqs.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                  AND LOWER(TRIM(COALESCE(pqs.delivery_status, ''))) IN (
                      '',
                      'pending',
                      'for dispatching',
                      'for shipping',
                      'for receiving',
                      'shipped'
                  )
                  {$activeDeliveryJobGuard}";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":delivery_usertracker", $user_id, PDO::PARAM_STR);
        foreach ($codes as $index => $queueCode) {
            $stmt->bindValue(":delivery_queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();
    }

    private function tableHasColumn(string $tableName, string $columnName): bool
    {
        $key = $tableName . "." . $columnName;
        if (array_key_exists($key, $this->tableColumnCache)) {
            return (bool) $this->tableColumnCache[$key];
        }

        $sql = "SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = :table_name
                  AND column_name = :column_name";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":table_name", $tableName, PDO::PARAM_STR);
        $stmt->bindValue(":column_name", $columnName, PDO::PARAM_STR);
        $stmt->execute();

        $exists = (int) $stmt->fetchColumn() > 0;
        $this->tableColumnCache[$key] = $exists;

        return $exists;
    }

    private function insertJobHeader(
        string $jobCode,
        string $busunitcode,
        string $referenceDate,
        float $bufferPct,
        float $plannedTotalQty,
        string $notes,
        string $user_id
    ): void {
        $sql = "INSERT INTO tbl_ims_production_job
                (
                    job_code,
                    busunitcode,
                    job_date,
                    reference_date,
                    status,
                    notes,
                    buffer_pct,
                    planned_total_qty,
                    completed_total_qty,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :job_code,
                    :busunitcode,
                    :job_date,
                    :reference_date,
                    'Released',
                    :notes,
                    :buffer_pct,
                    :planned_total_qty,
                    0,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->bindValue(":job_date", $referenceDate, PDO::PARAM_STR);
        $stmt->bindValue(":reference_date", $referenceDate, PDO::PARAM_STR);
        $stmt->bindValue(":notes", $notes, PDO::PARAM_STR);
        $stmt->bindValue(":buffer_pct", $bufferPct);
        $stmt->bindValue(":planned_total_qty", round($plannedTotalQty, 4));
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function insertJobLine(string $jobCode, array $lineRow, string $user_id): int
    {
        $sql = "INSERT INTO tbl_ims_production_job_line
                (
                    job_code,
                    line_type,
                    prd_queue_code,
                    inv_code,
                    planned_qty,
                    buffer_qty,
                    suggested_qty,
                    completed_qty,
                    expiry_date,
                    status,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :job_code,
                    'Demand',
                    :prd_queue_code,
                    :inv_code,
                    :planned_qty,
                    :buffer_qty,
                    :suggested_qty,
                    0,
                    NULL,
                    'Released',
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":prd_queue_code", (string) ($lineRow["prd_queue_code"] ?? ""), PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", (string) ($lineRow["inv_code"] ?? ""), PDO::PARAM_STR);
        $stmt->bindValue(":planned_qty", round((float) ($lineRow["quantity"] ?? 0), 4));
        $stmt->bindValue(":buffer_qty", round((float) ($lineRow["buffer_qty"] ?? 0), 4));
        $stmt->bindValue(
            ":suggested_qty",
            round(
                (float) (
                    $lineRow["suggested_qty"] ??
                    ($lineRow["quantity"] ?? 0)
                ),
                4,
            ),
        );
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $this->conn->lastInsertId();
    }

    private function insertProductionOutput(
        string $jobCode,
        int $jobLineSeq,
        string $prQueueCode,
        string $invCode,
        float $producedQty,
        string $transDate,
        ?string $expiryDate,
        string $remarks,
        string $user_id
    ): void
    {
        $sql = "INSERT INTO tbl_ims_production_output
                (
                    job_code,
                    job_line_seq,
                    prd_queue_code,
                    inv_code,
                    produced_qty,
                    trans_date,
                    expiry_date,
                    remarks,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :job_code,
                    :job_line_seq,
                    :prd_queue_code,
                    :inv_code,
                    :produced_qty,
                    :trans_date,
                    :expiry_date,
                    :remarks,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":job_line_seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->bindValue(":prd_queue_code", $prQueueCode, PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->bindValue(":produced_qty", round($producedQty, 4));
        $stmt->bindValue(":trans_date", $transDate, PDO::PARAM_STR);
        $stmt->bindValue(":expiry_date", $expiryDate, $expiryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(":remarks", $remarks, PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function insertComponentReservation(
        string $jobCode,
        int $jobLineSeq,
        string $prQueueCode,
        string $buildInvCode,
        string $componentCode,
        float $reservedQty,
        float $issuedQty,
        string $reservationStatus,
        string $sourceBusunitcode,
        ?string $expiryDate,
        string $user_id
    ): void
    {
        $sql = "INSERT INTO tbl_ims_production_component_reservation
                (
                    job_code,
                    job_line_seq,
                    prd_queue_code,
                    build_inv_code,
                    component_code,
                    reserved_qty,
                    issued_qty,
                    reservation_status,
                    source_busunitcode,
                    expiry_date,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :job_code,
                    :job_line_seq,
                    :prd_queue_code,
                    :build_inv_code,
                    :component_code,
                    :reserved_qty,
                    :issued_qty,
                    :reservation_status,
                    :source_busunitcode,
                    :expiry_date,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":job_line_seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->bindValue(":prd_queue_code", $prQueueCode, PDO::PARAM_STR);
        $stmt->bindValue(":build_inv_code", $buildInvCode, PDO::PARAM_STR);
        $stmt->bindValue(":component_code", $componentCode, PDO::PARAM_STR);
        $stmt->bindValue(":reserved_qty", round($reservedQty, 4));
        $stmt->bindValue(":issued_qty", round($issuedQty, 4));
        $stmt->bindValue(":reservation_status", $reservationStatus, PDO::PARAM_STR);
        $stmt->bindValue(":source_busunitcode", $sourceBusunitcode, PDO::PARAM_STR);
        $stmt->bindValue(":expiry_date", $expiryDate, $expiryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function issueOrCreateComponentReservation(
        string $jobCode,
        int $jobLineSeq,
        string $prQueueCode,
        string $buildInvCode,
        string $componentCode,
        float $issuedQty,
        string $sourceBusunitcode,
        string $user_id
    ): void
    {
        if ($issuedQty <= 0) {
            return;
        }

        $sql = "UPDATE tbl_ims_production_component_reservation
                SET
                    issued_qty = issued_qty + :issued_qty,
                    reservation_status = CASE
                        WHEN issued_qty + :issued_qty_compare >= reserved_qty THEN 'Issued'
                        WHEN issued_qty + :issued_qty_progress > 0 THEN 'Partially Issued'
                        ELSE reservation_status
                    END,
                    usertracker = :usertracker
                WHERE job_code = :job_code
                  AND job_line_seq = :job_line_seq
                  AND prd_queue_code = :prd_queue_code
                  AND build_inv_code = :build_inv_code
                  AND component_code = :component_code
                  AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":issued_qty", round($issuedQty, 4));
        $stmt->bindValue(":issued_qty_compare", round($issuedQty, 4));
        $stmt->bindValue(":issued_qty_progress", round($issuedQty, 4));
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":job_line_seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->bindValue(":prd_queue_code", $prQueueCode, PDO::PARAM_STR);
        $stmt->bindValue(":build_inv_code", $buildInvCode, PDO::PARAM_STR);
        $stmt->bindValue(":component_code", $componentCode, PDO::PARAM_STR);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            return;
        }

        $this->insertComponentReservation(
            $jobCode,
            $jobLineSeq,
            $prQueueCode,
            $buildInvCode,
            $componentCode,
            $issuedQty,
            $issuedQty,
            "Issued",
            $sourceBusunitcode,
            null,
            $user_id
        );
    }

    private function incrementJobLineCompletion(
        int $jobLineSeq,
        float $completedQty,
        float $targetQty,
        ?string $expiryDate,
        string $user_id
    ): void
    {
        $sql = "UPDATE tbl_ims_production_job_line
                SET
                    completed_qty = LEAST(:target_qty, completed_qty + :completed_qty),
                    expiry_date = COALESCE(:expiry_date, expiry_date),
                    status = CASE
                        WHEN completed_qty + :completed_qty_compare >= :target_qty_compare THEN 'Completed'
                        WHEN completed_qty + :completed_qty_progress > 0 THEN 'In Progress'
                        ELSE status
                    END,
                    usertracker = :usertracker
                WHERE seq = :seq
                  AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":target_qty", round($targetQty, 4));
        $stmt->bindValue(":completed_qty", round($completedQty, 4));
        $stmt->bindValue(":target_qty_compare", round($targetQty, 4));
        $stmt->bindValue(":completed_qty_compare", round($completedQty, 4));
        $stmt->bindValue(":completed_qty_progress", round($completedQty, 4));
        $stmt->bindValue(":expiry_date", $expiryDate, $expiryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->execute();
    }

    private function markJobLineSkipped(
        int $jobLineSeq,
        ?string $expiryDate,
        string $user_id
    ): void
    {
        $sql = "UPDATE tbl_ims_production_job_line
                SET
                    completed_qty = CASE
                        WHEN COALESCE(NULLIF(suggested_qty, 0), planned_qty) > completed_qty
                            THEN COALESCE(NULLIF(suggested_qty, 0), planned_qty)
                        ELSE completed_qty
                    END,
                    expiry_date = COALESCE(:expiry_date, expiry_date),
                    status = 'Skipped',
                    usertracker = :usertracker
                WHERE seq = :seq
                  AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":expiry_date", $expiryDate, $expiryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":seq", $jobLineSeq, PDO::PARAM_INT);
        $stmt->execute();
    }

    private function syncRelatedJobHeaders(string $user_id): void
    {
        $sql = "UPDATE tbl_ims_production_job AS j
                SET
                    j.completed_total_qty = (
                        SELECT COALESCE(SUM(jl.completed_qty), 0)
                        FROM tbl_ims_production_job_line AS jl
                        WHERE jl.job_code = j.job_code
                          AND jl.deletestatus = 'Active'
                    ),
                    j.status = CASE
                        WHEN NOT EXISTS (
                            SELECT 1
                            FROM tbl_ims_production_job_line AS pending_line
                            WHERE pending_line.job_code = j.job_code
                              AND pending_line.deletestatus = 'Active'
                              AND pending_line.status NOT IN ('Completed', 'Skipped')
                        ) THEN 'Completed'
                        WHEN EXISTS (
                            SELECT 1
                            FROM tbl_ims_production_job_line AS started_line
                            WHERE started_line.job_code = j.job_code
                              AND started_line.deletestatus = 'Active'
                              AND started_line.completed_qty > 0
                        ) THEN 'In Progress'
                        ELSE 'Released'
                    END,
                    j.usertracker = :usertracker
                WHERE j.deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function buildRequestedProductionRows(
        array $lineRows,
        array $existingProducedMap,
        array $requestedOutputsMap,
        array $latestJobLineMap
    ): array
    {
        $rows = [];

        foreach ($lineRows as $row) {
            $queueCode = (string) ($row["prd_queue_code"] ?? "");
            $invCode = (string) ($row["inv_code"] ?? "");
            $key = $this->buildQueueInvKey($queueCode, $invCode);
            $totalQty = round((float) ($row["quantity"] ?? 0), 4);
            $alreadyProducedQty = round((float) ($existingProducedMap[$key] ?? 0), 4);
            $targetQty = round(
                max(
                    $totalQty,
                    (float) ($latestJobLineMap[$key]["suggested_qty"] ?? $totalQty),
                ),
                4,
            );
            $remainingQty = round(max(0, $targetQty - $alreadyProducedQty), 4);
            $requestedOutput = !empty($requestedOutputsMap)
                ? ($requestedOutputsMap[$key] ?? null)
                : $remainingQty;
            $requestedQty = is_array($requestedOutput)
                ? round((float) ($requestedOutput["quantity"] ?? 0), 4)
                : round((float) $requestedOutput, 4);

            if ($requestedQty <= 0) {
                continue;
            }

            if ($requestedQty - $remainingQty > 0.0001) {
                http_response_code(422);
                throw new RuntimeException("requestedProductionExceedsRemainingQty");
            }

            $row["produce_qty"] = $requestedQty;
            $row["requested_expiry_date"] = is_array($requestedOutput)
                ? $this->normalizeDateString($requestedOutput["expiry_date"] ?? null)
                : null;
            $row["remaining_qty"] = $remainingQty;
            $row["target_qty"] = $targetQty;
            $rows[] = $row;
        }

        return $rows;
    }

    private function buildQueueProgressMap(
        array $lineRows,
        array $existingProducedMap,
        array $requestedRows
    ): array
    {
        $map = [];

        foreach ($lineRows as $row) {
            $queueCode = (string) ($row["prd_queue_code"] ?? "");
            $invCode = (string) ($row["inv_code"] ?? "");
            $key = $this->buildQueueInvKey($queueCode, $invCode);

            if (!isset($map[$queueCode])) {
                $map[$queueCode] = [
                    "total_qty" => 0.0,
                    "produced_qty" => 0.0,
                    "remaining_qty" => 0.0,
                ];
            }

            $map[$queueCode]["total_qty"] += (float) ($row["quantity"] ?? 0);
            $map[$queueCode]["produced_qty"] += (float) ($existingProducedMap[$key] ?? 0);
        }

        foreach ($requestedRows as $row) {
            $queueCode = (string) ($row["prd_queue_code"] ?? "");
            if (!isset($map[$queueCode])) {
                continue;
            }

            $map[$queueCode]["produced_qty"] += (float) ($row["produce_qty"] ?? 0);
        }

        foreach ($map as $queueCode => $progress) {
            $map[$queueCode]["total_qty"] = round((float) $progress["total_qty"], 4);
            $map[$queueCode]["produced_qty"] = round((float) $progress["produced_qty"], 4);
            $map[$queueCode]["remaining_qty"] = round(
                max(0, (float) $progress["total_qty"] - (float) $progress["produced_qty"]),
                4
            );
        }

        return $map;
    }

    private function normalizeProductionOutputs($value): array
    {
        $rows = is_array($value) ? $value : [];
        $map = [];

        foreach ($rows as $row) {
            $queueCode = trim((string) ($row["prd_queue_code"] ?? ""));
            $invCode = trim((string) ($row["inv_code"] ?? ""));
            $quantity = $row["quantity"] ?? null;
            $expiryDate = $this->normalizeDateString($row["expiry_date"] ?? null);

            if ($queueCode === "" || $invCode === "" || !is_numeric($quantity)) {
                continue;
            }

            $map[$this->buildQueueInvKey($queueCode, $invCode)] = [
                "quantity" => round(max(0, (float) $quantity), 4),
                "expiry_date" => $expiryDate,
            ];
        }

        return $map;
    }

    private function buildQueueInvKey(string $queueCode, string $invCode): string
    {
        return $queueCode . "::" . $invCode;
    }

    private function computeExpiryDate(string $baseDate, int $expiryDays): string
    {
        if ($expiryDays <= 0) {
            return "0000-00-00";
        }

        $date = new DateTimeImmutable($baseDate);
        return $date->modify("+" . $expiryDays . " days")->format("Y-m-d");
    }

    private function normalizeDateString($value): ?string
    {
        $value = trim((string) $value);
        if ($value === "" || $value === "0000-00-00") {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat("Y-m-d", $value);
        if ($date === false) {
            return null;
        }

        return $date->format("Y-m-d");
    }

    private function generateJobCode(): string
    {
        $datePart = date("Ymd");
        $nextSeries = $this->getNextJobSeriesForDate($datePart);

        while (true) {
            $candidate = "JOB-" . $datePart . "-" . str_pad((string) $nextSeries, 2, "0", STR_PAD_LEFT);
            if (!$this->jobCodeExists($candidate)) {
                return $candidate;
            }
            $nextSeries++;
        }
    }

    private function getNextJobSeriesForDate(string $datePart): int
    {
        $sql = "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(job_code, '-', -1) AS UNSIGNED)), 0) AS last_series
                FROM tbl_ims_production_job
                WHERE job_code LIKE :job_prefix
                  AND job_code REGEXP :job_pattern
                FOR UPDATE";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_prefix", "JOB-" . $datePart . "-%", PDO::PARAM_STR);
        $stmt->bindValue(":job_pattern", "^JOB-" . $datePart . "-[0-9]+$", PDO::PARAM_STR);
        $stmt->execute();

        $lastSeries = (int) ($stmt->fetchColumn() ?: 0);
        return max(1, $lastSeries + 1);
    }

    private function jobCodeExists(string $jobCode): bool
    {
        $sql = "SELECT COUNT(*)
                FROM tbl_ims_production_job
                WHERE job_code = :job_code";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function tableExists(string $tableName): bool
    {
        $sql = "SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = :table_name";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":table_name", $tableName, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function normalizeQueueCodes($value): array
    {
        $rows = is_array($value) ? $value : [];
        $next = [];

        foreach ($rows as $item) {
            $queueCode = trim((string) $item);
            if ($queueCode === "" || isset($next[$queueCode])) {
                continue;
            }
            $next[$queueCode] = true;
        }

        return array_keys($next);
    }

    private function normalizePercent($value): float
    {
        if (is_string($value)) {
            $value = trim($value);
        }

        if (!is_numeric($value)) {
            return 10.0;
        }

        return round(max(0, min(100, (float) $value)), 2);
    }

    private function normalizeDate($value): string
    {
        $raw = trim((string) $value);
        if ($raw === "") {
            return date("Y-m-d");
        }

        $date = DateTimeImmutable::createFromFormat("Y-m-d", $raw);
        return $date ? $date->format("Y-m-d") : date("Y-m-d");
    }
}
