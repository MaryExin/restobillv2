<?php

declare(strict_types=1);

function posDeveloperEnv(string $key, string $default = ""): string
{
    if (isset($_ENV[$key]) && $_ENV[$key] !== "") {
        return trim((string)$_ENV[$key]);
    }

    $value = getenv($key);
    return $value !== false && $value !== ""
        ? trim((string)$value)
        : $default;
}

/**
 * Developer credentials live in a dedicated singleton table. Keeping this
 * identity outside tbl_users_global_assignment prevents it from appearing in
 * or being mutated through the ordinary User Accounts feature.
 */
function posDeveloperDatabaseConnection(): ?PDO
{
    static $connectionAttempted = false;
    static $connection = null;

    if ($connectionAttempted) {
        return $connection;
    }
    $connectionAttempted = true;

    $host = posDeveloperEnv("DB_HOST");
    $database = posDeveloperEnv("DB_NAME");
    $username = posDeveloperEnv("DB_USER");
    $password = posDeveloperEnv("DB_PASS");

    if ($host === "" || $database === "" || $username === "") {
        return null;
    }

    try {
        $connection = new PDO(
            "mysql:host={$host};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (Throwable $error) {
        error_log("Unable to connect to the POS Developer credential database.");
        $connection = null;
    }

    return $connection;
}

function posDeveloperDatabaseRecord(): ?array
{
    static $recordLoaded = false;
    static $record = null;

    if ($recordLoaded) {
        return $record;
    }
    $recordLoaded = true;

    $pdo = posDeveloperDatabaseConnection();
    if (!$pdo instanceof PDO) {
        return null;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT
                d.singleton_id,
                d.subject_id,
                d.username,
                d.password_hash,
                d.display_name,
                d.email,
                d.is_enabled,
                d.credential_version,
                EXISTS (
                    SELECT 1
                    FROM tbl_users_global_assignment u
                    WHERE u.uuid = CAST(d.subject_id AS CHAR)
                ) AS subject_collision
            FROM tbl_pos_developer_account d
            WHERE d.singleton_id = :singleton_id
            LIMIT 1
        ");
        $stmt->execute([":singleton_id" => 1]);
        $candidate = $stmt->fetch(PDO::FETCH_ASSOC);
        $record = is_array($candidate) ? $candidate : null;
    } catch (Throwable $error) {
        error_log("Unable to load the POS Developer credential record.");
        $record = null;
    }

    return $record;
}

function posDeveloperEnabled(): bool
{
    $record = posDeveloperDatabaseRecord();
    return is_array($record) && (int)($record["is_enabled"] ?? 0) === 1;
}

function posDeveloperUsername(): string
{
    return trim((string)(posDeveloperDatabaseRecord()["username"] ?? ""));
}

function posDeveloperSubject(): string
{
    $configured = trim((string)(
        posDeveloperDatabaseRecord()["subject_id"] ?? ""
    ));

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
    $configured = trim((string)(
        posDeveloperDatabaseRecord()["display_name"] ?? ""
    ));
    return $configured !== "" ? $configured : "POS Developer";
}

function posDeveloperEmail(): string
{
    $configured = trim((string)(
        posDeveloperDatabaseRecord()["email"] ?? ""
    ));

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
    $record = posDeveloperDatabaseRecord();

    return posDeveloperEnabled() &&
        is_array($record) &&
        posDeveloperUsername() !== "" &&
        posDeveloperSubject() !== "" &&
        trim((string)($record["password_hash"] ?? "")) !== "" &&
        (int)($record["subject_collision"] ?? 1) === 0 &&
        posDeveloperEnv("SECRET_KEY") !== "";
}

function posDeveloperUsernameMatches(string $username): bool
{
    $configuredUsername = posDeveloperUsername();
    if ($configuredUsername === "") {
        return false;
    }

    return hash_equals(
        strtolower($configuredUsername),
        strtolower(trim($username))
    );
}

function posDeveloperAuthenticate(string $username, string $password): bool
{
    if (
        !posDeveloperUsernameMatches($username) ||
        !posDeveloperConfigured()
    ) {
        return false;
    }

    $passwordHash = trim((string)(
        posDeveloperDatabaseRecord()["password_hash"] ?? ""
    ));
    return $password !== "" &&
        strlen($password) <= 72 &&
        password_verify($password, $passwordHash);
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
    if (!posDeveloperConfigured()) {
        return "";
    }

    $record = posDeveloperDatabaseRecord();
    $versionMaterial = trim((string)($record["password_hash"] ?? ""));
    $credentialVersion = max(
        1,
        (int)($record["credential_version"] ?? 1)
    );

    // Version 1 intentionally matches the former private-file token
    // fingerprint so migrating the same bcrypt hash does not end live
    // Developer sessions. Incrementing credential_version revokes them.
    if ($credentialVersion > 1) {
        $versionMaterial .= "\0" . (string)$credentialVersion;
    }

    return substr(hash_hmac(
        "sha256",
        $versionMaterial,
        posDeveloperEnv("SECRET_KEY")
    ), 0, 24);
}

function posDeveloperTokenIsValid(array $payload): bool
{
    if (
        ($payload["pos_developer_mode"] ?? false) !== true ||
        !posDeveloperConfigured()
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
