import React, { useMemo, useState } from "react";
import {
  FaShoppingCart,
  FaTrash,
  FaSave,
  FaListUl,
  FaSearch,
  FaQrcode,
} from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import PosModal from "./Common/PosModal";
import useCustomQuery from "../../hooks/useCustomQuery";


const sampleProducts = [
  {
    id: 1,
    name: "BAKED MUSSELS",
    code: "BD-cabf16991309",
    sku: "",
    price: 419,
    category: "APPETIZERS",
  },
  {
    id: 2,
    name: "BAKED SCALLOPS",
    code: "BD-e995fb0cc890",
    sku: "",
    price: 299,
    category: "APPETIZERS",
  },
  {
    id: 3,
    name: "CALAMARI",
    code: "BD-90e45d6fc73b",
    sku: "",
    price: 289,
    category: "APPETIZERS",
  },
  {
    id: 4,
    name: "CHICHARON BULAKLAK",
    code: "BD-d6c95eca40ad",
    sku: "",
    price: 349,
    category: "APPETIZERS",
  },
  {
    id: 5,
    name: "FISH N CHIPS",
    code: "BD-d2cfa7ef9129",
    sku: "",
    price: 289,
    category: "APPETIZERS",
  },
  {
    id: 6,
    name: "KILAWIN TUNA",
    code: "BD-997881622693",
    sku: "",
    price: 329,
    category: "APPETIZERS",
  },
  {
    id: 7,
    name: "POTATO WEDGE",
    code: "BD-bfd1ec2f5e57",
    sku: "",
    price: 199,
    category: "APPETIZERS",
  },
];

