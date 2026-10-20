<?php

declare(strict_types=1);

/** Persist restaurant selection snapshots alongside newly assigned online detail IDs. */
final class PosGroupSelectionSync
{
    private ?bool $installed = null;
    public function __construct(private PDO $conn) {}
    public function installed(): bool
    {
        if ($this->installed !== null) return $this->installed;
        try {
            $this->conn->query('SELECT pos_detail_id FROM tbl_pos_synced_group_selections WHERE 1=0');
            return $this->installed = true;
        } catch (PDOException $e) {
            if ($this->conn->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite' && str_contains($e->getMessage(),'no such table')) return $this->installed = false;
            if ((string)$e->getCode() !== '42S02' && (int)($e->errorInfo[1]??0)!==1146) throw $e;
            return $this->installed = false;
        }
    }
    public static function validate(array $detail): ?array
    {
        if (!array_key_exists('group_selection', $detail) || $detail['group_selection'] === null) return null;
        $s = $detail['group_selection'];
        if (!is_array($s) || strlen(json_encode($s, JSON_THROW_ON_ERROR))>1000000) throw new InvalidArgumentException('Invalid product selection snapshot.');
        $part=$s['part_index']??null; $variants=$s['variants']??null; $count=$s['unit_count']??null;
        $portion=$s['portion']??null;
        if (!is_int($part) || !is_array($variants) || !array_is_list($variants) || !isset($variants[$part]) || (string)$variants[$part] !== (string)($detail['product_id']??'')
            || !in_array($portion,['whole','half','half_and_half'],true) || count($variants)!==($portion==='half_and_half'?2:1)
            || !is_numeric($count) || (float)$count<1 || floor((float)$count)!==(float)$count || (float)$count>10000
            || !is_numeric($detail['sales_quantity']??null) || abs((float)$detail['sales_quantity']-(float)$count*($portion==='whole'?1:.5))>.000001
            || !is_string($s['selection_id']??null) || !preg_match('/^[A-Za-z0-9_-]{8,64}$/',$s['selection_id'])) {
            throw new InvalidArgumentException('The saved product selection does not match its sale detail.');
        }
        if (($s['schema_version']??1)===2) {
            $option=$s['variant_options'][$part]??null; $recipe=$s['recipe_snapshot']??null;
            if (!is_array($option) || ($option['product_id']??null)!==$variants[$part] || !is_string($option['size_id']??null) || trim($option['size_id'])==='' || strlen($option['size_id'])>64
                || !is_array($recipe) || ($recipe['size_id']??null)!==$option['size_id'] || ($recipe['recipe_configured']??null)!==true
                || !is_array($recipe['components']??null) || count($recipe['components'])>500) throw new InvalidArgumentException('A product size is missing its saved recipe.');
            $seen=[];
            foreach ($recipe['components'] as $c) {
                if (!is_array($c) || !is_string($c['component_code']??null) || trim($c['component_code'])==='' || strlen($c['component_code'])>64
                    || !in_array($c['component_class']??null,['RM','FG'],true) || !is_numeric($c['qty']??null) || !is_finite((float)$c['qty']) || (float)$c['qty']<=0 || (float)$c['qty']>999999999999
                    || !is_numeric($c['uomval']??null) || !is_finite((float)$c['uomval']) || (float)$c['uomval']<=0 || !is_string($c['uom']??null) || trim($c['uom'])==='' || strlen($c['uom'])>128) {
                    throw new InvalidArgumentException('Invalid ingredient quantities in the saved size recipe.');
                }
                $key=$c['component_class'].'|'.$c['component_code'];
                if(isset($seen[$key])) throw new InvalidArgumentException('Duplicate ingredients in a saved size recipe.');
                $seen[$key]=true;
            }
        } elseif (($s['schema_version']??1)!==1) {
            throw new InvalidArgumentException('Unsupported product selection snapshot version.');
        }
        return $s;
    }
    public function assertPayload(array $details, array $transactions, string $dataset, mixed $snapshotVersion = null, array $tables = []): void
    {
        $with=[]; $sets=[];
        foreach($details as $row) {
            $selection=self::validate($row);
            if ($selection===null) continue;
            $identity=self::identityKey($row);
            $partKey=$selection['selection_id'].'|'.$selection['part_index'];
            if(isset($with[$identity][$partKey])) throw new InvalidArgumentException('Duplicate product selection part in the sales upload.');
            $with[$identity][$partKey]=true;
            $setKey=$identity.'|'.$selection['selection_id'];
            $canonical=array_intersect_key($selection,array_flip(['schema_version','group_name','size','portion','variants','variant_options','unit_count','unit_price']));
            if(isset($sets[$setKey]) && $sets[$setKey]['canonical']!==$canonical) throw new InvalidArgumentException('The product selection parts disagree.');
            $sets[$setKey]['canonical']=$canonical;
            $sets[$setKey]['parts'][]=$selection['part_index'];
            $sets[$setKey]['amount']=($sets[$setKey]['amount']??0)+(float)($row['selling_price']??0)*(float)$row['sales_quantity'];
        }
        foreach($sets as $set) {
            $expected=count($set['canonical']['variants']);
            $parts=$set['parts']; sort($parts);
            if($parts!==range(0,$expected-1)) throw new InvalidArgumentException('Sync all parts of each product selection together.');
            if (isset($set['canonical']['unit_price']) && abs($set['amount']-(float)$set['canonical']['unit_price']*(float)$set['canonical']['unit_count'])>.005) throw new InvalidArgumentException('The product selection price does not match its sale details.');
        }
        if ($with && !$this->installed()) throw new RuntimeException('Install the online product size selection update before syncing these sales.');
        if ($with && $this->conn->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' && $tables) {
            $names=array_values(array_unique(array_merge(array_map(static fn($t)=>trim($t,'`'),$tables),['tbl_pos_synced_group_selections'])));
            $marks=implode(',',array_fill(0,count($names),'?'));
            $stmt=$this->conn->prepare("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ($marks)");
            $stmt->execute($names); $engines=[];
            foreach($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $engines[$r['TABLE_NAME']]=strtoupper((string)$r['ENGINE']);
            foreach($names as $name) if(($engines[$name]??'')!=='INNODB') throw new RuntimeException('This sales destination needs transactional storage before syncing product groups. No sales were uploaded.');
        }
        if (!$this->installed() || $snapshotVersion===2) return;
        foreach($transactions as $row) {
            $identity=self::identityKey($row);
            $stmt=$this->conn->prepare('SELECT selection_json FROM tbl_pos_synced_group_selections WHERE dataset=? AND transaction_id=? AND category_code=? AND unit_code=? AND terminal_number=?');
            $stmt->execute([$dataset,(string)($row['transaction_id']??''),(string)($row['Category_Code']??''),(string)($row['Unit_Code']??''),(string)($row['terminal_number']??'')]);
            foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $json) {
                $saved=json_decode($json,true,512,JSON_THROW_ON_ERROR);
                if(!isset($with[$identity][$saved['selection_id'].'|'.$saved['part_index']])) throw new RuntimeException('This sale already has product selections. Sync from the updated POS to retain its sizes and recipes.');
            }
        }
    }
    private static function identityKey(array $row): string
    {
        return json_encode([(string)($row['Category_Code']??''),(string)($row['Unit_Code']??''),(string)($row['terminal_number']??''),(string)($row['transaction_id']??'')]);
    }
    public function clear(array $row, string $dataset): void
    {
        if (!$this->installed()) return;
        $stmt=$this->conn->prepare('DELETE FROM tbl_pos_synced_group_selections WHERE dataset=? AND transaction_id=? AND category_code=? AND unit_code=? AND terminal_number=?');
        $stmt->execute([$dataset,(string)($row['transaction_id']??''),(string)($row['Category_Code']??''),(string)($row['Unit_Code']??''),(string)($row['terminal_number']??'')]);
    }
    public function store(int|string $detailId, array $row, string $dataset): void
    {
        $selection=self::validate($row);
        if($selection===null) return;
        if (!$this->installed()) throw new RuntimeException('Install the online product size selection update before syncing these sales.');
        $detailTable=$dataset==='REPORT'?'tbl_pos_transactions_detailed_bd':'tbl_pos_transactions_detailed';
        $stored=$this->conn->prepare("SELECT sales_quantity,selling_price,unit_cost FROM $detailTable WHERE ID=?");
        $stored->execute([$detailId]); $actual=$stored->fetch(PDO::FETCH_ASSOC);
        foreach(['sales_quantity','selling_price','unit_cost'] as $field) {
            if(!$actual || abs((float)$actual[$field]-(float)($row[$field]??0))>.000001) throw new RuntimeException('The online sales columns cannot retain this product quantity or price precisely. Nothing was saved.');
        }
        $stmt=$this->conn->prepare('INSERT INTO tbl_pos_synced_group_selections (dataset,pos_detail_id,transaction_id,category_code,unit_code,terminal_number,selection_json,line_label) VALUES (?,?,?,?,?,?,?,?)');
        $stmt->execute([$dataset,$detailId,(string)($row['transaction_id']??''),(string)($row['Category_Code']??''),(string)($row['Unit_Code']??''),(string)($row['terminal_number']??''),json_encode($selection,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),(string)($row['group_line_label']??'')]);
    }
    public function annotate(array $details, string $dataset='LIVE'): array
    {
        if(!$details || !$this->installed()) return $details;
        $ids=array_values(array_unique(array_map(static fn($r)=>(string)$r['ID'],$details)));
        $marks=implode(',',array_fill(0,count($ids),'?'));
        $stmt=$this->conn->prepare("SELECT * FROM tbl_pos_synced_group_selections WHERE dataset=? AND pos_detail_id IN ($marks)");
        $stmt->execute(array_merge([$dataset],$ids)); $map=[];
        foreach($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $map[(string)$r['pos_detail_id']]=$r;
        foreach($details as &$r) {
            $saved=$map[(string)$r['ID']]??null; if(!$saved) continue;
            if((string)$saved['transaction_id']!==(string)$r['transaction_id'] || (string)$saved['unit_code']!==(string)$r['Unit_Code'] || (string)$saved['category_code']!==(string)$r['Category_Code'] || (string)$saved['terminal_number']!==(string)($r['terminal_number']??'')) throw new RuntimeException('A product selection does not match its sale.');
            $r['group_selection']=json_decode($saved['selection_json'],true,512,JSON_THROW_ON_ERROR);
            $r['group_line_label']=$saved['line_label']; self::validate($r);
        }
        unset($r); return $details;
    }
    /** null = legacy recipe; [] = an explicitly configured recipe with no stock ingredients. */
    public static function inventoryComponents(array $detail): ?array
    {
        $s=self::validate($detail);
        if ($s===null || ($s['schema_version']??1)!==2) return null;
        $components=$s['recipe_snapshot']['components']; $quantity=(float)$detail['sales_quantity'];
        $total=array_sum(array_map(static fn($c)=>(float)$c['qty'],$components));
        $cost=$quantity*(float)($detail['unit_cost']??0); $allocated=0.0; $result=[];
        foreach($components as $index=>$c) {
            $partCost=$index===count($components)-1 ? $cost-$allocated : ($total>0?$cost*(float)$c['qty']/$total:0);
            $allocated+=$partCost;
            $result[]=['component_code'=>$c['component_code'],'component_class'=>$c['component_class'],
                'qty'=>$quantity*(float)$c['qty'],'uomval'=>(float)$c['uomval'],'uom'=>$c['uom'],
                'category'=>trim((string)($c['category']??''))?:'OTHERS','allocatedCost'=>$partCost];
        }
        return $result;
    }
}
