<?php

declare(strict_types=1);

require_once __DIR__ . '/ProductGroupSizeSync.php';
require_once __DIR__ . '/ProductGroupAliasSync.php';

/** Optional product-group metadata shared by WEB export and local catalog sync. */
final class ProductGroupSyncMetadata
{
    private ?bool $installed = null;
    private ?bool $localInstalled = null;

    public function __construct(private PDO $conn) {}

    public function isInstalled(): bool
    {
        if ($this->installed !== null) return $this->installed;
        try {
            $this->conn->query('SELECT build_code FROM tbl_pos_product_groups WHERE 1=0');
            return $this->installed = true;
        } catch (PDOException $error) {
            if ((string) $error->getCode() !== '42S02' && (int) ($error->errorInfo[1] ?? 0) !== 1146) throw $error;
            return $this->installed = false;
        }
    }

    /** The restaurant POS also needs its order-selection snapshot table. */
    public function isLocalInstalled(): bool
    {
        if ($this->localInstalled !== null) return $this->localInstalled;
        if (!$this->isInstalled()) return $this->localInstalled = false;
        try {
            $this->conn->query('SELECT pos_detail_id FROM tbl_pos_product_group_selections WHERE 1=0');
            return $this->localInstalled = true;
        } catch (PDOException $error) {
            if ((string) $error->getCode() !== '42S02' && (int) ($error->errorInfo[1] ?? 0) !== 1146) throw $error;
            return $this->localInstalled = false;
        }
    }

