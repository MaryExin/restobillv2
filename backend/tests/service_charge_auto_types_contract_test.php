<?php

declare(strict_types=1);

// Exercise the real endpoint against isolated in-memory SQLite. Only MySQL's
// row-lock suffix is adapted; the SELECT/INSERT/UPDATE/DELETE SQL runs normally.
final class AutoTypesTestPdo extends PDO
{
    public function __construct()
    {
        parent::__construct("sqlite::memory:", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return parent::prepare(str_replace(" FOR UPDATE", "", $query), $options);
    }
}

if (getenv("AUTO_TYPES_TEST_CHILD") === "1") return;

function autoTypesAssertSame(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) {
        throw new RuntimeException("Failed: {$label}; got " . var_export($actual, true));
    }
}

$fixture = sys_get_temp_dir() . "/service-charge-auto-types-" . bin2hex(random_bytes(6));
mkdir($fixture, 0700);
try {
    $source = str_replace(
        ['<?php', 'file_get_contents("php://input")'],
        ['<?php $_SERVER["REQUEST_METHOD"] = getenv("AUTO_TYPES_TEST_METHOD");', 'file_get_contents("php://stdin")'],
        file_get_contents(__DIR__ . "/../api/pos_manage_other_charges.php")
    );
    file_put_contents($fixture . "/endpoint.php", $source);
    file_put_contents($fixture . "/secure_guard.php", "<?php\n");
    file_put_contents($fixture . "/pos_role_authorization.php", "<?php function posRoleAuthRequirePermission(...\$args) {}\n");
    file_put_contents($fixture . "/pdo.php", "<?php\nrequire " . var_export(__FILE__, true) . ";\n" . <<<'PHP'
$pdo = new AutoTypesTestPdo();
$pdo->exec("CREATE TABLE tbl_pos_list_of_other_charges (ID INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, particulars TEXT, amount REAL, rate_type TEXT, is_enabled INTEGER)");
$pdo->exec("CREATE TABLE tbl_pos_settings (ID INTEGER PRIMARY KEY, category TEXT, description TEXT, value TEXT)");
$pdo->exec("CREATE TABLE lkp_sales_type (sales_type_id TEXT, description TEXT, deletestatus TEXT)");
$state = json_decode(getenv("AUTO_TYPES_TEST_STATE"), true, 512, JSON_THROW_ON_ERROR);
foreach ($state as $table => $rows) {
    foreach ($rows as $row) {
        $sql = "INSERT INTO {$table} (" . implode(",", array_keys($row)) . ") VALUES (" . implode(",", array_fill(0, count($row), "?")) . ")";
        $pdo->prepare($sql)->execute(array_values($row));
    }
}
if (getenv("AUTO_TYPES_TEST_FAIL_MAPPING") === "1") {
    $pdo->exec("CREATE TRIGGER fail_mapping BEFORE INSERT ON tbl_pos_settings BEGIN SELECT RAISE(ABORT, 'Simulated mapping failure'); END");
}
$baselineChanges = (int)$pdo->query("SELECT total_changes()")->fetchColumn();
register_shutdown_function(static function () use ($pdo, $baselineChanges) {
    $state = [];
    foreach (["tbl_pos_list_of_other_charges", "tbl_pos_settings", "lkp_sales_type"] as $table) {
        $state[$table] = $pdo->query("SELECT * FROM {$table}")->fetchAll(PDO::FETCH_ASSOC);
    }
    fwrite(STDERR, "SNAPSHOT:" . json_encode([
        "status" => http_response_code(), "state" => $state,
        "writes" => (int)$pdo->query("SELECT total_changes()")->fetchColumn() - $baselineChanges,
        "transaction_open" => $pdo->inTransaction(),
    ]));
});
PHP
    );

    $base = [
        "tbl_pos_list_of_other_charges" => [
            ["ID" => 1, "category" => "POS", "particulars" => "SERVICE CHARGE", "amount" => 5, "rate_type" => "Percentage", "is_enabled" => 1],
            ["ID" => 2, "category" => "POS", "particulars" => "DELIVERY FEE", "amount" => 20, "rate_type" => "Fixed", "is_enabled" => 1],
        ],
        "tbl_pos_settings" => [["ID" => 1, "category" => "Service", "description" => "Service Charge Enabled", "value" => "True"]],
        "lkp_sales_type" => [
            ["sales_type_id" => "ST-DINE", "description" => "DINE IN", "deletestatus" => "Active"],
            ["sales_type_id" => "ST-TAKE", "description" => "TAKE OUT", "deletestatus" => "Active"],
            ["sales_type_id" => "ST-OLD", "description" => "OLD TYPE", "deletestatus" => "Deleted"],
        ],
    ];
    $scenarios = 0;
    $run = static function (string $method, array $body = [], ?array $state = null, bool $failMapping = false) use ($fixture, $base, &$scenarios): array {
        $process = proc_open([PHP_BINARY, $fixture . "/endpoint.php"],
            [0 => ["pipe", "r"], 1 => ["pipe", "w"], 2 => ["pipe", "w"]], $pipes, null,
            ["AUTO_TYPES_TEST_CHILD" => "1", "AUTO_TYPES_TEST_METHOD" => $method,
             "AUTO_TYPES_TEST_STATE" => json_encode($state ?? $base), "AUTO_TYPES_TEST_FAIL_MAPPING" => $failMapping ? "1" : "0"]);
        if (!is_resource($process)) throw new RuntimeException("Unable to start endpoint test.");
        fwrite($pipes[0], json_encode($body));
        fclose($pipes[0]);
        $response = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        autoTypesAssertSame(0, proc_close($process), "endpoint exits successfully");
        $snapshotOffset = strrpos($stderr, "SNAPSHOT:");
        if ($snapshotOffset === false) throw new RuntimeException("Missing snapshot: {$stderr}");
        $scenarios++;
        return [json_decode($response, true, 512, JSON_THROW_ON_ERROR), json_decode(substr($stderr, $snapshotOffset + 9), true, 512, JSON_THROW_ON_ERROR)];
    };

    [$response, $snapshot] = $run("GET");
    autoTypesAssertSame([], $response["charges"][0]["auto_sales_type_ids"], "existing charge remains manual by default");
    autoTypesAssertSame([], $response["charges"][0]["auto_sales_types"], "unassigned labels are empty");
    autoTypesAssertSame(["ST-DINE", "ST-TAKE"], array_column($response["sales_types"], "sales_type_id"), "only active service types listed");
    autoTypesAssertSame(0, $snapshot["writes"], "GET has no writes");

    $save = ["id" => 1, "amount" => 10, "rate_type" => "Percentage", "auto_sales_type_ids" => ["ST-DINE", "ST-DINE"]];
    [$response, $snapshot] = $run("PUT", $save);
    autoTypesAssertSame(200, $snapshot["status"], "mapping save succeeds");
    autoTypesAssertSame(["ST-DINE"], $response["charges"][0]["auto_sales_type_ids"], "mapping de-duplicates IDs");
    autoTypesAssertSame(["DINE IN"], $response["charges"][0]["auto_sales_types"], "description resolves for order_type matching");
    autoTypesAssertSame(10, $response["charges"][0]["amount"], "rate changes save with mapping");
    $saved = $snapshot["state"];
    [$reopened] = $run("GET", [], $saved);
    autoTypesAssertSame($response["charges"], $reopened["charges"], "mapping survives reopening");

    [$response, $snapshot] = $run("PUT", ["id" => 1, "is_enabled" => 0], $saved);
    autoTypesAssertSame(["ST-DINE"], $response["charges"][0]["auto_sales_type_ids"], "toggle-only callers preserve mapping");
    autoTypesAssertSame(0, $response["charges"][0]["is_enabled"], "charge toggle still works");
    autoTypesAssertSame($saved["tbl_pos_settings"], $snapshot["state"]["tbl_pos_settings"], "toggle does not rewrite settings");
    [$response] = $run("PUT", ["id" => 1, "amount" => 7, "rate_type" => "Fixed"], $saved);
    autoTypesAssertSame(["ST-DINE"], $response["charges"][0]["auto_sales_type_ids"], "old amount/rate callers preserve mapping");
    [$response] = $run("PUT", ["id" => 1, "auto_sales_type_ids" => ["ST-TAKE"]], $saved);
    autoTypesAssertSame(10, $response["charges"][0]["amount"], "mapping-only edit preserves rate");
    autoTypesAssertSame(["TAKE OUT"], $response["charges"][0]["auto_sales_types"], "mapping-only edit takes effect");

    foreach ([null, "ST-DINE", 1, true, new stdClass(), ["bad"], ["ST-OLD"], [null], [1], [""], ["id" => "ST-DINE"]] as $invalid) {
        [$response, $snapshot] = $run("PUT", array_replace($save, ["auto_sales_type_ids" => $invalid]), $saved);
        autoTypesAssertSame(400, $snapshot["status"], "invalid mapping rejected");
        autoTypesAssertSame(false, $response["success"], "invalid mapping reports failure");
        autoTypesAssertSame(0, $snapshot["writes"], "validation occurs before any rate or mapping writes");
        autoTypesAssertSame($saved, $snapshot["state"], "invalid mapping preserves saved state");
    }

    [$response, $snapshot] = $run("PUT", ["id" => 1, "auto_sales_type_ids" => []], $saved);
    autoTypesAssertSame([], $response["charges"][0]["auto_sales_types"], "empty selection clears automatic defaults");
    autoTypesAssertSame($base["tbl_pos_settings"], $snapshot["state"]["tbl_pos_settings"], "clearing retains unrelated settings");

    $inactive = $saved;
    $inactive["lkp_sales_type"][0]["deletestatus"] = "Deleted";
    [$response] = $run("GET", [], $inactive);
    autoTypesAssertSame(["ST-DINE"], $response["charges"][0]["auto_sales_type_ids"], "inactive mapping stays visible for removal");
    autoTypesAssertSame([], $response["charges"][0]["auto_sales_types"], "inactive service type never auto-applies");

    $renamed = $saved;
    $renamed["lkp_sales_type"][0]["description"] = "DINE-IN NEW";
    [$response] = $run("GET", [], $renamed);
    autoTypesAssertSame(["DINE-IN NEW"], $response["charges"][0]["auto_sales_types"], "assignment follows stable type ID on rename");

    $add = ["particulars" => "New fee", "amount" => 50, "rate_type" => "Fixed", "auto_sales_type_ids" => ["ST-DINE", "ST-TAKE"]];
    [$response, $snapshot] = $run("POST", $add);
    autoTypesAssertSame(200, $snapshot["status"], "new charge plus mapping saves");
    autoTypesAssertSame(0, $response["charges"][2]["is_enabled"], "new charge keeps existing disabled default");
    autoTypesAssertSame(["DINE IN", "TAKE OUT"], $response["charges"][2]["auto_sales_types"], "new charge accepts multiple service types");
    [$response, $snapshot] = $run("DELETE", ["id" => 1], $saved);
    autoTypesAssertSame([2], array_column($response["charges"], "ID"), "delete removes the charge");
    autoTypesAssertSame($base["tbl_pos_settings"], $snapshot["state"]["tbl_pos_settings"], "delete cleans only charge's mapping");

    foreach (["PUT", "DELETE"] as $method) {
        [$response, $snapshot] = $run($method, ["id" => 999, "auto_sales_type_ids" => ["ST-DINE"]]);
        autoTypesAssertSame(404, $snapshot["status"], "unknown charge rejected");
        autoTypesAssertSame(0, $snapshot["writes"], "unknown charge cannot leave an orphan mapping");
        autoTypesAssertSame(false, $snapshot["transaction_open"], "unknown charge transaction is closed");
    }

    foreach ([["PUT", $save], ["POST", $add]] as [$method, $payload]) {
        [$response, $snapshot] = $run($method, $payload, null, true);
        autoTypesAssertSame(500, $snapshot["status"], "mapping storage failure reports failure");
        autoTypesAssertSame($base, $snapshot["state"], "mapping failure rolls back charge write");
        autoTypesAssertSame(false, $snapshot["transaction_open"], "failed transaction is closed");
    }
    echo "Service charge automatic type contract tests passed ({$scenarios} endpoint scenarios).\n";
} finally {
    foreach (glob($fixture . "/*") ?: [] as $path) unlink($path);
    rmdir($fixture);
}
