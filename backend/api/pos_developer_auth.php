<?php

declare(strict_types=1);

/**
 * Resolve the private Developer credential file.
 *
 * POS_DEVELOPER_CONFIG_FILE may point at a deployment-specific file. The
 * default intentionally resolves outside XAMPP's htdocs directory when this
 * API folder is deployed at <xampp>/htdocs/api.
 */
function posDeveloperPrivateConfigPath(): string
{
    $configuredPath = trim((string)(
        $_ENV["POS_DEVELOPER_CONFIG_FILE"] ??
        (getenv("POS_DEVELOPER_CONFIG_FILE") ?: "")
    ));

    if ($configuredPath !== "") {
        return $configuredPath;
    }

    return dirname(dirname(__DIR__)) . "/etc/restobill-pos-developer.env";
}

/**
 * Load only the Developer settings that are safe to source from the private
 * file. SECRET_KEY remains owned by the application's normal server env.
 */
function posDeveloperLoadPrivateConfig(): void
{
    static $loaded = false;

    if ($loaded) {
        return;
    }

    $loaded = true;
    $configPath = posDeveloperPrivateConfigPath();

    if (!is_file($configPath)) {
        return;
    }

    $config = @parse_ini_file($configPath, false, INI_SCANNER_RAW);
    if (!is_array($config)) {
        error_log("Unable to parse the private POS developer configuration.");
        return;
    }

    $allowedKeys = [
        "POS_DEVELOPER_LOGIN_ENABLED",
        "POS_DEVELOPER_USERNAME",
        "POS_DEVELOPER_PASSWORD_HASH",
        "POS_DEVELOPER_ALLOWED_IPS",
        "POS_DEVELOPER_SUBJECT",
        "POS_DEVELOPER_DISPLAY_NAME",
        "POS_DEVELOPER_EMAIL",
    ];

    foreach ($allowedKeys as $key) {
        if (!array_key_exists($key, $config) || isset($_ENV[$key])) {
            continue;
        }

        $value = trim((string)$config[$key]);
        if (
            strlen($value) >= 2 &&
            (
                ($value[0] === "'" && $value[strlen($value) - 1] === "'") ||
                ($value[0] === '"' && $value[strlen($value) - 1] === '"')
            )
        ) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;
    }
}

function posDeveloperEnv(string $key, string $default = ""): string
{
    posDeveloperLoadPrivateConfig();

    if (isset($_ENV[$key]) && $_ENV[$key] !== "") {
        return trim((string)$_ENV[$key]);
    }

    $value = getenv($key);
    return $value !== false && $value !== ""
        ? trim((string)$value)
        : $default;
}

function posDeveloperEnabled(): bool
{
    return in_array(
        strtolower(posDeveloperEnv("POS_DEVELOPER_LOGIN_ENABLED")),
        ["1", "true", "yes", "on"],
        true
    );
}

function posDeveloperUsername(): string
{
    return posDeveloperEnv("POS_DEVELOPER_USERNAME");
}

function posDeveloperSubject(): string
{
    $configured = posDeveloperEnv(
        "POS_DEVELOPER_SUBJECT",
        "2147483646"
    );

    if (!ctype_digit($configured)) {
        return "";
    }

    $numeric = (int)$configured;
    return $numeric >= 1 && $numeric <= 2147483647
        ? (string)$numeric
        : "";
}

function posDeveloperDisplayName(): string
{
    return posDeveloperEnv("POS_DEVELOPER_DISPLAY_NAME", "POS Developer");
}

function posDeveloperEmail(): string
{
    $configured = posDeveloperEnv("POS_DEVELOPER_EMAIL");

    return $configured !== ""
        ? $configured
        : strtolower(posDeveloperUsername()) . "@localhost";
}

function posDeveloperReadingScopes(): array
{
    return ["cnc", "report"];
}

function posDeveloperConfigured(): bool
{
    return posDeveloperEnabled() &&
        posDeveloperUsername() !== "" &&
        posDeveloperSubject() !== "" &&
        posDeveloperEnv("POS_DEVELOPER_PASSWORD_HASH") !== "" &&
        posDeveloperEnv("POS_DEVELOPER_ALLOWED_IPS") !== "" &&
        posDeveloperEnv("SECRET_KEY") !== "";
}

