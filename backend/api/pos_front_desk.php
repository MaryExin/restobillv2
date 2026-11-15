<?php
declare(strict_types=1);

/**
 * Hotel front desk (no PMS). See pos_hotel_ledger.php for the accounting rules.
 *
 * GET  ?view=summary                      in-house guests with balances, rooms by floor,
 *                                         settlement modes, city ledger accounts, comp types
 * GET  ?view=in_house                     in-house guests only (payment screen / room service)
 * GET  ?view=folio&id=                    one stay: charges, collections, balance
 * GET  ?view=stays&from=&to=              checked-out / cancelled stays (by check-in date)
 * GET  ?view=city_ledger                  company accounts with balances
 * GET  ?view=statement&account_id=        one company account: charges, collections, balance
 * GET  ?view=collections&from=&to=        collections (folio + city ledger)
 * GET  ?view=complimentary&from=&to=      complimentary log
 * GET  ?view=approvers                    admins who can approve a complimentary
 * GET  ?view=room_nights&date=            night audit: unposted room nights of in-house guests
 *                                         through the business date (&id= one stay, &for=checkout)
 * GET  ?view=aging                        city ledger balances by age (FIFO: payments clear the
 *                                         oldest charges first)
 *
 * POST {action: "check_in", room_name, guest_name, guest_contact, guest_count,
 *       expected_check_out, notes}
 * POST {action: "update_stay", id, room_name, guest_name, guest_contact, guest_count,
 *       expected_check_out, notes}
 * POST {action: "cancel_stay", id}                         only when the folio has no activity
 * POST {action: "collect", id, payments: [{payment_method, payment_amount, payment_reference}],
 *       terminal_number, remarks}                           deposit / partial payment
 * POST {action: "check_out", id, payments: [...], terminal_number, remarks}
 *       payments must settle the whole balance
 * POST {action: "save_account", id?, company_name, contact_person, contact_number, email,
 *       address, tin, credit_limit, status}
 * POST {action: "collect_account", account_id, payments: [...], terminal_number, remarks}
 * POST {action: "void_collection", collection_no, reason, approver_id, approver_password}
 *
 * Access: Front Desk permission (routes.frontDesk). The in-house list and the
 * approvers are also readable with New Transaction / Payment access (payment
 * screen, room service).
 */

require __DIR__ . "/secure_guard.php";
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
require_once __DIR__ . "/pos_hotel_ledger.php";
date_default_timezone_set("Asia/Manila");

