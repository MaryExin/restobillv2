<?php
declare(strict_types=1);

/**
 * Product options: suggested per-item choices shown when an item is added
 * to an order (e.g. BANGSILOG -> Bangus: Regular/Tustado, Kanin: Sinangag/
 * Plain rice, Itlog: Sunny side up/Scrambled). The cashier's picks become
 * the item's special instruction (printed on the kitchen ticket).
 *
 * A product without its own groups falls back to its category's defaults
 * (rows whose product_id is "CAT:<item_category>"), so newly added products
 * get suggestions automatically.
 *
 * GET  ?product_id=BD-...&item_category=.. groups for one product, plus the
 *                                         category defaults and which applies
 * GET  (no product_id)                    { options: {product_id: [groups]},
 *                                           category_options: {category: [groups]} }
 *      &category_code=..&unit_code=..     optional scope (defaults to the POS unit)
 *
 * POST {product_id, groups: [{group_name, select_type: "single"|"multi",
 *       options: ["..."], default_option: ""}]}      replaces the product's groups
 * POST {item_category, groups: [...]}                replaces the category defaults
 *      (both need the Pricing Engine permission)
 *
 * Written for PHP 7.4+ (no PHP 8-only syntax).
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];
if ($method === "POST") {
    require __DIR__ . "/secure_guard.php";
}
require __DIR__ . "/pdo.php";
if ($method === "POST") {
    require_once __DIR__ . "/pos_role_authorization.php";
    posRoleAuthRequireAnyPermission(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        [
            ["settings", "pricingEngine"],
            ["reports", "pricingManagement"],
        ]
    );
}

const PRODUCT_OPTION_MAX_GROUPS = 20;
const PRODUCT_OPTION_MAX_CHOICES = 20;
const PRODUCT_OPTION_SELECT_TYPES = ["single", "multi"];
const PRODUCT_OPTION_CATEGORY_PREFIX = "CAT:";

function categoryOptionKey(string $category): string
{
    return PRODUCT_OPTION_CATEGORY_PREFIX . trim($category);
}

class ProductOptionValidationException extends RuntimeException
{
}

function respondProductOptions(bool $success, string $message, $data = null, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function ensureProductOptionsTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_pos_product_options (
            ID INT NOT NULL AUTO_INCREMENT,
            category_code VARCHAR(100) NOT NULL,
            unit_code VARCHAR(100) NOT NULL,
            product_id VARCHAR(100) NOT NULL,
            group_name VARCHAR(60) NOT NULL,
            select_type VARCHAR(10) NOT NULL DEFAULT 'single',
            default_option VARCHAR(60) NULL,
            options_json TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'Active',
            date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (ID),
            KEY idx_pos_product_options_product (product_id, sort_order),
            KEY idx_pos_product_options_scope (category_code, unit_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
}

function resolveProductOptionScope(PDO $pdo, string $categoryCode, string $unitCode): array
{
    if ($categoryCode !== "" && $unitCode !== "") {
        return ["category_code" => $categoryCode, "unit_code" => $unitCode];
    }

    $stmt = $pdo->query("
        SELECT Category_Code, Unit_Code
        FROM tbl_main_business_units
        WHERE Status = 'Active'
          AND TRIM(COALESCE(Unit_Code, '')) <> ''
        ORDER BY ID ASC
        LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        respondProductOptions(false, "No active POS business unit was found.", null, 404);
    }

    return [
        "category_code" => trim((string)$row["Category_Code"]),
        "unit_code" => trim((string)$row["Unit_Code"]),
    ];
}

function decodeOptionRow(array $row): array
{
    $options = json_decode((string)$row["options_json"], true);
    return [
        "group_name" => (string)$row["group_name"],
        "select_type" => (string)$row["select_type"] === "multi" ? "multi" : "single",
        "options" => is_array($options) ? array_values(array_map("strval", $options)) : [],
        "default_option" => (string)($row["default_option"] ?? ""),
    ];
}

function readProductOptionGroups(PDO $pdo, array $scope, ?string $productId): array
{
    $sql = "
        SELECT product_id, group_name, select_type, default_option, options_json
        FROM tbl_pos_product_options
        WHERE category_code = :category_code
          AND unit_code = :unit_code
          AND status = 'Active'
    ";
    $params = [
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ];
    if ($productId !== null) {
        $sql .= " AND product_id = :product_id";
        $params[":product_id"] = $productId;
    }
    $sql .= " ORDER BY product_id ASC, sort_order ASC, ID ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $byProduct = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $byProduct[(string)$row["product_id"]][] = decodeOptionRow($row);
    }
    return $byProduct;
}

/** Splits the raw map into product rows and "CAT:<category>" default rows. */
function splitCategoryOptions(array $byProduct): array
{
    $products = [];
    $categories = [];
    $prefixLength = strlen(PRODUCT_OPTION_CATEGORY_PREFIX);
    foreach ($byProduct as $key => $groups) {
        if (strncmp((string)$key, PRODUCT_OPTION_CATEGORY_PREFIX, $prefixLength) === 0) {
            $categories[substr((string)$key, $prefixLength)] = $groups;
        } else {
            $products[$key] = $groups;
        }
    }
    return [$products, $categories];
}