function posDeveloperUsernameMatches(string $username): bool
{
    if (!posDeveloperConfigured()) {
        return false;
    }

    return hash_equals(
        strtolower(posDeveloperUsername()),
        strtolower(trim($username))
    );
}

function posDeveloperClientAllowed(?string $remoteAddress = null): bool
{
    $configured = posDeveloperEnv("POS_DEVELOPER_ALLOWED_IPS");
    if ($configured === "") {
        return false;
    }

    $remoteAddress = trim((string)(
        $remoteAddress ?? ($_SERVER["REMOTE_ADDR"] ?? "")
    ));

    if (str_starts_with($remoteAddress, "::ffff:")) {
        $remoteAddress = substr($remoteAddress, 7);
    }

    $allowed = preg_split('/[\s,]+/', $configured) ?: [];
    foreach ($allowed as $candidate) {
        $candidate = trim((string)$candidate);

        if (str_starts_with($candidate, "::ffff:")) {
            $candidate = substr($candidate, 7);
        }

        if ($candidate !== "" && hash_equals($candidate, $remoteAddress)) {
            return true;
        }
    }

    return false;
}

function posDeveloperAuthenticate(string $username, string $password): bool
{
    if (
        !posDeveloperUsernameMatches($username) ||
        !posDeveloperClientAllowed()
    ) {
        return false;
    }

    $passwordHash = posDeveloperEnv("POS_DEVELOPER_PASSWORD_HASH");
    return $password !== "" && password_verify($password, $passwordHash);
}

function posDeveloperVirtualUser(): array
{
    return [
        "uuid" => posDeveloperSubject(),
        "email" => posDeveloperEmail(),
        "classification" => "2",
        "firstname" => "POS",
        "middlename" => "",
        "lastname" => "Developer",
        "department" => "DEVELOPER",
        "status" => "Active",
        "deletestatus" => "Active",
        "image_filename" => "",
        "User_Name" => posDeveloperDisplayName(),
        "username" => posDeveloperDisplayName(),
    ];
}

function posDeveloperVirtualAccount(): array
{
    return [
        "uuid" => posDeveloperSubject(),
        "classification" => "2",
        "email" => posDeveloperEmail(),
    ];
}

function posDeveloperCredentialVersion(): string
{
    return substr(hash_hmac(
        "sha256",
        posDeveloperEnv("POS_DEVELOPER_PASSWORD_HASH"),
        posDeveloperEnv("SECRET_KEY")
    ), 0, 24);
}

function posDeveloperTokenIsValid(array $payload): bool
{
    if (
        ($payload["pos_developer_mode"] ?? false) !== true ||
        !posDeveloperConfigured() ||
        !posDeveloperClientAllowed()
    ) {
        return false;
    }

    return hash_equals(
        posDeveloperSubject(),
        trim((string)($payload["sub"] ?? ""))
    ) && hash_equals(
        posDeveloperCredentialVersion(),
        trim((string)($payload["pos_developer_version"] ?? ""))
    );
}

function posDeveloperFullAccessTokenIsValid(array $payload): bool
{
    return ($payload["pos_developer_full_access"] ?? false) === true &&
        ($payload["pos_developer_read_only"] ?? false) !== true &&
        posDeveloperTokenIsValid($payload);
}

function posDeveloperTokenAllowsReadingScope(array $payload, string $scope): bool
{
    if (!posDeveloperFullAccessTokenIsValid($payload)) {
        return false;
    }

    $scope = strtolower(trim($scope));
    $allowedScopes = $payload["pos_reading_scopes"] ?? [];

    return is_array($allowedScopes) &&
        in_array($scope, $allowedScopes, true) &&
        in_array($scope, posDeveloperReadingScopes(), true);
}

function posDeveloperAuthorizationHeader(): string
{
    $authorization = trim((string)(
        $_SERVER["HTTP_AUTHORIZATION"] ??
        $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] ??
        ""
    ));

    if ($authorization === "" && function_exists("getallheaders")) {
        foreach ((array)getallheaders() as $name => $value) {
            if (strcasecmp((string)$name, "Authorization") === 0) {
                return trim((string)$value);
            }
        }
    }

    return $authorization;
}

/**
 * Decode the request bearer as an access token. JWTCodec verifies the HMAC
 * signature and expiry; this additionally enforces the access-token type and
 * a usable subject before any reading authorization decision is made.
 */
