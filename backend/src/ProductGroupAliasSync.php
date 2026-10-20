<?php

declare(strict_types=1);

/** Optional menu aliases; never changes the original product or historical sale. */
final class ProductGroupAliasSync
{
    private ?bool $installed = null;
    public function __construct(private PDO $conn) {}
    private function rows(string $sql, array $params = []): array
    {
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->columnCount() ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    }
    public function installed(): bool
    {
        if ($this->installed !== null) return $this->installed;
        try {
            $this->rows('SELECT source_build_code FROM tbl_pos_product_group_aliases WHERE 1=0');
            return $this->installed = true;
        } catch (PDOException $error) {
            if ((string) $error->getCode() !== '42S02' && (int) ($error->errorInfo[1] ?? 0) !== 1146) throw $error;
            return $this->installed = false;
        }
    }
    public function read(array $codes): array
    {
        if (!$codes || !$this->installed()) return [];
        $rows = $this->rows('SELECT source_build_code,canonical_build_code,size_id,enabled FROM tbl_pos_product_group_aliases WHERE source_build_code IN (' . implode(',', array_fill(0, count($codes), '?')) . ')', $codes);
        $result = [];
        foreach ($rows as $row) $result[$row['source_build_code']] = ['canonical_build_code' => (string) $row['canonical_build_code'], 'size_id' => (string) $row['size_id'], 'enabled' => (bool) $row['enabled']];
        return $result;
    }
    public function forCanonical(array $codes): array
    {
        if (!$codes || !$this->installed()) return [];
        $rows = $this->rows('SELECT source_build_code,canonical_build_code,size_id FROM tbl_pos_product_group_aliases WHERE enabled=1 AND canonical_build_code IN (' . implode(',', array_fill(0, count($codes), '?')) . ') ORDER BY source_build_code', $codes);
        $result = [];
        foreach ($rows as $row) $result[$row['canonical_build_code']][] = ['source_build_code' => (string) $row['source_build_code'], 'size_id' => (string) $row['size_id']];
        return $result;
    }
    public static function code(mixed $value, bool $required = true): string
    {
        if (!is_string($value) || strlen($value) > 64 || ($required && trim($value) === '') || preg_match('/[\x00-\x1F\x7F]/', $value)) throw new InvalidArgumentException('Invalid grouped product mapping. Refresh before saving.');
        return trim($value);
    }
    public static function changes(array $rows): array
    {
        $result = [];
        $sourceKeys = [];
        foreach ($rows as $row) {
            $action = $row['action'] ?? '';
            $online = $row['online'] ?? null;
            if ($action !== 'inactive_product' && (!in_array($action, ['new_product', 'price_change', 'group_change'], true) || !is_array($online) || !array_key_exists('group_alias', $online))) continue;
            $code = self::code($row['product_id'] ?? null);
            $key = strtolower($code);
            $code = $sourceKeys[$key] ?? $code;
            $sourceKeys[$key] = $code;
            $alias = $action === 'inactive_product' ? null : $online['group_alias'];
            if ($alias !== null) {
                if (!is_array($alias) || !is_bool($alias['enabled'] ?? null)) throw new InvalidArgumentException('Product mapping switches must be true or false.');
                $alias = ['canonical_build_code' => self::code($alias['canonical_build_code'] ?? null), 'size_id' => self::code($alias['size_id'] ?? '', false), 'enabled' => $alias['enabled']];
                if (strcasecmp($code, $alias['canonical_build_code']) === 0) throw new InvalidArgumentException('A product cannot map to itself.');
            }
            if (array_key_exists($code, $result) && $result[$code] !== $alias) throw new InvalidArgumentException('Product mappings differ across price lists. Refresh product sync.');
            $result[$code] = $alias;
        }
        return $result;
    }
    /** Apply after groups/sizes, inside the catalog transaction. Partial sync is
     * valid: an absent target keeps the source visible until that target is ready. */
    public function apply(array $rows, string $userId): int
    {
        $changes = self::changes($rows);
        if (!$changes) return 0;
        if (!$this->installed()) {
            foreach ($changes as $alias) if (!empty($alias['enabled'])) throw new RuntimeException('Install the product group aliases update on this POS before syncing.');
            return 0;
        }
        if (!$this->conn->inTransaction()) throw new LogicException('Product mappings must sync with the catalog transaction.');
        // Serialize the small optional mapping set; this also protects cross-target chains.
        $existing = array_column($this->rows('SELECT * FROM tbl_pos_product_group_aliases FOR UPDATE'), null, 'source_build_code');
        $active = [];
        foreach ($existing as $code => $alias) if ($alias['enabled']) $active[strtolower($code)] = strtolower($alias['canonical_build_code']);
        $count = 0;
        foreach ($changes as $code => $alias) {
            unset($active[strtolower($code)]);
            if (!empty($alias['enabled'])) $active[strtolower($code)] = strtolower($alias['canonical_build_code']);
        }
        foreach ($active as $source => $target) if ($source === $target || isset($active[$target])) throw new InvalidArgumentException('Product mappings cannot form a chain or cycle.');
        foreach ($changes as $code => $alias) {
            if (!empty($alias['enabled'])) {
                $config = $this->rows('SELECT enabled FROM tbl_pos_product_groups WHERE build_code=? FOR UPDATE', [$code]);
                if (!empty($config[0]['enabled'])) throw new InvalidArgumentException('A grouped product cannot also be a mapped source.');
            }
            if ($alias === null) {
                if (!isset($existing[$code])) continue;
                $this->rows('UPDATE tbl_pos_product_group_aliases SET enabled=0,revision=revision+1,usertracker=? WHERE source_build_code=?', [$userId, $code]);
                $count++;
                continue;
            }
            $this->rows('INSERT INTO tbl_pos_product_group_aliases (source_build_code,canonical_build_code,size_id,enabled,usertracker) VALUES (?,?,?,?,?)
                ON DUPLICATE KEY UPDATE canonical_build_code=VALUES(canonical_build_code),size_id=VALUES(size_id),enabled=VALUES(enabled),revision=revision+1,usertracker=VALUES(usertracker)', [$code, $alias['canonical_build_code'], $alias['size_id'], (int) $alias['enabled'], $userId]);
            $count++;
        }
        return $count;
    }
}
