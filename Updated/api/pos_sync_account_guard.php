<?php

declare(strict_types=1);

/**
 * Sync deliberately uses its own web/tablet account. A private local POS
 * Developer token must never cross that authentication boundary.
 */
function posSyncRequireDedicatedAccount(Auth $auth): void
{
    $tokenData = $auth->getTokenData();
    $isDeveloperToken =
        ($tokenData["pos_developer_mode"] ?? false) === true ||
        ($tokenData["pos_developer_full_access"] ?? false) === true ||
        ($tokenData["pos_developer_read_only"] ?? false) === true;

    if (!$isDeveloperToken) {
        return;
    }

    http_response_code(403);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "message" => "Use the dedicated web/tablet account for sync."
    ]);
    exit;
}