function respondFrontDesk(bool $success, string $message, $data = null, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function fdText($value, int $max): string
{
    return mb_substr(trim(preg_replace('/\s+/', ' ', (string)$value)), 0, $max);
}

function fdDate($value): ?string
{
    $text = trim((string)$value);
    if ($text === "") {
        return null;
    }
    $date = DateTime::createFromFormat("Y-m-d", $text);
    if (!$date || $date->format("Y-m-d") !== $text) {
        throw new PosHotelLedgerException("Invalid date: {$text}.");
    }
    return $text;
}

function fdRange(): array
{
    $from = fdDate($_GET["from"] ?? "") ?? date("Y-m-d");
    $to = fdDate($_GET["to"] ?? "") ?? $from;
    if ($to < $from) {
        list($from, $to) = [$to, $from];
    }
    return [$from . " 00:00:00", $to . " 23:59:59"];
}

function fdRoomsByFloor(PDO $pdo, array $scope): array
{
    $stmt = $pdo->prepare("
        SELECT DISTINCT table_name FROM tbl_pos_tables
        WHERE category_code = :cc AND unit_code = :uc
        ORDER BY table_name ASC
    ");
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
    $all = array_map(function ($row) {
        return (string)$row["table_name"];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));

    $floors = [];
    $assigned = [];
    if (posHotelTableExists($pdo, "tbl_pos_table_rooms")) {
        $floorStmt = $pdo->prepare("
            SELECT room_name, tables_json FROM tbl_pos_table_rooms
            WHERE category_code = :cc AND unit_code = :uc AND is_active = 1
            ORDER BY sort_order ASC, ID ASC
        ");
        $floorStmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
        foreach ($floorStmt->fetchAll(PDO::FETCH_ASSOC) as $floor) {
            $names = json_decode((string)($floor["tables_json"] ?? "[]"), true);
            $rooms = [];
            foreach (is_array($names) ? $names : [] as $name) {
                $name = (string)$name;
                if (in_array($name, $all, true) && !isset($assigned[$name])) {
                    $rooms[] = $name;
                    $assigned[$name] = true;
                }
            }
            if ($rooms) {
                $floors[] = ["floor" => (string)$floor["room_name"], "rooms" => $rooms];
            }
        }
    }
    $others = array_values(array_filter($all, function ($name) use ($assigned) {
        return !isset($assigned[$name]);
    }));
    if ($others) {
        $floors[] = ["floor" => $floors ? "Other" : "Rooms", "rooms" => $others];
    }
    return $floors;
}

function fdStayRow(array $row, ?float $balance = null): array
{
    $out = [
        "id" => (int)$row["ID"],
        "folio_no" => (string)$row["folio_no"],
        "room_name" => (string)$row["room_name"],
        "guest_name" => (string)$row["guest_name"],
        "guest_contact" => (string)($row["guest_contact"] ?? ""),
        "guest_count" => (int)$row["guest_count"],
        "check_in_at" => (string)$row["check_in_at"],
        "expected_check_out" => $row["expected_check_out"] !== null ? (string)$row["expected_check_out"] : "",
        "room_rate" => isset($row["room_rate"]) && $row["room_rate"] !== null ? (float)$row["room_rate"] : null,
        "check_out_at" => $row["check_out_at"] !== null ? (string)$row["check_out_at"] : "",
        "status" => (string)$row["status"],
        "notes" => (string)($row["notes"] ?? ""),
        "created_by" => (string)($row["created_by"] ?? ""),
        "checked_out_by" => (string)($row["checked_out_by"] ?? ""),
    ];
    if ($balance !== null) {
        $out["balance"] = $balance;
    }
    return $out;
}

function fdInHouse(PDO $pdo, array $scope): array
{
    $stmt = $pdo->prepare("
        SELECT s.*,
            COALESCE((SELECT SUM(c.amount) FROM tbl_pos_ar_charges c
                      WHERE c.ledger_type = 'FOLIO' AND c.stay_id = s.ID AND c.status = 'Active'), 0) AS total_charges,
            COALESCE((SELECT SUM(p.payment_amount) FROM tbl_pos_ar_collections p
                      WHERE p.ledger_type = 'FOLIO' AND p.stay_id = s.ID AND p.status = 'Active'), 0) AS total_paid
        FROM tbl_pos_hotel_stays s
        WHERE s.Category_Code = :cc AND s.Unit_Code = :uc AND s.status = 'In-House'
        ORDER BY s.room_name ASC
    ");
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
    return array_map(function ($row) {
        $stay = fdStayRow($row, posHotelMoney((float)$row["total_charges"] - (float)$row["total_paid"]));
        $stay["total_charges"] = posHotelMoney($row["total_charges"]);
        $stay["total_paid"] = posHotelMoney($row["total_paid"]);
        return $stay;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function fdAccountRow(array $row, ?float $balance = null): array
{
    $out = [
        "id" => (int)$row["ID"],
        "account_code" => (string)$row["account_code"],
        "company_name" => (string)$row["company_name"],
        "contact_person" => (string)($row["contact_person"] ?? ""),
        "contact_number" => (string)($row["contact_number"] ?? ""),
        "email" => (string)($row["email"] ?? ""),
        "address" => (string)($row["address"] ?? ""),
        "tin" => (string)($row["tin"] ?? ""),
        "credit_limit" => $row["credit_limit"] !== null ? (float)$row["credit_limit"] : null,
        "status" => (string)$row["status"],
    ];
    if ($balance !== null) {
        $out["balance"] = $balance;
    }
    return $out;
}

function fdAccounts(PDO $pdo, array $scope, bool $activeOnly): array
{
    $stmt = $pdo->prepare("
        SELECT a.*,
            COALESCE((SELECT SUM(c.amount) FROM tbl_pos_ar_charges c
                      WHERE c.ledger_type = 'CITY_LEDGER' AND c.account_id = a.ID AND c.status = 'Active'), 0)
          - COALESCE((SELECT SUM(p.payment_amount) FROM tbl_pos_ar_collections p
                      WHERE p.ledger_type = 'CITY_LEDGER' AND p.account_id = a.ID AND p.status = 'Active'), 0) AS balance
        FROM tbl_pos_city_ledger_accounts a
        WHERE a.Category_Code = :cc AND a.Unit_Code = :uc" . ($activeOnly ? " AND a.status = 'Active'" : "") . "
        ORDER BY a.company_name ASC
    ");
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
    return array_map(function ($row) {
        return fdAccountRow($row, posHotelMoney($row["balance"]));
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function fdLedgerLines(PDO $pdo, string $ledgerType, int $id): array
{
    $column = $ledgerType === "FOLIO" ? "stay_id" : "account_id";
    $charges = $pdo->prepare("
        SELECT ID, source, transaction_id, invoice_no, collection_no, service_date, description, amount, status,
               reversed_reason, posted_by, charged_at
        FROM tbl_pos_ar_charges
        WHERE ledger_type = :lt AND {$column} = :id
        ORDER BY charged_at ASC, ID ASC
    ");
    $charges->execute([":lt" => $ledgerType, ":id" => $id]);
    $collections = $pdo->prepare("
        SELECT ID, collection_no, payment_method, payment_amount, payment_reference, cashier, remarks,
               status, void_reason, voided_by, voided_at, collected_at
        FROM tbl_pos_ar_collections
        WHERE ledger_type = :lt AND {$column} = :id
        ORDER BY collected_at ASC, ID ASC
    ");
    $collections->execute([":lt" => $ledgerType, ":id" => $id]);
    return [
        "charges" => array_map(function ($row) {
            $row["amount"] = posHotelMoney($row["amount"]);
            $row["invoice_no"] = $row["invoice_no"] !== null ? (int)$row["invoice_no"] : null;
            return $row;
        }, $charges->fetchAll(PDO::FETCH_ASSOC)),
        "collections" => array_map(function ($row) {
            $row["payment_amount"] = posHotelMoney($row["payment_amount"]);
            return $row;
        }, $collections->fetchAll(PDO::FETCH_ASSOC)),
        "balance" => posHotelBalance($pdo, $ledgerType, $id),
    ];
}

/** kind => mode name, e.g. ROOM_CHARGE => "Charge to Room". */
function fdSpecialMops(PDO $pdo): array
{
    $out = [];
    foreach (posHotelMopKinds($pdo) as $name => $kind) {
        $row = $pdo->prepare("SELECT mop FROM tbl_mode_of_payment WHERE LOWER(TRIM(mop)) = :name LIMIT 1");
        $row->execute([":name" => $name]);
        $out[$kind] = (string)$row->fetchColumn();
    }
    return $out;
}

/** Modes that can settle a balance: active, not Charge to Room / Complimentary. */
function fdSettlementModes(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT mop, reference_On_Off, mop_kind FROM tbl_mode_of_payment
        WHERE MOP_On_Off = 1
        ORDER BY seq ASC
    ")->fetchAll(PDO::FETCH_ASSOC);
    $out = [];
    foreach ($rows as $row) {
        $kind = strtoupper(trim((string)($row["mop_kind"] ?? "")));
        if ($kind === POS_HOTEL_KIND_ROOM_CHARGE || $kind === POS_HOTEL_KIND_COMPLIMENTARY) {
            continue;
        }
        $out[] = [
            "mop" => (string)$row["mop"],
            "reference_On_Off" => (int)$row["reference_On_Off"],
            "mop_kind" => $kind,
        ];
    }
    return $out;
}

function fdLoadStay(PDO $pdo, array $scope, int $id, bool $lock = false): array
{
    $stmt = $pdo->prepare("
        SELECT * FROM tbl_pos_hotel_stays
        WHERE ID = :id AND Category_Code = :cc AND Unit_Code = :uc
        LIMIT 1" . ($lock ? " FOR UPDATE" : ""));
    $stmt->execute([":id" => $id, ":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new PosHotelLedgerException("Guest folio not found.");
    }
    return $row;
}

function fdLoadAccount(PDO $pdo, array $scope, int $id, bool $lock = false): array
{
    $stmt = $pdo->prepare("
        SELECT * FROM tbl_pos_city_ledger_accounts
        WHERE ID = :id AND Category_Code = :cc AND Unit_Code = :uc
        LIMIT 1" . ($lock ? " FOR UPDATE" : ""));
    $stmt->execute([":id" => $id, ":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new PosHotelLedgerException("City ledger account not found.");
    }
    return $row;
}

function fdReadStayFields(PDO $pdo, array $scope, array $body, int $excludeId): array
{
    $room = fdText($body["room_name"] ?? "", 100);
    $guest = fdText($body["guest_name"] ?? "", 150);
    if ($room === "") {
        throw new PosHotelLedgerException("Select the room.");
    }
    if (mb_strlen($guest) < 2) {
        throw new PosHotelLedgerException("Enter the guest's name.");
    }
    $roomStmt = $pdo->prepare("
        SELECT 1 FROM tbl_pos_tables
        WHERE category_code = :cc AND unit_code = :uc AND table_name = :room
        LIMIT 1
    ");
    $roomStmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":room" => $room]);
    if ($roomStmt->fetchColumn() === false) {
        throw new PosHotelLedgerException("\"{$room}\" was not found.");
    }
    $occupied = $pdo->prepare("
        SELECT folio_no, guest_name FROM tbl_pos_hotel_stays
        WHERE Category_Code = :cc AND Unit_Code = :uc AND room_name = :room
          AND status = 'In-House' AND ID <> :id
        LIMIT 1
    ");
    $occupied->execute([
        ":cc" => $scope["category_code"],
        ":uc" => $scope["unit_code"],
        ":room" => $room,
        ":id" => $excludeId,
    ]);
    $other = $occupied->fetch(PDO::FETCH_ASSOC);
    if ($other) {
        throw new PosHotelLedgerException("{$room} is occupied by {$other['guest_name']} ({$other['folio_no']}).");
    }
    $count = (int)($body["guest_count"] ?? 1);
    if ($count < 1 || $count > 50) {
        throw new PosHotelLedgerException("Number of guests must be between 1 and 50.");
    }
    $checkout = fdDate($body["expected_check_out"] ?? "");
    if ($checkout !== null && $checkout < date("Y-m-d")) {
        throw new PosHotelLedgerException("Expected check-out cannot be in the past.");
    }
    $contact = fdText($body["guest_contact"] ?? "", 30);
    $notes = fdText($body["notes"] ?? "", 500);
    $rateText = trim((string)($body["room_rate"] ?? ""));
    if ($rateText !== "" && (!is_numeric($rateText) || (float)$rateText < 0 || (float)$rateText > 1000000)) {
        throw new PosHotelLedgerException("Room rate must be an amount, or blank for no room charge.");
    }
    return [
        "room_rate" => $rateText !== "" && (float)$rateText > 0 ? posHotelMoney($rateText) : null,
        "room_name" => $room,
        "guest_name" => $guest,
        "guest_contact" => $contact !== "" ? $contact : null,
        "guest_count" => $count,
        "expected_check_out" => $checkout,
        "notes" => $notes !== "" ? $notes : null,
    ];
}

/** "Y-m-d" business date from the request, default today. */
function fdBusinessDate($value): string
{
    return fdDate($value) ?? date("Y-m-d");
}

/** Last night a guest checking out on $businessDate must have paid for. */
function fdCheckoutThrough(array $stay, string $businessDate): string
{
    $checkIn = substr((string)$stay["check_in_at"], 0, 10);
    $before = date("Y-m-d", strtotime($businessDate . " -1 day"));
    return $before < $checkIn ? $checkIn : $before;
}

function fdAging(PDO $pdo, array $scope): array
{
    $today = new DateTime(date("Y-m-d"));
    $rows = [];
    $totals = ["current" => 0.0, "d31_60" => 0.0, "d61_90" => 0.0, "over_90" => 0.0, "balance" => 0.0];
    foreach (fdAccounts($pdo, $scope, false) as $account) {
        $charges = $pdo->prepare("
            SELECT amount, charged_at FROM tbl_pos_ar_charges
            WHERE ledger_type = 'CITY_LEDGER' AND account_id = :id AND status = 'Active'
            ORDER BY charged_at ASC, ID ASC
        ");
        $charges->execute([":id" => $account["id"]]);
        $paid = $pdo->prepare("
            SELECT COALESCE(SUM(payment_amount), 0) FROM tbl_pos_ar_collections
            WHERE ledger_type = 'CITY_LEDGER' AND account_id = :id AND status = 'Active'
        ");
        $paid->execute([":id" => $account["id"]]);
        $credit = (float)$paid->fetchColumn();
        $bucket = ["current" => 0.0, "d31_60" => 0.0, "d61_90" => 0.0, "over_90" => 0.0];
        foreach ($charges->fetchAll(PDO::FETCH_ASSOC) as $charge) {
            $amount = (float)$charge["amount"];
            $applied = min($credit, $amount);
            $credit -= $applied;
            $open = posHotelMoney($amount - $applied);
            if ($open <= 0) {
                continue;
            }
            $days = (int)$today->diff(new DateTime(substr((string)$charge["charged_at"], 0, 10)))->days;
            $key = $days <= 30 ? "current" : ($days <= 60 ? "d31_60" : ($days <= 90 ? "d61_90" : "over_90"));
            $bucket[$key] += $open;
        }
        if ($credit > 0.005) {
            // Advance payment: shown as a negative current amount.
            $bucket["current"] -= $credit;
        }
        $bucket = array_map("posHotelMoney", $bucket);
        $balance = posHotelMoney(array_sum($bucket));
        if (abs($balance) < 0.005 && $account["status"] !== "Active") {
            continue;
        }
        foreach ($bucket as $key => $value) {
            $totals[$key] += $value;
        }
        $totals["balance"] += $balance;
        $rows[] = array_merge([
            "id" => $account["id"],
            "account_code" => $account["account_code"],
            "company_name" => $account["company_name"],
            "credit_limit" => $account["credit_limit"],
            "balance" => $balance,
        ], $bucket);
    }
    return ["rows" => $rows, "totals" => array_map("posHotelMoney", $totals)];
}

/** Front Desk permission once it exists in the role tables; older role data falls back to the POS pages. */
function fdRequireAccess(PDO $pdo, string $userId, bool $readOnlyLookup): void
{
    $pairs = [["routes", "frontDesk"]];
    $defined = false;
    try {
        $stmt = $pdo->query("
            SELECT 1 FROM tbl_pos_permissions
            WHERE permission_group = 'routes' AND permission_key = 'frontDesk' AND is_active = 1
            LIMIT 1
        ");
        $defined = $stmt !== false && $stmt->fetchColumn() !== false;
    } catch (Throwable $e) {
        $defined = false;
    }
    if (!$defined) {
        $pairs = [["routes", "reservations"], ["routes", "newTransaction"], ["routes", "payment"]];
    } elseif ($readOnlyLookup) {
        $pairs[] = ["routes", "newTransaction"];
        $pairs[] = ["routes", "payment"];
    }
    posRoleAuthRequireAnyPermission($pdo, $userId, $pairs);
}

function fdPayments(array $body): array
{
    $payments = $body["payments"] ?? [];
    return is_array($payments) ? array_values(array_filter($payments, "is_array")) : [];
}

function fdPaymentsTotal(array $payments): float
{
    $total = 0.0;
    foreach ($payments as $payment) {
        $total += posHotelMoney($payment["payment_amount"] ?? 0);
    }
    return posHotelMoney($total);
}

try {
    $requestedView = $_SERVER["REQUEST_METHOD"] === "GET" ? (string)($_GET["view"] ?? "summary") : "";
    fdRequireAccess(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        in_array($requestedView, ["in_house", "approvers"], true)
    );

    posHotelEnsureSchema($pdo);
    posHotelEnsureSpecialMops($pdo);
    $scope = posHotelResolveScope($pdo);
    $userId = (string)($GLOBALS["pos_user_id"] ?? "");

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $view = (string)($_GET["view"] ?? "summary");

        if ($view === "summary") {
            respondFrontDesk(true, "OK", [
                "in_house" => fdInHouse($pdo, $scope),
                "rooms" => fdRoomsByFloor($pdo, $scope),
                "settlement_modes" => fdSettlementModes($pdo),
                "accounts" => fdAccounts($pdo, $scope, true),
                "comp_types" => POS_HOTEL_COMP_TYPES,
                "special_mops" => fdSpecialMops($pdo),
            ]);
        }
        if ($view === "in_house") {
            respondFrontDesk(true, "OK", [
                "in_house" => fdInHouse($pdo, $scope),
                "accounts" => fdAccounts($pdo, $scope, true),
                "comp_types" => POS_HOTEL_COMP_TYPES,
            ]);
        }
        if ($view === "folio") {
            $stay = fdLoadStay($pdo, $scope, (int)($_GET["id"] ?? 0));
            respondFrontDesk(true, "OK", array_merge(
                ["stay" => fdStayRow($stay)],
                fdLedgerLines($pdo, "FOLIO", (int)$stay["ID"])
            ));
        }
        if ($view === "stays") {
            list($from, $to) = fdRange();
            $stmt = $pdo->prepare("
                SELECT * FROM tbl_pos_hotel_stays
                WHERE Category_Code = :cc AND Unit_Code = :uc
                  AND status <> 'In-House'
                  AND check_in_at BETWEEN :from AND :to
                ORDER BY check_in_at DESC
            ");
            $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":from" => $from, ":to" => $to]);
            respondFrontDesk(true, "OK", array_map(function ($row) {
                return fdStayRow($row);
            }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
        }
        if ($view === "city_ledger") {
            respondFrontDesk(true, "OK", fdAccounts($pdo, $scope, false));
        }
        if ($view === "statement") {
            $account = fdLoadAccount($pdo, $scope, (int)($_GET["account_id"] ?? 0));
            respondFrontDesk(true, "OK", array_merge(
                ["account" => fdAccountRow($account)],
                fdLedgerLines($pdo, "CITY_LEDGER", (int)$account["ID"])
            ));
        }
        if ($view === "collections") {
            list($from, $to) = fdRange();
            $stmt = $pdo->prepare("
                SELECT p.collection_no, p.ledger_type, p.payment_method, p.payment_amount, p.payment_reference,
                       p.terminal_number, p.cashier, p.remarks, p.status, p.void_reason, p.voided_by, p.collected_at,
                       s.folio_no, s.room_name, s.guest_name, a.account_code, a.company_name
                FROM tbl_pos_ar_collections p
                LEFT JOIN tbl_pos_hotel_stays s ON s.ID = p.stay_id
                LEFT JOIN tbl_pos_city_ledger_accounts a ON a.ID = p.account_id
                WHERE p.Category_Code = :cc AND p.Unit_Code = :uc
                  AND p.collected_at BETWEEN :from AND :to
                ORDER BY p.collected_at DESC, p.ID DESC
            ");
            $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":from" => $from, ":to" => $to]);
            respondFrontDesk(true, "OK", array_map(function ($row) {
                $row["payment_amount"] = posHotelMoney($row["payment_amount"]);
                return $row;
            }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
        }
        if ($view === "complimentary") {
            list($from, $to) = fdRange();
            $stmt = $pdo->prepare("
                SELECT transaction_id, invoice_no, comp_type, reason, amount, guest_name,
                       approved_by_name, cashier, status, date_recorded
                FROM tbl_pos_complimentary
                WHERE Category_Code = :cc AND Unit_Code = :uc
                  AND date_recorded BETWEEN :from AND :to
                ORDER BY date_recorded DESC, ID DESC
            ");
            $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":from" => $from, ":to" => $to]);
            respondFrontDesk(true, "OK", array_map(function ($row) {
                $row["amount"] = posHotelMoney($row["amount"]);
                return $row;
            }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
        }
        if ($view === "approvers") {
            respondFrontDesk(true, "OK", posHotelAdminApprovers($pdo));
        }
        if ($view === "aging") {
            respondFrontDesk(true, "OK", fdAging($pdo, $scope));
        }
        if ($view === "room_nights") {
            posHotelEnsureRoomProduct($pdo);
            $businessDate = fdBusinessDate($_GET["date"] ?? "");
            $forCheckout = ($_GET["for"] ?? "") === "checkout";
            $onlyId = (int)($_GET["id"] ?? 0);
            $stmt = $pdo->prepare("
                SELECT * FROM tbl_pos_hotel_stays
                WHERE Category_Code = :cc AND Unit_Code = :uc AND status = 'In-House'
                ORDER BY room_name ASC
            ");
            $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"]]);
            $due = [];
            $noRate = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $stay) {
                if ($onlyId > 0 && (int)$stay["ID"] !== $onlyId) {
                    continue;
                }
                if ((float)($stay["room_rate"] ?? 0) <= 0) {
                    $noRate[] = fdStayRow($stay);
                    continue;
                }
                $through = $forCheckout ? fdCheckoutThrough($stay, $businessDate) : $businessDate;
                $nights = posHotelUnpostedNights($pdo, $stay, $through);
                if ($nights) {
                    $due[] = array_merge(fdStayRow($stay), ["nights" => $nights]);
                }
            }
            respondFrontDesk(true, "OK", [
                "business_date" => $businessDate,
                "due" => $due,
                "no_rate" => $noRate,
                "product" => [
                    "product_id" => POS_HOTEL_ROOM_PRODUCT_ID,
                    "item_name" => POS_HOTEL_ROOM_PRODUCT_NAME,
                    "order_type" => POS_HOTEL_ROOM_ORDER_TYPE,
                ],
                "room_charge_mop" => fdSpecialMops($pdo)[POS_HOTEL_KIND_ROOM_CHARGE] ?? "",
            ]);
        }
        respondFrontDesk(false, "Unknown view.", null, 400);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respondFrontDesk(false, "Method not allowed.", null, 405);
    }

    $body = json_decode((string)file_get_contents("php://input"), true);
    if (!is_array($body)) {
        respondFrontDesk(false, "Invalid request body.", null, 400);
    }
    $action = (string)($body["action"] ?? "");
    $userName = posHotelUserName($pdo, $userId);
    $terminal = fdText($body["terminal_number"] ?? "", 20);
    $remarks = fdText($body["remarks"] ?? "", 300);

    if ($action === "check_in") {
        $pdo->beginTransaction();
        $fields = fdReadStayFields($pdo, $scope, $body, 0);
        $folioNo = posHotelFormatNumber("F", posHotelNextNumber($pdo, $scope, "folio"));
        $pdo->prepare("
            INSERT INTO tbl_pos_hotel_stays
                (folio_no, Category_Code, Unit_Code, room_name, guest_name, guest_contact, guest_count,
                 check_in_at, expected_check_out, room_rate, status, notes, created_by)
            VALUES
                (:folio, :cc, :uc, :room, :guest, :contact, :count, NOW(), :checkout, :rate, 'In-House', :notes, :by)
        ")->execute([
            ":folio" => $folioNo,
            ":cc" => $scope["category_code"],
            ":uc" => $scope["unit_code"],
            ":room" => $fields["room_name"],
            ":guest" => $fields["guest_name"],
            ":contact" => $fields["guest_contact"],
            ":count" => $fields["guest_count"],
            ":checkout" => $fields["expected_check_out"],
            ":rate" => $fields["room_rate"],
            ":notes" => $fields["notes"],
            ":by" => $userName,
        ]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        respondFrontDesk(true, "{$fields['guest_name']} checked in to {$fields['room_name']} ({$folioNo}).", [
            "id" => $id,
            "folio_no" => $folioNo,
        ]);
    }

    if ($action === "update_stay") {
        $pdo->beginTransaction();
        $stay = fdLoadStay($pdo, $scope, (int)($body["id"] ?? 0), true);
        if ($stay["status"] !== "In-House") {
            throw new PosHotelLedgerException("Only in-house guests can be edited.");
        }
        $fields = fdReadStayFields($pdo, $scope, $body, (int)$stay["ID"]);
        $pdo->prepare("
            UPDATE tbl_pos_hotel_stays
            SET room_name = :room, guest_name = :guest, guest_contact = :contact, guest_count = :count,
                expected_check_out = :checkout, room_rate = :rate, notes = :notes
            WHERE ID = :id
        ")->execute([
            ":room" => $fields["room_name"],
            ":guest" => $fields["guest_name"],
            ":contact" => $fields["guest_contact"],
            ":count" => $fields["guest_count"],
            ":checkout" => $fields["expected_check_out"],
            ":rate" => $fields["room_rate"],
            ":notes" => $fields["notes"],
            ":id" => (int)$stay["ID"],
        ]);
        $pdo->commit();
        respondFrontDesk(true, "Guest details saved.");
    }

    if ($action === "cancel_stay") {
        $pdo->beginTransaction();
        $stay = fdLoadStay($pdo, $scope, (int)($body["id"] ?? 0), true);
        if ($stay["status"] !== "In-House") {
            throw new PosHotelLedgerException("This folio is no longer in-house.");
        }
        $activity = $pdo->prepare("
            SELECT (SELECT COUNT(*) FROM tbl_pos_ar_charges WHERE ledger_type = 'FOLIO' AND stay_id = :id1 AND status = 'Active')
                 + (SELECT COUNT(*) FROM tbl_pos_ar_collections WHERE ledger_type = 'FOLIO' AND stay_id = :id2 AND status = 'Active')
        ");
        $activity->execute([":id1" => (int)$stay["ID"], ":id2" => (int)$stay["ID"]]);
        if ((int)$activity->fetchColumn() > 0) {
            throw new PosHotelLedgerException("This folio already has charges or payments. Check the guest out instead.");
        }
        $pdo->prepare("
            UPDATE tbl_pos_hotel_stays
            SET status = 'Cancelled', check_out_at = NOW(), checked_out_by = :by
            WHERE ID = :id
        ")->execute([":by" => $userName, ":id" => (int)$stay["ID"]]);
        $pdo->commit();
        respondFrontDesk(true, "Check-in cancelled.");
    }

    if ($action === "collect" || $action === "check_out") {
        $kinds = posHotelMopKinds($pdo);
        $payments = fdPayments($body);
        $pdo->beginTransaction();
        $stay = fdLoadStay($pdo, $scope, (int)($body["id"] ?? 0), true);
        if ($stay["status"] !== "In-House") {
            throw new PosHotelLedgerException("This folio is no longer in-house.");
        }
        $balance = posHotelBalance($pdo, "FOLIO", (int)$stay["ID"]);
        $paying = fdPaymentsTotal($payments);
        $collectionNo = null;

        if ($action === "collect") {
            if ($paying <= 0) {
                throw new PosHotelLedgerException("Enter the amount received.");
            }
            // Deposits / advance payments may exceed the balance (credit on the folio).
            $collectionNo = posHotelRecordCollection($pdo, $scope, "FOLIO", $stay, $payments, $kinds, $userName, $terminal, $remarks);
        } else {
            $missing = posHotelUnpostedNights($pdo, $stay, fdCheckoutThrough($stay, fdBusinessDate($body["business_date"] ?? "")));
            if ($missing) {
                throw new PosHotelLedgerException(
                    "Post the room charges first (night of " . implode(", ", array_map(function ($d) {
                        return date("M j", strtotime($d));
                    }, $missing)) . ")."
                );
            }
            if (abs($paying - $balance) > 0.005) {
                throw new PosHotelLedgerException(sprintf(
                    "Payments (%s) must equal the balance of %s to check out.",
                    number_format($paying, 2),
                    number_format($balance, 2)
                ));
            }
            if (abs($balance) > 0.005) {
                // A credit balance (after a reversed charge) is refunded with a negative line.
                $collectionNo = posHotelRecordCollection(
                    $pdo, $scope, "FOLIO", $stay, $payments, $kinds, $userName, $terminal,
                    $remarks !== "" ? $remarks : "Check-out settlement",
                    $balance < 0
                );
            }
            $pdo->prepare("
                UPDATE tbl_pos_hotel_stays
                SET status = 'Checked Out', check_out_at = NOW(), checked_out_by = :by
                WHERE ID = :id
            ")->execute([":by" => $userName, ":id" => (int)$stay["ID"]]);
        }
        $pdo->commit();
        respondFrontDesk(true, $action === "check_out"
            ? "{$stay['guest_name']} checked out of {$stay['room_name']}."
            : "Payment saved ({$collectionNo}).", [
            "collection_no" => $collectionNo,
            "balance" => posHotelBalance($pdo, "FOLIO", (int)$stay["ID"]),
        ]);
    }

    if ($action === "save_account") {
        $id = (int)($body["id"] ?? 0);
        $company = fdText($body["company_name"] ?? "", 150);
        if (mb_strlen($company) < 2) {
            throw new PosHotelLedgerException("Enter the company name.");
        }
        $limitText = trim((string)($body["credit_limit"] ?? ""));
        if ($limitText !== "" && (!is_numeric($limitText) || (float)$limitText < 0)) {
            throw new PosHotelLedgerException("Credit limit must be a positive amount, or blank for no limit.");
        }
        $status = ($body["status"] ?? "Active") === "Inactive" ? "Inactive" : "Active";
        $email = fdText($body["email"] ?? "", 150);
        if ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new PosHotelLedgerException("Enter a valid email address.");
        }
        $nullable = function ($value) {
            return $value !== "" ? $value : null;
        };
        $params = [
            ":company" => $company,
            ":person" => $nullable(fdText($body["contact_person"] ?? "", 150)),
            ":number" => $nullable(fdText($body["contact_number"] ?? "", 30)),
            ":email" => $nullable($email),
            ":address" => $nullable(fdText($body["address"] ?? "", 300)),
            ":tin" => $nullable(fdText($body["tin"] ?? "", 30)),
            ":limit" => $limitText !== "" && (float)$limitText > 0 ? posHotelMoney($limitText) : null,
            ":status" => $status,
        ];

        $pdo->beginTransaction();
        $duplicate = $pdo->prepare("
            SELECT 1 FROM tbl_pos_city_ledger_accounts
            WHERE Category_Code = :cc AND Unit_Code = :uc AND LOWER(company_name) = LOWER(:company) AND ID <> :id
            LIMIT 1
        ");
        $duplicate->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":company" => $company, ":id" => $id]);
        if ($duplicate->fetchColumn() !== false) {
            throw new PosHotelLedgerException("{$company} already has a city ledger account.");
        }
        if ($id > 0) {
            fdLoadAccount($pdo, $scope, $id, true);
            $pdo->prepare("
                UPDATE tbl_pos_city_ledger_accounts
                SET company_name = :company, contact_person = :person, contact_number = :number, email = :email,
                    address = :address, tin = :tin, credit_limit = :limit, status = :status
                WHERE ID = :id
            ")->execute($params + [":id" => $id]);
            $code = null;
        } else {
            $code = posHotelFormatNumber("CL", posHotelNextNumber($pdo, $scope, "city_ledger"));
            $pdo->prepare("
                INSERT INTO tbl_pos_city_ledger_accounts
                    (account_code, Category_Code, Unit_Code, company_name, contact_person, contact_number, email,
                     address, tin, credit_limit, status, created_by)
                VALUES
                    (:code, :cc, :uc, :company, :person, :number, :email, :address, :tin, :limit, :status, :by)
            ")->execute($params + [
                ":code" => $code,
                ":cc" => $scope["category_code"],
                ":uc" => $scope["unit_code"],
                ":by" => $userName,
            ]);
            $id = (int)$pdo->lastInsertId();
        }
        $pdo->commit();
        respondFrontDesk(true, $code ? "{$company} added ({$code})." : "{$company} saved.", ["id" => $id, "account_code" => $code]);
    }

    if ($action === "collect_account") {
        $kinds = posHotelMopKinds($pdo);
        $payments = fdPayments($body);
        if (fdPaymentsTotal($payments) <= 0) {
            throw new PosHotelLedgerException("Enter the amount received.");
        }
        $pdo->beginTransaction();
        $account = fdLoadAccount($pdo, $scope, (int)($body["account_id"] ?? 0), true);
        $collectionNo = posHotelRecordCollection($pdo, $scope, "CITY_LEDGER", $account, $payments, $kinds, $userName, $terminal, $remarks);
        $pdo->commit();
        respondFrontDesk(true, "Payment saved ({$collectionNo}).", [
            "collection_no" => $collectionNo,
            "balance" => posHotelBalance($pdo, "CITY_LEDGER", (int)$account["ID"]),
        ]);
    }

    if ($action === "void_collection") {
        $collectionNo = fdText($body["collection_no"] ?? "", 20);
        $reason = fdText($body["reason"] ?? "", 300);
        if ($collectionNo === "") {
            throw new PosHotelLedgerException("Collection number is required.");
        }
        if (mb_strlen($reason) < 3) {
            throw new PosHotelLedgerException("Enter the reason for voiding the payment.");
        }
        list(, $approverName) = posHotelVerifyApprover(
            $pdo,
            trim((string)($body["approver_id"] ?? "")),
            (string)($body["approver_password"] ?? "")
        );
        $pdo->beginTransaction();
        $rows = $pdo->prepare("
            SELECT c.*, s.status AS stay_status, s.folio_no
            FROM tbl_pos_ar_collections c
            LEFT JOIN tbl_pos_hotel_stays s ON s.ID = c.stay_id
            WHERE c.Category_Code = :cc AND c.Unit_Code = :uc AND c.collection_no = :no
            FOR UPDATE
        ");
        $rows->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":no" => $collectionNo]);
        $lines = $rows->fetchAll(PDO::FETCH_ASSOC);
        if (!$lines) {
            throw new PosHotelLedgerException("Collection {$collectionNo} was not found.");
        }
        foreach ($lines as $line) {
            if ($line["status"] !== "Active") {
                throw new PosHotelLedgerException("Collection {$collectionNo} is already voided.");
            }
            if ($line["ledger_type"] === "FOLIO" && $line["stay_status"] !== "In-House") {
                throw new PosHotelLedgerException("Folio {$line['folio_no']} is already checked out; its payments cannot be voided.");
            }
        }
        // A City Ledger line on a folio moved the amount to a company: take it back.
        $pdo->prepare("
            UPDATE tbl_pos_ar_charges
            SET status = 'Reversed', reversed_reason = :reason, reversed_at = NOW()
            WHERE Category_Code = :cc AND Unit_Code = :uc AND collection_no = :no
              AND source = 'FOLIO_TRANSFER' AND status = 'Active'
        ")->execute([
            ":reason" => "Voided {$collectionNo}: {$reason}",
            ":cc" => $scope["category_code"],
            ":uc" => $scope["unit_code"],
            ":no" => $collectionNo,
        ]);
        $pdo->prepare("
            UPDATE tbl_pos_ar_collections
            SET status = 'Voided', void_reason = :reason, voided_by = :by, voided_at = NOW()
            WHERE Category_Code = :cc AND Unit_Code = :uc AND collection_no = :no
        ")->execute([
            ":reason" => $reason,
            ":by" => mb_substr($approverName . " / " . $userName, 0, 150),
            ":cc" => $scope["category_code"],
            ":uc" => $scope["unit_code"],
            ":no" => $collectionNo,
        ]);
        $pdo->commit();
        respondFrontDesk(true, "{$collectionNo} voided.");
    }

    respondFrontDesk(false, "Unknown action.", null, 400);
} catch (PosHotelLedgerException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respondFrontDesk(false, $e->getMessage(), null, 400);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("POS front desk error: " . $e->getMessage());
    respondFrontDesk(false, "Unable to process the front desk request.", null, 500);
}
