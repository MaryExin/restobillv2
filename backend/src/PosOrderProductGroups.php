<?php

declare(strict_types=1);

/** Optional grouped-product metadata, attached to existing restaurant product/detail rows. */
final class PosOrderProductGroups
{
    private ?bool $installed = null;
    private ?bool $sizesInstalled = null;

    public function __construct(private PDO|mysqli $connection) {}

    private function query(string $sql, array $values = []): array
    {
        $statement = $this->connection->prepare($sql);
        if ($statement === false && $this->connection instanceof mysqli) {
            throw new mysqli_sql_exception($this->connection->error, $this->connection->errno);
        }
        if ($this->connection instanceof PDO) {
            $statement->execute($values);
            return $statement->columnCount() ? ($statement->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        }
        if ($values) $statement->bind_param(str_repeat('s', count($values)), ...$values);
        if (!$statement->execute()) throw new mysqli_sql_exception($statement->error, $statement->errno);
        $result = $statement->get_result();
        $rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        $statement->close();
        return $rows;
    }

    public function isInstalled(): bool
    {
        if ($this->installed !== null) return $this->installed;
        try {
            $this->query('SELECT build_code FROM tbl_pos_product_groups WHERE 1=0');
            $this->query('SELECT pos_detail_id FROM tbl_pos_product_group_selections WHERE 1=0');
            return $this->installed = true;
        } catch (PDOException | mysqli_sql_exception $error) {
            if ((string) $error->getCode() !== '42S02' && (int) $error->getCode() !== 1146 && (int) ($error instanceof PDOException ? ($error->errorInfo[1] ?? 0) : 0) !== 1146) throw $error;
            return $this->installed = false;
        }
    }

    private static function yes(mixed $value): bool
    {
        return in_array(strtoupper(trim((string) $value)), ['1', 'YES', 'TRUE', 'VATABLE'], true);
    }

    private function configs(): array
    {
        $result = [];
        foreach ($this->query('SELECT * FROM tbl_pos_product_groups') as $row) $result[(string) $row['build_code']] = $row;
        return $result;
    }

    private function aliases(): ?array
    {
        try {
            $rows = $this->query('SELECT source_build_code,canonical_build_code,size_id,enabled FROM tbl_pos_product_group_aliases');
        } catch (PDOException | mysqli_sql_exception $error) {
            if ((string) $error->getCode() !== '42S02' && (int) $error->getCode() !== 1146 && (int) ($error instanceof PDOException ? ($error->errorInfo[1] ?? 0) : 0) !== 1146) throw $error;
            return null;
        }
        $result = [];
        foreach ($rows as $row) $result[(string) $row['source_build_code']] = ['canonical_build_code' => (string) $row['canonical_build_code'],
            'size_id' => (string) $row['size_id'], 'enabled' => (bool) $row['enabled']];
        return $result;
    }

    private function sizeOptions(): array
    {
        if ($this->sizesInstalled === false) return [];
        try {
            $sizes = $this->query('SELECT * FROM tbl_pos_product_group_sizes ORDER BY sort_order,size_name,size_id');
            $prices = $this->query('SELECT * FROM tbl_pos_product_group_size_prices');
            $components = $this->query('SELECT * FROM tbl_pos_product_group_size_components ORDER BY size_id,component_code,component_class');
            $this->sizesInstalled = true;
        } catch (PDOException | mysqli_sql_exception $error) {
            if ((string) $error->getCode() !== '42S02' && (int) $error->getCode() !== 1146 && (int) ($error instanceof PDOException ? ($error->errorInfo[1] ?? 0) : 0) !== 1146) throw $error;
            $this->sizesInstalled = false;
            return [];
        }
        $byId = [];
        foreach ($sizes as $size) {
            $byId[(string) $size['size_id']] = ['size_id' => (string) $size['size_id'], 'build_code' => (string) $size['build_code'],
                'size_name' => (string) $size['size_name'], 'enabled' => (bool) $size['enabled'],
                'recipe_configured' => (bool) $size['recipe_configured'], 'sort_order' => (int) $size['sort_order'], 'prices' => [], 'components' => []];
        }
        foreach ($prices as $price) if (isset($byId[(string) $price['size_id']])) {
            $byId[(string) $price['size_id']]['prices'][] = ['pricing_category' => (string) $price['pricing_category'],
                'srp' => $price['srp'], 'cost_per_uom' => $price['cost_per_uom']];
        }
        foreach ($components as $component) if (isset($byId[(string) $component['size_id']])) {
            $metadata = array_intersect_key($component, array_flip(['uom', 'uomval', 'category', 'cost_per_uom', 'description']));
            $byId[(string) $component['size_id']]['components'][] = array_merge($metadata, [
                'component_code' => (string) $component['component_code'], 'component_class' => (string) $component['component_class'], 'qty' => (float) $component['qty']]);
        }
        $result = [];
        foreach ($byId as $size) $result[$size['build_code']][] = $size;
        return $result;
    }

    public function annotateProducts(array $products): array
    {
        if (!$products || !$this->isInstalled()) return $products;
        $configs = $this->configs();
        $sizes = $this->sizeOptions();
        $aliases = $this->aliases();
        $counts = [];
        foreach ($products as $row) {
            $key = (string) ($row['product_id'] ?? '') . '|' . (string) ($row['pricing_code'] ?? '');
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }
        foreach ($products as &$row) {
            if ($aliases !== null) $row['group_alias'] = $aliases[(string) ($row['product_id'] ?? '')] ?? null;
            $config = $configs[(string) ($row['product_id'] ?? '')] ?? null;
            if ($config === null) continue;
            $row['product_group'] = ['name' => $config['group_name'], 'enabled' => (bool) $config['enabled'],
                'allow_half' => (bool) $config['allow_half'], 'allow_half_and_half' => (bool) $config['allow_half_and_half']];
            $row['group_size'] = $config['size_name'];
            $row['group_variant'] = $config['variant_name'];
            if (isset($sizes[(string) $row['product_id']])) $row['group_sizes'] = $sizes[(string) $row['product_id']];
            $key = (string) $row['product_id'] . '|' . (string) ($row['pricing_code'] ?? '');
            if (($counts[$key] ?? 0) > 1 || !is_numeric($row['selling_price'] ?? null) || (float) $row['selling_price'] < 0) {
                $row['group_price_error'] = 'This variant needs one active price in Price Setup.';
            }
        }
        unset($row);
        return $products;
    }

    /** All enabled variants for the active unit/list, independent of the menu's search/page. */
    public function groupProducts(string $category, string $unit, string $pricing): array
    {
        if (!$this->isInstalled()) return [];
        $products = $this->query("SELECT m.*,pd.pricing_code,pd.cost_per_uom AS unit_cost,pd.srp AS selling_price
            FROM tbl_inventory_products_masterlist m
            INNER JOIN tbl_pos_product_groups g ON CONVERT(g.build_code USING utf8mb4) COLLATE utf8mb4_general_ci=CONVERT(m.product_id USING utf8mb4) COLLATE utf8mb4_general_ci AND g.enabled=1
            LEFT JOIN tbl_pricing_details pd ON pd.inv_code=m.product_id AND pd.pricing_code=? AND pd.deletestatus='Active'
            WHERE m.category_code=? AND m.unit_code=? AND m.status='Active' ORDER BY m.item_name,m.product_id,pd.seq", [$pricing, $category, $unit]);
        $result = [];
        $seen = [];
        foreach ($this->annotateProducts($products) as $product) {
            if (!array_key_exists('group_sizes', $product)) { $result[] = $product; continue; }
            // Size options are children of a real product, independent of its legacy price row.
            if (isset($seen[(string) $product['product_id']])) continue;
            $seen[(string) $product['product_id']] = true;
            foreach ($product['group_sizes'] as $size) {
                if (!$size['enabled']) continue;
                $matches = array_values(array_filter($size['prices'], static fn ($price) => $price['pricing_category'] === $pricing));
                $price = count($matches) === 1 ? $matches[0] : null;
                $choice = array_merge($product, ['group_size' => $size['size_name'], 'group_size_id' => $size['size_id'],
                    'group_recipe_configured' => $size['recipe_configured'], 'group_recipe_components' => $size['components'],
                    'selling_price' => $price['srp'] ?? null, 'unit_cost' => $price['cost_per_uom'] ?? null, 'pricing_code' => $pricing]);
                unset($choice['group_price_error']);
                if (!$price || !is_numeric($price['srp']) || (float) $price['srp'] < 0 || !is_numeric($price['cost_per_uom']) || (float) $price['cost_per_uom'] < 0) {
                    $choice['group_price_error'] = 'Set the whole-item price and cost for this size and price list.';
                } elseif (!$size['recipe_configured']) {
                    $choice['group_price_error'] = 'Set the ingredients for this size before selling it.';
                }
                $result[] = $choice;
            }
        }
        return $result;
    }

    private function pricing(string $unit, string $orderType): string
    {
        $rows = $this->query("SELECT map.pricing_category FROM tbl_pricing_by_sales_type map
            INNER JOIN lkp_sales_type st ON st.sales_type_id=map.sales_type_id AND st.deletestatus='Active'
            WHERE map.busunitcode=? AND st.description=? AND map.deletestatus='Active'", [$unit, $orderType]);
        if (count($rows) !== 1 || trim((string) $rows[0]['pricing_category']) === '') throw new InvalidArgumentException('The sales type needs one active price list for this unit. Refresh Product Sync and Price Setup.');
        return (string) $rows[0]['pricing_category'];
    }

    /** A combined cart selection becomes ordinary fractional variant details for stock and reports. */
    public function prepareItems(array $items, string $category, string $unit, string $orderType, ?string $transactionId = null): array
    {
        $hasGroups = false;
        foreach ($items as $item) $hasGroups = $hasGroups || array_key_exists('group_selection', $item);
        if (!$hasGroups) return $items;
        if (!$this->isInstalled()) throw new InvalidArgumentException('Install database/2026-10-19_pos_product_groups.sql on this terminal before saving product groups.');
        $pricing = null;
        $catalog = null;
        $saved = $transactionId === null ? [] : $this->savedParts($transactionId, $category, $unit);
        $result = [];
        $seen = [];
        foreach ($items as $item) {
            if (!array_key_exists('group_selection', $item)) { $result[] = $item; continue; }
            $selection = $item['group_selection'];
            if (!is_array($selection)) throw new InvalidArgumentException('Choose the product group again.');
            foreach (['selection_id' => 64, 'group_name' => 100, 'size' => 64, 'portion' => 20, 'pricing_category' => 64] as $field => $limit) {
                if (!is_string($selection[$field] ?? null) || trim($selection[$field]) === '' || strlen($selection[$field]) > $limit * 4) {
                    throw new InvalidArgumentException('Choose a valid product group, size and portion.');
                }
            }
            $id = (string) ($selection['selection_id'] ?? '');
            $portion = (string) ($selection['portion'] ?? '');
            $variants = $selection['variants'] ?? null;
            $count = filter_var($selection['unit_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
            if (!preg_match('/^[A-Za-z0-9_-]{8,64}$/', $id) || isset($seen[$id]) || !in_array($portion, ['whole', 'half', 'half_and_half'], true)
                || $count === false || !is_array($variants) || count($variants) !== ($portion === 'half_and_half' ? 2 : 1)
                || abs((float) ($item['sales_quantity'] ?? 0) - $count) > .000001) throw new InvalidArgumentException('The group quantity or selection is invalid. Choose it again.');
            foreach ($variants as $variant) if (!is_string($variant) || trim($variant) === '' || strlen($variant) > 64) throw new InvalidArgumentException('Choose valid product variants.');
            if (count(array_unique($variants)) !== count($variants)) throw new InvalidArgumentException('Choose two distinct variants for a mixed portion.');
            $sizeOptions = [];
            if (array_key_exists('schema_version', $selection) || array_key_exists('variant_options', $selection)) {
                if (($selection['schema_version'] ?? null) !== 2 || !is_array($selection['variant_options'] ?? null) || count($selection['variant_options']) !== count($variants)) {
                    throw new InvalidArgumentException('Choose the product size again.');
                }
                foreach ($selection['variant_options'] as $index => $option) {
                    if (!is_array($option) || ($option['product_id'] ?? null) !== $variants[$index] || !is_string($option['size_id'] ?? null)
                        || !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $option['size_id'])) throw new InvalidArgumentException('Choose valid product size options.');
                    $sizeOptions[$variants[$index]] = $option['size_id'];
                }
            }
            $seen[$id] = true;
            // An untouched recalled item keeps its recorded price and description.
            // A changed quantity/selection is validated against current setup below.
            if (isset($saved[$id]) && $this->sameSavedSelection($saved[$id], $selection, $item, $orderType)) {
                foreach ($saved[$id] as $part) {
                    unset($part['ID']);
                    $part['item_instruction'] = $item['item_instruction'] ?? '';
                    $result[] = $part;
                }
                continue;
            }
            if ($pricing === null) {
                $pricing = $this->pricing($unit, $orderType);
                $catalog = [];
                foreach ($this->groupProducts($category, $unit, $pricing) as $product) $catalog[(string) $product['product_id']][] = $product;
            }
            if ((string) ($selection['pricing_category'] ?? '') !== $pricing) throw new InvalidArgumentException('The group price list changed. Choose the item again.');
            $products = [];
            foreach ($variants as $code) {
                $matches = $catalog[$code] ?? [];
                $matches = array_values(array_filter($matches, static fn ($p) => isset($sizeOptions[$code])
                    ? ($p['group_size_id'] ?? null) === $sizeOptions[$code] : empty($p['group_size_id'])));
                if (count($matches) !== 1 || !empty($matches[0]['group_price_error'])) throw new InvalidArgumentException('A selected variant is unavailable or needs one active price. Sync products and check Price Setup.');
                $p = $matches[0];
                if (strcasecmp((string) $p['product_group']['name'], (string) ($selection['group_name'] ?? '')) !== 0
                    || strcasecmp((string) $p['group_size'], (string) ($selection['size'] ?? '')) !== 0
                    || ($portion === 'half' && !$p['product_group']['allow_half'])
                    || ($portion === 'half_and_half' && !$p['product_group']['allow_half_and_half'])) throw new InvalidArgumentException('The product group size or allowed portions changed. Choose it again.');
                $products[$code] = $p;
            }
            $taxes = array_unique(array_map(static fn ($p) => self::yes($p['vatable'] ?? ''), $products));
            if (count($taxes) !== 1) throw new InvalidArgumentException('Mixed variants must use the same VAT setting.');
            $units = array_unique(array_map(static fn ($p) => strtoupper(trim((string) ($p['unit_of_measure'] ?? ''))), $products));
            if (count($units) !== 1) throw new InvalidArgumentException('Mixed variants must use the same unit of measure.');
            $discountable = !in_array(false, array_map(static fn ($p) => self::yes($p['isDiscountable'] ?? ''), $products), true);
            $fraction = $portion === 'whole' ? 1.0 : 0.5;
            $unitPrice = round(array_sum(array_map(static fn ($p) => (float) $p['selling_price'] * $fraction, $products)), 2);
            if (abs((float) ($item['selling_price'] ?? -1) - $unitPrice) > .005) throw new InvalidArgumentException('The grouped item price changed. Choose it again.');
            $names = array_map(static fn ($code) => (string) $products[$code]['group_variant'], $variants);
            $label = $products[$variants[0]]['product_group']['name'] . ' · ' . $products[$variants[0]]['group_size'] . ' · '
                . ($portion === 'whole' ? 'Whole' : ($portion === 'half' ? 'Half' : 'Half & half')) . ': ' . implode(' / ', $names);
            $canonical = ['selection_id' => $id, 'group_name' => $products[$variants[0]]['product_group']['name'], 'size' => $products[$variants[0]]['group_size'],
                'portion' => $portion, 'variants' => $variants, 'unit_count' => $count, 'pricing_category' => $pricing,
                'variant_names' => $names, 'whole_prices' => array_map(static fn ($p) => (float) $p['selling_price'], $products),
                'unit_price' => $unitPrice, 'group_label' => $label, 'sales_type' => $orderType];
            if ($sizeOptions) {
                $canonical['schema_version'] = 2;
                $canonical['variant_options'] = array_map(static fn ($code) => ['product_id' => $code, 'size_id' => $sizeOptions[$code]], $variants);
            }
            $allocated = 0.0;
            foreach ($variants as $index => $code) {
                $p = $products[$code];
                $partPrice = $index === count($variants) - 1 ? round($unitPrice - $allocated, 2) : round((float) $p['selling_price'] * $fraction, 2);
                $allocated += $partPrice;
                $partSelection = $canonical + ['part_index' => $index];
                if (isset($sizeOptions[$code])) {
                    $partSelection['recipe_snapshot'] = ['size_id' => $sizeOptions[$code], 'recipe_configured' => true, 'components' => $p['group_recipe_components']];
                }
                $result[] = array_merge($item, [
                    'product_id' => $code, 'sku' => (string) ($p['sku'] ?? ''), 'sales_quantity' => $count * $fraction,
                    'selling_price' => round($partPrice / $fraction, 4), 'unit_cost' => (float) $p['unit_cost'], 'landing_cost' => (float) $p['unit_cost'],
                    'vatable' => self::yes($p['vatable'] ?? '') ? 'Yes' : 'No', 'isDiscountable' => $discountable ? 'Yes' : 'No',
                    'group_selection' => $partSelection,
                    'group_line_label' => $label . ($portion === 'half_and_half' ? ' [' . ($index + 1) . '/2: ' . $p['group_variant'] . ']' : ''),
                ]);
            }
        }
        return $result;
    }

    private function sameSavedSelection(array $parts, array $selection, array $item, string $orderType): bool
    {
        $original = $parts[0]['group_selection'];
        if (strcasecmp(trim((string) ($original['sales_type'] ?? '')), trim($orderType)) !== 0) return false;
        foreach (['group_name', 'size', 'portion', 'variants', 'unit_count', 'pricing_category', 'schema_version', 'variant_options'] as $key) if (($selection[$key] ?? null) !== ($original[$key] ?? null)) return false;
        return count($parts) === count($original['variants']) && abs((float) $item['selling_price'] - (float) $original['unit_price']) < .005;
    }

    private function savedParts(string $id, string $category, string $unit): array
    {
        $rows = $this->query('SELECT d.*,s.group_selection_json,s.line_label FROM tbl_pos_transactions_detailed d
            INNER JOIN tbl_pos_product_group_selections s ON s.pos_detail_id=d.ID
            WHERE d.transaction_id=? AND d.Category_Code=? AND d.Unit_Code=? ORDER BY d.ID', [$id, $category, $unit]);
        $result = [];
        foreach ($rows as $row) {
            $row['group_selection'] = json_decode($row['group_selection_json'], true, 512, JSON_THROW_ON_ERROR);
            $row['group_line_label'] = $row['line_label'];
            unset($row['group_selection_json'], $row['line_label']);
            $result[$row['group_selection']['selection_id']][] = $row;
        }
        return $result;
    }

    public function storePart(string $detailId, string $transaction, string $category, string $unit, array $item): void
    {
        if (empty($item['group_selection'])) return;
        // Legacy terminals can have different detail column precision. Verify
        // the actual write before committing; never silently round a half to 0/1.
        $stored = $this->query('SELECT sales_quantity,selling_price FROM tbl_pos_transactions_detailed
            WHERE ID=? AND transaction_id=? AND Category_Code=? AND Unit_Code=?', [$detailId, $transaction, $category, $unit]);
        if (count($stored) !== 1 || abs((float) $stored[0]['sales_quantity'] - (float) $item['sales_quantity']) > .000001
            || abs((float) $stored[0]['selling_price'] - (float) $item['selling_price']) > .000001) {
            throw new InvalidArgumentException('This terminal cannot store the selected quantity or price precisely. Nothing was saved; check the detail column precision.');
        }
        $this->query('INSERT INTO tbl_pos_product_group_selections
            (pos_detail_id,transaction_id,category_code,unit_code,selection_id,group_selection_json,line_label) VALUES (?,?,?,?,?,?,?)',
            [$detailId, $transaction, $category, $unit, $item['group_selection']['selection_id'], json_encode($item['group_selection'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $item['group_line_label']]);
    }

    public function clearOrder(string $transaction, string $category, string $unit): void
    {
        if (!$this->isInstalled()) return;
        $this->query('DELETE FROM tbl_pos_product_group_selections WHERE transaction_id=? AND category_code=? AND unit_code=?', [$transaction, $category, $unit]);
    }

    public function assertTransferSupported(array $transactions): void
    {
        if (!$this->isInstalled()) return;
        foreach ($transactions as $transaction) {
            if ($this->query('SELECT pos_detail_id FROM tbl_pos_product_group_selections WHERE transaction_id=? LIMIT 1', [(string) $transaction])) {
                throw new InvalidArgumentException('This order contains a product group. Keep its variants together; item transfer is unavailable for grouped orders.');
            }
        }
    }

    public function assertBillingPrices(array $items, string $transaction, string $category, string $unit): void
    {
        if (!$items || !$this->isInstalled()) return;
        $ids = array_values(array_unique(array_filter(array_map(static fn ($item) => (int) ($item['databaseID'] ?? 0), $items))));
        if (!$ids) return;
        $rows = $this->query('SELECT d.ID,d.transaction_id,d.Category_Code,d.Unit_Code,d.selling_price
            FROM tbl_pos_transactions_detailed d INNER JOIN tbl_pos_product_group_selections s ON s.pos_detail_id=d.ID
            WHERE d.ID IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids);
        $grouped = [];
        foreach ($rows as $row) $grouped[(string) $row['ID']] = $row;
        foreach ($items as $item) {
            $row = $grouped[(string) ($item['databaseID'] ?? '')] ?? null;
            if (!$row) continue;
            if ((string) $row['transaction_id'] !== $transaction || (string) $row['Category_Code'] !== $category || (string) $row['Unit_Code'] !== $unit
                || abs((float) ($item['selling_price'] ?? -1) - (float) $row['selling_price']) > .00001) {
                throw new InvalidArgumentException('A product group price cannot be changed one variant at a time. Edit the whole selection in the order first.');
            }
        }
    }

    public function annotateLines(array $lines): array
    {
        if (!$lines || !$this->isInstalled()) return $lines;
        $ids = array_values(array_unique(array_filter(array_map(static fn ($row) => (string) ($row['ID'] ?? $row['id'] ?? ''), $lines))));
        if (!$ids) return $lines;
        $snapshots = [];
        foreach ($this->query('SELECT * FROM tbl_pos_product_group_selections WHERE pos_detail_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids) as $row) $snapshots[(string) $row['pos_detail_id']] = $row;
        foreach ($lines as &$line) {
            $snapshot = $snapshots[(string) ($line['ID'] ?? $line['id'] ?? '')] ?? null;
            if (!$snapshot) continue;
            $line['group_selection'] = json_decode($snapshot['group_selection_json'], true, 512, JSON_THROW_ON_ERROR);
            $line['group_line_label'] = $snapshot['line_label'];
            $line['item_name'] = $snapshot['line_label'];
        }
        unset($line);
        return $lines;
    }
}
