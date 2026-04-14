import React, { useEffect, useMemo, useState } from "react";
import { LinearProgress } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import useCustomQuery from "../../hooks/useCustomQuery";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import {
  FiSearch,
  FiRefreshCw,
  FiCheckCircle,
  FiArrowRight,
  FiServer,
  FiGlobe,
} from "react-icons/fi";
import { supabase } from "../../context/supaBaseClient";

const INPUT =
  "h-11 w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-base sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#D75529]/30";
const LABEL = "text-[11px] font-semibold tracking-wide text-slate-500";
const PANEL =
  "rounded-3xl border border-slate-200/80 bg-white/65 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.07)]";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-colorBrand px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] hover:opacity-95 active:scale-[0.99] transition";
const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-white transition";

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition",
      active
        ? "border-[#D75529]/30 bg-colorBrand/10 text-colorBrand"
        : "border-slate-200/80 bg-white/70 text-slate-600 hover:bg-white",
    ].join(" ")}
  >
    {children}
  </button>
);

const CheckPill = ({ checked, onChange, title, sub, disabled = false }) => (
  <label
    className={[
      "group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3 transition",
      disabled
        ? "opacity-80 cursor-not-allowed"
        : "hover:bg-white cursor-pointer",
    ].join(" ")}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={[
        "mt-1 h-5 w-5 accent-[#D75529]",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    />
    <div className="min-w-0">
      <div className="text-sm font-semibold text-slate-800 truncate">
        {title}
      </div>
      {sub ? <div className="text-xs text-slate-600 mt-0.5">{sub}</div> : null}
    </div>
  </label>
);

const EndpointCard = ({ icon, title, badge, url }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-[11px] text-slate-500">{badge}</div>
        </div>
      </div>
    </div>

    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="break-all text-[11px] font-medium text-slate-700">
        {url || "Not set"}
      </div>
    </div>
  </div>
);

const toList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.json)) return data.json;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  return [];
};

const norm = (v) =>
  String(v || "")
    .trim()
    .toUpperCase();

const toggleInArray = (prev, id, checked) => {
  if (checked) {
    if (prev.includes(id)) return prev;
    return [...prev, id];
  }
  return prev.filter((x) => x !== id);
};

const safeLower = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const findSelectedUser = (usersData, userId) => {
  const list = toList(usersData);
  return list.find((u) => String(u.empid) === String(userId)) || null;
};

const cleanBase = (value, fallback = "") =>
  String(value || fallback || "")
    .trim()
    .replace(/\/$/, "");

