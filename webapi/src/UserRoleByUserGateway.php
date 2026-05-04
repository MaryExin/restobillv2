<?php

declare(strict_types=1);

final class UserRoleByUserGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = self::extractPdo($database);
    }

    /**
     * @return array<int, array{rolename: string}>
     */
    public function getForUser(int|string $userId): array
    {
        $sql = "SELECT rolename FROM tbl_user_roles
                WHERE deletestatus = 'Active'
                  AND userid = :userid";

        $stmt = $this->conn->prepare($sql);

        // Use INT binding when possible; fallback to STR.
        if (is_int($userId) || ctype_digit((string) $userId)) {
            $stmt->bindValue(":userid", (int) $userId, PDO::PARAM_INT);
        } else {
            $stmt->bindValue(":userid", (string) $userId, PDO::PARAM_STR);
        }

        $stmt->execute();

        /** @var array<int, array{rolename: string}> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return $rows;
    }

    private static function extractPdo(Database $database): PDO
    {
        // Common patterns in "Database" wrappers across PHP projects.
        foreach (["getConnection", "get_connection", "connection", "connect", "getConn"] as $method) {
            if (method_exists($database, $method)) {
                $pdo = $database->{$method}();
                if ($pdo instanceof PDO) {
                    return $pdo;
                }
            }
        }

        // Some projects expose a public PDO property.
        foreach (["conn", "pdo", "connection"] as $prop) {
            if (property_exists($database, $prop)) {
                /** @phpstan-ignore-next-line */
                $pdo = $database->{$prop};
                if ($pdo instanceof PDO) {
                    return $pdo;
                }
            }
        }

        throw new RuntimeException("Unable to obtain PDO connection from Database wrapper.");
    }
}
