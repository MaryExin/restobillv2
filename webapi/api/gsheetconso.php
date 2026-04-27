<?php

declare(strict_types=1);


require __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/GoogleSheetsServiceFactory.php";

echo class_exists(\Google\Client::class) ? "OK" : "MISSING";
exit;



$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  http_response_code(405);
  header("Allow: GET");
  exit;
}

// Your existing auth pattern (keep as-is)
$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
  exit;
}

$user_id = $auth->getUserID();

// ✅ Create Sheets service + gateway + controller
$sheetsService = GoogleSheetsServiceFactory::make();
$consoGateway = new GSheetsConsoGateway($sheetsService, $_ENV['GOOGLE_SHEETS_SPREADSHEET_ID']);
$consoController = new GSheetsConsoController($consoGateway, (string)$user_id);

$consoController->processRequest($_SERVER["REQUEST_METHOD"]);
