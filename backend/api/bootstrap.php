<?php

$backendDir = dirname(__DIR__);
$autoloadPath = $backendDir . "/vendor/autoload.php";

if (file_exists($autoloadPath)) {
    require $autoloadPath;
}

require_once $backendDir . "/src/ErrorHandler.php";

set_error_handler([ErrorHandler::class, "handleError"]);
set_exception_handler([ErrorHandler::class, "handleException"]);

$dotenvClass = "Dotenv\\Dotenv";
if (class_exists($dotenvClass)) {
    $dotenv = $dotenvClass::createImmutable($backendDir);
    $dotenv->load();
}

header("Content-type: application/json; charset=UTF-8");
