/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBed, FaHotel, FaMoon, FaSearch, FaSyncAlt, FaUserPlus } from "react-icons/fa";
import "../../fonts/font-style.css";
import useApiHost from "../../hooks/useApiHost";
import useBusinessInfo from "../../hooks/useBusinessInfo";
import { useExecuteToast } from "../../context/ToastContext";
import { formatDate, frontDeskGet, nightsStayed, peso, todayKey } from "./frontDeskUtils";
import { Button, Card, ErrorBox, Muted, fieldClass, fieldStyle } from "./FrontDeskUi";
import CheckInModal from "./CheckInModal";
import FolioModal from "./FolioModal";
import CityLedgerTab from "./CityLedgerTab";
import LogsTab from "./LogsTab";
import NightAuditModal from "./NightAuditModal";

const TABS = [
  ["inhouse", "In-House"],
  ["cityledger", "City Ledger"],
  ["collections", "Collections"],
  ["complimentary", "Complimentary"],
  ["stays", "History"],
];

const RoomTile = ({ room, stay, onClick }) => {
  const occupied = Boolean(stay);
  const balance = Number(stay?.balance || 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[92px] flex-col items-start justify-between rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      style={{
        borderColor: occupied ? "rgba(16,185,129,0.45)" : "var(--app-border)",
        backgroundColor: occupied ? "rgba(16,185,129,0.08)" : "var(--app-surface)",
      }}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-[Poppins-Bold] text-[14px]">{room}</span>
        <FaBed style={{ color: occupied ? "#047857" : "var(--app-muted-text)" }} />
      </span>
      {occupied ? (
        <span className="w-full">
          <span className="block truncate font-[Poppins-Medium] text-[12px]">{stay.guest_name}</span>
          <span className="block font-[Poppins-SemiBold] text-[12px]" style={{ color: balance > 0 ? "#be123c" : "#047857" }}>
            {peso(balance)} · {nightsStayed(stay.check_in_at)}n
          </span>
        </span>
      ) : (
        <span className="font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>Vacant · tap to check in</span>
      )}
    </button>
  );
};

