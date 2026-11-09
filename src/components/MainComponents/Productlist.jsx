import React, {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaSyncAlt,
  FaArrowLeft,
  FaTag,
  FaChartPie,
  FaLock,
  FaPowerOff,
  FaCheckCircle,
  FaExclamationTriangle,
  FaThLarge,
  FaPercent,
  FaLayerGroup,
  FaPlus,
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import ProductImage from "../common/ProductImage";
import TutorialTip from "../common/TutorialTip";
import AddProductModal from "./ProductListModal/AddProductModal";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { hasPosSettingsAccess } from "../../utils/posRoleAccess";
import {
  usePosDeveloperSession,
  usePosRoleAccessVersion,
} from "../../hooks/usePosRoleAccessConfig";

const PosPricingDashboard = lazy(() =>
  import("./PosSettingsModal/PosPricingDashboard"),
);

const PRODUCTS_PER_PAGE = 60;
const PRICING_ACCENT = "var(--branch-primary)";

const ProductList = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const apiHost = useApiHost();

  // "products" = product masterlist, "pricing" = Pricing Engine (moved here from Settings)
  const [activeView, setActiveView] = useState("products");
  const roles = useZustandLoginCred((state) => state.roles);
  const roleAccessVersion = usePosRoleAccessVersion();
  const developerMode = usePosDeveloperSession();
  const canUsePricing = useMemo(
    () => hasPosSettingsAccess(roles, "Pricing Engine", developerMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles, roleAccessVersion, developerMode],
  );
  const showPricing = activeView === "pricing" && canUsePricing;

  const imageBaseUrl = useMemo(() => {
    if (!apiHost) return "";
    return `${apiHost}/item_pictures/`;
  }, [apiHost]);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const productGridRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [enablePictures, setEnablePictures] = useState(false);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState(null);
  const [subcategoryDraft, setSubcategoryDraft] = useState("");

  // MODAL STATES
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addedNotice, setAddedNotice] = useState("");
  const [pendingStatus, setPendingStatus] = useState(null);

  const fetchProducts = useCallback(async () => {
    if (!apiHost) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/get_product_masterlist.php`);
      if (!response.ok) throw new Error("Failed to fetch products.");
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiHost]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;
    fetch(`${apiHost}/api/pos_pictures_settings.php`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setEnablePictures(Boolean(data.data?.enable_pictures));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiHost]);

  const triggerBulkConfirm = (status) => {
    if (selectedCategory === "ALL") return;
    setPendingStatus(status);
    setShowConfirm(true);
  };

  const executeBulkUpdate = async () => {
    const newStatus = pendingStatus;
    const currentCat = selectedCategory;
    setShowConfirm(false);

    const targetProducts = products.filter(
      (p) => p.item_category === currentCat,
    );
    const ids = targetProducts.map((p) => p.product_id);
    const idSet = new Set(ids);

    if (ids.length === 0) return;

    const previousState = [...products];
    setProducts((prev) =>
      prev.map((p) =>
        idSet.has(p.product_id) ? { ...p, status: newStatus } : p,
      ),
    );

    try {
      const response = await fetch(
        `${apiHost}/api/update_product_status_bulk.php`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_ids: ids,
            status: newStatus,
            item_category: currentCat,
          }),
        },
      );
      const result = await response.json();
      if (result.status !== "success") {
        setProducts(previousState);
        alert("Update failed: " + result.message);
      }
    } catch (error) {
      console.error("Bulk update error:", error);
      setProducts(previousState);
    }
  };

  const toggleStatus = async (pid) => {
    const product = products.find((p) => p.product_id === pid);
    if (!product) return;
    const newStatus = product.status === "1" ? "0" : "1";

    const previousState = [...products];
    setProducts((prev) =>
      prev.map((p) => (p.product_id === pid ? { ...p, status: newStatus } : p)),
    );

    try {
      const response = await fetch(`${apiHost}/api/update_product_status.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pid, status: newStatus }),
      });
      const result = await response.json();
      if (result.status !== "success") setProducts(previousState);
    } catch (error) {
      console.error("Toggle status error:", error);
      setProducts(previousState);
    }
  };

  const toggleDiscountable = async (pid) => {
    const product = products.find((p) => p.product_id === pid);
    if (!product) return;
    const newVal = product.isDiscountable === "Yes" ? "No" : "Yes";

    const previousState = [...products];
    setProducts((prev) =>
      prev.map((p) => (p.product_id === pid ? { ...p, isDiscountable: newVal } : p)),
    );

    try {
      const response = await fetch(`${apiHost}/api/update_product_discountable.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pid, isDiscountable: newVal }),
      });
      const result = await response.json();
      if (result.status !== "success") setProducts(previousState);
    } catch (error) {
      console.error("Toggle discountable error:", error);
      setProducts(previousState);
    }
  };

  const saveSubcategory = async (pid, value) => {
    const trimmedValue = value.trim();
    const previousState = [...products];

    setProducts((prev) =>
      prev.map((p) =>
        p.product_id === pid
          ? { ...p, subcategory_item_category: trimmedValue }
          : p,
      ),
    );

    try {
      const response = await fetch(
        `${apiHost}/api/update_product_subcategory.php`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: pid,
            subcategory_item_category: trimmedValue,
          }),
        },
      );
      const result = await response.json();
      if (result.status !== "success") setProducts(previousState);
    } catch (error) {
      console.error("Save subcategory error:", error);
      setProducts(previousState);
    }
  };

  const categoryStats = useMemo(() => {
    const stats = products.reduce((acc, curr) => {
      const cat = curr.item_category;
      if (!acc[cat]) acc[cat] = { total: 0, active: 0 };
      acc[cat].total += 1;
      if (curr.status === "1") acc[cat].active += 1;
      return acc;
    }, {});
    return stats;
  }, [products]);

  const categories = useMemo(() => {
    const uniqueCats = Object.keys(categoryStats).sort();
    return ["ALL", ...uniqueCats];
  }, [categoryStats]);

  const productCategoryOptions = useMemo(
    () => categories.filter((cat) => cat !== "ALL"),
    [categories],
  );

  const productUnitOptions = useMemo(
    () =>
      [...new Set(products.map((p) => String(p.unit_of_measure || "").trim().toUpperCase()))]
        .filter(Boolean)
        .sort(),
    [products],
  );

  const subcategoriesByCategory = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const cat = p.item_category || "";
      const sub = (p.subcategory_item_category || "").trim();
      if (!sub) return;
      if (!map[cat]) map[cat] = new Set();
      map[cat].add(sub);
    });
    const result = {};
    Object.keys(map).forEach((cat) => {
      result[cat] = Array.from(map[cat]).sort();
    });
    return result;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return products.filter((p) => {
      const matchesSearch = (p.item_name || "")
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesCategory =
        selectedCategory === "ALL" || p.item_category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // Keep the full dataset for searching, category statistics and bulk updates,
  // while limiting the number of mounted cards and decoded product images.
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const visibleProducts = filteredProducts.slice(pageStart, pageStart + PRODUCTS_PER_PAGE);

  const changePage = (nextPage) => {
    setPage(nextPage);
    productGridRef.current?.scrollIntoView({ block: "start" });
  };

  const paginationControls = pageCount > 1 && (
    <nav
      aria-label="Product pages"
      className="flex flex-wrap items-center justify-between gap-3 py-4 font-[Poppins-Regular] text-sm"
      style={{ color: "var(--app-text)" }}
    >
      <span>
        {pageStart + 1}–{Math.min(pageStart + PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => changePage(currentPage - 1)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <span>Page {currentPage} of {pageCount}</span>
        <button
          type="button"
          disabled={currentPage === pageCount}
          onClick={() => changePage(currentPage + 1)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );

  const displayStats = useMemo(() => {
    if (selectedCategory !== "ALL") {
      return {
        [selectedCategory]: categoryStats[selectedCategory] || {
          total: 0,
          active: 0,
        },
      };
    }
    return categoryStats;
  }, [categoryStats, selectedCategory]);

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDark ? "bg-[#0f172a]" : "bg-[#f8fafc]"
      }`}
    >
      <AddProductModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onAdded={({ item_name, prices_added }) => {
          setAddedNotice(
            `${item_name} added with ${prices_added} price${prices_added === 1 ? "" : "s"}.`,
          );
          setTimeout(() => setAddedNotice(""), 3500);
          fetchProducts();
        }}
        isDark={isDark}
        apiHost={apiHost}
        categories={productCategoryOptions}
        units={productUnitOptions}
      />

      {addedNotice && (
        <div className="fixed bottom-8 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-emerald-500/30">
          <FaCheckCircle size={14} />
          {addedNotice}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-300">
          <div
            className={`w-full max-w-sm p-8 rounded-[35px] shadow-2xl border-2 transform animate-in zoom-in-95 duration-300 ${
              isDark
                ? "bg-slate-900 border-white/10"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${
                  pendingStatus === "1"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                <FaExclamationTriangle size={28} />
              </div>
              <h3
                className={`text-lg font-black uppercase tracking-tight mb-2 ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                Bulk Update
              </h3>
              <p
                className={`text-xs font-bold uppercase mb-8 leading-relaxed ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Are you sure you want to{" "}
                <span
                  className={
                    pendingStatus === "1" ? "text-emerald-500" : "text-rose-500"
                  }
                >
                  {pendingStatus === "1" ? "ACTIVATE" : "DEACTIVATE"}
                </span>{" "}
                all products under{" "}
                <span className="text-blue-500">{selectedCategory}</span>?
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${
                    isDark
                      ? "border-white/5 text-slate-500 hover:bg-white/5"
                      : "border-slate-100 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={executeBulkUpdate}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 ${
                    pendingStatus === "1"
                      ? "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600"
                      : "bg-rose-500 shadow-rose-500/30 hover:bg-rose-600"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${showPricing ? "" : "sticky top-0"} z-30 border-b-2 ${
          isDark
            ? "bg-slate-900/95 border-white/10"
            : "bg-white/95 border-slate-200"
        } backdrop-blur-md px-6 py-4`}
      >
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center w-full gap-4 md:w-auto">
              <button
                onClick={() => navigate(-1)}
                className={`p-3 rounded-2xl border-2 transition-all ${
                  isDark
                    ? "bg-white/5 border-white/10 text-white"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                <FaArrowLeft size={18} />
              </button>
              <div>
                <h1
                  className={`text-xl font-black uppercase tracking-tight ${
                    isDark ? "text-white" : "text-slate-800"
                  }`}
                >
                  PRODUCT LIST
                </h1>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">

                </p>
              </div>

              <TutorialTip
                section="Managing Products"
                title="How to use Product List"
              />
            </div>

            {canUsePricing && (
              <div
                className={`flex w-full md:w-auto p-1 rounded-2xl border-2 ${
                  isDark
                    ? "bg-white/5 border-white/10"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                {[
                  { id: "products", label: "Products", icon: FaThLarge },
                  { id: "pricing", label: "Pricing Engine", icon: FaTag },
                ].map(({ id, label, icon: Icon }) => {
                  const isSelected = activeView === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        if (id === activeView) return;
                        setActiveView(id);
                        // prices may have changed in the Pricing Engine
                        if (id === "products") fetchProducts();
                      }}
                      className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                          : isDark
                            ? "text-slate-400 hover:text-white"
                            : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {!showPricing && (
            <div className="flex items-center w-full gap-3 md:w-auto">
              {canUsePricing && (
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center gap-2 px-4 py-3 text-[10px] font-black tracking-widest text-white uppercase transition-all bg-blue-600 shadow-lg rounded-2xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 whitespace-nowrap"
                >
                  <FaPlus size={11} />
                  Add Product
                </button>
              )}
              <div
                className={`flex items-center gap-2 pr-3 mr-2 border-r-2 ${
                  isDark ? "border-white/10" : "border-slate-200"
                } ${
                  selectedCategory === "ALL"
                    ? "opacity-20 grayscale pointer-events-none"
                    : ""
                }`}
              >
                <button
                  onClick={() => triggerBulkConfirm("1")}
                  className="p-3 transition-all border-2 rounded-2xl border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-90"
                >
                  <FaCheckCircle size={16} />
                </button>
                <button
                  onClick={() => triggerBulkConfirm("0")}
                  className="p-3 transition-all border-2 rounded-2xl border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white active:scale-90"
                >
                  <FaPowerOff size={16} />
                </button>
              </div>

              <div className="relative flex-grow md:flex-grow-0">
                <FaSearch
                  className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className={`pl-12 pr-6 py-3 rounded-2xl text-sm w-full md:w-[280px] outline-none border-2 transition-all ${
                    isDark
                      ? "bg-slate-800 border-white/10 text-white focus:border-blue-500"
                      : "bg-slate-50 border-slate-200 focus:border-blue-500"
                  }`}
                />
              </div>
              <button
                onClick={fetchProducts}
                className={`p-3.5 rounded-2xl border-2 transition-all active:scale-95 ${
                  isDark
                    ? "border-white/10 text-slate-400 hover:bg-white/5"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <FaSyncAlt
                  className={isLoading ? "animate-spin" : ""}
                  size={16}
                />
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className={`p-3.5 rounded-2xl border-2 transition-all ${
                  isDark
                    ? "border-white/10 text-rose-500 hover:bg-rose-500/10"
                    : "border-slate-200 text-rose-500 hover:bg-rose-50"
                }`}
              >
                <FaLock size={16} />
              </button>
            </div>
            )}
          </div>

          {!showPricing && (
          <div className="flex items-center gap-3 pb-2 mt-6 overflow-x-auto no-scrollbar scroll-smooth">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const count =
                cat === "ALL"
                  ? products.length
                  : categoryStats[cat]?.total || 0;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap group ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.5)] scale-105 z-10"
                      : isDark
                        ? "bg-slate-800/50 border-2 border-white/5 text-slate-400 hover:border-blue-500/30 hover:text-white"
                        : "bg-white border-2 border-slate-100 text-slate-500 hover:border-blue-400/30 hover:text-blue-600 shadow-sm"
                  }`}
                >
                  {cat === "ALL" ? (
                    <FaThLarge
                      size={12}
                      className={isActive ? "text-white" : "text-blue-500"}
                    />
                  ) : null}
                  {cat}

                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isDark
                          ? "bg-white/5 text-slate-500 group-hover:bg-blue-500/20 group-hover:text-blue-400"
                          : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500"
                    }`}
                  >
                    {count}
                  </span>

                  {isActive && (
                    <div className="absolute w-8 h-1 -translate-x-1/2 bg-white rounded-full -bottom-1 left-1/2"></div>
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {showPricing ? (
        <div className="flex-grow p-6">
          <div className="max-w-[1600px] mx-auto">
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center gap-4 py-40">
                  <div className="w-12 h-12 border-[5px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 animate-pulse">
                    Loading Pricing Engine...
                  </p>
                </div>
              }
            >
              <PosPricingDashboard isDark={isDark} accent={PRICING_ACCENT} />
            </Suspense>
          </div>
        </div>
      ) : (
      <>
      <div className="flex-grow p-6 overflow-auto">
        <div ref={productGridRef} className="max-w-[1600px] mx-auto scroll-mt-60">
          {paginationControls}
          {isLoading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-40">
              <div className="w-12 h-12 border-[5px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 animate-pulse">
                Syncing Database...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((item) => {
                const isActive = item.status === "1";

                return (
                  <div
                    key={item.product_id}
                    className={`relative flex gap-4 overflow-hidden rounded-[1.75rem] border p-4 group transition-all duration-200 ${
                      isDark
                        ? "bg-slate-900/50 border-slate-800"
                        : "bg-white border-slate-100"
                    } ${
                      isActive
                        ? "hover:shadow-md hover:-translate-y-0.5"
                        : "grayscale opacity-60"
                    }`}
                  >
                    {enablePictures && (
                      <div
                        className={`relative flex-shrink-0 w-20 h-20 overflow-hidden rounded-2xl border bg-white ${
                          isDark ? "border-white/10" : "border-slate-200"
                        }`}
                      >
                        <ProductImage
                          src={`${apiHost}/item_pictures/${item.item_name}.jpg`}
                          alt={item.item_name}
                          className="object-contain w-full h-full p-1.5 transition-transform group-hover:scale-105"
                          wrapperClassName="w-full h-full overflow-hidden"
                          fallbackSrc={`${apiHost}/item_pictures/default.jpg`}
                        />
                      </div>
                    )}

                    <div className="flex flex-col justify-between flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tight truncate"
                            style={{ color: PRICING_ACCENT }}
                          >
                            <FaTag size={7} />
                            {item.unit_of_measure}
                          </p>
                          <span
                            className={`flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                              isActive
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${
                                isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                              }`}
                            />
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <h3
                          className={`text-[11px] font-black leading-tight uppercase line-clamp-2 mt-0.5 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {item.item_name}
                        </h3>

                        {/* Subcategory */}
                        <div className="mt-1.5">
                          {editingSubcategoryId === item.product_id ? (
                            <>
                              <input
                                autoFocus
                                type="text"
                                list={`subcat-options-${item.product_id}`}
                                value={subcategoryDraft}
                                onChange={(e) => setSubcategoryDraft(e.target.value)}
                                onBlur={() => {
                                  saveSubcategory(item.product_id, subcategoryDraft);
                                  setEditingSubcategoryId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  } else if (e.key === "Escape") {
                                    setEditingSubcategoryId(null);
                                  }
                                }}
                                placeholder="Set subcategory..."
                                className={`w-full rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] outline-none ${
                                  isDark
                                    ? "bg-slate-800 border-blue-500/40 text-white"
                                    : "bg-white border-blue-400 text-slate-700"
                                }`}
                              />
                              <datalist id={`subcat-options-${item.product_id}`}>
                                {(subcategoriesByCategory[item.item_category] || []).map(
                                  (sub) => (
                                    <option key={sub} value={sub} />
                                  ),
                                )}
                              </datalist>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubcategoryId(item.product_id);
                                setSubcategoryDraft(
                                  item.subcategory_item_category || "",
                                );
                              }}
                              className={`inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 text-[8px] font-black uppercase rounded-lg tracking-wide border border-dashed transition-colors ${
                                item.subcategory_item_category
                                  ? isDark
                                    ? "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                    : "bg-blue-50 border-blue-100 text-blue-500 hover:text-blue-700"
                                  : "border-blue-500/30 text-blue-500/70 hover:text-blue-500"
                              }`}
                            >
                              <FaLayerGroup size={8} className="flex-shrink-0" />
                              <span className="truncate">
                                {item.subcategory_item_category || "Add Subcategory"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-3">
                        {/* Discountable toggle */}
                        <button
                          type="button"
                          onClick={() => toggleDiscountable(item.product_id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-colors ${
                            item.isDiscountable === "Yes"
                              ? isDark
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-amber-50 border-amber-200 text-amber-600"
                              : isDark
                                ? "bg-slate-800 border-slate-700 text-slate-500"
                                : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}
                        >
                          <FaPercent size={8} />
                          {item.isDiscountable === "Yes" ? "Discountable" : "No Discount"}
                        </button>

                        {/* Active / inactive toggle */}
                        <button
                          type="button"
                          onClick={() => toggleStatus(item.product_id)}
                          title={isActive ? "Deactivate" : "Activate"}
                          className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-all duration-300 flex items-center p-1 border-2 ${
                            isActive
                              ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/30"
                              : "bg-slate-400 border-slate-500 shadow-inner"
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                              isActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          ></div>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {paginationControls}
        </div>
      </div>

      <div
        className={`p-8 border-t-2 ${
          isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
        }`}
      >
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-600/10">
              <FaChartPie className="text-blue-600" size={14} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Live Statistics
            </p>
          </div>
          <div className="flex gap-5 pb-2 overflow-x-auto no-scrollbar">
            {Object.keys(displayStats).map((cat) => (
              <div
                key={cat}
                className={`min-w-[200px] p-5 rounded-[24px] border-2 transition-all duration-300 ${
                  isDark
                    ? "bg-white/5 border-white/10 hover:border-white/30"
                    : "bg-slate-50 border-blue-500/20 hover:border-blue-500/40"
                }`}
              >
                <p
                  className={`text-[9px] font-black uppercase mb-2 truncate tracking-widest ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {cat}
                </p>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-blue-600">
                    {displayStats[cat].active}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Active / {displayStats[cat].total}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default ProductList;
