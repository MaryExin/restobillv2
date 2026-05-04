<?php

class InventoryOperationsDashboardGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getSummaryData(array $filters): array
    {
        $built = $this->buildSummaryFilters($filters);
        $limit = $this->normalizeLimit($filters["limit"] ?? 500);

        $sql = "SELECT
                    pqs.prd_queue_code,
                    pqs.subtotal,
                    pqs.orderedby,
                    pqs.payee,
                    pqs.pr_status,
                    pqs.pr_created_date,
                    pqs.pr_approved_date,
                    pqs.pr_approved_by,
                    pqs.po_status,
                    pqs.po_created_date,
                    pqs.po_approved_date,
                    pqs.po_approved_by,
                    pqs.production_status,
                    pqs.production_started,
                    pqs.production_completed,
                    pqs.billing_status,
                    pqs.billing_date,
                    pqs.payment_code,
                    pqs.delivery_status,
                    pqs.del_code,
                    pqs.shipping_date,
                    pqs.date_delivered,
                    pqs.notes,
                    pqs.truck_details,
                    pqs.createdtime,
                    ordered_by.name AS orderedbyname,
                    ordered_by.class AS orderedbyclass,
                    ordered_by.ownership_status AS orderedbyownership,
                    payee_bu.name AS payeebu_name,
                    payee_bu.class AS payeeclass,
                    payee_bu.ownership_status AS payeeownership,
                    supplier.supplier_name,
                    COUNT(pq.seq) AS line_count,
                    COALESCE(SUM(pq.quantity), 0) AS total_quantity,
                    COALESCE(SUM(CASE WHEN pq.inv_code LIKE 'BD%' THEN 1 ELSE 0 END), 0) AS build_lines,
                    COALESCE(SUM(CASE WHEN pq.inv_code NOT LIKE 'BD%' THEN 1 ELSE 0 END), 0) AS raw_lines
                FROM tbl_products_queue_summary pqs
                LEFT JOIN tbl_products_queue pq
                    ON pqs.prd_queue_code = pq.prd_queue_code
                    AND pq.deletestatus = 'Active'
                LEFT JOIN lkp_busunits ordered_by
                    ON pqs.orderedby = ordered_by.busunitcode
                LEFT JOIN lkp_busunits payee_bu
                    ON pqs.payee = payee_bu.busunitcode
                LEFT JOIN lkp_supplier supplier
                    ON pqs.payee = supplier.supplier_code
                WHERE " . implode(" AND ", $built["where"]) . "
                GROUP BY
                    pqs.seq,
                    pqs.prd_queue_code,
                    pqs.subtotal,
                    pqs.orderedby,
                    pqs.payee,
                    pqs.pr_status,
                    pqs.pr_created_date,
                    pqs.pr_approved_date,
                    pqs.pr_approved_by,
                    pqs.po_status,
                    pqs.po_created_date,
                    pqs.po_approved_date,
                    pqs.po_approved_by,
                    pqs.production_status,
                    pqs.production_started,
                    pqs.production_completed,
                    pqs.billing_status,
                    pqs.billing_date,
                    pqs.payment_code,
                    pqs.delivery_status,
                    pqs.del_code,
                    pqs.shipping_date,
                    pqs.date_delivered,
                    pqs.notes,
                    pqs.truck_details,
                    pqs.createdtime,
                    ordered_by.name,
                    ordered_by.class,
                    ordered_by.ownership_status,
                    payee_bu.name,
                    payee_bu.class,
                    payee_bu.ownership_status,
                    supplier.supplier_name
                ORDER BY pqs.createdtime DESC, pqs.prd_queue_code DESC
                LIMIT " . $limit;

        $stmt = $this->conn->prepare($sql);
        foreach ($built["params"] as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map([$this, "decorateSummaryRow"], $items);

        return [
            "items" => $items,
            "metrics" => $this->buildMetrics($items),
            "filters_applied" => [
                "search" => (string) ($filters["search"] ?? ""),
                "flow_type" => (string) ($filters["flow_type"] ?? ""),
                "status_bucket" => (string) ($filters["status_bucket"] ?? ""),
                "orderedby" => (string) ($filters["orderedby"] ?? ""),
                "payee" => (string) ($filters["payee"] ?? ""),
            ],
        ];
    }

    public function getDetailRows(array $filters): array
    {
        if (empty($filters["prd_queue_code"])) {
            http_response_code(422);
            return ["message" => "prd_queue_codeRequired"];
        }

        $sql = "SELECT
                    pq.seq,
                    pq.prd_queue_code,
                    pq.inv_code,
                    pq.cost_per_uom,
                    pq.uomval,
                    pq.uom,
                    pq.quantity,
                    pq.total,
                    pq.transdate,
                    pq.orderedby,
                    pq.payee,
                    COALESCE(bp.`desc`, rm.`desc`, pq.inv_code) AS item_name,
                    COALESCE(bp.category, rm.category, 'Uncategorized') AS category,
                    COALESCE(bp.productcode, rm.productcode, pq.inv_code) AS productcode,
                    COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                FROM tbl_products_queue pq
                LEFT JOIN lkp_build_of_products bp
                    ON pq.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats rm
                    ON pq.inv_code = rm.mat_code
                WHERE pq.deletestatus = 'Active'
                  AND pq.prd_queue_code = :prd_queue_code
                ORDER BY pq.seq ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":prd_queue_code", (string) $filters["prd_queue_code"], PDO::PARAM_STR);
        $stmt->execute();

        return [
            "items" => $stmt->fetchAll(PDO::FETCH_ASSOC),
        ];
    }

    private function buildSummaryFilters(array $filters): array
    {
        $where = ["pqs.deletestatus = 'Active'"];
        $params = [];

        $busunits = $this->normalizeBusunits($filters["busunits"] ?? []);
        if (!empty($busunits)) {
            $roleParts = [];
            foreach ($busunits as $index => $busunit) {
                $orderedKey = ":busunit_ordered_" . $index;
                $payeeKey = ":busunit_payee_" . $index;
                $roleParts[] = "(pqs.orderedby = {$orderedKey} OR pqs.payee = {$payeeKey})";
                $params[$orderedKey] = $busunit;
                $params[$payeeKey] = $busunit;
            }
            $where[] = "(" . implode(" OR ", $roleParts) . ")";
        }

        if (!empty($filters["search"])) {
            $where[] = "(
                pqs.prd_queue_code LIKE :search
                OR ordered_by.name LIKE :search
                OR payee_bu.name LIKE :search
                OR supplier.supplier_name LIKE :search
            )";
            $params[":search"] = "%" . trim((string) $filters["search"]) . "%";
        }

        if (!empty($filters["orderedby"])) {
            $where[] = "pqs.orderedby = :orderedby";
            $params[":orderedby"] = (string) $filters["orderedby"];
        }

        if (!empty($filters["payee"])) {
            $where[] = "pqs.payee = :payee";
            $params[":payee"] = (string) $filters["payee"];
        }

        if (!empty($filters["reference_id"])) {
            $where[] = "pqs.prd_queue_code = :reference_id";
            $params[":reference_id"] = (string) $filters["reference_id"];
        }

        if (!empty($filters["date_from"])) {
            $where[] = "DATE(pqs.createdtime) >= :date_from";
            $params[":date_from"] = (string) $filters["date_from"];
        }

        if (!empty($filters["date_to"])) {
            $where[] = "DATE(pqs.createdtime) <= :date_to";
            $params[":date_to"] = (string) $filters["date_to"];
        }

        if (!empty($filters["status_bucket"])) {
            $bucket = strtolower(trim((string) $filters["status_bucket"]));

            if ($bucket === "approval") {
                $where[] = "(pqs.pr_status = 'Pending' OR pqs.po_status = 'Pending')";
            } elseif ($bucket === "production") {
                $where[] = "(pqs.production_status = 'Pending' OR pqs.production_status = 'In Progress')";
            } elseif ($bucket === "delivery") {
                $where[] = "(pqs.delivery_status IN ('Pending','For Dispatching','For Shipping','For Receiving'))";
            } elseif ($bucket === "billing") {
                $where[] = "(pqs.billing_status IN ('Pending','Unpaid'))";
            } elseif ($bucket === "completed") {
                $where[] = "(pqs.delivery_status = 'Delivered' OR pqs.billing_status = 'Paid')";
            }
        }

        return ["where" => $where, "params" => $params];
    }

    private function decorateSummaryRow(array $row): array
    {
        $payeeName = trim((string) ($row["supplier_name"] ?? "")) !== ""
            ? (string) $row["supplier_name"]
            : (string) ($row["payeebu_name"] ?? "");

        $row["payeename"] = $payeeName;
        $row["flow_type"] = $this->resolveFlowType($row);
        $row["processing_lane"] = $this->resolveProcessingLane($row);
        $row["status_label"] = $this->resolveStatusLabel($row);
        $row["counterparty_type"] = str_starts_with((string) ($row["payee"] ?? ""), "SP")
            ? "Supplier"
            : "BusinessUnit";

        return $row;
    }

    private function buildMetrics(array $items): array
    {
        $metrics = [
            "total_transactions" => count($items),
            "supplier_orders" => 0,
            "store_to_commissary" => 0,
            "store_to_store" => 0,
            "approval_pending" => 0,
            "production_active" => 0,
            "delivery_active" => 0,
            "billing_pending" => 0,
            "flow_breakdown" => [],
        ];

        foreach ($items as $item) {
            if (($item["counterparty_type"] ?? "") === "Supplier") {
                $metrics["supplier_orders"]++;
            }
            if (($item["flow_type"] ?? "") === "Store to Commissary") {
                $metrics["store_to_commissary"]++;
            }
            if (($item["flow_type"] ?? "") === "Store to Store") {
                $metrics["store_to_store"]++;
            }
            if (($item["pr_status"] ?? "") === "Pending" || ($item["po_status"] ?? "") === "Pending") {
                $metrics["approval_pending"]++;
            }
            if (in_array((string) ($item["production_status"] ?? ""), ["Pending", "In Progress"], true)) {
                $metrics["production_active"]++;
            }
            if (in_array((string) ($item["delivery_status"] ?? ""), ["Pending", "For Dispatching", "For Shipping", "For Receiving"], true)) {
                $metrics["delivery_active"]++;
            }
            if (in_array((string) ($item["billing_status"] ?? ""), ["Pending", "Unpaid"], true)) {
                $metrics["billing_pending"]++;
            }

            $flowType = (string) ($item["flow_type"] ?? "Unknown");
            if (!array_key_exists($flowType, $metrics["flow_breakdown"])) {
                $metrics["flow_breakdown"][$flowType] = 0;
            }
            $metrics["flow_breakdown"][$flowType]++;
        }

        $flowBreakdown = [];
        foreach ($metrics["flow_breakdown"] as $flowType => $count) {
            $flowBreakdown[] = [
                "name" => $flowType,
                "value" => $count,
            ];
        }
        $metrics["flow_breakdown"] = $flowBreakdown;

        return $metrics;
    }

    private function resolveFlowType(array $row): string
    {
        $orderedClass = strtoupper(trim((string) ($row["orderedbyclass"] ?? "")));
        $payeeClass = strtoupper(trim((string) ($row["payeeclass"] ?? "")));
        $payeeCode = trim((string) ($row["payee"] ?? ""));

        if (str_starts_with($payeeCode, "SP")) {
            if ($orderedClass === "COMMI") {
                return "Commissary to Supplier";
            }
            return "Store to Supplier";
        }

        if ($orderedClass === "STORE" && $payeeClass === "COMMI") {
            return "Store to Commissary";
        }

        if ($orderedClass === "COMMI" && $payeeClass === "STORE") {
            return "Commissary to Store";
        }

        if ($orderedClass === "STORE" && $payeeClass === "STORE") {
            return "Store to Store";
        }

        if ($orderedClass === "COMMI" && $payeeClass === "COMMI") {
            return "Commissary to Commissary";
        }

        return "Internal Inventory";
    }

    private function resolveProcessingLane(array $row): string
    {
        $orderedClass = strtoupper(trim((string) ($row["orderedbyclass"] ?? "")));
        $payeeClass = strtoupper(trim((string) ($row["payeeclass"] ?? "")));

        if ($orderedClass === "COMMI" || $payeeClass === "COMMI") {
            return "Batch Lane";
        }

        return "Single Lane";
    }

    private function resolveStatusLabel(array $row): string
    {
        if (($row["pr_status"] ?? "") === "Pending") {
            return "Awaiting PR approval";
        }
        if (($row["po_status"] ?? "") === "Pending") {
            return "Awaiting PO approval";
        }
        if (($row["production_status"] ?? "") === "In Progress") {
            return "Production in progress";
        }
        if (($row["production_status"] ?? "") === "Pending") {
            return "Waiting for production";
        }
        if (in_array((string) ($row["delivery_status"] ?? ""), ["Pending", "For Dispatching", "For Shipping", "For Receiving"], true)) {
            return "Delivery active";
        }
        if (in_array((string) ($row["billing_status"] ?? ""), ["Pending", "Unpaid"], true)) {
            return "Billing pending";
        }
        if (($row["delivery_status"] ?? "") === "Delivered") {
            return "Delivered";
        }

        return "In process";
    }

    private function normalizeBusunits($busunits): array
    {
        if (!is_array($busunits)) {
            return [];
        }

        $values = [];
        foreach ($busunits as $item) {
            $roleName = is_array($item) ? ($item["rolename"] ?? "") : $item;
            $roleName = trim((string) $roleName);
            if ($roleName === "" || !str_starts_with($roleName, "BU-")) {
                continue;
            }
            $values[] = $roleName;
        }

        return array_values(array_unique($values));
    }

    private function normalizeLimit($limit): int
    {
        $normalized = (int) $limit;
        if ($normalized <= 0) {
            return 500;
        }

        return min($normalized, 2000);
    }
}
