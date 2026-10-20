# Product groups and sizes

The online Product Build form creates one product per flavor/variant, with sizes
as child options. A group name may be selected or typed. The requested 9″, 12″,
16″ choices each have separate whole prices, costs and ingredient quantities.
Half portions use 50%; two variants use half of each selected size's price/recipe.

Opening a group or scanning a grouped code opens one full-screen modal with
**Size, Whole or Half, and Flavor / variant** together. Sizes use natural numeric
order (9, 12, 16). Size, portion and flavor require explicit choices; portion
controls unlock after a size is chosen, and flavor cards unlock after a portion
is chosen. A whole item offers one flavor or two flavors, half each; a half item
takes one flavor. Flavor cards show prices for the selected size and portion.
Changing size clears the portion and flavors; changing portion or the number of
flavors clears the dependent flavor choices. The selection summary, quantity,
total and Add to cart action stay visible while browsing the choices.

Apply the local migrations, in order:

1. `database/2026-10-19_pos_product_groups.sql`
2. `database/2026-10-19_pos_product_group_sizes.sql`
3. `database/2026-10-19_pos_product_group_aliases.sql` (optional existing-product mappings)

Update this app's frontend/backend together, then preview/apply Products and
Pricing Sync. New sizes do not create master products or replace base recipes.
Old single-size groups and ordinary products remain supported. Configured size
choices need a price for the active service list and a completed recipe (or an
explicit confirmation that the size needs no ingredient stock).

Optional mappings connect older size/half records to an existing grouped product
and its saved size, through the online Product groups editor and the existing
product/pricing sync. An empty mapped size ID is supported only for a legacy
grouped product that already represents one size. The register replaces the old
tile with the group only when that exact target is enabled and ready under the
current service type. Otherwise the old item remains available normally. A
mapped barcode opens the same full-screen picker. Half prices come from the
selected whole price, not the old half-product price. Saved old sales retain
their original product codes and prices. Removing a mapping restores the old
tile; no master records or historical transactions are deleted.

The optional sync field is `group_alias: {canonical_build_code, size_id, enabled}`.
An omitted field from an older server preserves local mappings; explicit null or
disabled metadata turns them off. Missing alias tables omit runtime metadata,
and syncing enabled mappings requires the alias migration before catalog writes.

The central API also needs its corresponding size migration and
`2026-10-19_pos_synced_group_selections.sql`, with the new online snapshot receiver
and journal helpers. Full rollout instructions live in the main project at
`lightemcoredarkweb/docs/product-groups.md`.

Saved selections keep stable size IDs and immutable ingredient snapshots. LIVE
and REPORT exports retain them after verifying report-to-source mapping and all
physical details. A stale/incomplete report copy stops sync with a refresh
instruction. Old uploads cannot erase existing online snapshots. Fractional
quantities and precise prices must fit the existing sale-detail columns;
transactional catalog/destination storage is required before enabled group sync.

No existing master, recipe, price or sale data is changed by the migrations.
Old separate-size/half products are not automatically deleted or merged.
Grouped item transfers/split bills and item-only QR printing remain unsupported;
use a complete order and its receipt. Include all optional tables in backups.
