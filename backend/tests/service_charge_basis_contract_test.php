<?php

declare(strict_types=1);

// Run the real endpoint against an in-memory PDO double: no API or database calls.
final class ServiceChargeBasisTestPdo extends PDO
{
    public array $rows;
    public int $writes = 0;

    public function __construct(array $rows)
    {
        $this->rows = $rows;
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return new ServiceChargeBasisTestStatement($this, $query);
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        $statement = $this->prepare($query);
        $statement->execute();
        return $statement;
    }
}

final class ServiceChargeBasisTestStatement extends PDOStatement
{
    private mixed $result = false;

    public function __construct(private ServiceChargeBasisTestPdo $pdo, private string $sql)
    {
    }

    public function execute(?array $params = null): bool
    {
        $params ??= [];
        $sql = trim($this->sql);
        if (str_starts_with($sql, "SELECT COALESCE(MAX(ID)")) {
            $this->result = max(array_merge([0], array_column($this->pdo->rows, "ID"))) + 1;
        } elseif (str_starts_with($sql, "SELECT")) {
            $matches = array_values(array_filter($this->pdo->rows, static fn($row) =>
                $row["category"] === $params[":category"] &&
                $row["description"] === $params[":description"]
            ));
            usort($matches, static fn($a, $b) => $b["ID"] <=> $a["ID"]);
            $this->result = $matches[0][str_starts_with($sql, "SELECT ID") ? "ID" : "value"] ?? false;
        } elseif (str_starts_with($sql, "UPDATE")) {
            foreach ($this->pdo->rows as &$row) {
                if ($row["ID"] === $params[":id"]) {
                    $row["value"] = $params[":setting_value"] ?? $params[":v"];
                }
            }
            $this->pdo->writes++;
        } elseif (str_starts_with($sql, "INSERT")) {
            $this->pdo->rows[] = [
                "ID" => $params[":id"],
                "category" => $params[":category"] ?? $params[":cat"],
                "description" => $params[":description"] ?? $params[":desc"],
                "value" => $params[":setting_value"] ?? $params[":v"],
            ];
            $this->pdo->writes++;
        } else {
            throw new RuntimeException("Unexpected SQL in service charge contract test.");
        }
        return true;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->result;
    }
}

if (getenv("SERVICE_CHARGE_TEST_CHILD") === "1") {
    return;
}

function serviceChargeBasisAssertSame(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) {
        throw new RuntimeException("Failed: {$label}; got " . var_export($actual, true));
    }
}

$fixture = sys_get_temp_dir() . "/service-charge-contract-" . bin2hex(random_bytes(6));
mkdir($fixture, 0700);

