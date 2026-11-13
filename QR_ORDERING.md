# QR ordering on the restaurant Wi-Fi

The installed Restobill desktop app hosts the customer menu on TCP port **8787**. A phone sends its order to that computer; the computer calls the existing PHP API, which saves it in the same MySQL database as the POS. The cashier reviews the pending order before accepting it as an unpaid POS transaction.

## Prepare the POS computer

Keep the existing PHP web server and MySQL service running on the POS computer. The Electron installer packages the ordering website and local HTTP host; **PHP and MySQL still need the existing backend installation**. Configure those existing services to start with the computer if they should be available after every restart.

Serve the updated `backend/` files through the normal POS API location. Keep the database connection in `backend/api/config.php` and the existing authentication environment configured. The authenticated QR actions require the same valid `SECRET_KEY`, environment loader and staff session as the other secured POS endpoints.

The frontend endpoint is defined in `.env`:

```dotenv
VITE_POS_QR_ORDERING_ENDPOINT=/api/qr-ordering.php
```

`useApiHost` combines that endpoint with the configured local API host. In development it reads the `LOCAL` entry in `public/ip.txt`; installed Electron reads the bundled `resources/ip.txt`. For a backend served at the root of the local web server, the entry is:

```text
LOCAL: http://localhost
```

Use the actual existing local API host or path if your installation differs. Phones use the generated Wi-Fi link, so they do not need a copy of `ip.txt`, database credentials or access tokens. They communicate through the POS host rather than connecting directly to MySQL.

## Apply the database update

Use the database already configured for this POS. The examples below use `db_cnc_pos`; replace the database and `YOUR_DB_USER` when deploying elsewhere. Run commands from the project root. `-p` prompts for the database password.

First, these read-only checks confirm the selected schema, transaction table engines and whether per-item notes already exist:

```sh
mysql -u YOUR_DB_USER -p db_cnc_pos
```

```sql
SELECT DATABASE();

SELECT TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'tbl_pos_transactions', 'tbl_pos_transactions_detailed',
    'tbl_pos_document_counters', 'tbl_pos_shifting_records',
    'tbl_main_activity_logs', 'tbl_main_transaction_logs',
    'tbl_pos_qr_hosts', 'tbl_pos_qr_orders', 'tbl_pos_qr_order_items'
  );

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'tbl_pos_transactions_detailed'
  AND COLUMN_NAME = 'item_instruction';
```

The existing transaction, counter and log tables must use InnoDB for acceptance and rollback to remain atomic. Leave unrelated table structure unchanged.

After exiting the MySQL prompt, create the QR tables:

```sh
mysql -u YOUR_DB_USER -p db_cnc_pos < database/2026-11-12_qr_ordering.sql
```

The migration contains the complete `CREATE TABLE IF NOT EXISTS` commands for `tbl_pos_qr_hosts`, `tbl_pos_qr_orders` and `tbl_pos_qr_order_items`, all using InnoDB and `utf8mb4_general_ci`.

For table availability and additional orders, also apply the idempotent continuation migration:

```sh
mysql -u YOUR_DB_USER -p db_cnc_pos < database/2026-11-13_qr_order_continuation.sql
```

This adds only nullable `tbl_pos_qr_orders.continuation_order_id` (`CHAR(36)`, `utf8mb4_general_ci`); it does not create another table or change existing orders.

**Only if the column check returned no row**, apply the existing item-note migration once:

```sh
mysql -u YOUR_DB_USER -p db_cnc_pos < database/2026-10-21_pos_order_item_instruction.sql
```

Do not reapply that `ALTER TABLE` when `item_instruction` already exists.

## Build and run

```sh
npm run build
npm run dev:electron
```

The Wi-Fi host serves the built `dist/` assets even during Electron development. Rebuild after customer-page changes. For a Windows installer, use the project's existing `npm run dist` command; for macOS, use `npm run dist:mac`.

The local host starts automatically when Electron opens. On the first run, sign in, select the restaurant branch and open the normal POS screen. QR setup then stores the branch and private host configuration under the application's user-data directory at `config/qr-ordering.json`. Later launches reuse this configuration automatically. Keep this file private; it is not served to customers.

