<?php

class AccountingFileLinksGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /**
     * GET ALL ACTIVE
     */
    public function getAllData()
    {
        try {
            $sql = "SELECT 
                        seq,
                        menutransactedref,
                        filelink,
                        deletestatus,
                        usertracker,
                        createdtime
                    FROM tbl_accounting_file_url_link
                    WHERE deletestatus = 'Active'
                    ORDER BY seq DESC";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $data[] = $row;
            }

            return $data;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Read error",
                "error" => $e->getMessage(),
            ]);
            exit;
        }
    }

    /**
     * READ ONE ACTIVE LINK BY REFERENCE
     */
    public function getByReference(string $reference)
    {
        try {
            $sql = "SELECT 
                        seq,
                        menutransactedref,
                        filelink,
                        deletestatus,
                        usertracker,
                        createdtime
                    FROM tbl_accounting_file_url_link
                    WHERE menutransactedref = :reference
                      AND deletestatus = 'Active'
                    ORDER BY seq DESC
                    LIMIT 1";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
            $stmt->execute();

            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                return [
                    "message" => "No Data",
                    "reference" => $reference,
                    "filelink" => "",
                ];
            }

            return [
                "message" => "Success",
                "data" => $row,
            ];
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Read by reference error",
                "error" => $e->getMessage(),
            ]);
            exit;
        }
    }

    /**
     * READ MANY ACTIVE LINKS BY REFERENCES
     * Useful for mapping into your cards later
     */
    public function getByReferences(array $references)
    {
        try {
            $cleanRefs = array_values(
                array_filter(
                    array_map(fn($r) => trim((string) $r), $references),
                    fn($r) => $r !== ""
                )
            );

            if (empty($cleanRefs)) {
                return [
                    "message" => "No Data",
                    "items" => [],
                ];
            }

            $placeholders = [];
            foreach ($cleanRefs as $index => $value) {
                $placeholders[] = ":ref" . $index;
            }

            $sql = "SELECT 
                        seq,
                        menutransactedref,
                        filelink,
                        deletestatus,
                        usertracker,
                        createdtime
                    FROM tbl_accounting_file_url_link
                    WHERE deletestatus = 'Active'
                      AND menutransactedref IN (" . implode(",", $placeholders) . ")
                    ORDER BY seq DESC";

            $stmt = $this->conn->prepare($sql);

            foreach ($cleanRefs as $index => $value) {
                $stmt->bindValue(":ref" . $index, $value, PDO::PARAM_STR);
            }

            $stmt->execute();

            $rows = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $rows[] = $row;
            }

            return [
                "message" => "Success",
                "items" => $rows,
            ];
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Read by references error",
                "error" => $e->getMessage(),
            ]);
            exit;
        }
    }

    /**
     * UPSERT:
     * - if reference already exists and Active => update filelink + usertracker
     * - else insert new row
     */
    public function createOrUpdateForUser($user_id, array $data)
    {
        try {
            $reference = trim((string) ($data["reference"] ?? ""));
            $link = trim((string) ($data["link"] ?? ""));

            if ($reference === "" || $link === "") {
                http_response_code(400);
                echo json_encode(["message" => "Reference and link are required"]);
                return;
            }

            $this->conn->beginTransaction();

            // Check existing active row by menutransactedref
            $checkSql = "SELECT seq
                         FROM tbl_accounting_file_url_link
                         WHERE menutransactedref = :reference
                           AND deletestatus = 'Active'
                         ORDER BY seq DESC
                         LIMIT 1";

            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->bindValue(":reference", $reference, PDO::PARAM_STR);
            $checkStmt->execute();

            $existingSeq = $checkStmt->fetchColumn();

            if ($existingSeq) {
                // UPDATE existing active row
                $updateSql = "UPDATE tbl_accounting_file_url_link
                              SET
                                  filelink = :filelink,
                                  usertracker = :usertracker
                              WHERE seq = :seq";

                $updateStmt = $this->conn->prepare($updateSql);
                $updateStmt->bindValue(":filelink", $link, PDO::PARAM_STR);
                $updateStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $updateStmt->bindValue(":seq", $existingSeq, PDO::PARAM_INT);
                $updateStmt->execute();

                $this->conn->commit();

                echo json_encode([
                    "message" => "Edited",
                    "reference" => $reference,
                    "link" => $link,
                ]);
                return;
            }

            // INSERT new
            $insertSql = "INSERT INTO tbl_accounting_file_url_link
                          (
                              menutransactedref,
                              filelink,
                              deletestatus,
                              usertracker,
                              createdtime
                          )
                          VALUES
                          (
                              :reference,
                              :filelink,
                              'Active',
                              :usertracker,
                              DATE_ADD(NOW(), INTERVAL 8 HOUR)
                          )";

            $insertStmt = $this->conn->prepare($insertSql);
            $insertStmt->bindValue(":reference", $reference, PDO::PARAM_STR);
            $insertStmt->bindValue(":filelink", $link, PDO::PARAM_STR);
            $insertStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $insertStmt->execute();

            $this->conn->commit();

            echo json_encode([
                "message" => "Success",
                "reference" => $reference,
                "link" => $link,
            ]);
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            echo json_encode([
                "message" => "Save error",
                "error" => $e->getMessage(),
            ]);
            exit;
        }
    }

    /**
     * Optional soft delete later if you want it
     */
    public function rejectForUser($user_id, string $reference)
    {
        try {
            $sql = "UPDATE tbl_accounting_file_url_link
                    SET
                        deletestatus = 'Inactive',
                        usertracker = :usertracker
                    WHERE menutransactedref = :reference
                      AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            echo json_encode(["message" => "Deleted"]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Delete error",
                "error" => $e->getMessage(),
            ]);
            exit;
        }
    }
}