try {
    $source = file_get_contents(__DIR__ . "/../api/pos_service_charge.php");
    $source = str_replace(
        ['<?php', 'file_get_contents("php://input")'],
        ['<?php $_SERVER["REQUEST_METHOD"] = getenv("SERVICE_CHARGE_TEST_METHOD");', 'file_get_contents("php://stdin")'],
        $source
    );
    file_put_contents($fixture . "/endpoint.php", $source);
    file_put_contents($fixture . "/secure_guard.php", "<?php\n");
    file_put_contents($fixture . "/pos_role_authorization.php", "<?php function posRoleAuthRequirePermission(...\$args) {}\n");
    file_put_contents($fixture . "/pdo.php", "<?php\nrequire " . var_export(__FILE__, true) . ";\n" . <<<'PHP'
$pdo = new ServiceChargeBasisTestPdo(json_decode(getenv("SERVICE_CHARGE_TEST_ROWS"), true));
register_shutdown_function(static function () use ($pdo) {
    fwrite(STDERR, json_encode(["status" => http_response_code(), "rows" => $pdo->rows, "writes" => $pdo->writes]));
});
PHP
    );

    $run = static function (string $method, array $body = [], array $rows = []) use ($fixture): array {
        $process = proc_open(
            [PHP_BINARY, $fixture . "/endpoint.php"],
            [0 => ["pipe", "r"], 1 => ["pipe", "w"], 2 => ["pipe", "w"]],
            $pipes,
            null,
            [
                "SERVICE_CHARGE_TEST_CHILD" => "1",
                "SERVICE_CHARGE_TEST_METHOD" => $method,
                "SERVICE_CHARGE_TEST_ROWS" => json_encode($rows),
            ]
        );
        if (!is_resource($process)) {
            throw new RuntimeException("Unable to start isolated endpoint test.");
        }
        fwrite($pipes[0], json_encode($body));
        fclose($pipes[0]);
        $response = stream_get_contents($pipes[1]);
        $snapshot = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        serviceChargeBasisAssertSame(0, proc_close($process), "endpoint process exits successfully");
        return [json_decode($response, true, 512, JSON_THROW_ON_ERROR), json_decode($snapshot, true, 512, JSON_THROW_ON_ERROR)];
    };

    $body = [
        "service_charge_enabled" => true,
        "service_charge_percentage" => 5,
        "service_charge_type" => "SERVICE CHARGE",
    ];
    [$response, $snapshot] = $run("GET");
    serviceChargeBasisAssertSame("net_after_deductions", $response["data"]["service_charge_basis"], "missing row keeps legacy default");
    serviceChargeBasisAssertSame(0, $snapshot["writes"], "GET does not create settings");

    foreach (["net_after_deductions", "vat_exclusive_less_discount"] as $basis) {
        [$response, $snapshot] = $run("POST", $body + ["service_charge_basis" => $basis]);
        serviceChargeBasisAssertSame(200, $snapshot["status"], "valid setting returns success");
        serviceChargeBasisAssertSame($basis, $response["data"]["service_charge_basis"], "saved basis appears in response");
        serviceChargeBasisAssertSame(true, $response["data"]["service_charge_enabled"], "enabled response stays boolean");
        serviceChargeBasisAssertSame(5, $response["data"]["service_charge_percentage"], "percentage stays unchanged");
        serviceChargeBasisAssertSame("SERVICE CHARGE", $response["data"]["service_charge_type"], "charge type stays unchanged");
        serviceChargeBasisAssertSame(4, count($snapshot["rows"]), "all four settings are created");
        [$read] = $run("GET", [], $snapshot["rows"]);
        serviceChargeBasisAssertSame($basis, $read["data"]["service_charge_basis"], "saved basis loads again");
    }

    $savedRows = $snapshot["rows"];
    [$response, $snapshot] = $run("POST", $body, $savedRows);
    serviceChargeBasisAssertSame("vat_exclusive_less_discount", $response["data"]["service_charge_basis"], "old caller preserves saved basis");
    serviceChargeBasisAssertSame(3, $snapshot["writes"], "old caller does not write basis");

    [$response, $snapshot] = $run("POST", $body + ["service_charge_basis" => "net_after_deductions"], $savedRows);
    serviceChargeBasisAssertSame("net_after_deductions", $response["data"]["service_charge_basis"], "existing basis can switch back");
    serviceChargeBasisAssertSame(4, count($snapshot["rows"]), "updates do not duplicate rows");

    foreach ([null, "", "unsupported", 0, true, []] as $invalid) {
        [$response, $snapshot] = $run("POST", $body + ["service_charge_basis" => $invalid], $savedRows);
        serviceChargeBasisAssertSame(400, $snapshot["status"], "invalid basis is rejected");
        serviceChargeBasisAssertSame(false, $response["success"], "invalid basis reports failure");
        serviceChargeBasisAssertSame(0, $snapshot["writes"], "invalid basis cannot partly save other settings");
        serviceChargeBasisAssertSame($savedRows, $snapshot["rows"], "invalid basis preserves saved values");
    }

    echo "Service charge basis contract tests passed (13 endpoint scenarios).\n";
} finally {
    foreach (glob($fixture . "/*") ?: [] as $path) {
        unlink($path);
    }
    rmdir($fixture);
}
