<?php

class OTP
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $otp;


    public function __construct()
    {
        $this->otp = 0;
    }

    public function generateOTP()
    {
        // Generate a random 6-digit number
        $randomDigits = rand(100000, 999999);

        // Ensure it's exactly 6 digits by padding with zeros if needed
        $randomDigits = str_pad($randomDigits, 6, '0', STR_PAD_LEFT);

        $this->otp = $randomDigits;

        return $this->otp;
    }

    public function verifyReadOTP($database, $username, $otp)
    {
        try {
            $conn = $database->getConnection();

            $sql = "SELECT * FROM tbl_users_global_assignment WHERE email = :username AND otp = :otp";

            $stmt = $conn->prepare($sql);

            $stmt->bindValue(":username", $username, PDO::PARAM_STR);
            $stmt->bindValue(":otp", $otp, PDO::PARAM_INT);

            $stmt->execute();

            $data = $stmt->fetch(PDO::FETCH_ASSOC);

            return $data;

        } catch (Exception $e) {
            return false;
        }

    }

    public function setOTP($database, $userId, $otp)
    {
        try {
            $conn = $database->getConnection();

            $sql = "UPDATE tbl_users_global_assignment
                    SET  otp = $otp
                    WHERE uuid = :id";

            $stmt = $conn->prepare($sql);

            $stmt->bindValue(":id", $userId, PDO::PARAM_STR);

            $stmt->execute();

            return true;

        } catch (Exception $e) {
            return false;
        }

    }
}
