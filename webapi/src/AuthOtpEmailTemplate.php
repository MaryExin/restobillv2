<?php

class AuthOtpEmailTemplate
{
    public static function render(array $config): string
    {
        $recipientName = self::escape(
            self::cleanName($config["recipientName"] ?? "User")
        );
        $otp = self::escape((string) ($config["otp"] ?? ""));
        $title = self::escape((string) ($config["title"] ?? "Your One-Time Password"));
        $eyebrow = self::escape((string) ($config["eyebrow"] ?? "Secure access confirmation"));
        $intro = self::escape((string) ($config["intro"] ?? "Use the one-time password below to continue."));
        $helperText = self::escape((string) ($config["helperText"] ?? "This code helps us confirm it is really you."));
        $actionText = self::escape((string) ($config["actionText"] ?? "Use this code to continue your request."));
        $footerBrand = self::escape((string) ($config["footerBrand"] ?? "Exinnov Team"));
        $supportText = self::escape((string) ($config["supportText"] ?? "If you did not request this code, you can ignore this email."));
        $logoUrl = self::escape((string) ($config["logoUrl"] ?? "https://exinnovph.com/images/app/logo.png"));
        $year = date("Y");

        return "<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <title>{$title}</title>
</head>
<body style='margin:0; padding:0; background-color:#edf2ec;'>
    <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:linear-gradient(180deg, #0f5a43 0%, #184f3b 36%, #edf2ec 36%, #edf2ec 100%); margin:0; padding:24px 12px;'>
        <tr>
            <td align='center'>
                <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:640px; font-family:Arial, Helvetica, sans-serif; color:#173c2d;'>
                    <tr>
                        <td style='padding:0 0 18px; text-align:center;'>
                            <img src='{$logoUrl}' alt='Exinnov Logo' width='104' style='display:block; margin:0 auto 12px;'>
                            <div style='font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#f3d777; font-weight:700;'>{$eyebrow}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style='background-color:#0f5a43; border:1px solid #d4af37; border-bottom:none; border-radius:28px 28px 0 0; padding:32px 32px 24px;'>
                            <div style='font-size:28px; line-height:1.2; color:#ffffff; font-weight:700; margin:0 0 10px;'>{$title}</div>
                            <div style='font-size:15px; line-height:1.7; color:#d8eadf; margin:0;'>{$intro}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style='background-color:#fffdf7; border:1px solid #d9c27a; border-top:none; border-radius:0 0 28px 28px; padding:32px; box-shadow:0 18px 42px rgba(15, 90, 67, 0.12);'>
                            <div style='font-size:18px; line-height:1.6; color:#173c2d; margin:0 0 18px;'>
                                Dear <strong style='color:#0f5a43;'>{$recipientName}</strong>,
                            </div>
                            <div style='font-size:15px; line-height:1.8; color:#4b5f55; margin:0 0 24px;'>
                                {$helperText}
                            </div>
                            <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:0 0 24px;'>
                                <tr>
                                    <td align='center' style='padding:0;'>
                                        <div style='display:inline-block; min-width:228px; padding:16px 24px; border-radius:18px; background:linear-gradient(135deg, #f5d879 0%, #d4af37 100%); border:1px solid #b8911b; color:#143b2c; font-size:34px; line-height:1; letter-spacing:8px; font-weight:700; text-align:center;'>
                                            {$otp}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            <div style='font-size:15px; line-height:1.8; color:#4b5f55; margin:0 0 24px;'>
                                {$actionText}
                            </div>
                            <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:0 0 24px;'>
                                <tr>
                                    <td style='background-color:#163f31; border-radius:18px; padding:18px 20px;'>
                                        <div style='font-size:13px; line-height:1.8; color:#e6efe9;'>
                                            <strong style='color:#f3d777;'>Security note:</strong> {$supportText}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            <div style='font-size:14px; line-height:1.8; color:#4b5f55; margin:0;'>
                                Thank you,<br>
                                <strong style='color:#0f5a43;'>{$footerBrand}</strong>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding:18px 12px 0; text-align:center; font-size:12px; line-height:1.7; color:#5f6f67;'>
                            <span style='color:#0f5a43; font-weight:700;'>Exinnov</span> | Secure account verification<br>
                            &copy; {$year} Exinnov. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private static function cleanName(string $name): string
    {
        $name = trim($name);

        if ($name === "") {
            return "User";
        }

        return ucwords(strtolower($name));
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, "UTF-8");
    }
}