function cleanOptionText($value, int $maxLength, string $label): string
{
    $text = preg_replace('/\s+/u', ' ', trim((string)$value));
    if ($text === "" || mb_strlen($text) > $maxLength) {
        throw new ProductOptionValidationException("{$label} must be 1 to {$maxLength} characters.");
    }
    if (strpos($text, "|") !== false || strpos($text, ":") !== false) {
        throw new ProductOptionValidationException("{$label} cannot contain ':' or '|'.");
    }
    return $text;
}

/** Validates the posted groups and returns them normalized. */
function readPostedGroups($rawGroups): array
{
    if (!is_array($rawGroups)) {
        throw new ProductOptionValidationException("groups must be a list.");
    }
    if (count($rawGroups) > PRODUCT_OPTION_MAX_GROUPS) {
        throw new ProductOptionValidationException("A product can have up to " . PRODUCT_OPTION_MAX_GROUPS . " option groups.");
    }

    $groups = [];
    $seenNames = [];
    foreach ($rawGroups as $raw) {
        if (!is_array($raw)) {
            throw new ProductOptionValidationException("Each group must be an object.");
        }
        $name = cleanOptionText($raw["group_name"] ?? "", 60, "Group name");
        $key = mb_strtolower($name);
        if (isset($seenNames[$key])) {
            throw new ProductOptionValidationException("Group \"{$name}\" is listed twice.");
        }
        $seenNames[$key] = true;

        $selectType = strtolower(trim((string)($raw["select_type"] ?? "single")));
        if (!in_array($selectType, PRODUCT_OPTION_SELECT_TYPES, true)) {
            throw new ProductOptionValidationException("select_type must be single or multi.");
        }

        $rawOptions = $raw["options"] ?? [];
        if (!is_array($rawOptions) || count($rawOptions) === 0) {
            throw new ProductOptionValidationException("Group \"{$name}\" needs at least one option.");
        }
        $options = [];
        foreach ($rawOptions as $option) {
            $text = cleanOptionText($option, 60, "Option");
            if (!in_array($text, $options, true)) {
                $options[] = $text;
            }
        }
        if (count($options) > PRODUCT_OPTION_MAX_CHOICES) {
            throw new ProductOptionValidationException("Group \"{$name}\" can have up to " . PRODUCT_OPTION_MAX_CHOICES . " options.");
        }

        $default = trim((string)($raw["default_option"] ?? ""));
        if ($default !== "" && ($selectType === "multi" || !in_array($default, $options, true))) {
            throw new ProductOptionValidationException("The default of \"{$name}\" must be one of its options (single choice only).");
        }

        $groups[] = [
            "group_name" => $name,
            "select_type" => $selectType,
            "options" => $options,
            "default_option" => $default,
        ];
    }
    return $groups;
}

function categoryExists(PDO $pdo, array $scope, string $category): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM tbl_inventory_products_masterlist
        WHERE item_category = :item_category
          AND category_code = :category_code
          AND unit_code = :unit_code
        LIMIT 1
    ");
    $stmt->execute([
        ":item_category" => $category,
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ]);
    return (bool)$stmt->fetchColumn();
}

function productExists(PDO $pdo, array $scope, string $productId): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM tbl_inventory_products_masterlist
        WHERE product_id = :product_id
          AND category_code = :category_code
          AND unit_code = :unit_code
        LIMIT 1
    ");
    $stmt->execute([
        ":product_id" => $productId,
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ]);
    return (bool)$stmt->fetchColumn();
}

