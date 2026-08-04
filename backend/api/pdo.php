<?php

$config = require __DIR__ . "/config.php";

// Callers that need role-aware DB selection (superadmin -> archive_db) set
// $role before requiring this file. Everyone else keeps the original
// flat/main_db connection untouched.
$dbConfig = $config;
if (isset($role) && strtolower(trim((string)$role)) === "superadmin") {
  $dbConfig = $config["archive_db"];
}

$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['db']};charset={$dbConfig['charset']}";

$options = [
  PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
  $pdo = new PDO($dsn, $dbConfig["user"], $dbConfig["pass"], $options);
} catch (PDOException $e) {
  http_response_code(500);
  header("Content-Type: application/json");
  echo json_encode(["error" => "DB connection failed", "details" => $e->getMessage()]);
  exit;
}