const CmpUserRolesSetup = ({ mode = "assign", onOpenRead }) => {
  const queryClient = useQueryClient();

  const [checkedItems, setCheckedItems] = useState([]);
  const [checkedFunctionRole, setCheckedFunctionRole] = useState([]);
  const [checkedBusunitRole, setCheckedBusunitRole] = useState([]);
  const [checkedTeamRole, setCheckedTeamRole] = useState([]);
  const [functionRoutes, setFunctionRoutes] = useState([]);
  const [isFunctionChecked, setIsFunctionChecked] = useState(false);
  const [userId, setUserId] = useState("");

  const [IsYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [isModalSuccess, setIsModalSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState("busunit");
  const [qFunc, setQFunc] = useState("");
  const [qRoutes, setQRoutes] = useState("");
  const [qBU, setQBU] = useState("");
  const [qTeam, setQTeam] = useState("");

  const [supabasePostMsg, setSupabasePostMsg] = useState("");

  // local/current app base for this setup screen
  const apiHost = useMemo(() => {
    const stored = localStorage.getItem("apiendpoint");
    if (!stored || stored === "null" || stored === "undefined") {
      return "http://localhost";
    }
    return cleanBase(stored, "http://localhost");
  }, []);

  // separate web base, only for endpoints that must come from web
  const webApiHost = useMemo(() => {
    return cleanBase(import.meta.env.VITE_WEBAPIENDPOINT, "");
  }, []);

  const companycode = useMemo(
    () => localStorage.getItem("companycode") || "",
    [],
  );

  const mutateUserRolesUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_MUTATE_USER_ROLES_ENDPOINT}`,
    [apiHost],
  );

  const employeesUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_PARAMEMPLOYEES_DATA_READ_ENDPOINT}`,
    [apiHost],
  );

  const functionRolesUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_FUNCTION_ROLES_READ_ENDPOINT}`,
    [apiHost],
  );

  const routesUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_ROUTES_READ_ENDPOINT}`,
    [apiHost],
  );

  const businessUnitsUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_BUSINESS_UNITS_READ_ENDPOINT}`,
    [apiHost],
  );

  const functionToRolesMapUrl = useMemo(
    () =>
      `${apiHost}${import.meta.env.VITE_FUNCTION_TO_ROLES_MAP_READ_ENDPOINT}`,
    [apiHost],
  );

  const teamsUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_PARAMTEAMS_DATA_READ_ENDPOINT}`,
    [apiHost],
  );

  // separate display only: this is the one that should come from WEB
  const infiniteUserRolesWebUrl = useMemo(() => {
    if (!webApiHost) return "";
    return `${webApiHost}${import.meta.env.VITE_INFINITE_USER_ROLE_ENDPOINT}`;
  }, [webApiHost]);

  const roleMutationKey = useMemo(
    () => `user-roles:${companycode}`,
    [companycode],
  );

  const employeesQueryKey = useMemo(
    () => `employees-dropdown:${apiHost}:${companycode}`,
    [apiHost, companycode],
  );

  const {
    data: roleData,
    isLoading: roleIsLoading,
    mutate: mutateRole,
  } = useSecuredMutation(mutateUserRolesUrl, "POST");

  const {
    data: usersData,
    isLoading: usersIsLoading,
    refetch: refetchUsers,
  } = useCustomQuery(employeesUrl, employeesQueryKey);

  useEffect(() => {
    if (employeesUrl && refetchUsers) {
      refetchUsers();
    }
  }, [employeesUrl, refetchUsers]);

  const { data: funcrolesData, isLoading: funcrolesIsLoading } = useCustomQuery(
    functionRolesUrl,
    `funcroles:${apiHost}`,
  );

  const { data: routesData, isLoading: routesIsLoading } = useCustomQuery(
    routesUrl,
    `routes:${apiHost}`,
  );

  const { data: businessunitsData, isLoading: businessunitsIsLoading } =
    useCustomQuery(businessUnitsUrl, `businessunits:${apiHost}`);

  const { data: functionToRolesMapData } = useCustomQuery(
    functionToRolesMapUrl,
    `functiontorolesmap:${apiHost}`,
  );

  const { data: teamsData, isLoading: teamsIsLoading } = useCustomQuery(
    teamsUrl,
    `teams:${apiHost}`,
  );

  const FORCED_FUNCTION_NAMES = ["HRIS-TEAM PLAYER"];
  const forcedFunctionNameSet = useMemo(
    () => new Set(FORCED_FUNCTION_NAMES.map((n) => norm(n))),
    [],
  );

  const forcedFunctionNamesResolved = useMemo(() => {
    const list = toList(funcrolesData);
    return list
      .filter((r) => forcedFunctionNameSet.has(norm(r.roleclassfunc_name)))
      .map((r) => r.roleclassfunc_name)
      .filter(Boolean);
  }, [funcrolesData, forcedFunctionNameSet]);

  const forcedFunctionResolvedSet = useMemo(() => {
    return new Set(forcedFunctionNamesResolved.map((n) => norm(n)));
  }, [forcedFunctionNamesResolved]);

  useEffect(() => {
    if (!userId) return;
    if (!forcedFunctionNamesResolved.length) return;

    setCheckedFunctionRole((prev) => {
      const out = [...prev];
      forcedFunctionNamesResolved.forEach((n) => {
        if (!out.some((x) => norm(x) === norm(n))) out.push(n);
      });
      return out;
    });
  }, [userId, forcedFunctionNamesResolved]);

  useEffect(() => {
    setIsFunctionChecked(checkedFunctionRole.length > 0);
  }, [checkedFunctionRole]);

  const resetForm = () => {
    setCheckedItems([]);
    setCheckedFunctionRole([]);
    setCheckedBusunitRole([]);
    setCheckedTeamRole([]);
    setFunctionRoutes([]);
    setIsFunctionChecked(false);
    setUserId("");
    setActiveTab("busunit");
    setQFunc("");
    setQRoutes("");
    setQBU("");
    setQTeam("");
    setSupabasePostMsg("");
  };

  const togglePlain = (setter, id, checked) => {
    setter((prev) => toggleInArray(prev, id, checked));
  };

  const toggleFunction = (funcName, checked) => {
    const isLocked = forcedFunctionResolvedSet.has(norm(funcName));
    if (isLocked && checked === false) return;

    setCheckedFunctionRole((prev) => toggleInArray(prev, funcName, checked));
  };

  useEffect(() => {
    if (!userId) {
      setFunctionRoutes([]);
      return;
    }

    const mapClone = toList(functionToRolesMapData);
    if (!checkedFunctionRole.length) {
      setFunctionRoutes([]);
      return;
    }

    const routesSet = new Set();
    checkedFunctionRole.forEach((funcName) => {
      mapClone
        .filter((x) => x.roleclassfunc_name === funcName)
        .forEach((x) => {
          if (x?.route) routesSet.add(x.route);
        });
    });

    setFunctionRoutes(Array.from(routesSet));
  }, [checkedFunctionRole, functionToRolesMapData, userId]);

  useEffect(() => {
    if (!userId) return;

    if (checkedFunctionRole.length > 0) {
      const mapClone = toList(functionToRolesMapData);
      const addRoutes = [];

      checkedFunctionRole.forEach((funcName) => {
        mapClone
          .filter((x) => x.roleclassfunc_name === funcName)
          .forEach((x) => {
            if (x?.route && !checkedItems.includes(x.route)) {
              addRoutes.push(x.route);
            }
          });
      });

      setCheckedItems((prev) => {
        const next = [...prev];
        checkedFunctionRole.forEach((funcName) => {
          if (!next.includes(funcName)) next.push(funcName);
        });
        addRoutes.forEach((route) => {
          if (!next.includes(route)) next.push(route);
        });
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedFunctionRole]);

  const handleRoleSubmission = async () => {
    mutateRole({
      empid: userId,
      functionandroutes: checkedItems,
      busunit: checkedBusunitRole,
      teams: checkedTeamRole,
    });

    try {
      const selectedUser = findSelectedUser(usersData, userId);
      const emailRaw = selectedUser?.email || "";
      const email = String(emailRaw).trim();

      if (!companycode || !email) {
        setSupabasePostMsg(
          "Skipped Supabase insert (missing companycode/email)",
        );
        return;
      }

      const { error: insErr } = await supabase
        .from("tbl_user_roles_reset")
        .insert([{ companycode, email }]);

      if (insErr) throw insErr;

      setSupabasePostMsg("Inserted to Supabase (duplicates allowed)");
    } catch (e) {
      console.error("Supabase insert error:", e);
      setSupabasePostMsg(
        e?.message
          ? `Supabase insert failed: ${e.message}`
          : "Supabase insert failed",
      );
    }
  };

  useEffect(() => {
    if (roleData?.message === "Success") {
      queryClient.invalidateQueries({ queryKey: [roleMutationKey] });
      setIsModalSuccess(true);
    }
  }, [roleData, queryClient, roleMutationKey]);

  const funcList = useMemo(() => {
    const list = toList(funcrolesData);
    return list
      .sort((a, b) =>
        String(a.roleclassfunc_name || "").localeCompare(
          String(b.roleclassfunc_name || ""),
        ),
      )
      .filter((x) =>
        safeLower(x.roleclassfunc_name).includes(safeLower(qFunc)),
      );
  }, [funcrolesData, qFunc]);

  const routesList = useMemo(() => {
    const list = toList(routesData);
    const q = safeLower(qRoutes);

    return list.filter((x) => {
      const name = safeLower(x.route_name);
      const rr = safeLower(x.react_route);
      return name.includes(q) || rr.includes(q);
    });
  }, [routesData, qRoutes]);

  const buList = useMemo(() => {
    const list = toList(businessunitsData);
    const q = safeLower(qBU);
    return list.filter(
      (x) =>
        safeLower(x.name).includes(q) ||
        safeLower(x.Unit_Name).includes(q) ||
        safeLower(x.Unit_Code).includes(q),
    );
  }, [businessunitsData, qBU]);

  const teamList = useMemo(() => {
    const list = toList(teamsData);
    const q = safeLower(qTeam);
    return list.filter((x) => safeLower(x.teamname).includes(q));
  }, [teamsData, qTeam]);

  const totals = {
    routes: checkedItems.length,
    busunit: checkedBusunitRole.length,
    teams: checkedTeamRole.length,
    funcs: checkedFunctionRole.length,
  };

  const canSubmit =
    Boolean(userId) &&
    (totals.routes > 0 ||
      totals.funcs > 0 ||
      totals.busunit > 0 ||
      totals.teams > 0);

  return (
    <>
      {IsYesNoModalOpen && (
        <ModalYesNoReusable
          header={"Confirmation"}
          message={"Assign these roles to the selected user?"}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleRoleSubmission}
          isLoading={roleIsLoading}
        />
      )}

      {isModalSuccess && (
        <ModalSuccessNavToSelf
          header="Success"
          message="Role assignment successful"
          button="Confirm"
          setIsModalOpen={setIsModalSuccess}
          resetForm={resetForm}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={activeTab === "function"}
            onClick={() => setActiveTab("function")}
          >
            Function{totals.funcs > 0 ? ` • ${totals.funcs}` : ""}
          </Chip>
          <Chip
            active={activeTab === "routes"}
            onClick={() => setActiveTab("routes")}
          >
            Routes{totals.routes > 0 ? ` • ${totals.routes}` : ""}
          </Chip>
          <Chip
            active={activeTab === "busunit"}
            onClick={() => setActiveTab("busunit")}
          >
            Business Units{totals.busunit > 0 ? ` • ${totals.busunit}` : ""}
          </Chip>
          <Chip
            active={activeTab === "teams"}
            onClick={() => setActiveTab("teams")}
          >
            Teams{totals.teams > 0 ? ` • ${totals.teams}` : ""}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={BTN_GHOST} onClick={resetForm}>
            <FiRefreshCw />
            Form Reset
          </button>

          {onOpenRead && (
            <button type="button" className={BTN_GHOST} onClick={onOpenRead}>
              Read Roles
              <FiArrowRight />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={PANEL}>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Step 1 • Select Employee
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Choose who will receive access.
                  </div>
                </div>

                {usersIsLoading && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    Loading…
                  </span>
                )}
              </div>

              <div className="mt-3">
                <label className={LABEL}>Employee name</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className={INPUT}
                  disabled={usersIsLoading || !employeesUrl}
                >
                  <option value="" disabled>
                    {usersIsLoading
                      ? "Loading employees..."
                      : "Select employee…"}
                  </option>
                  {toList(usersData).map((u, idx) => (
                    <option key={idx} value={u.empid}>
                      {`${u.fullname} - ${u.department}`}
                    </option>
                  ))}
                </select>
              </div>

              {supabasePostMsg ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {supabasePostMsg}
                </div>
              ) : null}
            </div>
          </div>

          <div className={PANEL}>
            <div className="p-4 sm:p-5">
              <div className="text-sm font-semibold text-slate-900">
                Step 2 • Summary
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Review selections before submitting.
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Functions", val: totals.funcs },
                  { label: "Routes", val: totals.routes },
                  { label: "Business Units", val: totals.busunit },
                  { label: "Teams", val: totals.teams },
                ].map((x) => (
                  <div
                    key={x.label}
                    className="rounded-2xl border border-slate-200/80 bg-white/70 p-4"
                  >
                    <div className="text-xs font-semibold text-slate-700">
                      {x.label}
                    </div>
                    <div className="mt-1 text-2xl font-[Poppins-Black] text-slate-900">
                      {x.val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => setYesNoModalOpen(true)}
                  className={[
                    BTN_PRIMARY,
                    !canSubmit ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <FiCheckCircle />
                  Submit Roles
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={PANEL}>
          <div className="p-4 sm:p-5">
            <div className="text-sm font-semibold text-slate-900">
              Endpoint Routing Display
            </div>
            <div className="mt-1 text-xs text-slate-600">
              This setup screen uses the current app API. The infinite read
              roles endpoint is shown separately and should come from WEB only.
            </div>

            <div className="mt-4 space-y-3">
              <EndpointCard
                icon={<FiServer size={16} />}
                title="Setup Screen Base"
                badge="Current / Local / Selected API"
                url={apiHost}
              />

              <EndpointCard
                icon={<FiGlobe size={16} />}
                title="Infinite User Roles Base"
                badge="WEB only"
                url={infiniteUserRolesWebUrl}
              />
            </div>
          </div>
        </div>
      </div>

      {!userId ? (
        <div className="mt-5 rounded-3xl border border-slate-200/80 bg-white/65 backdrop-blur-xl p-6 text-center text-sm text-slate-600">
          Select an employee to start assigning roles.
        </div>
      ) : (
        <div className="mt-5">
          {roleIsLoading && <LinearProgress color="primary" />}

          {activeTab === "function" && (
            <div className={PANEL}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Functions
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Pick a function to auto-add its routes (recommended).
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {funcList.length} item(s)
                  </div>
                </div>

                <div className="mt-3 relative">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qFunc}
                    onChange={(e) => setQFunc(e.target.value)}
                    className={[INPUT, "pl-11"].join(" ")}
                    placeholder="Search function…"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                  {funcrolesIsLoading ? (
                    <div className="text-sm text-slate-600 p-3">Loading…</div>
                  ) : (
                    funcList.map((d, idx) => {
                      const name = d.roleclassfunc_name;
                      const isLocked = forcedFunctionResolvedSet.has(
                        norm(name),
                      );
                      return (
                        <CheckPill
                          key={idx}
                          checked={checkedFunctionRole.some(
                            (x) => norm(x) === norm(name),
                          )}
                          disabled={isLocked}
                          onChange={(e) =>
                            toggleFunction(name, e.target.checked)
                          }
                          title={name}
                          sub={
                            isLocked
                              ? "Required (auto-selected)"
                              : "Auto-add mapped routes"
                          }
                        />
                      );
                    })
                  )}
                </div>

                {functionRoutes?.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#D75529]/20 bg-colorBrand/5 p-4">
                    <div className="text-xs font-semibold text-slate-800">
                      Mapped routes preview
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {functionRoutes.slice(0, 10).map((r) => (
                        <span
                          key={r}
                          className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {r}
                        </span>
                      ))}
                      {functionRoutes.length > 10 && (
                        <span className="text-[11px] font-semibold text-slate-600">
                          +{functionRoutes.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "routes" && (
            <div className={PANEL}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Routes
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Fine-tune access by selecting specific routes.
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {routesList.length} item(s)
                  </div>
                </div>

                <div className="mt-3 relative">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qRoutes}
                    onChange={(e) => setQRoutes(e.target.value)}
                    className={[INPUT, "pl-11"].join(" ")}
                    placeholder="Search route name or react route…"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                  {routesIsLoading ? (
                    <div className="text-sm text-slate-600 p-3">Loading…</div>
                  ) : (
                    routesList.map((d, idx) => (
                      <CheckPill
                        key={idx}
                        checked={checkedItems.includes(d.react_route)}
                        onChange={(e) =>
                          togglePlain(
                            setCheckedItems,
                            d.react_route,
                            e.target.checked,
                          )
                        }
                        title={d.route_name}
                        sub={d.react_route}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "busunit" && (
            <div className={PANEL}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Business Units
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Restrict access to certain business units if needed.
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {buList.length} item(s)
                  </div>
                </div>

                <div className="mt-3 relative">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qBU}
                    onChange={(e) => setQBU(e.target.value)}
                    className={[INPUT, "pl-11"].join(" ")}
                    placeholder="Search business unit…"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                  {businessunitsIsLoading ? (
                    <div className="text-sm text-slate-600 p-3">Loading…</div>
                  ) : (
                    buList.map((d, idx) => (
                      <CheckPill
                        key={idx}
                        checked={checkedBusunitRole.includes(d.Unit_Code)}
                        onChange={(e) =>
                          togglePlain(
                            setCheckedBusunitRole,
                            d.Unit_Code,
                            e.target.checked,
                          )
                        }
                        title={d.Unit_Name || d.name}
                        sub={d.Unit_Code}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className={PANEL}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Teams
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Restrict access to specific teams if required.
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {teamList.length} item(s)
                  </div>
                </div>

                <div className="mt-3 relative">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qTeam}
                    onChange={(e) => setQTeam(e.target.value)}
                    className={[INPUT, "pl-11"].join(" ")}
                    placeholder="Search team…"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                  {teamsIsLoading ? (
                    <div className="text-sm text-slate-600 p-3">Loading…</div>
                  ) : (
                    teamList.map((d, idx) => (
                      <CheckPill
                        key={idx}
                        checked={checkedTeamRole.includes(d.teamid)}
                        onChange={(e) =>
                          togglePlain(
                            setCheckedTeamRole,
                            d.teamid,
                            e.target.checked,
                          )
                        }
                        title={d.teamname}
                        sub={d.teamid}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CmpUserRolesSetup;
