"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FixedSizeList as List } from "react-window";
import {
  FaArrowLeft,
  FaSearch,
  FaSyncAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaList,
  FaThLarge,
} from "react-icons/fa";
import {
  FiRefreshCw,
  FiWifiOff,
  FiPackage,
  FiPlusCircle,
  FiSlash,
  FiInfo,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useTheme } from "../../context/ThemeContext";
import useCustomQuery from "../../hooks/useCustomQuery";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";

import ProductImage from "../Common/ProductImage";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getDisplayBusunitName = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "No target busunit";

  const parts = raw
    .split(/\s*-\s*/)
    .map((v) => v.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }

  return raw;
};

const normalize = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const pairKey = (productId, pricingCode) => `${productId}||${pricingCode}`;

const sameText = (a, b) =>
  String(a || "")
    .trim()
    .toLowerCase() ===
  String(b || "")
    .trim()
    .toLowerCase();

const sameNumber = (a, b, epsilon = 0.0001) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < epsilon;
};

const badgeMap = {
  price_change: {
    label: "Price Change",
    darkCls: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
    lightCls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  new_product: {
    label: "New Product",
    darkCls: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    lightCls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  inactive_product: {
    label: "Set Inactive",
    darkCls: "bg-rose-500/10 text-rose-300 border border-rose-500/30",
    lightCls: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  no_price_change: {
    label: "No Price Change",
    darkCls: "bg-slate-500/10 text-slate-300 border border-slate-500/20",
    lightCls: "bg-slate-100 text-slate-700 border border-slate-200",
  },
};

const TABLE_TEMPLATE =
  "260px 170px 150px 130px 130px 130px 130px 160px 160px 120px";

const StatCard = ({
  title,
  value,
  icon,
  accent = "blue",
  subtitle,
  isDark,
}) => {
  const accentCls =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "amber"
        ? "text-amber-400"
        : accent === "rose"
          ? "text-rose-400"
          : accent === "violet"
            ? "text-violet-400"
            : "text-blue-400";

  return (
    <div
      className={`rounded-[2rem] p-5 border backdrop-blur-xl ${
        isDark
          ? "bg-slate-900/40 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
            {title}
          </div>
          <div
            className={`text-3xl font-black ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {value}
          </div>
          {subtitle ? (
            <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
          ) : null}
        </div>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isDark ? "bg-slate-950/80" : "bg-slate-100"
          } ${accentCls}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

const FilterChip = ({
  active,
  label,
  onClick,
  tone = "default",
  isDark,
  disabled = false,
}) => {
  const activeCls =
    tone === "emerald"
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
      : tone === "amber"
        ? "bg-amber-600 text-white shadow-lg shadow-amber-900/20"
        : tone === "rose"
          ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20"
          : tone === "slate"
            ? "bg-slate-700 text-white shadow-lg"
            : "bg-blue-600 text-white shadow-lg shadow-blue-900/20";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
        active
          ? activeCls
          : isDark
            ? "bg-slate-900/40 text-slate-400 border border-white/5 hover:text-white"
            : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300"
      } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
    >
      {label}
    </button>
  );
};

const DiffRow = ({
  label,
  onlineValue,
  offlineValue,
  changed,
  isMoney = false,
  isDark,
  highlight = "blue",
}) => {
  const fmt = (v) => (isMoney ? peso(v) : String(v ?? "—"));

  const changedCls =
    highlight === "amber"
      ? isDark
        ? "bg-amber-500/10 border border-amber-500/20"
        : "bg-amber-50 border border-amber-200"
      : highlight === "rose"
        ? isDark
          ? "bg-rose-500/10 border border-rose-500/20"
          : "bg-rose-50 border border-rose-200"
        : isDark
          ? "bg-blue-500/10 border border-blue-500/20"
          : "bg-blue-50 border border-blue-200";

  return (
    <div
      className={`grid grid-cols-3 gap-3 rounded-2xl px-4 py-3 ${
        changed
          ? changedCls
          : isDark
            ? "bg-slate-900/40 border border-white/5"
            : "bg-slate-50 border border-slate-200"
      }`}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
        {label}
      </div>
      <div
        className={`${isDark ? "text-slate-300" : "text-slate-700"} text-sm`}
      >
        <span className="font-black text-slate-500 mr-1">ONLINE:</span>
        {fmt(onlineValue)}
      </div>
      <div
        className={`${isDark ? "text-slate-300" : "text-slate-700"} text-sm`}
      >
        <span className="font-black text-slate-500 mr-1">OFFLINE:</span>
        {fmt(offlineValue)}
      </div>
    </div>
  );
};

const InfoStrip = ({ isDark, title, message, tone = "blue" }) => {
  const toneCls = isDark
    ? tone === "amber"
      ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
      : tone === "rose"
        ? "bg-rose-500/10 border border-rose-500/20 text-rose-200"
        : tone === "emerald"
          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200"
          : "bg-blue-500/10 border border-blue-500/20 text-blue-200"
    : tone === "amber"
      ? "bg-amber-50 border border-amber-200 text-amber-800"
      : tone === "rose"
        ? "bg-rose-50 border border-rose-200 text-rose-800"
        : tone === "emerald"
          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
          : "bg-blue-50 border border-blue-200 text-blue-800";

  return (
    <div className={`rounded-[2rem] p-4 flex items-start gap-3 ${toneCls}`}>
      <FiInfo className="mt-1 shrink-0" />
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
          {title}
        </div>
        <div className="text-sm whitespace-pre-line">{message}</div>
      </div>
    </div>
  );
};

const ProductCard = ({
  row,
  checked,
  onToggle,
  imageBaseUrl,
  isDark,
  disabled = false,
}) => {
  const badge = badgeMap[row.action] || badgeMap.no_price_change;
  const hasAction = row.action !== "no_price_change";
  const priceChanged = row.diff?.price_changed || row.diff?.cost_changed;
  const badgeCls = isDark ? badge.darkCls : badge.lightCls;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[2rem] overflow-hidden border ${
        isDark
          ? "bg-slate-900/30 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      } ${disabled ? "opacity-80" : ""}`}
    >
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full md:w-44 shrink-0">
            <ProductImage
              src={`${imageBaseUrl}${row.product_id}.png`}
              alt={
                row.online?.item_name ||
                row.offline?.item_name ||
                row.product_id
              }
              className="rounded-2xl object-cover"
              wrapperClassName="h-40 md:h-44 w-full rounded-2xl overflow-hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeCls}`}
                  >
                    {badge.label}
                  </span>

                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      isDark
                        ? "bg-slate-900/70 text-slate-300 border border-white/5"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {row.pricing_code}
                  </span>

                  {priceChanged ? (
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        isDark
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      Price Discrepancy
                    </span>
                  ) : null}
                </div>

                <h3
                  className={`text-xl font-black break-words ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {row.online?.item_name ||
                    row.offline?.item_name ||
                    row.product_id}
                </h3>

                <div className="mt-1 text-sm text-slate-500 break-words">
                  {row.product_id}
                </div>

                <div className="mt-1 text-sm text-slate-500 break-words">
                  Pricing:{" "}
                  {row.online?.pricing_label ||
                    row.pricing_label ||
                    row.pricing_code}
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      isDark
                        ? "bg-slate-900/60 text-slate-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ONLINE Status: {row.online_presence ? "Exists" : "Missing"}
                  </span>

                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      isDark
                        ? "bg-slate-900/60 text-slate-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    OFFLINE Status:{" "}
                    {row.offline_presence
                      ? row.offline_status || "Exists"
                      : "Missing"}
                  </span>
                </div>
              </div>

              <div className="md:pl-4">
                <button
                  type="button"
                  disabled={!hasAction || disabled}
                  onClick={() => onToggle(row.row_key)}
                  className={`w-full md:w-auto rounded-2xl px-4 py-3 text-sm font-black transition-all ${
                    checked
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                      : hasAction
                        ? isDark
                          ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                          : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                        : isDark
                          ? "bg-slate-800/30 text-slate-500 cursor-not-allowed border border-white/5"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  } ${
                    disabled
                      ? "opacity-60 cursor-not-allowed pointer-events-none"
                      : ""
                  }`}
                >
                  {checked ? "Selected" : hasAction ? "Select" : "No Action"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <DiffRow
                label="Selling Price"
                onlineValue={row.online?.selling_price}
                offlineValue={row.offline?.selling_price}
                changed={row.diff?.price_changed}
                isMoney
                isDark={isDark}
                highlight="amber"
              />
              <DiffRow
                label="Unit Cost"
                onlineValue={row.online?.unit_cost}
                offlineValue={row.offline?.unit_cost}
                changed={row.diff?.cost_changed}
                isMoney
                isDark={isDark}
                highlight="amber"
              />
              <DiffRow
                label="Item Name"
                onlineValue={row.online?.item_name}
                offlineValue={row.offline?.item_name}
                changed={row.diff?.name_changed}
                isDark={isDark}
              />
              <DiffRow
                label="Category"
                onlineValue={row.online?.item_category}
                offlineValue={row.offline?.item_category}
                changed={row.diff?.category_changed}
                isDark={isDark}
              />
              <DiffRow
                label="UOM"
                onlineValue={row.online?.unit_of_measure}
                offlineValue={row.offline?.unit_of_measure}
                changed={row.diff?.uom_changed}
                isDark={isDark}
              />
            </div>

            {row.action === "inactive_product" ? (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  isDark
                    ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                    : "bg-rose-50 border border-rose-200 text-rose-700"
                }`}
              >
                This product is no longer available ONLINE for this selected
                pricing scope. Sync will set the OFFLINE product status to
                Inactive and deactivate its pricing row.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ProgressLoader = ({ isDark, text = "Loading sync details..." }) => {
  return (
    <div
      className={`rounded-[2rem] p-8 border text-center ${
        isDark
          ? "bg-slate-900/40 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="mx-auto mb-4 w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
      <div
        className={`text-2xl font-black ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {text}
      </div>
      <div className="mt-2 text-slate-500">
        Reconciling ONLINE pricing availability, price changes, new products,
        and OFFLINE-only products.
      </div>
    </div>
  );
};

const SyncingOverlay = ({ isDark }) => {
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className={`w-full max-w-lg rounded-[2rem] border px-8 py-10 text-center shadow-2xl ${
            isDark
              ? "bg-slate-950/90 border-white/10 text-white"
              : "bg-white/95 border-slate-200 text-slate-900"
          }`}
        >
          <div className="mx-auto mb-5 h-20 w-20 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="text-3xl font-black tracking-tight">
            Syncing products, pricing, sales types, and mappings...
          </div>
          <div className="mt-3 text-sm text-slate-500">
            Please wait while selected changes are being applied.
          </div>
        </div>
      </div>
    </div>
  );
};

const VirtualHeader = ({ isDark }) => {
  const cols = [
    "Product",
    "Pricing",
    "Action",
    "ONLINE SRP",
    "OFFLINE SRP",
    "ONLINE COST",
    "OFFLINE COST",
    "Status",
    "Select",
  ];

  return (
    <div
      className={isDark ? "bg-slate-900/60" : "bg-slate-100/70"}
      style={{
        display: "grid",
        gridTemplateColumns: TABLE_TEMPLATE,
        minWidth: "1640px",
      }}
    >
      {cols.map((col) => (
        <div
          key={col}
          className="p-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500"
        >
          {col}
        </div>
      ))}
    </div>
  );
};

const VirtualRow = ({ index, style, data }) => {
  const {
    rows,
    selectedRowKeys,
    toggleSelect,
    imageBaseUrl,
    isDark,
    disabled,
  } = data;
  const row = rows[index];
  const badge = badgeMap[row.action] || badgeMap.no_price_change;
  const checked = selectedRowKeys.includes(row.row_key);
  const badgeCls = isDark ? badge.darkCls : badge.lightCls;

  return (
    <div style={style}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: TABLE_TEMPLATE,
          minWidth: "1640px",
        }}
        className={`border-b last:border-0 transition-colors ${
          isDark
            ? "border-white/5 hover:bg-white/5"
            : "border-slate-100 hover:bg-slate-50"
        } ${disabled ? "opacity-80" : ""}`}
      >
        <div className="p-4">
          <div className="flex items-center gap-4 min-w-[220px]">
            <div className="w-8 h-8 shrink-0">
              <ProductImage
                src={`${imageBaseUrl}${row.product_id}.png`}
                alt={
                  row.online?.item_name ||
                  row.offline?.item_name ||
                  row.product_id
                }
                className="rounded-xl object-cover"
                wrapperClassName="h-8 w-8 rounded-xl overflow-hidden"
              />
            </div>

            <div className="min-w-0">
              <div
                className={`font-black text-sm ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {row.online?.item_name ||
                  row.offline?.item_name ||
                  row.product_id}
              </div>
              <div className="text-xs text-slate-500">{row.product_id}</div>
              <div className="text-xs text-slate-500">
                {row.online?.item_category || row.offline?.item_category || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="font-black">
            {row.online?.pricing_label || row.pricing_label || row.pricing_code}
          </div>
          <div className="text-sm text-slate-500">{row.pricing_code}</div>
        </div>

        <div className="p-4">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeCls}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="p-4 font-bold text-amber-500">
          {row.online?.selling_price != null
            ? peso(row.online?.selling_price)
            : "—"}
        </div>

        <div className="p-4">
          {row.offline?.selling_price != null
            ? peso(row.offline?.selling_price)
            : "—"}
        </div>

        <div className="p-4 font-bold text-cyan-500">
          {row.online?.unit_cost != null ? peso(row.online?.unit_cost) : "—"}
        </div>

        <div className="p-4">
          {row.offline?.unit_cost != null ? peso(row.offline?.unit_cost) : "—"}
        </div>

        <div className="p-4">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
              row.action === "inactive_product"
                ? isDark
                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
                : row.action === "new_product"
                  ? isDark
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : row.action === "price_change"
                    ? isDark
                      ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                    : isDark
                      ? "bg-slate-500/10 text-slate-300 border border-slate-500/20"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}
          >
            {row.offline_status ||
              (row.offline_presence ? "Exists" : "Missing")}
          </span>
        </div>

        <div className="p-4">
          <button
            disabled={row.action === "no_price_change" || disabled}
            onClick={() => toggleSelect(row.row_key)}
            className={`rounded-2xl px-4 py-2 font-bold transition-all ${
              checked
                ? "bg-blue-600 text-white"
                : row.action === "no_price_change"
                  ? isDark
                    ? "bg-slate-700/30 text-slate-500 cursor-not-allowed"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : isDark
                    ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                    : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
            } ${
              disabled
                ? "opacity-60 cursor-not-allowed pointer-events-none"
                : ""
            }`}
          >
            {checked
              ? "Selected"
              : row.action === "no_price_change"
                ? "None"
                : "Select"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SyncProductsAndPricing = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("price_change");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedPricingCodes, setSelectedPricingCodes] = useState([]);
  const [pendingPricingCodes, setPendingPricingCodes] = useState([]);
  const [warningMode, setWarningMode] = useState(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [virtualHeight, setVirtualHeight] = useState(620);

  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [showhidesuccess, setshowhidesuccess] = useState(false);
  const [returnmessage, setReturnmessage] = useState({ message: "" });
  const [isSyncing, setIsSyncing] = useState(false);

  const pricingQueryString = useMemo(() => {
    const params = new URLSearchParams();
    selectedPricingCodes.forEach((code) =>
      params.append("pricing_codes[]", code),
    );
    return params.toString();
  }, [selectedPricingCodes]);

  const imageBaseUrl =
    import.meta.env.VITE_WEBAPIENDPOINT + import.meta.env.VITE_PRODUCT_IMAGES;

  const localReadUrl = useMemo(() => {
    const base =
      import.meta.env.VITE_LOCALAPIENDPOINT +
      import.meta.env.VITE_PRODUCT_SYNC_LOCAL_READ_ENDPOINT;

    return pricingQueryString ? `${base}?${pricingQueryString}` : base;
  }, [pricingQueryString]);

  const webReadUrl =
    import.meta.env.VITE_WEBAPIENDPOINT +
    import.meta.env.VITE_PRODUCT_SYNC_WEB_READ_ENDPOINT;

  const webExportUrl =
    import.meta.env.VITE_WEBAPIENDPOINT +
    import.meta.env.VITE_PRODUCT_SYNC_WEB_EXPORT_ENDPOINT;

  const localMutateUrl =
    import.meta.env.VITE_LOCALAPIENDPOINT +
    import.meta.env.VITE_PRODUCT_SYNC_LOCAL_MUTATE_ENDPOINT;

  const {
    data: localReadData,
    isLoading: isLocalLoading,
    refetch: refetchLocal,
  } = useCustomQuery(localReadUrl, [
    "product-sync-local-read",
    pricingQueryString,
  ]);

  const { mutate: webReadMutate, data: webReadData } =
    useCustomSecuredMutation(webReadUrl);

  const { mutate: webExportMutate } = useCustomSecuredMutation(webExportUrl);
  const { mutate: localMutate } = useCustomSecuredMutation(localMutateUrl);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      const h = Math.max(360, window.innerHeight - 280);
      setVirtualHeight(h);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    const busunitcode = localReadData?.target?.busunitcode || "";
    if (!busunitcode) return;

    webReadMutate({
      busunitcode,
      pricing_codes: selectedPricingCodes,
    });
  }, [localReadData?.target?.busunitcode, selectedPricingCodes, webReadMutate]);

  const pricingOptions = useMemo(
    () => webReadData?.pricing_options || [],
    [webReadData],
  );

  const offlineExistingPricingCodes = useMemo(
    () => new Set(localReadData?.offline_existing_pricing_codes || []),
    [localReadData],
  );

  const busunitMappedPricingCodes = useMemo(
    () => new Set(webReadData?.busunit_mapped_pricing_codes || []),
    [webReadData],
  );

  const busunitSalesTypePricingRows = useMemo(
    () => webReadData?.busunit_sales_type_pricing_rows || [],
    [webReadData],
  );

  const onlinePricingCodes = useMemo(() => {
    return (webReadData?.pricing_options || [])
      .map((row) => String(row.pricing_code || "").trim())
      .filter(Boolean);
  }, [webReadData]);

  const offlinePricingCodes = useMemo(() => {
    return localReadData?.offline_existing_pricing_codes || [];
  }, [localReadData]);

  const offlineOnlyPricingCodes = useMemo(() => {
    return offlinePricingCodes.filter(
      (code) => !onlinePricingCodes.includes(code),
    );
  }, [offlinePricingCodes, onlinePricingCodes]);

  const onlineOnlyPricingCodes = useMemo(() => {
    return onlinePricingCodes.filter(
      (code) => !offlinePricingCodes.includes(code),
    );
  }, [onlinePricingCodes, offlinePricingCodes]);

  const salesTypeSummaryText = useMemo(() => {
    if (!busunitSalesTypePricingRows.length) return "";

    const grouped = busunitSalesTypePricingRows.reduce((acc, row) => {
      const label =
        row.sales_type_description || row.sales_type_id || "Unknown Sales Type";
      if (!acc[label]) acc[label] = [];
      acc[label].push(row.pricing_label || row.pricing_code || "—");
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([salesType, pricingLabels]) => {
        const uniq = [...new Set(pricingLabels)];
        return `${salesType}: ${uniq.join(", ")}`;
      })
      .join("\n");
  }, [busunitSalesTypePricingRows]);

  useEffect(() => {
    if (selectedPricingCodes.length === 0 && pricingOptions.length > 0) {
      const defaults = pricingOptions
        .filter((opt) => busunitMappedPricingCodes.has(opt.pricing_code))
        .map((opt) => opt.pricing_code);

      setSelectedPricingCodes(
        defaults.length > 0 ? defaults : [pricingOptions[0].pricing_code],
      );
    }
  }, [pricingOptions, busunitMappedPricingCodes, selectedPricingCodes.length]);

  const runRefresh = useCallback(() => {
    if (isSyncing) return;
    refetchLocal?.();
  }, [refetchLocal, isSyncing]);

  const rows = useMemo(() => {
    const webRows = webReadData?.web_rows || [];
    const offlineProducts = localReadData?.offline_products || [];
    const offlinePricingRows = localReadData?.offline_pricing_rows || [];
    const currentPricingOptions = webReadData?.pricing_options || [];

    const pricingLabels = {};
    currentPricingOptions.forEach((opt) => {
      pricingLabels[String(opt.pricing_code || "")] = String(
        opt.pricing_label || opt.pricing_code || "",
      );
    });

    const offlineProductMap = {};
    offlineProducts.forEach((row) => {
      const productId = String(row.product_id || "").trim();
      if (productId) offlineProductMap[productId] = row;
    });

    const offlinePricingMap = {};
    offlinePricingRows.forEach((row) => {
      const invCode = String(row.inv_code || "").trim();
      const pricingCode = String(row.pricing_code || "").trim();
      if (invCode && pricingCode) {
        offlinePricingMap[pairKey(invCode, pricingCode)] = row;
      }
    });

    const requestedPricingCodes =
      selectedPricingCodes.length > 0
        ? selectedPricingCodes
        : webReadData?.selected_pricing_codes || [];

    const builtRows = [];
    const seen = new Set();

    requestedPricingCodes.forEach((pricingCode) => {
      webRows.forEach((webRow) => {
        const currentPricingCode = String(webRow.pricing_code || "").trim();
        if (currentPricingCode !== pricingCode) return;

        const productId = String(webRow.product_id || "").trim();
        if (!productId) return;

        const rowKey = pairKey(productId, pricingCode);
        const localProduct = offlineProductMap[productId] || null;
        const localPricing = offlinePricingMap[rowKey] || null;

        const diff = {
          price_changed: !sameNumber(webRow.selling_price, localPricing?.srp),
          cost_changed: !sameNumber(
            webRow.unit_cost,
            localPricing?.cost_per_uom,
          ),
          name_changed: !sameText(webRow.item_name, localProduct?.item_name),
          category_changed: !sameText(
            webRow.item_category,
            localProduct?.item_category,
          ),
          uom_changed: !sameText(
            webRow.unit_of_measure,
            localProduct?.unit_of_measure,
          ),
        };

        let action = "no_price_change";
        if (!localPricing) {
          action = "new_product";
        } else if (diff.price_changed || diff.cost_changed) {
          action = "price_change";
        }

        builtRows.push({
          row_key: rowKey,
          product_id: productId,
          pricing_code: pricingCode,
          pricing_label: pricingLabels[pricingCode] || pricingCode,
          action,
          online_presence: true,
          offline_presence: !!localProduct,
          offline_status: String(localProduct?.status || "Missing"),
          offline_only: false,
          online: {
            product_id: productId,
            pricing_code: pricingCode,
            pricing_label: String(
              webRow.pricing_label || pricingLabels[pricingCode] || pricingCode,
            ),
            item_name: String(webRow.item_name || ""),
            item_category: String(webRow.item_category || ""),
            unit_of_measure: String(webRow.unit_of_measure || ""),
            unit_value: String(webRow.unit_value || ""),
            unit_cost:
              webRow.unit_cost != null ? Number(webRow.unit_cost) : null,
            selling_price:
              webRow.selling_price != null
                ? Number(webRow.selling_price)
                : null,
            inventory_type: String(webRow.inventory_type || "PRODUCT"),
            vatable: String(webRow.vatable || ""),
            expiry_days: Number(webRow.expiry_days || 0),
            item_brand: String(webRow.item_brand || ""),
            isDiscountable: String(webRow.isDiscountable || "No"),
          },
          offline: {
            item_name: localProduct?.item_name ?? null,
            item_category: localProduct?.item_category ?? null,
            unit_of_measure: localProduct?.unit_of_measure ?? null,
            unit_cost:
              localPricing?.cost_per_uom != null
                ? Number(localPricing.cost_per_uom)
                : null,
            selling_price:
              localPricing?.srp != null ? Number(localPricing.srp) : null,
            inventory_type: localProduct?.inventory_type ?? null,
            vatable: localProduct?.vatable ?? null,
            item_brand: localProduct?.item_brand ?? null,
            isDiscountable: localProduct?.isDiscountable ?? null,
          },
          diff,
        });

        seen.add(rowKey);
      });
    });

    requestedPricingCodes.forEach((pricingCode) => {
      Object.values(offlinePricingMap).forEach((localPricing) => {
        if (String(localPricing.pricing_code || "") !== String(pricingCode)) {
          return;
        }

        const productId = String(localPricing.inv_code || "").trim();
        const rowKey = pairKey(productId, pricingCode);

        if (seen.has(rowKey)) return;

        const localProduct = offlineProductMap[productId] || null;

        builtRows.push({
          row_key: rowKey,
          product_id: productId,
          pricing_code: pricingCode,
          pricing_label: pricingLabels[pricingCode] || pricingCode,
          action: "inactive_product",
          online_presence: false,
          offline_presence: !!localProduct,
          offline_status: String(localProduct?.status || "Active"),
          offline_only: true,
          online: null,
          offline: {
            item_name: localProduct?.item_name ?? null,
            item_category: localProduct?.item_category ?? null,
            unit_of_measure: localProduct?.unit_of_measure ?? null,
            unit_cost:
              localPricing?.cost_per_uom != null
                ? Number(localPricing.cost_per_uom)
                : null,
            selling_price:
              localPricing?.srp != null ? Number(localPricing.srp) : null,
            inventory_type: localProduct?.inventory_type ?? null,
            vatable: localProduct?.vatable ?? null,
            item_brand: localProduct?.item_brand ?? null,
            isDiscountable: localProduct?.isDiscountable ?? null,
          },
          diff: {
            price_changed: false,
            cost_changed: false,
            name_changed: false,
            category_changed: false,
            uom_changed: false,
          },
        });

        seen.add(rowKey);
      });
    });

    return builtRows;
  }, [webReadData, localReadData, selectedPricingCodes]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      priceChange: rows.filter((r) => r.action === "price_change").length,
      newProduct: rows.filter((r) => r.action === "new_product").length,
      inactive: rows.filter((r) => r.action === "inactive_product").length,
      noPriceChange: rows.filter((r) => r.action === "no_price_change").length,
    };
  }, [rows]);

  useEffect(() => {
    const auto = rows
      .filter((r) =>
        ["price_change", "new_product", "inactive_product"].includes(r.action),
      )
      .map((r) => r.row_key);

    setSelectedRowKeys(auto);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let data = [...rows];

    if (filter !== "all") {
      data = data.filter((r) => r.action === filter);
    }

    if (search.trim()) {
      const q = normalize(search);
      data = data.filter((r) => {
        const hay = [
          r.product_id,
          r.pricing_code,
          r.online?.item_name,
          r.online?.item_category,
          r.offline?.item_name,
          r.online?.pricing_label,
        ]
          .map(normalize)
          .join(" ");
        return hay.includes(q);
      });
    }

    data.sort((a, b) => {
      const aPricingName = normalize(
        a.online?.pricing_label || a.pricing_label || a.pricing_code,
      );
      const bPricingName = normalize(
        b.online?.pricing_label || b.pricing_label || b.pricing_code,
      );

      const pricingNameCompare = aPricingName.localeCompare(
        bPricingName,
        undefined,
        { numeric: true, sensitivity: "base" },
      );

      if (pricingNameCompare !== 0) return pricingNameCompare;

      const aProductName = normalize(
        a.online?.item_name || a.offline?.item_name || a.product_id,
      );
      const bProductName = normalize(
        b.online?.item_name || b.offline?.item_name || b.product_id,
      );

      return aProductName.localeCompare(bProductName, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return data;
  }, [rows, filter, search]);

  const selectedRows = useMemo(() => {
    const map = new Set(selectedRowKeys);
    return rows.filter(
      (r) => map.has(r.row_key) && r.action !== "no_price_change",
    );
  }, [rows, selectedRowKeys]);

  const toggleSelect = useCallback(
    (rowKey) => {
      if (isSyncing) return;
      setSelectedRowKeys((prev) =>
        prev.includes(rowKey)
          ? prev.filter((id) => id !== rowKey)
          : [...prev, rowKey],
      );
    },
    [isSyncing],
  );

  const selectAllVisibleChanges = () => {
    if (isSyncing) return;
    const visibleChangeIds = filteredRows
      .filter((r) => r.action !== "no_price_change")
      .map((r) => r.row_key);

    setSelectedRowKeys((prev) => {
      const s = new Set(prev);
      visibleChangeIds.forEach((id) => s.add(id));
      return Array.from(s);
    });
  };

  const clearSelection = () => {
    if (isSyncing) return;
    setSelectedRowKeys([]);
  };

  const confirmWarningAndApplyPricingCodes = () => {
    const codes = [...pendingPricingCodes];
    setPendingPricingCodes([]);
    setWarningMode(null);
    setYesNoModalOpen(false);
    setSelectedPricingCodes(codes);
  };

  const requestPricingCodeToggle = (pricingCode) => {
    if (isSyncing) return;

    const next = selectedPricingCodes.includes(pricingCode)
      ? selectedPricingCodes.filter((c) => c !== pricingCode)
      : [...selectedPricingCodes, pricingCode];

    setSelectedPricingCodes(next);
  };

  const requestCheckAllPricingCodes = () => {
    if (isSyncing) return;
    const allCodes = pricingOptions.map((p) => p.pricing_code);
    setSelectedPricingCodes(allCodes);
  };

  const clearPricingCodes = () => {
    if (isSyncing) return;
    setSelectedPricingCodes([]);
    setSelectedRowKeys([]);
  };

  const openSyncConfirm = () => {
    if (isSyncing) return;
    setWarningMode("sync_rows");
    setYesNoModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (warningMode === "pricing_code" || warningMode === "check_all_pricing") {
      confirmWarningAndApplyPricingCodes();
      return;
    }

    setYesNoModalOpen(false);

    if (!isOnline) {
      setReturnmessage({
        message: "Offline. Cannot sync while there is no internet.",
      });
      setshowhidesuccess(true);
      return;
    }

    if (!localReadData?.target?.busunitcode) {
      setReturnmessage({
        message: "No active business unit / pricing mapping found.",
      });
      setshowhidesuccess(true);
      return;
    }

    if (selectedRows.length === 0) {
      setReturnmessage({ message: "No selected changes to sync." });
      setshowhidesuccess(true);
      return;
    }

    setIsSyncing(true);

    webExportMutate(
      {
        busunitcode: localReadData?.target?.busunitcode,
        rows: selectedRows.map((row) => ({
          row_key: row.row_key,
          product_id: row.product_id,
          pricing_code: row.pricing_code,
          action: row.action,
        })),
        selected_pricing_codes: selectedPricingCodes,
      },
      {
        onSuccess: (exportPayload) => {
          localMutate(exportPayload, {
            onSuccess: async (localResult) => {
              setIsSyncing(false);
              setReturnmessage({
                message:
                  localResult?.summary_message ||
                  `Synced ${localResult?.affected_rows || 0} operation(s).`,
              });
              setshowhidesuccess(true);
              runRefresh();
            },
            onError: (err) => {
              setIsSyncing(false);
              setReturnmessage({
                message:
                  err?.response?.data?.message ||
                  err?.message ||
                  "LOCAL mutate failed.",
              });
              setshowhidesuccess(true);
            },
          });
        },
        onError: (err) => {
          setIsSyncing(false);
          setReturnmessage({
            message:
              err?.response?.data?.message ||
              err?.message ||
              "WEB export failed.",
          });
          setshowhidesuccess(true);
        },
      },
    );
  };

  const modalMessage = useMemo(() => {
    const priceChangeCount = selectedRows.filter(
      (r) => r.action === "price_change",
    ).length;
    const newProductCount = selectedRows.filter(
      (r) => r.action === "new_product",
    ).length;
    const inactiveCount = selectedRows.filter(
      (r) => r.action === "inactive_product",
    ).length;

    return `Do you want to sync ${selectedRows.length} selected row(s)?

Price changes: ${priceChangeCount}
New products: ${newProductCount}
Set inactive: ${inactiveCount}

This will also replace OFFLINE lkp_sales_type and tbl_pricing_by_sales_type using WEB mappings for the selected business unit.`;
  }, [selectedRows]);

  const localReadMessage = localReadData?.message || "";
  const webReadMessage = webReadData?.message || "";

  const isLocalFailed = localReadMessage === "Failed";
  const isWebFailed = webReadMessage === "Failed";
  const isRemoteOffline = isWebFailed;
  const noBusinessUnit = localReadMessage === "NoBusinessUnit";

  const isLoading =
    isLocalLoading || (!webReadData && !!localReadData?.target?.busunitcode);

  const listData = useMemo(
    () => ({
      rows: filteredRows,
      selectedRowKeys,
      toggleSelect,
      imageBaseUrl,
      isDark,
      disabled: isSyncing,
    }),
    [
      filteredRows,
      selectedRowKeys,
      toggleSelect,
      imageBaseUrl,
      isDark,
      isSyncing,
    ],
  );

  return (
    <div
      className={`min-h-screen overflow-x-hidden pb-20 ${
        isDark ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none">
        <div
          className={`absolute top-[-5%] left-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-blue-600/5" : "bg-blue-600/10"
          }`}
        />
        <div
          className={`absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-indigo-600/5" : "bg-indigo-600/10"
          }`}
        />
      </div>

      {isSyncing && <SyncingOverlay isDark={isDark} />}

      <nav
        className={`sticky top-0 z-40 backdrop-blur-xl px-4 py-4 mb-8 ${
          isDark
            ? "bg-slate-950/60 border-b border-white/5"
            : "bg-white/80 border-b border-slate-200/80 shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => !isSyncing && navigate(-1)}
            disabled={isSyncing}
            className={`flex items-center gap-3 px-6 py-3 rounded-full transition-all ${
              isDark
                ? "bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
            } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <FaArrowLeft size={14} />
            <span className="text-xs font-bold tracking-wider uppercase">
              Back
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div
              className={`flex p-1 rounded-2xl ${
                isDark
                  ? "bg-slate-900/80 border border-white/5"
                  : "bg-slate-100 border border-slate-200"
              } ${isSyncing ? "opacity-50 pointer-events-none" : ""}`}
            >
              <button
                onClick={() => setViewMode("card")}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${
                  viewMode === "card"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <FaThLarge size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${
                  viewMode === "table"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <FaList size={14} />
              </button>
            </div>

            <button
              onClick={runRefresh}
              disabled={isSyncing}
              className={`rounded-2xl px-4 py-3 bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 ${
                isSyncing
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : ""
              }`}
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-10">
          <div>
            <h1
              className={`text-2xl md:text-5xl font-black tracking-tighter mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Products and Pricing <span className="text-blue-500">Sync</span>
            </h1>
            <p className="text-slate-500 font-medium">
              Reconcile ONLINE vs POS by{" "}
              <strong>pricing_code + inv_code</strong>
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:w-[560px]">
            <div className="relative group">
              <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Search product id / pricing / name / category..."
                value={search}
                disabled={isSyncing}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-[2rem] py-2 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all backdrop-blur-sm ${
                  isDark
                    ? "bg-slate-900/30 border border-slate-800 hover:border-slate-700 text-white"
                    : "bg-white border border-slate-200 hover:border-slate-300 text-slate-900 shadow-sm"
                } ${isSyncing ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={filter === "price_change"}
                label="Price Change"
                tone="amber"
                onClick={() => setFilter("price_change")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "new_product"}
                label="New Product"
                tone="emerald"
                onClick={() => setFilter("new_product")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "inactive_product"}
                label="Not Available"
                tone="rose"
                onClick={() => setFilter("inactive_product")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "no_price_change"}
                label="No Price Change"
                tone="slate"
                onClick={() => setFilter("no_price_change")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "all"}
                label="All"
                onClick={() => setFilter("all")}
                isDark={isDark}
                disabled={isSyncing}
              />
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mb-8">
          <StatCard
            title="Target Business Unit"
            value={
              webReadData?.busunit_names?.[
                localReadData?.target?.busunitcode
              ] ||
              getDisplayBusunitName(localReadData?.target?.busunit_name) ||
              "No target busunit"
            }
            subtitle={localReadData?.target?.busunitcode || "—"}
            icon={<FiPackage size={20} />}
            isDark={isDark}
          />
          <StatCard
            title="Price Changes"
            value={summary.priceChange}
            subtitle="Cost and/or SRP changed"
            icon={<FaSyncAlt size={18} />}
            accent="amber"
            isDark={isDark}
          />
          <StatCard
            title="New Products"
            value={summary.newProduct}
            subtitle="ONLINE rows missing OFFLINE"
            icon={<FiPlusCircle size={18} />}
            accent="emerald"
            isDark={isDark}
          />
          <StatCard
            title="Not Available"
            value={summary.inactive}
            subtitle="OFFLINE rows missing ONLINE"
            icon={<FiSlash size={18} />}
            accent="rose"
            isDark={isDark}
          />
          <StatCard
            title="No Price Change"
            value={summary.noPriceChange}
            subtitle="For reference only"
            icon={<FaCheckCircle size={18} />}
            accent="violet"
            isDark={isDark}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] mb-8">
          <div
            className={`rounded-[2rem] p-5 border ${
              isDark
                ? "bg-slate-900/30 border-white/5"
                : "bg-white border-slate-200 shadow-sm"
            } ${isSyncing ? "opacity-80" : ""}`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
                    Pricing Code Selector
                  </div>
                  <div
                    className={`text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    ONLINE pricing codes
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Check state now comes from WEB{" "}
                    <code>tbl_pricing_by_sales_type_per_bu</code> for the
                    selected business unit.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={requestCheckAllPricingCodes}
                    disabled={isSyncing}
                    className={`rounded-2xl px-4 py-3 font-bold transition-all ${
                      isDark
                        ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                        : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                    } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                  >
                    Check All
                  </button>

                  <button
                    onClick={clearPricingCodes}
                    disabled={isSyncing}
                    className={`rounded-2xl px-4 py-3 font-bold transition-all ${
                      isDark
                        ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                        : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                    } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                  >
                    Clear Pricing
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pricingOptions.map((opt) => {
                  const checked = selectedPricingCodes.includes(
                    opt.pricing_code,
                  );
                  const mappedToSelectedBu = busunitMappedPricingCodes.has(
                    opt.pricing_code,
                  );
                  const existsOffline = offlineExistingPricingCodes.has(
                    opt.pricing_code,
                  );

                  return (
                    <button
                      key={opt.pricing_code}
                      type="button"
                      disabled={isSyncing}
                      onClick={() => requestPricingCodeToggle(opt.pricing_code)}
                      className={`text-left rounded-2xl border px-4 py-4 transition-all ${
                        checked
                          ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20"
                          : isDark
                            ? "bg-slate-900/60 border-white/5 text-slate-200 hover:border-blue-400/40"
                            : "bg-slate-50 border-slate-200 text-slate-900 hover:border-blue-300"
                      } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.25em] opacity-70">
                            Pricing Code
                          </div>
                          <div className="text-sm font-black mt-1">
                            {opt.pricing_code}
                          </div>
                          <div className="text-sm mt-1 opacity-80">
                            {opt.pricing_label}
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            checked
                              ? "bg-white text-blue-600 border-white"
                              : isDark
                                ? "border-slate-500"
                                : "border-slate-400"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {mappedToSelectedBu ? (
                          <div className="text-xs font-black uppercase tracking-wider text-emerald-500">
                            Mapped in WEB selected BU
                          </div>
                        ) : (
                          <div className="text-xs font-black uppercase tracking-wider text-amber-500">
                            Not mapped in WEB selected BU
                          </div>
                        )}

                        {existsOffline ? (
                          <div className="text-[11px] font-bold text-indigo-200">
                            Already exists in OFFLINE mapping table
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-indigo-200">
                            Not currently in OFFLINE mapping table
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {busunitSalesTypePricingRows.length > 0 ? (
              <InfoStrip
                isDark={isDark}
                tone="emerald"
                title="Selected BU sales type → pricing mapping from WEB"
                message={salesTypeSummaryText}
              />
            ) : null}

            {offlineOnlyPricingCodes.length > 0 ? (
              <InfoStrip
                isDark={isDark}
                tone="rose"
                title="Offline pricing codes not available online"
                message={`These OFFLINE pricing codes do not currently exist in ONLINE: ${offlineOnlyPricingCodes.join(
                  ", ",
                )}`}
              />
            ) : null}

            {onlineOnlyPricingCodes.length > 0 ? (
              <InfoStrip
                isDark={isDark}
                tone="amber"
                title="Online pricing codes not yet offline"
                message={`These ONLINE pricing codes are available for initial add: ${onlineOnlyPricingCodes.join(
                  ", ",
                )}`}
              />
            ) : null}

            <div
              className={`rounded-[2rem] p-5 border ${
                isDark
                  ? "bg-slate-900/30 border-white/5"
                  : "bg-white border-slate-200 shadow-sm"
              } ${isSyncing ? "opacity-80" : ""}`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
                Reconciliation Controls
              </div>

              <div className="space-y-3">
                <button
                  onClick={selectAllVisibleChanges}
                  disabled={isSyncing}
                  className={`w-full rounded-2xl px-4 py-3 font-bold transition-all ${
                    isDark
                      ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                      : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                  } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  Select Visible Changes
                </button>

                <button
                  onClick={clearSelection}
                  disabled={isSyncing}
                  className={`w-full rounded-2xl px-4 py-3 font-bold transition-all ${
                    isDark
                      ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                      : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                  } ${isSyncing ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  Clear Selected Rows
                </button>

                <button
                  onClick={openSyncConfirm}
                  disabled={
                    isSyncing ||
                    !isOnline ||
                    isLocalFailed ||
                    isRemoteOffline ||
                    noBusinessUnit ||
                    selectedRows.length === 0
                  }
                  className={`w-full rounded-2xl px-5 py-3 font-bold transition-all ${
                    isSyncing ||
                    !isOnline ||
                    isLocalFailed ||
                    isRemoteOffline ||
                    noBusinessUnit ||
                    selectedRows.length === 0
                      ? isDark
                        ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                  }`}
                >
                  Sync Selected
                </button>

                <div
                  className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                    isOnline
                      ? isDark
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      : isDark
                        ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                        : "bg-rose-50 border border-rose-200 text-rose-700"
                  }`}
                >
                  {isOnline ? (
                    <FaCheckCircle size={16} />
                  ) : (
                    <FiWifiOff size={16} />
                  )}
                  <span className="font-bold">
                    {isOnline ? "Device online" : "Device offline"}
                  </span>
                </div>

                <div
                  className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                    isRemoteOffline || isLocalFailed
                      ? isDark
                        ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                        : "bg-rose-50 border border-rose-200 text-rose-700"
                      : noBusinessUnit
                        ? isDark
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                          : "bg-amber-50 border border-amber-200 text-amber-700"
                        : isDark
                          ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                          : "bg-blue-50 border border-blue-200 text-blue-700"
                  }`}
                >
                  <FaExclamationTriangle size={16} />
                  <span className="font-bold">
                    {isLocalFailed
                      ? "LOCAL read failed"
                      : isRemoteOffline
                        ? "WEB database unreachable"
                        : noBusinessUnit
                          ? "No active local BU pricing mapping"
                          : "WEB reconciliation ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(filter === "price_change" || filter === "all") &&
        summary.priceChange > 0 ? (
          <InfoStrip
            isDark={isDark}
            tone="amber"
            title="Price discrepancy highlight"
            message="Amber and Blue values show the incoming ONLINE SRP and COST that will overwrite the current POS pricing for the same inv_code + pricing_code."
          />
        ) : null}

        {!isOnline && (
          <div
            className={`mb-8 mt-6 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FiWifiOff size={18} />
            <div className="font-semibold">
              You are offline. Reads may be stale and syncing is disabled until
              internet returns.
            </div>
          </div>
        )}

        {isRemoteOffline && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              Cannot reach the WEB database right now. Reconciliation and sync
              are blocked.
            </div>
          </div>
        )}

        {isLocalFailed && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              Cannot read OFFLINE product and pricing snapshot right now.
            </div>
          </div>
        )}

        {noBusinessUnit && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              No active row found in <code>tbl_pricing_by_sales_type</code>. Add
              at least one active business unit mapping first.
            </div>
          </div>
        )}

        <main className="min-h-[40vh] mt-5">
          {isLoading ? (
            <ProgressLoader
              isDark={isDark}
              text="Loading reconciliation details..."
            />
          ) : filteredRows.length === 0 ? (
            <div
              className={`rounded-[2rem] p-10 text-center border ${
                isDark
                  ? "bg-slate-900/30 border-white/5"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div
                className={`text-2xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                No matching rows
              </div>
              <div className="text-slate-500">
                Try another filter, search keyword, or pricing-code selection.
              </div>
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredRows.map((row) => (
                  <ProductCard
                    key={row.row_key}
                    row={row}
                    checked={selectedRowKeys.includes(row.row_key)}
                    onToggle={toggleSelect}
                    imageBaseUrl={imageBaseUrl}
                    isDark={isDark}
                    disabled={isSyncing}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div
              className={`rounded-[2.5rem] overflow-hidden border ${
                isDark
                  ? "bg-slate-950/40 border-white/5"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="overflow-y-hidden">
                <div
                  className="overflow-y-auto overflow-x-hidden"
                  style={{
                    maxHeight: `${virtualHeight + 80}px`,
                  }}
                >
                  <VirtualHeader isDark={isDark} />
                  <div style={{ height: virtualHeight }}>
                    <List
                      height={virtualHeight}
                      itemCount={filteredRows.length}
                      itemSize={92}
                      itemData={listData}
                    >
                      {VirtualRow}
                    </List>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message={modalMessage}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleModalConfirm}
        />
      )}

      {showhidesuccess && (
        <ModalSuccessNavToSelf
          header="Success"
          message={returnmessage.message}
          button="Save"
          setIsModalOpen={setshowhidesuccess}
          resetForm={async () => {
            setReturnmessage({ message: "" });
            await runRefresh();
          }}
        />
      )}
    </div>
  );
};

export default SyncProductsAndPricing;