try {
    ensureProductOptionsTable($pdo);

    if ($method === "GET") {
        $scope = resolveProductOptionScope(
            $pdo,
            trim((string)($_GET["category_code"] ?? "")),
            trim((string)($_GET["unit_code"] ?? ""))
        );
        $productId = trim((string)($_GET["product_id"] ?? ""));
        $itemCategory = trim((string)($_GET["item_category"] ?? ""));

        if ($productId !== "") {
            $groups = readProductOptionGroups($pdo, $scope, $productId)[$productId] ?? [];
            $categoryGroups = $itemCategory === ""
                ? []
                : (readProductOptionGroups($pdo, $scope, categoryOptionKey($itemCategory))[categoryOptionKey($itemCategory)] ?? []);
            respondProductOptions(true, "Product options loaded.", [
                "product_id" => $productId,
                "item_category" => $itemCategory,
                "groups" => $groups,
                "category_groups" => $categoryGroups,
                "source" => $groups ? "product" : ($categoryGroups ? "category" : "none"),
            ]);
        }

        list($products, $categories) = splitCategoryOptions(readProductOptionGroups($pdo, $scope, null));
        respondProductOptions(true, "Product options loaded.", [
            "scope" => $scope,
            "count" => count($products),
            "options" => (object)$products,
            "category_options" => (object)$categories,
        ]);
    }

    if ($method !== "POST") {
        respondProductOptions(false, "Method not allowed.", null, 405);
    }

    $body = json_decode((string)file_get_contents("php://input"), true);
    if (!is_array($body)) {
        throw new ProductOptionValidationException("Invalid request body.");
    }

    $scope = resolveProductOptionScope(
        $pdo,
        trim((string)($body["category_code"] ?? "")),
        trim((string)($body["unit_code"] ?? ""))
    );
    $productId = trim((string)($body["product_id"] ?? ""));
    $itemCategory = trim((string)($body["item_category"] ?? ""));
    if ($productId === "" && $itemCategory === "") {
        throw new ProductOptionValidationException("product_id or item_category is required.");
    }
    if ($productId !== "") {
        if (!productExists($pdo, $scope, $productId)) {
            respondProductOptions(false, "Product not found.", null, 404);
        }
    } else {
        // Category defaults are stored under a "CAT:<category>" key.
        if (!categoryExists($pdo, $scope, $itemCategory)) {
            respondProductOptions(false, "Category not found.", null, 404);
        }
        $productId = categoryOptionKey($itemCategory);
    }
    $groups = readPostedGroups($body["groups"] ?? []);

    $pdo->beginTransaction();
    try {
        $delete = $pdo->prepare("
            DELETE FROM tbl_pos_product_options
            WHERE product_id = :product_id
              AND category_code = :category_code
              AND unit_code = :unit_code
        ");
        $delete->execute([
            ":product_id" => $productId,
            ":category_code" => $scope["category_code"],
            ":unit_code" => $scope["unit_code"],
        ]);

        $insert = $pdo->prepare("
            INSERT INTO tbl_pos_product_options
                (category_code, unit_code, product_id, group_name, select_type, default_option, options_json, sort_order, status)
            VALUES
                (:category_code, :unit_code, :product_id, :group_name, :select_type, :default_option, :options_json, :sort_order, 'Active')
        ");
        foreach ($groups as $index => $group) {
            $insert->execute([
                ":category_code" => $scope["category_code"],
                ":unit_code" => $scope["unit_code"],
                ":product_id" => $productId,
                ":group_name" => $group["group_name"],
                ":select_type" => $group["select_type"],
                ":default_option" => $group["default_option"] === "" ? null : $group["default_option"],
                ":options_json" => json_encode($group["options"], JSON_UNESCAPED_UNICODE),
                ":sort_order" => $index,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    respondProductOptions(true, $itemCategory !== "" && strncmp($productId, PRODUCT_OPTION_CATEGORY_PREFIX, strlen(PRODUCT_OPTION_CATEGORY_PREFIX)) === 0
        ? "Category defaults saved."
        : "Product options saved.", [
        "product_id" => $productId,
        "item_category" => $itemCategory,
        "groups" => $groups,
    ]);
} catch (ProductOptionValidationException $e) {
    respondProductOptions(false, $e->getMessage(), null, 422);
} catch (Throwable $e) {
    error_log("pos_product_options.php: " . $e->getMessage());
    respondProductOptions(false, "Could not process the product options request.", null, 500);
}
