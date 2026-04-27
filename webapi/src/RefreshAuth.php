<?php

class RefreshAuth
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $codec;
    protected $user_gateway;


    private $user_id;

    public function __construct($user_gateway,
        $codec) {
        $this->user_gateway = $user_gateway;
        $this->codec = $codec;
    }

    public function getUserID()
    {
        return $this->user_id;
    }

    public function authenticateAccessToken()
    {
        if (!preg_match("/^Bearer\s+(.*)$/", $_SERVER["HTTP_AUTHORIZATION"], $matches)) {
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

        $this->user_id = $data["sub"];

        return true;
    }
}