The app must remain running and the computer awake to receive orders. The existing PHP/MySQL services must also remain available. Core local ordering does not require Internet access once the app, menu, pricing and required data are installed locally.

## Connect phones and create table QR codes

1. Connect the POS computer and phones to the same reachable Wi-Fi/LAN. Ethernet for the POS is also supported when the router bridges it to the phones' Wi-Fi.
2. Allow Restobill through the computer firewall on the **private network**, TCP **8787**. The router's guest/client isolation must allow phones to reach the POS computer.
3. In the POS, open **QR Orders → Wi-Fi & QR codes**. The panel shows server status and available network addresses.
4. Select the address for the restaurant network. Choose a table or the general menu, then use **Save QR code** to download an SVG for printing.
5. Scan the code on a phone and place an order. A typical link is `http://192.168.1.10:8787/#/qr-order?table=Table%2001`; use the address generated for your computer.

A router DHCP reservation for the POS computer keeps printed QR codes valid. If its IP address changes, reconnect the host and regenerate the codes. If there are several network addresses, select the one reachable from customer Wi-Fi, rather than a VPN or virtual adapter.

## Cashier workflow

Open the terminal's normal shift and use an account with permission to create transactions. **QR Orders** refreshes the pending queue automatically.

- **Accept into POS** creates an unpaid transaction using the existing POS numbering, transaction details and open-shift business date.
- **Accept & print** saves first, then uses the existing category-based kitchen printer configuration. A print failure leaves the accepted order saved; retry printing without accepting it again. If supported printing fails, the existing PDF fallback is offered. Check any partially printed tickets before retrying.
- **Reject** records the optional reason and updates the customer's status page.

Continue through the normal billing and payment screens. Tables with an active unpaid transaction are unavailable to new QR guests. A guest who already has an accepted order can use **Add more** on the same phone to continue that table's visit. The server verifies the previous order's private tracking token before allowing this continuation.

Accepting an additional batch appends only its new items to the same unpaid transaction. Existing item rows, table, headcount and transaction identity are retained. If payment completed before acceptance, a free table starts a new transaction; a table now occupied by another visit cannot be claimed using an old receipt. Pending QR requests do not reserve a table, and availability is checked again when the cashier accepts.

If the transaction was already billed, accepting another batch requires the normal **Billing** step again before payment, so discounts and service charges are recalculated together. The cashier sees this reminder. A POS order screen opened before the new batch arrived must reload before saving changes, preventing its older cart from removing the QR additions. **Accept & print** labels an appended batch as an additional order and prints only its new items.

Prices come from the local active catalog and sales-type pricing. The server validates the table, quantity and price again; the phone cannot set authoritative prices. If an item is removed or its price changes before acceptance, the cashier must reject that order and ask for a fresh submission.

Guest order notes and individual item instructions are retained. Menu/cart amounts and any submitted service-charge amount are estimates; discounts, service charges and the final amount due are resolved by the normal POS billing/payment flow. An accepted QR status means the order entered the POS, not that payment has been collected.

## Troubleshooting and verification

| Symptom | Check |
| --- | --- |
| Phone cannot open the link | POS app is open, computer is awake, correct LAN address, same reachable Wi-Fi, private firewall access to 8787, router isolation. |
| Port is already in use | Close the other process using 8787, then use **Reconnect ordering server**. |
| Database service unavailable | Existing PHP/MySQL services, configured local API host and backend files. |
| Database update required | QR migration and the `item_instruction` column in the same database used by the backend. |
| No menu items | Active products, branch assignments and configured sales-type prices in the local database. |
| Acceptance requires an open shift | Open a shift for the selected branch and terminal. |
| Missing customer-page changes | Run `npm run build` again and reload the phone page. |

Useful automated checks:

```sh
node --test electron/__tests__/*.test.cjs
node --test src/utils/__tests__/printQrOrder.test.mjs src/utils/__tests__/qrOrderDraft.test.mjs
php backend/tests/qr_ordering_test.php
```

The MySQL integration suite is opt-in and creates a disposable database from local table structures. See `backend/tests/qr_order_mysql_integration_test.php` for its environment variables before running it. Automated tests do not verify the restaurant router, a real phone or a physical printer; perform one end-to-end check on the actual installation.

