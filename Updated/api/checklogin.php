<?php

//PHP to CRUD Tasks End Point

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/pos_role_identity.php";
require_once __DIR__ . "/pos_developer_auth.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById
$user_gateway = new UserGateway($database);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Initialize Auth, methods: authenticateAccessToken, getUserID

$auth = new RefreshAuth($user_gateway, $codec);

//Method of auth checking if token is invalid signature or expired
if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();
$refreshTokenData = $auth->getTokenData();
$requestedDeveloperSession =
    ($refreshTokenData["pos_developer_mode"] ?? false) === true;
$isDeveloperSession = posDeveloperFullAccessTokenIsValid($refreshTokenData);

if ($requestedDeveloperSession && !$isDeveloperSession) {
    http_response_code(401);
    echo json_encode(["message" => "invalid developer session"]);
    exit;
}

$authorization = trim((string)(
    $_SERVER["HTTP_AUTHORIZATION"] ??
    $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] ??
    ""
));

if (!preg_match("/^Bearer\s+(.+)$/i", $authorization, $matches)) {
    http_response_code(400);
    echo json_encode(["message" => "invalidAuthorizationHeader"]);
    return false;
}

$refresh_token_gateway = new RefreshTokenGateway($database, $_ENV["SECRET_KEY"]);

$refresh_token = $refresh_token_gateway->getByToken($matches[1]);

if ($refresh_token === false) {

    http_response_code(400);
    echo json_encode(["message" => "refreshTokenNotIntheList"]);
    exit;
}

try {
    if ($isDeveloperSession) {
        $user = posDeveloperVirtualUser();
    } else {
        $conn = $database->getConnection();

        $sql = "SELECT tbl_users_global_assignment.* , tbl_employees.image_filename

                FROM tbl_users_global_assignment
                
                LEFT OUTER JOIN tbl_employees ON tbl_users_global_assignment.uuid =  tbl_employees.empid

                WHERE tbl_users_global_assignment.uuid = :userid
                
                AND tbl_users_global_assignment.deletestatus = 'Active'";

        $stmt = $conn->prepare($sql);

        $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!is_array($user)) {
        http_response_code(401);
        echo json_encode(["message" => "invalid authentication"]);
        exit;
    }

    //Get User Role

    $userId = $user["uuid"];

    $userProfilePic = $user["image_filename"];

    $email = $user["email"];

    $userRole = prependPosRoleIdentity(
        $isDeveloperSession ? [] : $user_gateway->getRole($userId),
        $user["classification"] ?? $user["department"] ?? ""
    );

    // Initialize payload and refresh token, echo out jwt tokens in local storage

    require __DIR__ . "/accesstoken.php";

    // // Initialize refresh token with methods: crud for refresh token

    // $refresh_token_gateway = new RefreshTokenGateway($database, $_ENV["SECRET_KEY"]);

    // // Create refresh token in refresh_token table

    // $refresh_token_gateway->create($refresh_token, $refresh_token_expiry);

    // $refresh_token_gateway->delete($matches[1]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
    return false;
}
