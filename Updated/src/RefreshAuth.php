<?php

class RefreshAuth
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $codec;
    protected $user_gateway;


    private $user_id;
    private $token_data = [];

    public function __construct($user_gateway,
        $codec) {
        $this->user_gateway = $user_gateway;
        $this->codec = $codec;
    }

    public function getUserID()
    {
        return $this->user_id;
    }

    public function getTokenData(): array
    {
        return $this->token_data;
    }

    public function authenticateAccessToken()
    {
        $authorization = trim((string)(
            $_SERVER["HTTP_AUTHORIZATION"] ??
            $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] ??
            ""
        ));

        if (!preg_match("/^Bearer\s+(.+)$/i", $authorization, $matches)) {
            http_response_code(400);
            echo json_encode(["message" => "incomplete authorization header"]);
            return false;
        }

        try {
            $data = $this->codec->decode($matches[1]);

        } catch (InvalidSignatureException $e) {

            http_response_code(401);
            echo json_encode(["message" => "invalid signature"]);
            return false;

        } catch (TokenExpiredException $e) {

            http_response_code(401);
            echo json_encode(["message" => "refresh token has expired"]);
            return false;

        } catch (Exception $e) {

            http_response_code(400);
            echo json_encode(["message" => $e->getMessage()]);
            return false;
        }

        if (
            isset($data["token_type"]) &&
            $data["token_type"] !== "refresh"
        ) {
            http_response_code(401);
            echo json_encode(["message" => "invalid refresh token"]);
            return false;
        }

        $requestedDeveloperSession =
            ($data["pos_developer_mode"] ?? false) === true ||
            ($data["pos_developer_full_access"] ?? false) === true ||
            ($data["pos_developer_read_only"] ?? false) === true;

        if ($requestedDeveloperSession) {
            require_once dirname(__DIR__) . "/api/pos_developer_auth.php";
            if (
                ($data["token_type"] ?? "") !== "refresh" ||
                !posDeveloperFullAccessTokenIsValid($data)
            ) {
                http_response_code(401);
                echo json_encode([
                    "message" => "invalid developer session; please log in again"
                ]);
                return false;
            }
        }

        $this->token_data = $data;
        $this->user_id = $data["sub"];

        return true;
    }
}