function ProductCard({ item, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="group flex h-[230px] flex-col rounded-[20px] border border-slate-200 bg-white p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-[2px] hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
    >
      <div className="flex justify-center pt-1">
        <div className="grid h-[90px] w-[90px] place-items-center rounded-[22px] bg-gradient-to-br from-slate-100 via-white to-slate-100 text-[40px] shadow-inner">
          🍽️
        </div>
      </div>

      <div className="mt-4 min-h-[42px] text-center text-[14px] font-extrabold leading-tight text-slate-700">
        {item.name}
      </div>

      <div className="mt-4 space-y-1 text-[11px] leading-4 text-slate-500">
        <div>
          <span className="font-bold text-sky-600">CODE:</span> {item.code}
        </div>
        <div>
          <span className="font-bold text-sky-600">SKU:</span> {item.sku || "-"}
        </div>
      </div>

      <div className="mt-auto pt-3 text-right text-[16px] font-black text-[#25379c]">
        ₱
        {Number(item.price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}
      </div>
    </button>
  );
}

function CartRow({ item, onIncrement, onDecrement, onRemove }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-gradient-to-b from-[#eef2f7] to-[#e7ecf4] px-3 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="grid h-[44px] w-[44px] flex-none place-items-center rounded-[11px] bg-[#f15a24] text-white shadow-[0_6px_14px_rgba(241,90,36,0.25)] transition hover:scale-[1.03]"
        >
          <FaTrash className="text-[14px]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-sky-500">
            <span>CODE:</span>
            <span>SKU:</span>
          </div>

          <div className="mt-1 truncate text-[18px] font-extrabold uppercase leading-none text-slate-600">
            {item.name}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-6 text-[10px] text-slate-400">
            <span>{item.code || "-"}</span>
            <span>{item.sku || "-"}</span>
          </div>

          <div className="mt-2 text-[12px] font-bold text-[#3344b5]">
            ₱
            {(item.price * item.qty).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="flex flex-none items-center">
          <button
            type="button"
            onClick={() => onDecrement(item.id)}
            className="grid h-[42px] w-[42px] place-items-center rounded-l-[10px] bg-[#e3cf16] text-[22px] font-black text-white shadow-sm"
          >
            -
          </button>

          <div className="flex h-[42px] min-w-[58px] items-center justify-center border-y border-slate-200 bg-white px-3 text-[14px] font-black text-slate-700">
            {item.qty}
          </div>

          <button
            type="button"
            onClick={() => onIncrement(item.id)}
            className="grid h-[42px] w-[42px] place-items-center rounded-r-[10px] bg-[#41a63b] text-[22px] font-black text-white shadow-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewTransaction() {
  // --- HOOKS MUST BE INSIDE THE COMPONENT ---
  const apiEndpoint = localStorage.getItem("apiendpoint") || "";
  const { data: newtransaction, isLoading } = useCustomQuery(
    apiEndpoint + import.meta.env.VITE_READ_NEW_TRANSACTION_ENDPOINT,
    "newtransaction"
  );

  const [transactionType, setTransactionType] = useState("PRODUCT");
  const [serviceType, setServiceType] = useState("WALK IN");
  const [activeCategory, setActiveCategory] = useState("APPETIZERS");
  const [search, setSearch] = useState("");
  const [refTag, setRefTag] = useState("Table 01");
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [cartItems, setCartItems] = useState([]);

const filteredProducts = useMemo(() => {

  let productsSource = [];

  if (Array.isArray(newtransaction)) {
    productsSource = newtransaction;
  } else if (newtransaction && Array.isArray(newtransaction.data)) {

    productsSource = newtransaction.data;
  } else {
    // Fallback to sample data if API hasn't loaded or returned an array
    productsSource = sampleProducts || [];
  }

  return productsSource.filter((item) => {
    // 2. Add optional chaining (?) to prevent errors if an item is malformed
    const matchCategory = item?.category === activeCategory;
    const keyword = search.toLowerCase();

    const matchSearch =
      item?.name?.toLowerCase().includes(keyword) ||
      item?.code?.toLowerCase().includes(keyword) ||
      (item?.sku || "").toLowerCase().includes(keyword);

    return matchCategory && matchSearch;
  });
}, [search, activeCategory, newtransaction]);

  const visibleProducts = filteredProducts.slice(0, 12);

  const addToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((x) => x.id === product.id);
      if (existing) {
        return prev.map((x) =>
          x.id === product.id ? { ...x, qty: x.qty + 1 } : x
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const incrementQty = (id) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: item.qty + 1 } : item
      )
    );
  };

  const decrementQty = (id) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const removeAllItems = () => {
    setCartItems([]);
  };

  const handleSaveClick = () => {
    if (cartItems.length === 0) {
      alert("Cart is empty.");
      return;
    }
    setShowPrintModal(true);
  };

  const handlePrintOption = (option) => {
    console.log("Selected print option:", option);
    setShowPrintModal(false);
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cartItems]);

  const totalQty = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.qty, 0);
  }, [cartItems]);

  return (
    <>
      <div className="h-[calc(100vh-210px)] w-full overflow-hidden bg-[#dfe4ef] p-2">
        <div className="grid h-full grid-cols-[180px_minmax(0,1fr)_430px] gap-3">
          <aside className="h-full overflow-hidden rounded-[22px] bg-gradient-to-b from-[#d9e2ec] to-[#cfd9e6] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="px-1">
              <div className="mb-3 text-[18px] font-black text-slate-700">
                Trans. Type
              </div>

              <div className="space-y-3">
              <div className="relative">
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="h-[46px] w-full appearance-none rounded-[16px] border border-orange-300 bg-white px-4 pr-10 text-[14px] font-semibold text-slate-600 outline-none shadow-sm"
                >

                  {newtransaction?.inventory_types?.map((item, index) => (
                    <option key={index} value={item.inventory_type}>
                      {item.inventory_type}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>

              <div className="relative">
                <select
                  value={serviceType} 
                  onChange={(e) => setServiceType(e.target.value)}
                  className="h-[46px] w-full appearance-none rounded-[16px] border border-orange-300 bg-white px-4 pr-10 text-[14px] font-semibold text-slate-600 outline-none shadow-sm"
                >
                  {newtransaction?.sales_types?.map((item, index) => (
                    <option key={index} value={item.sales_type_id}>
                      {item.sales_type}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              </div>
            </div>

          <div className="mt-5 h-[calc(100%-118px)] pr-1 overflow-y-auto 
                          [&::-webkit-scrollbar]:w-1.5 
                          [&::-webkit-scrollbar-track]:bg-transparent 
                          [&::-webkit-scrollbar-thumb]:rounded-full 
                          [&::-webkit-scrollbar-thumb]:bg-slate-400/30 
                          hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/50">
            <div className="space-y-3">
              {/* 1. Loading State */}
              {isLoading && (
                <div className="space-y-3 animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-[60px] w-full bg-slate-200 rounded-[18px]" />
                  ))}
                </div>
              )}

              {/* 2. Dynamic Categories Map */}
              {!isLoading && newtransaction?.item_categories?.map((item, index) => {
                const categoryName = item.item_category;
                const isActive = activeCategory === categoryName;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveCategory(categoryName)}
                    className={`w-full rounded-[18px] px-3 py-4 text-center text-[13px] font-extrabold uppercase leading-tight text-white shadow-[0_10px_20px_rgba(37,55,156,0.18)] transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-b from-[#4b72f0] to-[#3557d6] scale-[1.02]"
                        : "bg-gradient-to-b from-[#547af1] to-[#4467dd] opacity-90 hover:opacity-100 hover:translate-x-1"
                    }`}
                  >
                    {categoryName}
                  </button>
                );
              })}

              {/* 3. Empty State */}
              {!isLoading && (!newtransaction?.item_categories || newtransaction.item_categories.length === 0) && (
                <div className="flex flex-col items-center justify-center pt-10 text-center px-4">
                  <div className="text-[24px] mb-2">📂</div>
                  <div className="text-[12px] text-slate-400 font-bold uppercase tracking-wider">
                    No Categories
                  </div>
                </div>
              )}
            </div>
          </div>
          </aside>

          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/70 bg-gradient-to-b from-[#edf2f8] to-[#e4ebf4] shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
            <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 shadow-sm">
                  <FaListUl className="text-[20px]" />
                </div>

                <div>
                  <div className="text-[19px] font-black text-slate-700">
                    {activeCategory}
                  </div>
                  <div className="text-[12px] font-medium text-slate-400">
                    {isLoading ? "Fetching menu..." : "Tap products to add to cart"}
                  </div>
                </div>
              </div>

              <div className="relative w-full max-w-[350px]">
                <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan QR / Barcode Here..."
                  className="h-[48px] w-full rounded-full border border-slate-300 bg-white px-11 pr-4 text-[14px] text-slate-600 outline-none placeholder:text-slate-400 shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="grid grid-cols-4 gap-4 animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-[230px] rounded-[20px] bg-slate-200" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visibleProducts.length > 0 ? (
                    visibleProducts.map((item) => (
                      <ProductCard key={item.id} item={item} onAdd={addToCart} />
                    ))
                  ) : (
                    <div className="col-span-full flex h-[300px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white/60 text-[15px] font-semibold text-slate-400">
                      No products found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-slate-300 bg-gradient-to-b from-[#dce3ec] to-[#d1d8e3] shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
            <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-200 bg-[#eef2f7] px-4 py-3">
              <div className="flex items-center gap-3">
                <FaShoppingCart className="text-[28px] text-slate-600" />
                <div className="text-[18px] font-black text-slate-700">Cart</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-[14px] font-extrabold text-slate-600">
                  Ref./Tag:
                </div>
                <div className="relative">
                  <select
                    value={refTag}
                    onChange={(e) => setRefTag(e.target.value)}
                    className="h-[40px] min-w-[150px] appearance-none rounded-[14px] border border-orange-300 bg-white px-4 pr-10 text-[14px] font-semibold text-slate-700 outline-none shadow-sm"
                  >
                    <option>Table 01</option>
                    <option>Table 02</option>
                    <option>Table 03</option>
                    <option>Take Out</option>
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 bg-white/40 px-4 py-2">
              <div className="text-[12px] font-bold text-slate-500">
                {cartItems.length} item(s)
              </div>
              <div className="text-[12px] font-bold text-slate-500">
                Total Qty: {totalQty}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {cartItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-slate-300 shadow-sm">
                    <FaShoppingCart className="text-[24px]" />
                  </div>
                  <div className="mt-4 text-[16px] font-extrabold text-slate-500">
                    No items in cart
                  </div>
                  <div className="mt-1 text-[12px] text-slate-400">
                    Add products from the menu panel
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      onIncrement={incrementQty}
                      onDecrement={decrementQty}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-300 bg-[#edf1f7] px-4 py-3">
              <div className="mb-3 rounded-[16px] bg-white/85 px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold uppercase tracking-wide text-slate-500">
                    Grand Total
                  </span>
                  <span className="text-[23px] font-black text-[#3344b5]">
                    ₱
                    {cartTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_52px] gap-3">
                  <button
                    type="button"
                    className="flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-[#da3db4] px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(218,61,180,0.25)] transition hover:brightness-105"
                  >
                    <HiOutlineClipboardDocumentList className="text-[18px]" />
                    <span>Instructions</span>
                  </button>
                  <button
                    type="button"
                    className="grid h-[48px] place-items-center rounded-[10px] bg-[#44c776] text-white shadow-[0_8px_18px_rgba(68,199,118,0.25)] transition hover:brightness-105"
                  >
                    <FaQrcode className="text-[18px]" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={removeAllItems}
                    className="flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-[#f15a24] px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(241,90,36,0.25)] transition hover:brightness-105"
                  >
                    <FaTrash />
                    <span>Clear</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveClick}
                    className="flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-[#8e30d8] px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(142,48,216,0.25)] transition hover:brightness-105"
                  >
                    <FaSave />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <PosModal
        open={showPrintModal}
        title="Print Options"
        onClose={() => setShowPrintModal(false)}
        width="max-w-[560px]"
        height="min-h-[460px]"
        bodyClassName="pt-8"
      >
        <div className="flex flex-col items-center gap-8">
          <button
            type="button"
            onClick={() => handlePrintOption("new_pending")}
            className="h-[56px] w-full max-w-[330px] rounded-full bg-gradient-to-r from-[#f58aa0] via-[#caa4d0] to-[#55c8ea] text-[18px] font-bold text-white shadow-[0_10px_24px_rgba(85,200,234,0.24)]"
          >
            New & Pending Orders
          </button>
          <button
            type="button"
            onClick={() => handlePrintOption("print_all")}
            className="h-[56px] w-full max-w-[330px] rounded-full bg-gradient-to-r from-[#f58aa0] via-[#caa4d0] to-[#55c8ea] text-[18px] font-bold text-white shadow-[0_10px_24px_rgba(85,200,234,0.24)]"
          >
            Print All Orders
          </button>
          <button
            type="button"
            onClick={() => handlePrintOption("do_not_print")}
            className="h-[56px] w-full max-w-[330px] rounded-full bg-gradient-to-r from-[#f58aa0] via-[#caa4d0] to-[#55c8ea] text-[18px] font-bold text-white shadow-[0_10px_24px_rgba(85,200,234,0.24)]"
          >
            Do not Print
          </button>
        </div>
      </PosModal>
    </>
  );
}