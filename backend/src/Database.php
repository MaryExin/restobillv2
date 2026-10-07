<?php

class Database
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $host;
    protected $name;
    protected $password;
    protected $user;
    protected $port;


    private $conn = null;

    public function __construct(
        $host,
        $name,
        $user,
        $password,
        $port = null
    ) {
        $this->host = $host;
        $this->name = $name;
        $this->user = $user;
        $this->password = $password;
        // Existing callers keep their default connection. The managed runtime
        // supplies DB_PORT for its local database without changing cloud ports.
        $localHost = $_ENV['DB_HOST'] ?? getenv('DB_HOST');
        $localUser = $_ENV['DB_USER'] ?? getenv('DB_USER');
        $this->port = (int)($port ?? ((string)$host === (string)$localHost && (string)$user === (string)$localUser
            ? ($_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: 3306)
            : 3306));
        if ($this->port < 1 || $this->port > 65535) {
            throw new InvalidArgumentException('Invalid database port.');
        }
    }

    public function getConnection(): PDO
    {
        if ($this->conn === null) {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->name};charset=utf8";

            $this->conn = new PDO($dsn, $this->user, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
        }

        return $this->conn;
    }
}
