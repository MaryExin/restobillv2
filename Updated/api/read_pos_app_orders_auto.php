<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET" && $_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: GET, POST, OPTIONS");
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $database = new Database(
        $_ENV["DB_HOST"],
        $_ENV["DB_NAME"],
        $_ENV["DB_USER"],
        $_ENV["DB_PASS"]
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $data = is_array($json) ? $json : $_POST;

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $data = array_merge($_GET, $data);
    }

    $categoryCode = trim((string)($data["categoryCode"] ?? $data["category_code"] ?? ""));
    $unitCode = trim((string)($data["unitCode"] ?? $data["unit_code"] ?? ""));
    $pricingCode = trim((string)($data["pricingCode"] ?? $data["pricing_code"] ?? ""));
    $branchCode = trim((string)($data["branchCode"] ?? $unitCode));
    $apiKey = "nenpOW5nmEC60DHQgT7oVb57jcibq40W7KY";

    if ($categoryCode === "" || $unitCode === "" || $pricingCode === "") {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "categoryCode, unitCode, and pricingCode are required."
        ]);
        exit;
    }

    $apiUrl = "https://pos.tiuworldwidefranchise.com/index.php?Orders=" . rawurlencode($branchCode);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$apiKey}",
            "Accept: application/json",
        ],
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 30,
    ]);

    $remoteBody = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($remoteBody === false || $curlError) {
        throw new Exception("Unable to connect to remote orders API: " . $curlError);
    }

    if ($httpCode >= 400) {
        throw new Exception("Remote orders API returned HTTP {$httpCode}.");
    }

    $remoteJson = json_decode($remoteBody, true);

    if (!is_array($remoteJson)) {
        throw new Exception("Invalid JSON response from remote orders API.");
    }

    $items = $remoteJson["items"] ?? [];
    $customer = (string)($remoteJson["customer"] ?? "");
    $orderNumber = (string)($remoteJson["num"] ?? "");
    $reference = (string)($remoteJson["reference"] ?? "");
    $modeOfPayment = (string)($remoteJson["ModeOfPayment"] ?? "");
    $diamondAmount = (float)($remoteJson["DiamondAmount"] ?? 0);

    if (!is_array($items) || count($items) === 0) {
        echo json_encode([
            "success" => true,
            "message" => "No app orders found.",
            "data" => [
                "customer" => $customer,
                "num" => $orderNumber,
                "reference" => $reference,
                "modeOfPayment" => $modeOfPayment,
                "diamondAmount" => $diamondAmount,
                "cart_items" => [],
                "summary" => [
                    "requested_item_lines" => 0,
                    "matched_cart_lines" => 0,
                    "total_quantity" => 0,
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $sqlProduct = "
        SELECT
            pd.pricing_code,
            pd.inv_code AS product_id,
            pd.cost_per_uom AS pricing_unit_cost,
            pd.srp AS pricing_selling_price,
            pm.category_code,
            pm.unit_code,
            pm.inventory_type,
            pm.item_category,
            pm.item_name,
            pm.item_description,
            pm.unit_of_measure,
            pm.item_color,
            pm.item_brand,
            pm.item_variant,
            pm.item_size,
            pm.unit_cost,
            pm.selling_price,
            pm.vatable,
            pm.bar_code,
            pm.sku,
            pm.status
        FROM tbl_pricing_details pd
        INNER JOIN tbl_inventory_products_masterlist pm
            ON pd.inv_code = pm.product_id
        WHERE pd.pricing_code = ?
          AND pd.deletestatus = 'Active'
          AND pm.category_code = ?
          AND pm.unit_code = ?
          AND pm.status = 'Active'
          AND (
                pd.inv_code = ?
                OR pm.sku = ?
                OR pm.bar_code = ?
          )
        LIMIT 1
    ";

    $stmtProduct = $pdo->prepare($sqlProduct);

    $cartMap = [];

    foreach ($items as $item) {
        $code = trim((string)($item["code"] ?? ""));
        $qty = (int)($item["quantity"] ?? 0);
        $remarks = trim((string)($item["remarks"] ?? ""));

        if ($code === "" || $qty <= 0) {
            continue;
        }

        $stmtProduct->execute([
            $pricingCode,
            $categoryCode,
            $unitCode,
            $code,
            $code,
            $code,
        ]);

        $row = $stmtProduct->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            continue;
        }

        $productId = (string)($row["product_id"] ?? "");
        if ($productId === "") {
            continue;
        }

        if (!isset($cartMap[$productId])) {
            $cartMap[$productId] = [
                "code" => $productId,
                "product_id" => $productId,
                "name" => (string)($row["item_name"] ?? "NO NAME"),
                "item_name" => (string)($row["item_name"] ?? "NO NAME"),
                "price" => (float)($row["pricing_selling_price"] ?? $row["selling_price"] ?? 0),
                "selling_price" => (float)($row["pricing_selling_price"] ?? $row["selling_price"] ?? 0),
                "quantity" => 0,
                "isDiscountable" => "",
                "vatable" => (string)($row["vatable"] ?? ""),
                "item_category" => (string)($row["item_category"] ?? ""),
                "itemInstruction" => $remarks,
                "sku" => (string)($row["sku"] ?? ""),
                "bar_code" => (string)($row["bar_code"] ?? ""),
                "isLoadedFromDB" => false,
            ];
        }

        $cartMap[$productId]["quantity"] += $qty;

        if ($remarks !== "" && $cartMap[$productId]["itemInstruction"] === "") {
            $cartMap[$productId]["itemInstruction"] = $remarks;
        }
    }

    $cartItems = array_values($cartMap);

    echo json_encode([
        "success" => true,
        "message" => count($cartItems) > 0
            ? "App orders loaded successfully."
            : "No matching active products found.",
        "data" => [
            "customer" => $customer,
            "num" => $orderNumber,
            "reference" => $reference,
            "modeOfPayment" => $modeOfPayment,
            "diamondAmount" => $diamondAmount,
            "cart_items" => $cartItems,
            "summary" => [
                "requested_item_lines" => count($items),
                "matched_cart_lines" => count($cartItems),
                "total_quantity" => array_sum(array_map(
                    static fn(array $row): int => (int)($row["quantity"] ?? 0),
                    $cartItems
                )),
            ],
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}