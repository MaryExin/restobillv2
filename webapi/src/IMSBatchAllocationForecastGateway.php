<?php

class IMSBatchAllocationForecastGateway
{
    protected $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getBatchAllocationData(array $data): array
    {
        try {
            $busunitCodes = array_values(
                array_filter(
                    array_map(
                        static fn($value) => trim((string) $value),
                        is_array($data["busunitcodes"] ?? null) ? $data["busunitcodes"] : [],
                    ),
                    static fn($value) => $value !== "",
                ),
            );

            $dateFrom = trim((string) ($data["datefrom"] ?? ""));
            $dateTo = trim((string) ($data["dateto"] ?? ""));
            $contextBusunitCode = trim((string) ($data["context_busunitcode"] ?? ""));

            return [
                "message" => "Success",
                "forecast" => $this->getForecastRows($busunitCodes, $dateFrom, $dateTo),
                "reverse_bom" => $this->getReverseBomRows(),
                "stock_status" => $contextBusunitCode !== ""
                    ? $this->getStockStatusRows($contextBusunitCode)
                    : [],
            ];
        } catch (Throwable $error) {
            http_response_code(500);
            return [
                "message" => "Error: " . $error->getMessage(),
            ];
        }
    }

    private function getForecastRows(array $busunitCodes, string $dateFrom, string $dateTo): array
    {
        if (!$busunitCodes || $dateFrom === "" || $dateTo === "") {
            return [];
        }

        $placeholders = [];
        $params = [
            ":date_from" => $dateFrom,
            ":date_to" => $dateTo,
        ];

        foreach ($busunitCodes as $index => $code) {
            $key = ":busunit_" . $index;
            $placeholders[] = $key;
            $params[$key] = $code;
        }

        $sql = "SELECT
                    ss.busunitcode,
                    bu.name AS busunit_name,
                    st.inv_code,
                    COALESCE(fg.`desc`, rm.`desc`, st.inv_code) AS item_name,
                    COALESCE(fg.category, rm.category, 'Uncategorized') AS category,
                    COALESCE(fg.productcode, rm.productcode, st.inv_code) AS productcode,
                    COALESCE(fg.uomval, rm.uomval, st.uomval, 1) AS uomval,
                    COALESCE(fg.uom, rm.uom, st.uom, 'UNIT') AS uom,
                    SUM(COALESCE(st.qty, 0)) AS total_qty_sold,
                    COUNT(DISTINCT st.transdate) AS active_days,
                    SUM(COALESCE(st.total_sales, 0)) AS total_sales
                FROM tbl_sales_transactions AS st
                INNER JOIN tbl_sales_summary AS ss
                    ON ss.sales_id = st.sales_id
                LEFT JOIN lkp_busunits AS bu
                    ON ss.busunitcode = bu.busunitcode
                LEFT JOIN lkp_build_of_products AS fg
                    ON st.inv_code = fg.build_code
                LEFT JOIN lkp_raw_mats AS rm
                    ON st.inv_code = rm.mat_code
                WHERE st.deletestatus = 'Active'
                  AND ss.deletestatus = 'Active'
                  AND st.transdate BETWEEN :date_from AND :date_to
                  AND ss.busunitcode IN (" . implode(", ", $placeholders) . ")
                GROUP BY
                    ss.busunitcode,
                    bu.name,
                    st.inv_code,
                    item_name,
                    category,
                    productcode,
                    uomval,
                    uom
                ORDER BY
                    bu.name ASC,
                    item_name ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function getReverseBomRows(): array
    {
        $sql = "SELECT
                    bc.build_code,
                    COALESCE(parent.`desc`, bc.build_code) AS build_name,
                    COALESCE(parent.productcode, bc.build_code) AS build_productcode,
                    COALESCE(parent.category, '') AS build_category,
                    COALESCE(parent.uomval, 1) AS build_uomval,
                    COALESCE(parent.uom, 'UNIT') AS build_uom,
                    bc.component_code,
                    COALESCE(component_fg.`desc`, component_rm.`desc`, bc.component_code) AS component_name,
                    bc.component_class,
                    bc.qty AS component_qty,
                    bc.trigger
                FROM tbl_build_components AS bc
                LEFT JOIN lkp_build_of_products AS parent
                    ON bc.build_code = parent.build_code
                LEFT JOIN lkp_build_of_products AS component_fg
                    ON bc.component_code = component_fg.build_code
                LEFT JOIN lkp_raw_mats AS component_rm
                    ON bc.component_code = component_rm.mat_code
                WHERE bc.deletestatus = 'Active'
                  AND (bc.trigger = 'PRODUCTION' OR bc.trigger IS NULL OR bc.trigger = '')
                ORDER BY parent.`desc` ASC, component_name ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function getStockStatusRows(string $busunitCode): array
    {
        $sql = "SELECT
                    inv_code,
                    busunitcode,
                    inv_status
                FROM tbl_inventory_stock_status
                WHERE deletestatus = 'Active'
                  AND busunitcode = :busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