## Implementation files

The host implementation was based on inspected `electron/main.cjs`, `electron/preload.cjs`, `package.json`, `vite.config.js`, `public/ip.txt`, the existing API-host hook, and the normal POS printing code in `Orderlist.jsx`, `BuildOrderlistPrintHtml.jsx` and `printWithPdfFallback.js`.

| Files added or changed | Purpose |
| --- | --- |
| `electron/qrOrderingServer.cjs`, `electron/main.cjs`, `electron/preload.cjs` | Automatic Wi-Fi host, private persisted setup, safe public proxy and operator controls. |
| `electron/__tests__/qrOrderingServer.test.cjs`, existing Electron test mocks | Network, file-access, proxy, startup/shutdown and trusted-window checks. |
| `backend/api/qr-ordering.php`, `backend/src/QrOrderGateway.php`, `backend/api/save_order.php` | Public order intake, authenticated review and reuse of normal POS transaction saving. |
| `database/2026-11-12_qr_ordering.sql` | Pending-order, item and host tables. |
| `.env`, `src/hooks/useQrOrders.js`, `src/hooks/useQrGuestApi.js` | Endpoint configuration, cashier queue and same-origin guest requests. |
| `src/App.jsx`, `src/pages/QrOrderingPage.jsx`, `src/components/QrOrdering/` | Guest ordering route, menu/cart, status, cashier inbox and downloadable table QR codes. |
| `src/components/layout/_layoutpos.jsx`, `src/components/MainComponents/ViewOrdering.jsx` | QR Orders entry points in the POS. |
| `src/utils/printQrOrder.js`, `src/utils/__tests__/printQrOrder.test.mjs` | Mapping QR items to existing printers and safe PDF fallback. |
| `src/utils/qrOrderDraft.js`, related draft tests, `src/hooks/useApiHost.jsx` | Recoverable customer drafts and guest-page isolation. |

The integration maps guest `quantity` to POS `sales_quantity`, guest `notes` to transaction `special_instructions`, and stored `item_instruction` to the printer's `itemInstruction`. Category/unit scope is supplied by the configured POS host. Customer request identifiers prevent duplicate orders on retry; repeated acceptance returns the saved transaction without appending again. Optional `continuation_order_id` and `continuation_tracking_token` identify a previous accepted QR order; the phone cannot select a POS transaction ID. Normal POS replacement saves send an immutable `original_cart_items` snapshot to detect changes since the cashier opened the order.

Backend inspection also covered the CSVs for products, pricing details, sales-type pricing, sales types, business units, POS tables, transactions/details, shifts, settings, counters and audit logs; the corresponding PHP order, pricing, auth, table and shift endpoints; and the installed MySQL table definitions. `database/schema.sql` and `database/README.md` are absent, and the product CSV contains pre-existing merge markers. Existing queries and live definitions were used to resolve the schema ambiguities. The installed audit log has a legacy integer `Unit_Code` column while branch identifiers are strings; that existing schema was left unchanged. Deployments using strict SQL mode must reconcile their legacy POS schema with the normal order writer before using either order path.

## Verification on 12 November 2026

- Applied the three QR `CREATE TABLE` statements to the local `db_cnc_pos` database and confirmed `utf8mb4_general_ci` on each table.
- Added the missing nullable `tbl_pos_transactions_detailed.item_instruction` column using the existing migration. No customer sales were inserted by testing.
- Production Vite build passed; 39 Node/Electron checks, 26 PHP QR validation checks, 58 existing item-instruction checks and 42 isolated MySQL integration checks passed.
- Tested the customer flow in Brave with a temporary synthetic menu: table/pax, adding items, review, kitchen notes, order submission, an additional batch, and order-history persistence after reload. The temporary preview server was stopped afterwards.
- Two unrelated report regression scripts still fail on existing backfill code (`pos_report_mirror_enrollment_test.php` and `pos_report_activation_split_test.php`).

These changes are in this project checkout. The separately installed XAMPP backend has a different `save_order.php` and was not overwritten. Deploy the updated backend (including its referenced source files) and rebuild/reinstall or run this Electron project before using the feature in the installed POS. A real phone over restaurant Wi-Fi and physical printers have not been tested here.