function posReadingRequestAccessTokenData(): ?array
{
    $authorization = posDeveloperAuthorizationHeader();

    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        return null;
    }

    try {
        $codec = new JWTCodec(posDeveloperEnv("SECRET_KEY"));
        $payload = $codec->decode($matches[1]);

        $subject = $payload["sub"] ?? null;
        if (
            ($payload["token_type"] ?? "") !== "access" ||
            (!is_string($subject) && !is_int($subject)) ||
            trim((string)$subject) === ""
        ) {
            return null;
        }

        return $payload;
    } catch (Throwable $error) {
        return null;
    }
}

function posDeveloperRequestTokenData(): ?array
{
    $payload = posReadingRequestAccessTokenData();

    return
        is_array($payload) && posDeveloperFullAccessTokenIsValid($payload)
            ? $payload
            : null;
}

/**
 * Confirm an ordinary access token still belongs to an active local account.
 * The PDO must point at the original POS database; report-scope requests
 * never use this path because they are Developer-only.
 */
function posReadingActiveUser(PDO $pdo, array $payload): ?array
{
    $subject = trim((string)($payload["sub"] ?? ""));
    if ($subject === "") {
        return null;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT *
            FROM tbl_users_global_assignment
            WHERE uuid = :uuid
              AND deletestatus = 'Active'
            LIMIT 1
        ");
        $stmt->execute([":uuid" => $subject]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!is_array($user)) {
            return null;
        }

        $status = trim((string)($user["status"] ?? ""));
        if ($status !== "" && strcasecmp($status, "Active") !== 0) {
            return null;
        }

        return $user;
    } catch (Throwable $error) {
        return null;
    }
}

/**
 * Resolve authorization for POS reading requests without trusting a client
 * supplied identity or preview flag. CNC requires a signed, unexpired access
 * token for an active user; report scope and preview mode are Developer-only.
 */
function posDeveloperReadingAccess(
    string $scope,
    bool $developerPreviewRequested,
    PDO $posDatabasePdo
): array {
    $scope = strtolower(trim($scope));
    $developerRequired =
        $scope === "report" || $developerPreviewRequested;
    $tokenData = posReadingRequestAccessTokenData();

    if (!is_array($tokenData)) {
        return [
            "authorized" => false,
            "developer_required" => $developerRequired,
            "is_developer" => false,
            "is_normal_user" => false,
            "token" => null,
            "user" => null,
        ];
    }

    $developerTokenRequested =
        ($tokenData["pos_developer_mode"] ?? false) === true ||
        ($tokenData["pos_developer_full_access"] ?? false) === true ||
        ($tokenData["pos_developer_read_only"] ?? false) === true;
    $isDeveloper =
        $developerTokenRequested &&
        posDeveloperTokenAllowsReadingScope($tokenData, $scope);

    if ($developerTokenRequested) {
        $developerPreview = $isDeveloper && $developerPreviewRequested;
        $readOnly = $isDeveloper &&
            ($scope === "report" || $developerPreview);
        return [
            "authorized" => $isDeveloper,
            "developer_required" => $developerRequired,
            "is_developer" => $isDeveloper,
            "is_normal_user" => false,
            "developer_preview" => $developerPreview,
            "read_only" => $readOnly,
            "token" => $isDeveloper ? $tokenData : null,
            "user" => null,
        ];
    }

    if ($developerRequired || $scope !== "cnc") {
        return [
            "authorized" => false,
            "developer_required" => $developerRequired,
            "is_developer" => false,
            "is_normal_user" => false,
            "developer_preview" => false,
            "read_only" => false,
            "token" => null,
            "user" => null,
        ];
    }

    $normalUser = posReadingActiveUser($posDatabasePdo, $tokenData);
    $isNormalUser = is_array($normalUser);

    return [
        "authorized" => $isNormalUser,
        "developer_required" => $developerRequired,
        "is_developer" => false,
        "is_normal_user" => $isNormalUser,
        "developer_preview" => false,
        "read_only" => false,
        "token" => $isNormalUser ? $tokenData : null,
        "user" => $normalUser,
    ];
}

/**
 * Defense in depth for Developer previews. This makes the selected PDO
 * session read-only even if a future code change accidentally adds a write.
 */
function posDeveloperMakePdoReadOnly(PDO $pdo): void
{
    $pdo->exec("SET SESSION TRANSACTION READ ONLY");
}
