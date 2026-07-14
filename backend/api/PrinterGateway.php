<?php

/**
 * PrinterGateway handles CRUD operations for tbl_pos_printers.
 * It follows the pattern of injecting a Database object and using PDO.
 */
class PrinterGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /**
     * Fetch all active printers.
     */
    public function getAll(): array
    {
        $sql = "SELECT * FROM tbl_pos_printers WHERE deletestatus = 'Active' ORDER BY sequence_order ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch a specific printer by its sequence ID.
     */
    public function getById(string $id): array|bool
    {
        $sql = "SELECT * FROM tbl_pos_printers WHERE seq = :id AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Create a new printer record.
     */
    public function create(array $data, string $user_id): string
    {
        $sql = "INSERT INTO tbl_pos_printers (
                    printer_name, printer_type, doc_type, sequence_order, 
                    category_code, unit_code, terminal_number, usertracker
                ) VALUES (
                    :name, :type, :doc, :seq_order, 
                    :cat, :unit, :terminal, :user
                )";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(":name", $data["printer_name"], PDO::PARAM_STR);
        $stmt->bindValue(":type", $data["printer_type"], PDO::PARAM_STR);
        $stmt->bindValue(":doc", $data["doc_type"], PDO::PARAM_STR);
        $stmt->bindValue(":seq_order", $data["sequence_order"] ?? 1, PDO::PARAM_INT);
        $stmt->bindValue(":cat", $data["category_code"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":unit", $data["unit_code"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":terminal", $data["terminal_number"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":user", $user_id, PDO::PARAM_STR);
        
        $stmt->execute();
        
        return $this->conn->lastInsertId();
    }

    /**
     * Update an existing printer record.
     */
    public function update(string $id, array $data, string $user_id): int
    {
        $sql = "UPDATE tbl_pos_printers
                SET printer_name = :name,
                    printer_type = :type,
                    doc_type = :doc,
                    sequence_order = :seq_order,
                    category_code = :cat,
                    unit_code = :unit,
                    terminal_number = :terminal,
                    usertracker = :user
                WHERE seq = :id";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(":name", $data["printer_name"], PDO::PARAM_STR);
        $stmt->bindValue(":type", $data["printer_type"], PDO::PARAM_STR);
        $stmt->bindValue(":doc", $data["doc_type"], PDO::PARAM_STR);
        $stmt->bindValue(":seq_order", $data["sequence_order"] ?? 1, PDO::PARAM_INT);
        $stmt->bindValue(":cat", $data["category_code"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":unit", $data["unit_code"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":terminal", $data["terminal_number"] ?? null, PDO::PARAM_STR);
        $stmt->bindValue(":user", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        
        $stmt->execute();
        
        return $stmt->rowCount();
    }

    /**
     * Soft delete a printer record.
     */
    public function delete(string $id, string $user_id): int
    {
        $sql = "UPDATE tbl_pos_printers
                SET deletestatus = 'Inactive',
                    usertracker = :user
                WHERE seq = :id";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":user", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        
        $stmt->execute();
        
        return $stmt->rowCount();
    }
}