## Local installation completed later on 12 November 2026

At the user's request, the deployment described above was completed on this Mac:

- Installed and launched the arm64 app at `/Applications/Lightem Pos.app`.
- Updated the local XAMPP QR endpoint, gateway and shared order writer, preserving its existing product-group processing and runtime configuration. Backups are in `release/local-backend-backup/20261112-153938`.
- Confirmed the installed backend uses **`grumpyjoe_pos` / `grumpyjoe_pos_report`**, rather than the checkout's `db_cnc_pos`. Applied the QR tables and missing nullable item-note column to that active POS database.
- Configured the persisted host for **GRUMPYJOE / GIBRALTAR**. Improved the QR catalog's latest-price lookup after live-data testing exposed a slow correlated query.
- Added **Table 01–Table 05**, Available with transaction reference 0, after the user requested five initial tables. No sales or customer orders were created during installation.
- Verified the installed host's menu at `http://192.168.100.73:8787/qr-api/menu`: 380 priced products, both DINE IN and TAKE OUT, and all five tables.
- Saved `Restobill QR Ordering.png` and `Restobill QR Instructions.txt` on the user's Desktop. Independently decoded the PNG to verify its URL is `http://192.168.100.73:8787/#/qr-order`.

The app remains running. A phone must join the same reachable Wi-Fi; retain the current LAN IP or regenerate the code after it changes. A physical phone scan and physical printer output still require the user's devices.

## Table visits update installed on 13 November 2026

- Updated `/Applications/Lightem Pos.app` and the active XAMPP backend; applied `2026-11-13_qr_order_continuation.sql` to `grumpyjoe_pos`.
- Verified live availability: Tables 01 and 03 had unpaid transactions and were unavailable to new guests; Tables 02, 04 and 05 were available. Pending requests alone do not reserve tables.
- Added the verified-receipt continuation fields, safe append logic, payment/re-billing checks and protection against older POS carts overwriting added QR items. No new tables were required.
- Inspected the tables, transactions, detail, payment and QR schemas; `save_order.php`, `update_order.php`, `billing.php`, both payment writers, `PosCurrentBillItems.php`, the guest UI, host proxy and kitchen print helper. The table master `status` / `transaction_reference` fields are not maintained consistently by POS saving/payment, so occupancy is derived from the scoped active transaction headers and payment records.
- Changed `QrOrderGateway.php`, `qr-ordering.php`, `save_order.php`, `update_order.php`, `billing.php`, both payment writers and `PosCurrentBillItems.php`; added `PosOrderSnapshot.php`. Updated `GuestOrdering.jsx`, `useQrGuestApi.js`, `qrOrderDraft.js`, `Orderlist.jsx`, `QrOrdersInbox.jsx`, `printQrOrder.js`, the host proxy and their regression tests. Installed product-group handling and runtime configuration were preserved.
- Validation passed: production Vite build, arm64 packaging/signature verification, 92 JavaScript checks, 232 PHP unit/endpoint checks, 66 isolated QR MySQL checks and 18 isolated POS-edit MySQL checks. Tests included simultaneous acceptances and payment winning the transaction lock. Test databases were removed; testing created no production orders.
- Safari UI verification used an isolated fixture: an occupied table was disabled; two accepted batches used the same transaction; both became Paid and left the running estimate; a later order used a new transaction. Physical printing and a phone scan were not performed during this update.
- The Mac's LAN address changed to `192.168.100.92`. Refreshed and independently decoded the Desktop QR PNG for `http://192.168.100.92:8787/#/qr-order`; the LAN menu returns HTTP 200. Guest receipt history is stored per browser/origin, so continuing a visit uses the same phone/browser address and its saved receipt.
- Backend rollback files and pre-migration schema: `release/local-backend-backup/20261113-103016`. Previous installed app: `release/local-app-backup/20261113-qr-visits/Lightem Pos.app`.

Lightem Pos was reopened at its login screen. The QR host starts automatically from its existing configuration; the cashier should sign in again to review and accept orders. Customers should refresh their menu to load the updated behavior.
