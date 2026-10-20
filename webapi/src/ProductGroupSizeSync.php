<?php

declare(strict_types=1);

/** Optional size catalog. All identities remain children of a real master product. */
final class ProductGroupSizeSync
{
    private ?bool $installed = null;
    public function __construct(private PDO $conn) {}
    private static function scope(string $kind, string $column): string
    {
        return class_exists('SoloModeGuard', false) ? SoloModeGuard::sqlScope($kind, $column) : '';
    }
    private function rows(string $sql, array $values = []): array
    {
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($values);
        return $stmt->columnCount() ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    }
    public function installed(): bool
    {
        if ($this->installed !== null) return $this->installed;
        try {
            foreach (['tbl_pos_product_group_sizes', 'tbl_pos_product_group_size_prices', 'tbl_pos_product_group_size_components'] as $table) {
                $this->rows("SELECT size_id FROM $table WHERE 1=0");
            }
            return $this->installed = true;
        } catch (PDOException $error) {
            if ((string) $error->getCode() !== '42S02' && (int) ($error->errorInfo[1] ?? 0) !== 1146) throw $error;
            return $this->installed = false;
        }
    }
    public function read(array $codes): array
    {
        if (!$codes || !$this->installed()) return [];
        $marks = implode(',', array_fill(0, count($codes), '?'));
        $sizes = $this->rows("SELECT * FROM tbl_pos_product_group_sizes WHERE build_code IN ($marks) ORDER BY sort_order,size_name,size_id", $codes);
        if (!$sizes) return [];
        $ids = array_column($sizes, 'size_id');
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $prices = [];
        foreach ($this->rows("SELECT * FROM tbl_pos_product_group_size_prices WHERE size_id IN ($marks) ORDER BY pricing_category", $ids) as $row) {
            $prices[$row['size_id']][] = ['pricing_category' => (string) $row['pricing_category'], 'srp' => (string) $row['srp'], 'cost_per_uom' => (string) $row['cost_per_uom']];
        }
        $components = [];
        // Keep the data columns explicit so revision/audit columns cannot leak into sync comparisons.
        foreach ($this->rows("SELECT size_id,component_code,component_class,qty,description,uom,uomval,category,cost_per_uom FROM tbl_pos_product_group_size_components WHERE size_id IN ($marks) ORDER BY component_class,component_code", $ids) as $row) {
            $id = $row['size_id']; unset($row['size_id']);
            $components[$id][] = $row;
        }
        $result = [];
        foreach ($sizes as $row) {
            $result[$row['build_code']][] = [
                'size_id' => (string) $row['size_id'], 'size_name' => (string) $row['size_name'],
                'enabled' => (bool) $row['enabled'], 'recipe_configured' => (bool) $row['recipe_configured'],
                'sort_order' => (int) $row['sort_order'], 'prices' => $prices[$row['size_id']] ?? [],
                'components' => $components[$row['size_id']] ?? [],
            ];
        }
        return $result;
    }
    /** Add size-priced products even when they have no ordinary base-price row. */
    public function sourceRows(array $rows, array $pricingCodes): array
    {
        if (!$pricingCodes || !$this->installed()) return $rows;
        $marks = implode(',', array_fill(0, count($pricingCodes), '?'));
        $sizedRows = $this->rows("SELECT p.build_code product_id,p.productcode,p.build_code,p.`desc` item_name,
            p.category item_category,p.uom unit_of_measure,p.uomval unit_value,MIN(sp.cost_per_uom) unit_cost,
            MIN(sp.srp) selling_price,p.level inventory_type,p.tax_type vatable,p.expiry_days,
            p.brandcode item_brand,p.isdiscountable isDiscountable,sp.pricing_category pricing_code,pc.pricing_code pricing_label
            FROM tbl_pos_product_group_sizes s
            INNER JOIN tbl_pos_product_groups g ON g.build_code=s.build_code AND g.size_name='' AND g.enabled=1
            INNER JOIN tbl_pos_product_group_size_prices sp ON sp.size_id=s.size_id
            INNER JOIN lkp_build_of_products p ON CONVERT(p.build_code USING utf8mb4) COLLATE utf8mb4_general_ci=s.build_code AND p.deletestatus='Active'
            INNER JOIN lkp_pricing_code pc ON CONVERT(pc.uuid USING utf8mb4) COLLATE utf8mb4_general_ci=sp.pricing_category AND pc.deletestatus='Active'
            WHERE s.enabled=1 AND sp.pricing_category IN ($marks)"
            . self::scope('build', 'p.build_code') . self::scope('pricing', 'pc.uuid') . "
            GROUP BY p.build_code,p.productcode,p.`desc`,p.category,p.uom,p.uomval,p.level,p.tax_type,p.expiry_days,p.brandcode,p.isdiscountable,sp.pricing_category,pc.pricing_code", $pricingCodes);
        $keys = [];
        foreach ($sizedRows as $row) $keys[$row['product_id'] . '|' . $row['pricing_code']] = true;
        // Size prices are authoritative for these products, not a possibly stale base amount.
        return array_merge(array_values(array_filter($rows, static fn($row) => !isset($keys[$row['product_id'] . '|' . $row['pricing_code']]))), $sizedRows);
    }
    public function pricingOptions(array $rows): array
    {
        if (!$this->installed()) return $rows;
        $extra = $this->rows("SELECT DISTINCT sp.pricing_category pricing_code,pc.pricing_code pricing_label
            FROM tbl_pos_product_group_size_prices sp
            INNER JOIN tbl_pos_product_group_sizes s ON s.size_id=sp.size_id AND s.enabled=1
            INNER JOIN tbl_pos_product_groups g ON g.build_code=s.build_code AND g.enabled=1 AND g.size_name=''
            INNER JOIN lkp_build_of_products p ON CONVERT(p.build_code USING utf8mb4) COLLATE utf8mb4_general_ci=s.build_code AND p.deletestatus='Active'
            INNER JOIN lkp_pricing_code pc ON CONVERT(pc.uuid USING utf8mb4) COLLATE utf8mb4_general_ci=sp.pricing_category AND pc.deletestatus='Active' WHERE 1=1"
            . self::scope('build', 'p.build_code') . self::scope('pricing', 'pc.uuid'));
        $all = [];
        foreach (array_merge($rows, $extra) as $row) $all[(string) $row['pricing_code']] = $row;
        uasort($all, static fn($a,$b) => strcasecmp((string)$a['pricing_label'],(string)$b['pricing_label']));
        return array_values($all);
    }
    private static function label(mixed $value, int $max, bool $required = true): string
    {
        if (!is_string($value)) throw new InvalidArgumentException('Invalid product size data. Refresh product sync.');
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if ($length > $max || ($required && trim($value) === '') || preg_match('/[\x00-\x1F\x7F]/u', $value)) throw new InvalidArgumentException('Invalid product size data. Refresh product sync.');
        return trim($value);
    }
    private static function number(mixed $value, bool $positive = false): string
    {
        if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || ($positive && (float)$value <= 0) || (float)$value > 999999999999) throw new InvalidArgumentException('Invalid size price or recipe quantity.');
        return (string)$value;
    }
    /** Validate the complete selected catalog before touching local rows. */
    public static function validate(mixed $sizes): array
    {
        if (!is_array($sizes) || !array_is_list($sizes) || count($sizes) > 30) throw new InvalidArgumentException('Invalid product sizes.');
        $result=[]; $seen=[]; $names=[];
        foreach ($sizes as $index=>$s) {
            if (!is_array($s)) throw new InvalidArgumentException('Invalid product size.');
            $id=self::label($s['size_id']??null,64); $name=self::label($s['size_name']??null,64);
            if (isset($seen[$id]) || isset($names[strtolower($name)])) throw new InvalidArgumentException('Duplicate product sizes.');
            $seen[$id]=true; $names[strtolower($name)]=true;
            foreach (['enabled','recipe_configured'] as $flag) if (!is_bool($s[$flag]??null)) throw new InvalidArgumentException('Invalid product size switches.');
            $prices=[]; $priceIds=[];
            if (!is_array($s['prices']??null) || !array_is_list($s['prices']) || count($s['prices'])>500) throw new InvalidArgumentException('Invalid size prices.');
            foreach ($s['prices'] as $p) {
                $code=self::label($p['pricing_category']??null,64);
                if (isset($priceIds[$code])) throw new InvalidArgumentException('Duplicate size prices.');
                $priceIds[$code]=true;
                $prices[]=['pricing_category'=>$code,'srp'=>self::number($p['srp']??null),'cost_per_uom'=>self::number($p['cost_per_uom']??null)];
            }
            $components=[]; $componentIds=[];
            if (!is_array($s['components']??null) || !array_is_list($s['components']) || count($s['components'])>200) throw new InvalidArgumentException('Invalid size recipe.');
            foreach ($s['components'] as $c) {
                $code=self::label($c['component_code']??null,64); $class=$c['component_class']??null;
                if (!in_array($class,['RM','FG'],true) || isset($componentIds[$class.'|'.$code])) throw new InvalidArgumentException('Invalid or duplicate size ingredient.');
                $componentIds[$class.'|'.$code]=true;
                $components[]=['component_code'=>$code,'component_class'=>$class,'qty'=>self::number($c['qty']??null,true),
                    'description'=>self::label($c['description']??'',255,false),'uom'=>self::label($c['uom']??null,32),
                    'uomval'=>self::number($c['uomval']??null,true),'category'=>self::label($c['category']??'',100,false),'cost_per_uom'=>self::number($c['cost_per_uom']??0)];
            }
            if (!$s['recipe_configured'] && $components) throw new InvalidArgumentException('An ingredient recipe must be confirmed before syncing.');
            $result[]=['size_id'=>$id,'size_name'=>$name,'enabled'=>$s['enabled'],'recipe_configured'=>$s['recipe_configured'],'sort_order'=>$index,'prices'=>$prices,'components'=>$components];
        }
        return $result;
    }
    public function apply(string $code, array $sizes): void
    {
        if (!$this->installed()) throw new RuntimeException('Install the product sizes update on this POS before syncing.');
        if (!$this->conn->inTransaction()) throw new LogicException('Product sizes must sync with their master product.');
        // A size id may never be reassigned to another product, even in a partial sync.
        foreach ($sizes as $size) {
            $existing=$this->rows('SELECT build_code FROM tbl_pos_product_group_sizes WHERE size_id=? FOR UPDATE',[$size['size_id']]);
            if ($existing && (string)$existing[0]['build_code']!==$code) throw new InvalidArgumentException('A size belongs to a different product.');
        }
        foreach (['tbl_pos_product_group_size_prices','tbl_pos_product_group_size_components'] as $table) {
            $this->rows("DELETE FROM $table WHERE size_id IN (SELECT size_id FROM tbl_pos_product_group_sizes WHERE build_code=?)",[$code]);
        }
        $this->rows('DELETE FROM tbl_pos_product_group_sizes WHERE build_code=?',[$code]);
        foreach ($sizes as $size) {
            $this->rows('INSERT INTO tbl_pos_product_group_sizes (size_id,build_code,size_name,enabled,recipe_configured,sort_order) VALUES (?,?,?,?,?,?)',[$size['size_id'],$code,$size['size_name'],(int)$size['enabled'],(int)$size['recipe_configured'],$size['sort_order']]);
            foreach ($size['prices'] as $p) $this->rows('INSERT INTO tbl_pos_product_group_size_prices (size_id,pricing_category,srp,cost_per_uom) VALUES (?,?,?,?)',[$size['size_id'],$p['pricing_category'],$p['srp'],$p['cost_per_uom']]);
            foreach ($size['components'] as $c) $this->rows('INSERT INTO tbl_pos_product_group_size_components (size_id,component_code,component_class,qty,description,uom,uomval,category,cost_per_uom) VALUES (?,?,?,?,?,?,?,?,?)',[$size['size_id'],$c['component_code'],$c['component_class'],$c['qty'],$c['description'],$c['uom'],$c['uomval'],$c['category'],$c['cost_per_uom']]);
        }
    }
}
