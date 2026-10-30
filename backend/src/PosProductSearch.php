<?php

/**
 * Partial-word matching for the pricing query's T1/T2 aliases.
 * Every term must match a field, but words may appear in any order.
 */
function posProductSearchPredicate(string $search): array
{
    // Keep this list aligned with the Digital Menu filter in Orderlist.jsx.
    $fields = [
        "T2.item_name",
        "T2.item_description",
        "T2.item_category",
        "T2.subcategory_item_category",
        "T1.inv_code",
        "T2.sku",
        "T2.bar_code",
        "T2.unit_of_measure",
        "T2.inventory_type",
    ];
    $terms = preg_split('/\s+/u', trim($search), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $terms = array_values(array_unique($terms));
    $clauses = [];
    $params = [];
    $orderBy = 'T2.item_name ASC';

    foreach ($terms as $termIndex => $term) {
        // Treat SQL wildcard characters as literal product text, like the UI.
        $pattern = '%' . strtr($term, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
        $matches = [];
        foreach ($fields as $fieldIndex => $field) {
            // PDO native prepared statements need a unique name per occurrence.
            $placeholder = ":product_search_{$termIndex}_{$fieldIndex}";
            $matches[] = "LOWER(COALESCE({$field}, '')) LIKE LOWER({$placeholder}) ESCAPE '!'";
            $params[$placeholder] = $pattern;
        }
        $clauses[] = '(' . implode(' OR ', $matches) . ')';
    }

    if ($clauses) {
        // Retail Enter searches with a small LIMIT, then checks for an exact
        // SKU. Keep that exact match ahead of broader category/text matches.
        $params[':product_search_exact_sku'] = trim($search);
        $orderBy = "CASE WHEN LOWER(TRIM(COALESCE(T2.sku, ''))) = LOWER(:product_search_exact_sku)
                    THEN 0 ELSE 1 END, T2.item_name ASC";
    }

    return [
        'sql' => implode(' AND ', $clauses),
        'params' => $params,
        'order_by' => $orderBy,
    ];
}