    public function annotate(array $rows, string $codeField = 'product_id'): array
    {
        // An older source sends no keys, so its ordinary sync cannot erase a
        // configuration. An installed source sends explicit null for ungrouped products.
        if (!$rows || !$this->isInstalled()) return $rows;
        $codes = array_values(array_unique(array_filter(array_map(static fn (array $row): string => trim((string) ($row[$codeField] ?? '')), $rows))));
        if (!$codes) return $rows;
        $statement = $this->conn->prepare('SELECT * FROM tbl_pos_product_groups WHERE build_code IN (' . implode(',', array_fill(0, count($codes), '?')) . ')');
        $statement->execute($codes);
        $configs = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $config) $configs[(string) $config['build_code']] = $config;
        $sizes = (new ProductGroupSizeSync($this->conn))->read($codes);
        $sizeInstalled = (new ProductGroupSizeSync($this->conn))->installed();
        $aliasHelper = new ProductGroupAliasSync($this->conn);
        $aliases = $aliasHelper->read($codes);
        $priceCounts = [];
        foreach ($rows as $row) {
            $key = (string) ($row[$codeField] ?? '') . '|' . (string) ($row['pricing_code'] ?? '');
            $priceCounts[$key] = ($priceCounts[$key] ?? 0) + 1;
        }
        foreach ($rows as &$row) {
            $config = $configs[(string) ($row[$codeField] ?? '')] ?? null;
            $row['product_group'] = $config ? [
                'name' => (string) $config['group_name'], 'enabled' => (bool) $config['enabled'],
                'allow_half' => (bool) $config['allow_half'], 'allow_half_and_half' => (bool) $config['allow_half_and_half'],
            ] : null;
            $row['group_size'] = (string) ($config['size_name'] ?? '');
            $row['group_variant'] = (string) ($config['variant_name'] ?? '');
            if ($aliasHelper->installed()) $row['group_alias'] = $aliases[(string) ($row[$codeField] ?? '')] ?? null;
            if ($config && $sizeInstalled && (string) $config['size_name'] === '') {
                $row['group_sizes'] = $sizes[(string) $row[$codeField]] ?? [];
            }
            $key = (string) ($row[$codeField] ?? '') . '|' . (string) ($row['pricing_code'] ?? '');
            if (!empty($config['enabled']) && isset($row['pricing_code']) && ($priceCounts[$key] ?? 0) > 1) {
                $row['group_price_error'] = 'More than one active price exists for this grouped product. Fix Price Assignment before syncing.';
            }
        }
        unset($row);
        return $rows;
    }

    /** Fail before catalog writes on an older local installation. Ordinary sync is unchanged. */
    public function assertReadyForEnabledSync(array $rows): void
    {
        $enabled = false;
        $hasSizes = false;
        $hasAliases = false;
        $aliasChanges = ProductGroupAliasSync::changes($rows);
        foreach ($aliasChanges as $alias) if (!empty($alias['enabled'])) $hasAliases = true;
        // An explicit removal is a write too, but ordinary rows with no saved
        // mapping must still work on clients without this optional update.
        $savedAliases = (new ProductGroupAliasSync($this->conn))->read(array_keys($aliasChanges));
        if ($savedAliases) $hasAliases = true;
        foreach ($rows as $row) {
            if (!in_array($row['action'] ?? '', ['new_product', 'price_change', 'group_change'], true)) continue;
            $group = $row['online']['product_group'] ?? null;
            if (is_array($group) && ($group['enabled'] ?? null) === true) $enabled = true;
            if (array_key_exists('group_sizes', $row['online'] ?? [])) $hasSizes = true;
        }
        if (!$enabled && !$hasSizes && !$hasAliases) return;
        if ($hasAliases && !(new ProductGroupAliasSync($this->conn))->installed()) throw new RuntimeException('Install the product group aliases update on this POS before syncing.');
        if ($hasSizes && !(new ProductGroupSizeSync($this->conn))->installed()) throw new RuntimeException('Install the product sizes update on this POS before syncing.');
        if (!$this->isLocalInstalled()) throw new RuntimeException('Product groups are not installed in this POS. Apply the local product-groups migration, then sync again.');
        $required = ['tbl_inventory_products_masterlist', 'tbl_pricing_details', 'tbl_pos_product_groups', 'tbl_pos_product_group_selections', 'lkp_sales_type', 'tbl_pricing_by_sales_type'];
        if ($hasSizes) $required = array_merge($required, ['tbl_pos_product_group_sizes', 'tbl_pos_product_group_size_prices', 'tbl_pos_product_group_size_components']);
        if ((new ProductGroupAliasSync($this->conn))->installed()) $required[] = 'tbl_pos_product_group_aliases';
        $tables = $this->conn->query("SHOW TABLE STATUS WHERE Name IN ('" . implode("','", $required) . "')")->fetchAll(PDO::FETCH_ASSOC);
        $engines = [];
        foreach ($tables as $table) $engines[(string) $table['Name']] = strtoupper((string) $table['Engine']);
        foreach ($required as $table) {
            if (($engines[$table] ?? '') !== 'INNODB') {
                throw new RuntimeException('This POS needs the transactional catalog update before syncing enabled product groups. Ask your administrator to update the local catalog storage, then sync again.');
            }
        }
    }

    /** Called inside the same transaction as the local product and price writes. */
    public function apply(array $rows, string $userId): int
    {
        $configs = [];
        $sizeConfigs = [];
        foreach ($rows as $row) {
            $action = (string) ($row['action'] ?? '');
            $code = trim((string) ($row['product_id'] ?? ''));
            $online = $row['online'] ?? null;
            if ($code === '') continue;
            if ($action === 'inactive_product') {
                $configs[$code] = null;
                continue;
            }
            if (!in_array($action, ['new_product', 'price_change', 'group_change'], true) || !is_array($online)
                || !array_key_exists('product_group', $online)) continue;
            $group = $online['product_group'];
            $sized = array_key_exists('group_sizes', $online);
            if ($sized) {
                $nextSizes = ProductGroupSizeSync::validate($online['group_sizes']);
                if (isset($sizeConfigs[$code]) && $sizeConfigs[$code] !== $nextSizes) throw new InvalidArgumentException('Size settings differ across exported price lists. Refresh the sync preview.');
                $sizeConfigs[$code] = $nextSizes;
            }
            if ($group === null) {
                $next = null;
            } else {
                if (!is_array($group)) throw new InvalidArgumentException('The product grouping export is invalid. Refresh the sync preview.');
                foreach (['enabled', 'allow_half', 'allow_half_and_half'] as $flag) {
                    if (!is_bool($group[$flag] ?? null)) throw new InvalidArgumentException('The product grouping switches must be true or false.');
                }
                if ($group['enabled'] && !empty($online['group_price_error'])) throw new InvalidArgumentException((string) $online['group_price_error']);
                $next = [
                    'enabled' => (int) $group['enabled'],
                    'group_name' => self::label($group['name'] ?? '', 100, $group['enabled']),
                    'size_name' => $sized ? '' : self::label($online['group_size'] ?? '', 64, $group['enabled']),
                    'variant_name' => self::label($online['group_variant'] ?? '', 100, $group['enabled']),
                    'allow_half' => (int) $group['allow_half'], 'allow_half_and_half' => (int) $group['allow_half_and_half'],
                ];
            }
            if (array_key_exists($code, $configs) && $configs[$code] !== $next) throw new InvalidArgumentException('The exported product grouping is inconsistent across price lists. Refresh the sync preview.');
            $configs[$code] = $next;
        }
        if (!$configs) return (new ProductGroupAliasSync($this->conn))->apply($rows, $userId);
        if (!$this->isInstalled()) {
            foreach ($configs as $config) {
                if (!empty($config['enabled'])) throw new RuntimeException('Product groups are not installed in this POS. Apply the local product-groups migration, then sync again.');
            }
            return (new ProductGroupAliasSync($this->conn))->apply($rows, $userId);
        }
        if (!$this->conn->inTransaction()) throw new LogicException('Product groups must sync with the catalog transaction.');
        $codes = array_keys($configs);
        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        $statement = $this->conn->prepare("SELECT build_code FROM tbl_pos_product_groups WHERE build_code IN ($placeholders) FOR UPDATE");
        $statement->execute($codes);
        $existing = array_fill_keys($statement->fetchAll(PDO::FETCH_COLUMN), true);
        // Release only the selected products' unique labels before applying the
        // complete selection, so renamed/swapped variants can sync atomically.
        $statement = $this->conn->prepare("UPDATE tbl_pos_product_groups SET enabled=0 WHERE build_code IN ($placeholders)");
        $statement->execute($codes);
        $count = 0;
        $aliasChanges = ProductGroupAliasSync::changes($rows);
        $savedAliases = (new ProductGroupAliasSync($this->conn))->read($codes);
        foreach ($configs as $code => $config) {
            $alias = array_key_exists($code, $aliasChanges) ? $aliasChanges[$code] : ($savedAliases[$code] ?? null);
            if (!empty($config['enabled']) && !empty($alias['enabled'])) throw new InvalidArgumentException('A grouped product cannot also be a mapped source. Remove its mapping first.');
            if ($config === null) {
                if (!isset($existing[$code])) continue;
                $statement = $this->conn->prepare('UPDATE tbl_pos_product_groups SET enabled=0,revision=revision+1,usertracker=:user WHERE build_code=:code');
                $statement->execute([':code' => $code, ':user' => $userId]);
            } else {
                $sql = isset($existing[$code])
                    ? "UPDATE tbl_pos_product_groups SET scope_key='',enabled=:enabled,group_name=:group_name,size_name=:size_name,
                        variant_name=:variant_name,allow_half=:allow_half,allow_half_and_half=:allow_half_and_half,revision=revision+1,usertracker=:user WHERE build_code=:code"
                    : "INSERT INTO tbl_pos_product_groups (build_code,scope_key,enabled,group_name,size_name,variant_name,allow_half,allow_half_and_half,usertracker)
                        VALUES (:code,'',:enabled,:group_name,:size_name,:variant_name,:allow_half,:allow_half_and_half,:user)";
                $statement = $this->conn->prepare($sql);
                $statement->execute(array_merge($config, ['code' => $code, 'user' => $userId]));
            }
            if (isset($sizeConfigs[$code])) (new ProductGroupSizeSync($this->conn))->apply($code, $sizeConfigs[$code]);
            $count++;
        }
        return $count + (new ProductGroupAliasSync($this->conn))->apply($rows, $userId);
    }

    private static function label(mixed $value, int $limit, bool $required): string
    {
        if (!is_string($value)) throw new InvalidArgumentException('Invalid product group labels.');
        $value = trim($value);
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if (($required && $value === '') || $length > $limit || preg_match('/[\x00-\x1F\x7F]/u', $value)) {
            throw new InvalidArgumentException('Invalid product group labels. Refresh the sync preview.');
        }
        return $value;
    }
}