const FrontDeskBoard = ({ apiHost }) => {
  const navigate = useNavigate();
  const { executeToast } = useExecuteToast();
  // Same business info as the receipts / ESC/POS header (businessInfo.json).
  const { businessInfo } = useBusinessInfo();
  const businessName = [businessInfo.companyName, businessInfo.storeName].filter(Boolean).join(" - ");
  const [tab, setTab] = useState("inhouse");
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [checkIn, setCheckIn] = useState(null); // null | {room} | {stay}
  const [folioId, setFolioId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [nightAudit, setNightAudit] = useState(false);
  // Same terminal number the ordering screen saves on its bills (X / Z reading).
  const terminalNumber = localStorage.getItem("posTerminalNumber") || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSetup(await frontDeskGet(apiHost, { view: "summary" }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiHost]);

  useEffect(() => {
    load();
  }, [load]);

  const notice = (message) => {
    executeToast(message, 3500, "success");
    load();
    setReloadKey((key) => key + 1);
  };

  const inHouse = setup?.in_house || [];
  const stayByRoom = useMemo(() => {
    const map = {};
    inHouse.forEach((stay) => {
      map[stay.room_name] = stay;
    });
    return map;
  }, [inHouse]);

  const rooms = setup?.rooms || [];
  const totalRooms = rooms.reduce((sum, group) => sum + group.rooms.length, 0);
  const totalBalance = inHouse.reduce((sum, stay) => sum + Number(stay.balance || 0), 0);
  const query = search.trim().toLowerCase();
  const matches = (room) => {
    if (!query) return true;
    const stay = stayByRoom[room];
    return [room, stay?.guest_name, stay?.folio_no].some((v) => String(v || "").toLowerCase().includes(query));
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => navigate("/poscorehomescreen")}><FaArrowLeft className="text-[12px]" /> Home</Button>
        <div className="flex gap-2">
          <Button onClick={() => { load(); setReloadKey((key) => key + 1); }}>
            <FaSyncAlt className={`text-[12px] ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setNightAudit(true)} disabled={!setup} title="Invoice tonight's room charges for every in-house guest">
            <FaMoon size={12} /> Night Audit
          </Button>
          <Button variant="primary" onClick={() => setCheckIn({})} disabled={!setup}><FaUserPlus size={13} /> Check In</Button>
        </div>
      </nav>

      <header className="mb-5">
        <p className="flex items-center gap-2 font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--app-accent)" }}>
          <FaHotel /> Hotel
        </p>
        <h1 className="mt-1 font-[Poppins-Bold] text-[32px] leading-tight sm:text-[40px]">Front Desk</h1>
        <Muted>
          {inHouse.length} in-house · {Math.max(totalRooms - inHouse.length, 0)} vacant · open folios {peso(totalBalance)}
        </Muted>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="rounded-full border px-4 py-2 font-[Poppins-SemiBold] text-[13px] transition"
            style={
              tab === key
                ? { backgroundColor: "var(--app-accent)", borderColor: "var(--app-accent)", color: "#fff" }
                : { borderColor: "var(--app-border)", color: "var(--app-text)", backgroundColor: "var(--app-surface)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {tab === "inhouse" ? (
        <div className="space-y-5">
          <div className="relative max-w-md">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: "var(--app-muted-text)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room, guest or folio"
              className={`${fieldClass} pl-9`}
              style={fieldStyle(false)}
            />
          </div>
          {!setup && loading ? (
            <Muted>Loading rooms…</Muted>
          ) : rooms.length === 0 ? (
            <Card><Muted>No rooms found. Rooms come from the floor layout (Settings › Room Layout).</Muted></Card>
          ) : (
            rooms.map((group) => {
              const visible = group.rooms.filter(matches);
              if (visible.length === 0) return null;
              return (
                <Card key={group.floor}>
                  <p className="mb-3 font-[Poppins-SemiBold] text-[14px]">
                    {group.floor}{" "}
                    <Muted>· {group.rooms.filter((room) => stayByRoom[room]).length}/{group.rooms.length} occupied</Muted>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {visible.map((room) => (
                      <RoomTile
                        key={room}
                        room={room}
                        stay={stayByRoom[room]}
                        onClick={() => (stayByRoom[room] ? setFolioId(stayByRoom[room].id) : setCheckIn({ room }))}
                      />
                    ))}
                  </div>
                </Card>
              );
            })
          )}
          {inHouse.some((stay) => stay.expected_check_out && stay.expected_check_out <= todayKey()) ? (
            <Card>
              <p className="mb-2 font-[Poppins-SemiBold] text-[14px]">Due to check out</p>
              <ul className="space-y-1">
                {inHouse
                  .filter((stay) => stay.expected_check_out && stay.expected_check_out <= todayKey())
                  .map((stay) => (
                    <li key={stay.id}>
                      <button type="button" onClick={() => setFolioId(stay.id)} className="font-[Poppins-Regular] text-[13px] underline-offset-2 hover:underline">
                        {stay.room_name} · {stay.guest_name} · {formatDate(stay.expected_check_out)} · balance {peso(stay.balance)}
                      </button>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : tab === "cityledger" ? (
        <CityLedgerTab
          apiHost={apiHost}
          modes={setup?.settlement_modes || []}
          terminalNumber={terminalNumber}
          businessName={businessName}
          onNotice={notice}
          reloadKey={reloadKey}
        />
      ) : (
        <LogsTab apiHost={apiHost} view={tab} reloadKey={reloadKey} onOpenStay={setFolioId} businessName={businessName} />
      )}

      {checkIn && setup ? (
        <CheckInModal
          apiHost={apiHost}
          rooms={rooms}
          inHouse={inHouse}
          stay={checkIn.stay}
          presetRoom={checkIn.room}
          onClose={() => setCheckIn(null)}
          onSaved={(message) => {
            setCheckIn(null);
            notice(message);
          }}
        />
      ) : null}

      {nightAudit ? (
        <NightAuditModal
          apiHost={apiHost}
          onClose={() => setNightAudit(false)}
          onDone={() => notice("Night audit finished.")}
        />
      ) : null}

      {folioId && !checkIn ? (
        <FolioModal
          apiHost={apiHost}
          stayId={folioId}
          setup={setup}
          terminalNumber={terminalNumber}
          businessName={businessName}
          onClose={() => setFolioId(null)}
          onEdit={(stay) => setCheckIn({ stay })}
          onChanged={notice}
        />
      ) : null}
    </div>
  );
};

const FrontDeskComponent = () => {
  const apiHost = useApiHost();
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6" style={{ color: "var(--app-text)" }}>
      {apiHost ? (
        <FrontDeskBoard apiHost={apiHost} />
      ) : (
        <p className="font-[Poppins-Regular] text-[14px]" style={{ color: "var(--app-muted-text)" }}>
          Connecting to the POS server…
        </p>
      )}
    </div>
  );
};

export default FrontDeskComponent;
