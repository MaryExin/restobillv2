import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode.react";
import {
  FaSearch,
  FaShoppingCart,
  FaTrash,
  FaPlus,
  FaMinus,
  FaFilter,
  FaPizzaSlice,
  FaHamburger,
  FaIceCream,
  FaCoffee,
  FaUtensils,
  FaArrowLeft,
  FaReceipt,
  FaCheckCircle,
  FaEdit,
} from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { IoQrCode } from "react-icons/io5";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiPrinter,
  FiClock,
  FiCheckCircle,
  FiPercent,
} from "react-icons/fi";
import Receipt from "./Receipt";
import { useNavigate } from "react-router-dom";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";
import ModalDiscountTransaction from "./ModalDiscountTransaction";

const Orderlist = ({
  tableselected,
  setshoworderlist,
  dateSelected,
  transactionId,
}) => {
  const navigate = useNavigate();
  const apiHost = useApiHost();
  const { isDark } = useTheme();

  const [productsearch, setproductsearch] = useState("");
  const [categorylist, setcategorylist] = useState([]);
  const [selectcategory, setselectcategory] = useState("");
  const [productlist, setproductlist] = useState([]);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [summaryCart, setSummaryCart] = useState(false);

  const [productcart, setproductcart] = useState({
    customer: tableselected || "",
    items: [],
  });

  const [cartforqr, setcartforqr] = useState({
    customer: tableselected || "",
    items: [],
  });

  const [cartlist, setcartlist] = useState([]);
  const [originalLoadedItems, setOriginalLoadedItems] = useState([]);

  const [showqrModal, setShowqrModal] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [showMobileCats, setShowMobileCats] = useState(false);
  const [showDesktopCartActions, setShowDesktopCartActions] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [instructions, setInstructions] = useState("");

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingTab, setBillingTab] = useState("pending");
  const [billingData, setBillingData] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSelectedTransaction, setBillingSelectedTransaction] =
    useState(null);
  const [billingDetailedProduct, setBillingDetailedProduct] = useState([]);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  const [showItemInstructionModal, setShowItemInstructionModal] =
    useState(false);
  const [selectedInstructionItem, setSelectedInstructionItem] = useState(null);
  const [itemInstructionText, setItemInstructionText] = useState("");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTransaction, setDiscountTransaction] = useState(null);

  const printRef = useRef();
  const printAllRef = useRef();
  const billingPrintRef = useRef();
  const [isReprint, setIsReprint] = useState(false);

  const printPageStyle = `
    @page {
      size: 80mm auto;
      margin: 0;
    }

    @media print {
      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body {
        display: block !important;
        min-height: 100vh !important;
      }

      .print-root {
        width: 80mm !important;
        min-height: 100vh !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
        margin: 0 !important;
        padding: 16px !important;
        box-shadow: none !important;
      }

      .print-root * {
        color: #000000 !important;
      }

      table {
        width: 100% !important;
        border-collapse: collapse !important;
      }

      img,
      svg,
      canvas {
        background: transparent !important;
        background-color: transparent !important;
      }
    }
  `;

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: transactionId
      ? `additional-order-${transactionId}`
      : `new-order-${tableselected}`,
    pageStyle: printPageStyle,
    onAfterPrint: () => {
      setIsReprint(false);
      setShowqrModal(false);
      setShowCartMobile(false);
      setShowDesktopCartActions(false);
      setshoworderlist(false);
    },
  });

  const handlePrintAll = useReactToPrint({
    content: () => printAllRef.current,
    documentTitle: transactionId
      ? `full-order-${transactionId}`
      : `full-order-${tableselected}`,
    pageStyle: printPageStyle,
    onAfterPrint: () => {
      setIsReprint(false);
      setShowqrModal(false);
      setShowCartMobile(false);
      setShowDesktopCartActions(false);
    },
  });

  const handleBillingPrint = useReactToPrint({
    content: () => billingPrintRef.current,
    documentTitle: billingSelectedTransaction?.billing_no
      ? `billing-${billingSelectedTransaction.billing_no}`
      : billingSelectedTransaction?.transaction_id
        ? `billing-${billingSelectedTransaction.transaction_id}`
        : `billing-${tableselected}`,
    pageStyle: printPageStyle,
    onAfterPrint: () => {
      setBillingSelectedTransaction(null);
      setBillingDetailedProduct([]);
    },
  });

  const getCategoryIcon = (name) => {
    const lower = (name || "").toLowerCase();
    if (lower.includes("pizza")) return <FaPizzaSlice />;
    if (lower.includes("burger") || lower.includes("meat"))
      return <FaHamburger />;
    if (lower.includes("dessert") || lower.includes("ice"))
      return <FaIceCream />;
    if (lower.includes("drink") || lower.includes("beverage"))
      return <FaCoffee />;
    return <FaUtensils />;
  };

  useEffect(() => {
    if (!tableselected) return;

    setproductcart({
      customer: tableselected,
      items: [],
    });

    setcartforqr({
      customer: tableselected,
      items: [],
    });

    setOriginalLoadedItems([]);
  }, [tableselected]);

  useEffect(() => {
    if (!apiHost) return;

    fetch(`${apiHost}/api/category_list.php`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction");
        return res.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setcategorylist(arr);
        if (arr.length > 0) setselectcategory(arr[0].item_category);
      })
      .catch(() => {
        setcategorylist([]);
      });
  }, [apiHost]);

  useEffect(() => {
    if (!selectcategory || !apiHost) return;

    fetch(
      `${apiHost}/api/product_list.php?category=${encodeURIComponent(
        selectcategory,
      )}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction");
        return res.json();
      })
      .then((data) => setproductlist(Array.isArray(data) ? data : []))
      .catch(() => setproductlist([]));
  }, [selectcategory, apiHost]);

  useEffect(() => {
    if (!apiHost || !transactionId) return;

    fetch(
      `${apiHost}/api/view_table_transaction.php?transaction_id=${transactionId}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction");
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.order_details)) return;

        const mappedCart = data.order_details.map((item) => ({
          code: item.product_id,
          name: item.item_name || item.product_id,
          price: Number(item.selling_price),
          quantity: Number(item.sales_quantity),
          isDiscountable: item.isDiscountable,
          itemInstruction: item.item_instruction || "",
          item_category: item.item_category || "",
          isLoadedFromDB: true,
        }));

        setproductcart({
          customer: tableselected,
          items: mappedCart,
        });

        setcartlist(mappedCart);
        setOriginalLoadedItems(mappedCart);

        setcartforqr({
          customer: tableselected,
          items: mappedCart.map((item) => ({
            code: item.code,
            quantity: item.quantity,
            itemInstruction: item.itemInstruction || "",
            item_category: item.item_category || "",
            isLoadedFromDB: true,
          })),
        });
      })
      .catch((err) => {
        console.error("Transaction fetch error:", err);
      });
  }, [apiHost, transactionId, tableselected]);

  const filteredProducts = useMemo(() => {
    return (productlist || []).filter((p) =>
      (p.item_name || "").toLowerCase().includes(productsearch.toLowerCase()),
    );
  }, [productsearch, productlist]);

  const filteredBillingData = useMemo(() => {
    return (billingData || []).filter((item) =>
      billingTab === "paid"
        ? item.remarks?.toLowerCase() === "paid"
        : item.remarks?.toLowerCase() !== "paid",
    );
  }, [billingData, billingTab]);

  const cartSummaryItems = productcart.items;
  const isCartFromDB = false;

  const loadedCartItems = cartSummaryItems.filter(
    (item) => item.isLoadedFromDB === true,
  );

  const additionalCartItems = cartSummaryItems.filter(
    (item) => item.isLoadedFromDB !== true,
  );

  const groupedSummaryOrders = useMemo(() => {
    const grouped = {};

    cartSummaryItems.forEach((item) => {
      const rawCategory = String(item.item_category || "").trim();
      const category = rawCategory || "Recent Orders";

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(item);
    });

    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        ),
      }));
  }, [cartSummaryItems]);

  const hasLoadedItemsChanged = useMemo(() => {
    if (originalLoadedItems.length === 0) return false;
    if (loadedCartItems.length !== originalLoadedItems.length) return true;

    const normalize = (items) =>
      [...items]
        .map((item) => ({
          code: item.code,
          quantity: Number(item.quantity || 0),
          itemInstruction: item.itemInstruction || "",
          price: Number(item.price || 0),
        }))
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

    return (
      JSON.stringify(normalize(loadedCartItems)) !==
      JSON.stringify(normalize(originalLoadedItems))
    );
  }, [loadedCartItems, originalLoadedItems]);

  const canPrintOnly =
    originalLoadedItems.length > 0 &&
    additionalCartItems.length === 0 &&
    !hasLoadedItemsChanged;

  const requestRemoveItem = (code) => {
    setItemToDelete(code);
    setShowDeleteItemModal(true);
  };

  const confirmRemoveItem = () => {
    if (!itemToDelete) return;
    removeItem(itemToDelete);
    setItemToDelete(null);
    setShowDeleteItemModal(false);
  };

  const cancelRemoveItem = () => {
    setItemToDelete(null);
    setShowDeleteItemModal(false);
  };

  const addToCart = (product) => {
    setproductcart((prev) => {
      const existing = prev.items.find(
        (i) => i.code === product.product_id && i.isLoadedFromDB !== true,
      );

      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.code === product.product_id && i.isLoadedFromDB !== true
              ? { ...i, quantity: Number(i.quantity || 0) + 1 }
              : i,
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            code: product.product_id,
            name: product.item_name,
            price: Number(product.selling_price) || 0,
            quantity: 1,
            isDiscountable: product.isDiscountable,
            itemInstruction: "",
            vatable: product.vatable,
            item_category: product.item_category || "",
            isLoadedFromDB: false,
          },
        ],
      };
    });

    setcartforqr((prev) => {
      const existing = prev.items.find(
        (i) => i.code === product.product_id && i.isLoadedFromDB !== true,
      );

      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.code === product.product_id && i.isLoadedFromDB !== true
              ? { ...i, quantity: Number(i.quantity || 0) + 1 }
              : i,
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            code: product.product_id,
            quantity: 1,
            itemInstruction: "",
            item_category: product.item_category || "",
            isLoadedFromDB: false,
          },
        ],
      };
    });
  };

  const updateQuantityByInput = (code, value) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.code === code
          ? {
              ...i,
              quantity:
                value === ""
                  ? ""
                  : Math.max(
                      0,
                      Number.isNaN(Number(value)) ? 0 : Number(value),
                    ),
            }
          : i,
      ),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.code === code
          ? {
              ...i,
              quantity:
                value === ""
                  ? ""
                  : Math.max(
                      0,
                      Number.isNaN(Number(value)) ? 0 : Number(value),
                    ),
            }
          : i,
      ),
    }));
  };

  const updateQuantity = (code, delta) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items
        .map((i) =>
          i.code === code
            ? {
                ...i,
                quantity: Math.max(1, Number(i.quantity || 1) + delta),
              }
            : i,
        )
        .filter((i) => Number(i.quantity) > 0),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items
        .map((i) =>
          i.code === code
            ? {
                ...i,
                quantity: Math.max(1, Number(i.quantity || 1) + delta),
              }
            : i,
        )
        .filter((i) => Number(i.quantity) > 0),
    }));
  };

  const removeItem = (code) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.code !== code),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.code !== code),
    }));
  };

  const clearCart = () => {
    if (isCartFromDB) return;

    setproductcart({
      customer: tableselected || "",
      items: [],
    });

    setcartforqr({
      customer: tableselected || "",
      items: [],
    });
  };

  const openItemInstructionModal = (item) => {
    setSelectedInstructionItem(item);
    setItemInstructionText(item?.itemInstruction || "");
    setShowItemInstructionModal(true);
  };

  const saveItemInstruction = () => {
    if (!selectedInstructionItem) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.code === selectedInstructionItem.code
          ? { ...item, itemInstruction: itemInstructionText }
          : item,
      ),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.code === selectedInstructionItem.code
          ? { ...item, itemInstruction: itemInstructionText }
          : item,
      ),
    }));

    setShowItemInstructionModal(false);
    setSelectedInstructionItem(null);
    setItemInstructionText("");
  };

  const handleGenerateQR = async () => {
    if (isCartFromDB) {
      if (cartSummaryItems.length === 0) return alert("Cart is empty");

      setQrValue(
        JSON.stringify({
          customer: tableselected,
          items: cartSummaryItems.map((item) => ({
            code: item.code,
            quantity: item.quantity,
            itemInstruction: item.itemInstruction || "",
          })),
        }),
      );
      setShowqrModal(true);
      return;
    }

    if (productcart.items.length === 0) return alert("Cart is empty");

    setQrValue(
      JSON.stringify({
        customer: tableselected,
        items: productcart.items.map((item) => ({
          code: item.code,
          quantity: item.quantity,
          itemInstruction: item.itemInstruction || "",
        })),
      }),
    );

    setShowqrModal(true);
  };

  const openBillingModal = () => {
    if (!apiHost || !tableselected) return;

    setShowBillingModal(true);
    setBillingTab("pending");
    setBillingLoading(true);

    fetch(
      `${apiHost}/api/transactio_per_table.php?date=${encodeURIComponent(
        dateSelected,
      )}&table_number=${encodeURIComponent(tableselected)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction");
        return res.json();
      })
      .then((data) => {
        setBillingData(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Fetch billing error:", error);
        setBillingData([]);
      })
      .finally(() => {
        setBillingLoading(false);
      });
  };

  const saveBillingToServer = async (transaction, detailedItems) => {
    if (!apiHost || !transaction?.transaction_id) {
      throw new Error("Missing transaction data.");
    }

    const payload = {
      transaction_id: transaction.transaction_id,
      printTitle: "BILLING", // change to "RECEIPT" if needed
      transStatus: "Pending for Payment", // or "Settled" if receipt/payment final
      category_code:
        transaction.Category_Code ||
        transaction.category_code ||
        "Crab & Crack",
      unit_code:
        transaction.Unit_Code || transaction.unit_code || "BU-247001cd32f1",

      TotalSales: Number(transaction.TotalSales || 0),
      Discount: Number(transaction.Discount || 0),
      OtherCharges: Number(transaction.OtherCharges || 0),
      TotalAmountDue: Number(transaction.TotalAmountDue || 0),
      payment_amount: Number(transaction.payment_amount || 0),
      change_amount: Number(transaction.change_amount || 0),

      customer_exclusive_id: transaction.customer_exclusive_id || "",
      customer_head_count: Number(transaction.customer_head_count || 1),
      customer_count_for_discount: Number(
        transaction.customer_count_for_discount || 0,
      ),
      discount_type: transaction.discount_type || "",
      VATableSales: Number(transaction.VATableSales || 0),
      VATableSales_VAT: Number(transaction.VATableSales_VAT || 0),
      VATExemptSales: Number(transaction.VATExemptSales || 0),
      VATExemptSales_VAT: Number(transaction.VATExemptSales_VAT || 0),
      VATZeroRatedSales: Number(transaction.VATZeroRatedSales || 0),
      payment_method: transaction.payment_method || "Cash",
      cashier: transaction.cashier || "System",

      cart_items: (detailedItems || []).map((item) => ({
        databaseID: item.ID || item.id || item.databaseID,
        selling_price: Number(item.selling_price || 0),
      })),
    };

    const response = await fetch(`${apiHost}/api/billing.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Failed to save billing.");
    }

    return result;
  };

  const onBillingTransactionClick = async (item) => {
    if (!apiHost) return;
    if (billingTab !== "pending") return;

    const txId = item?.transaction_id || transactionId;
    if (!txId) return;

    try {
      // 1. fetch detailed items first
      const detailRes = await fetch(
        `${apiHost}/api/bill_trans_per_table.php?transaction_id=${encodeURIComponent(txId)}`,
      );

      if (!detailRes.ok) {
        throw new Error("Failed to fetch transaction details");
      }

      const detailData = await detailRes.json();
      const detailedItems = Array.isArray(detailData) ? detailData : [];

      // 2. save/update billing in billing.php
      const billingResult = await saveBillingToServer(item, detailedItems);

      // 3. update state for printing
      setBillingDetailedProduct(detailedItems);
      setBillingSelectedTransaction({
        ...item,
        billing_no: billingResult.billing_no,
        invoice_no: billingResult.invoice_no,
      });

      // 4. trigger print
      setTimeout(() => {
        if (billingPrintRef.current) {
          handleBillingPrint();
        }
      }, 200);
    } catch (error) {
      console.error("Billing transaction click error:", error);
      alert(error.message || "Failed to process billing.");
    }
  };

  const saveOrderToServer = async () => {
    if (productcart.items.length === 0) {
      alert("Cart is empty");
      return { ok: false };
    }

    try {
      const now = new Date();
      const formData = new FormData();
      const txId = transactionId || Date.now();

      formData.append("transaction_id", txId);
      formData.append("Category_Code", "Crab & Crack");
      formData.append("Unit_Code", "BU-247001cd32f1");
      formData.append("transaction_type", "PRODUCT");
      formData.append("transaction_date", dateSelected);
      formData.append(
        "transaction_time",
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
      formData.append("terminal_number", "1");
      formData.append("order_slip_no", txId);
      formData.append("table_number", tableselected);
      formData.append("order_type", "DINE-IN");
      formData.append("customer_head_count", 1);
      formData.append("discount_type", "");
      formData.append("payment_method", "");
      formData.append("special_instructions", instructions || "");
      formData.append("cashier", "Store Crew");
      formData.append("remarks", "Pending for Payment");
      formData.append("order_status", "Pending");
      formData.append("status", "Active");
      formData.append("void_date", "");
      formData.append("refund_date", "");

      formData.append(
        "cart_items",
        JSON.stringify(
          productcart.items.map((item) => ({
            product_id: item.code,
            sku: item.code,
            sales_quantity: item.quantity,
            landing_cost: 0,
            unit_cost: item.price,
            selling_price: item.price,
            vatable: "Yes",
            isDiscountable: item.isDiscountable,
            order_status: "ACTIVE",
            item_instruction: item.itemInstruction || "",
          })),
        ),
      );

      const endpoint = transactionId
        ? `${apiHost}/api/update_order.php`
        : `${apiHost}/api/save_order.php`;

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status !== "success") {
        alert("Failed to process order");
        return { ok: false };
      }

      return {
        ok: true,
        txId,
        isUpdate: !!transactionId,
      };
    } catch (error) {
      console.error(error);
      alert("Server error while saving order");
      return { ok: false };
    }
  };

  const confirmTransactionAndPrint = async () => {
    if (additionalCartItems.length === 0) {
      alert("No additional items to print.");
      return;
    }

    const result = await saveOrderToServer();
    if (!result.ok) return;

    setShowConfirmModal(false);

    setTimeout(() => {
      if (printRef.current) {
        handlePrint();
      }
    }, 150);
  };

  const handlePrintOnly = () => {
    if (!canPrintOnly) {
      alert(
        "Print Only is available only when there are no new or edited items.",
      );
      return;
    }

    if (cartSummaryItems.length === 0) {
      alert("No transaction items to print.");
      return;
    }

    setIsReprint(true);
    setShowqrModal(false);
    setShowConfirmModal(false);

    setTimeout(() => {
      if (printAllRef.current) {
        handlePrintAll();
      }
    }, 150);
  };

  const onOpenDiscountModal = (item, e) => {
    e.stopPropagation();

    setDiscountTransaction({
      ...item,
      billing_no: item?.billing_no || item?.billingNo || "",
    });

    setShowDiscountModal(true);
  };

  const requestSaveOnly = () => {
    setShowSaveConfirmModal(true);
  };

  const handleSaveOnly = async () => {
    setShowSaveConfirmModal(false);

    const result = await saveOrderToServer();
    if (!result?.ok) return;

    setSaveSuccessMessage(
      result.isUpdate
        ? "Order updated successfully."
        : "Order saved successfully.",
    );

    setShowqrModal(false);
    setShowCartMobile(false);
    setShowDesktopCartActions(false);

    if (!transactionId) clearCart();

    setShowSaveSuccessModal(true);

    setTimeout(() => {
      setshoworderlist(false);
    }, 2000);
  };

  const requestClearCart = () => {
    if (isCartFromDB) return;
    if (productcart.items.length === 0) return;
    setShowClearCartModal(true);
  };

  const confirmClearCart = () => {
    clearCart();
    setShowClearCartModal(false);
    setShowDesktopCartActions(false);
  };

  const totalItems = cartSummaryItems.reduce(
    (sum, i) => sum + Number(i.quantity || 0),
    0,
  );

  const totalPrice = cartSummaryItems.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0,
  );

  const additionalTotalItems = additionalCartItems.reduce(
    (sum, i) => sum + Number(i.quantity || 0),
    0,
  );

  const additionalTotalPrice = additionalCartItems.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0,
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`fixed inset-0 z-[100] backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 ${
          isDark ? "bg-slate-950/80" : "bg-slate-200/70"
        }`}
      >
        <div
          className={`w-full h-full max-w-7xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-colors ${
            isDark
              ? "bg-slate-900/50 border border-white/10"
              : "bg-white border border-slate-200"
          }`}
        >
          <div
            className={`px-6 py-4 flex justify-between items-center transition-colors ${
              isDark
                ? "border-b border-white/5 bg-white/5"
                : "border-b border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMobileCats(!showMobileCats)}
                className={`md:hidden p-3 rounded-xl transition-colors ${
                  isDark
                    ? "bg-slate-800 text-blue-400"
                    : "bg-slate-100 text-blue-600"
                }`}
              >
                <FaFilter />
              </button>

              <div>
                <h2
                  className={`font-bold text-xl ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Table <span className="text-blue-500"> {tableselected}</span>
                </h2>
                <p
                  className={`text-xs uppercase tracking-widest ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Digital Menu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {transactionId && (
                <button
                  onClick={openBillingModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-sm flex items-center gap-2"
                >
                  <FaReceipt /> View Billing
                </button>
              )}

              <button
                onClick={() => setshoworderlist(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDark
                    ? "hover:bg-white/10 text-slate-400"
                    : "hover:bg-slate-200 text-slate-500"
                }`}
              >
                <IoMdClose size={28} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden relative">
            <aside
              className={`absolute md:relative z-20 h-full w-64 transition-transform duration-300 ${
                showMobileCats
                  ? "translate-x-0"
                  : "-translate-x-full md:translate-x-0"
              } ${
                isDark
                  ? "bg-slate-900 border-r border-white/5"
                  : "bg-white border-r border-slate-200"
              }`}
            >
              <div className="p-4 flex flex-col h-full">
                <h3
                  className={`text-[10px] font-bold uppercase tracking-widest mb-4 px-2 ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Menu Sections
                </h3>

                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                  {categorylist.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setselectcategory(cat.item_category);
                        setShowMobileCats(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                        selectcategory === cat.item_category
                          ? "bg-blue-600 text-white shadow-lg"
                          : isDark
                            ? "text-slate-400 hover:bg-white/5"
                            : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>{getCategoryIcon(cat.item_category)}</span>
                      {cat.item_category}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main
              className={`flex-1 flex flex-col min-w-0 transition-colors ${
                isDark ? "bg-slate-900/20" : "bg-slate-50"
              }`}
            >
              <div className="p-4">
                <div className="relative">
                  <FaSearch
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Search delicious food..."
                    value={productsearch}
                    onChange={(e) => setproductsearch(e.target.value)}
                    className={`w-full rounded-2xl py-3 pl-12 pr-4 outline-none transition-colors ${
                      isDark
                        ? "bg-slate-800/40 border border-slate-700 text-white focus:border-blue-500/50"
                        : "bg-white border border-slate-300 text-slate-900 focus:border-blue-400"
                    }`}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((p, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ y: -6, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(p)}
                      className={`group relative overflow-hidden rounded-[28px] border text-left transition-all duration-300 ${
                        isDark
                          ? "border-white/10 bg-slate-900/85 hover:border-blue-400/40"
                          : "border-slate-200 bg-white hover:border-blue-400/50 hover:shadow-[0_18px_50px_rgba(15,23,42,0.10)]"
                      }`}
                    >
                      <div
                        className={`absolute inset-x-0 top-0 h-1 ${
                          isDark
                            ? "bg-gradient-to-r from-cyan-500/0 via-blue-400/70 to-blue-500/0"
                            : "bg-gradient-to-r from-blue-500/0 via-blue-500/70 to-blue-500/0"
                        }`}
                      />

                      <div className="relative flex min-h-[145px] flex-col justify-between p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h4
                            className={`max-w-[calc(100%-56px)] text-[15px] font-black leading-snug break-words ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {p.item_name}
                          </h4>

                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all ${
                              isDark
                                ? "bg-slate-800 text-blue-400 group-hover:bg-blue-500 group-hover:text-white"
                                : "bg-slate-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white"
                            }`}
                          >
                            <FaPlus size={13} />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <div className="text-right">
                            <div
                              className={`mb-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                isDark ? "text-slate-500" : "text-slate-400"
                              }`}
                            >
                              Price
                            </div>
                            <div className="text-[22px] font-black text-blue-500">
                              ₱{Number(p.selling_price || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </main>

            <aside
              className={`hidden lg:flex w-80 flex-col relative overflow-hidden transition-colors ${
                isDark
                  ? "bg-slate-950/40 border-l border-white/5"
                  : "bg-slate-50 border-l border-slate-200"
              }`}
            >
              <div
                className={`p-6 font-bold flex items-center gap-2 transition-colors ${
                  isDark
                    ? "border-b border-white/5 text-white"
                    : "border-b border-slate-200 text-slate-900"
                }`}
              >
                <FaShoppingCart className="text-blue-500" /> Cart Summary
                {isCartFromDB && (
                  <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Loaded Order
                  </span>
                )}
              </div>

              <button
                onClick={() => setSummaryCart(true)}
                className="mx-4 mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <FaReceipt /> View Full Summary
              </button>

              <div className="absolute top-[10px] right-4 z-20 flex flex-row gap-2">
                <button
                  onClick={() => setShowDesktopCartActions((prev) => !prev)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-sm flex items-center gap-2"
                >
                  Save
                </button>

                {canPrintOnly && (
                  <button
                    onClick={handlePrintOnly}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-white font-semibold text-sm flex items-center gap-2"
                  >
                    <FiPrinter />
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                {additionalCartItems.length > 0 && (
                  <div
                    className={`p-4 pt-2 ${
                      isDark
                        ? "border-t border-white/10"
                        : "border-t border-slate-200"
                    }`}
                  >
                    <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">
                      New Items
                    </h4>
                    <CartList
                      items={additionalCartItems}
                      updateQuantity={updateQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={requestRemoveItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                      isDark={isDark}
                    />
                  </div>
                )}

                {loadedCartItems.length > 0 && (
                  <div className="p-4 pb-2">
                    <h4
                      className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Recent Orders
                    </h4>
                    <CartList
                      items={loadedCartItems}
                      updateQuantity={updateQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={requestRemoveItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                      isDark={isDark}
                    />
                  </div>
                )}

                {loadedCartItems.length === 0 &&
                  additionalCartItems.length === 0 && (
                    <CartList
                      items={[]}
                      updateQuantity={updateQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={removeItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                      isDark={isDark}
                    />
                  )}
              </div>

              <AnimatePresence>
                {showDeleteItemModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed inset-0 z-[370] flex items-center justify-center p-4 ${
                      isDark ? "bg-black/70" : "bg-slate-900/40"
                    }`}
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 10 }}
                      className={`rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                        isDark
                          ? "bg-slate-900 border border-white/10"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      <h3
                        className={`text-xl font-black mb-2 ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        Remove Item?
                      </h3>

                      <p
                        className={`text-sm mb-6 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Are you sure you want to delete this item from the cart?
                      </p>

                      <div className="flex gap-3">
                        <button
                          onClick={confirmRemoveItem}
                          className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-500"
                        >
                          Yes
                        </button>

                        <button
                          onClick={cancelRemoveItem}
                          className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                            isDark
                              ? "bg-white/10 text-white hover:bg-white/20"
                              : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showDesktopCartActions && (
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute inset-y-0 right-0 z-20 w-[88%] max-w-[320px] backdrop-blur-xl shadow-2xl p-5 flex flex-col transition-colors ${
                      isDark
                        ? "bg-slate-950/95 border-l border-white/10"
                        : "bg-white/95 border-l border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3
                        className={`font-black text-lg ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        Cart Actions
                      </h3>

                      <button
                        onClick={() => setShowDesktopCartActions(false)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          isDark
                            ? "bg-white/10 hover:bg-white/20 text-slate-300"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <FiX size={16} />
                      </button>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                      <div
                        className={`rounded-2xl p-4 transition-colors ${
                          isDark
                            ? "bg-white/5 border border-white/10"
                            : "bg-slate-50 border border-slate-200"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center font-black text-xl ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          <span>Total</span>
                          <span className="text-blue-500">
                            ₱{totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <p
                          className={`text-xs mt-1 ${
                            isDark ? "text-slate-500" : "text-slate-500"
                          }`}
                        >
                          {totalItems} item{totalItems !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`pt-4 space-y-3 ${
                        isDark
                          ? "border-t border-white/10"
                          : "border-t border-slate-200"
                      }`}
                    >
                      <button
                        onClick={handleGenerateQR}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20"
                      >
                        <IoQrCode size={20} /> Confirm Order
                      </button>

                      <button
                        onClick={requestClearCart}
                        disabled={isCartFromDB}
                        className={`w-full font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors ${
                          isCartFromDB
                            ? isDark
                              ? "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                            : isDark
                              ? "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200"
                        }`}
                      >
                        <FaTrash size={16} /> Clear Cart
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>
          </div>

          <div
            className={`lg:hidden p-4 transition-colors ${
              isDark
                ? "bg-slate-900 border-t border-white/10"
                : "bg-white border-t border-slate-200"
            }`}
          >
            <button
              onClick={() => setShowCartMobile(true)}
              className="w-full bg-blue-600 py-4 rounded-2xl text-white font-bold flex justify-between px-6 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <FaShoppingCart />
                <span>Items ({totalItems})</span>
              </div>
              <span className="text-xl">₱{totalPrice.toLocaleString()}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCartMobile && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed inset-0 z-[150] flex flex-col lg:hidden transition-colors ${
              isDark ? "bg-slate-950" : "bg-slate-50"
            }`}
          >
            <div
              className={`p-6 flex justify-between items-center transition-colors ${
                isDark
                  ? "border-b border-white/10"
                  : "border-b border-slate-200"
              }`}
            >
              <button
                onClick={() => setShowCartMobile(false)}
                className={`flex items-center gap-2 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                <FaArrowLeft /> Back
              </button>

              <h3
                className={`font-bold text-lg ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Your Cart ({totalItems})
              </h3>

              <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadedCartItems.length > 0 && (
                <div className="p-4 pb-2">
                  <h4
                    className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Loaded Items
                  </h4>
                  <CartList
                    items={loadedCartItems}
                    updateQuantity={updateQuantity}
                    updateQuantityByInput={updateQuantityByInput}
                    removeItem={removeItem}
                    readOnly={false}
                    openItemInstructionModal={openItemInstructionModal}
                    isDark={isDark}
                  />
                </div>
              )}

              {additionalCartItems.length > 0 && (
                <div
                  className={`p-4 pt-2 ${
                    isDark
                      ? "border-t border-white/10"
                      : "border-t border-slate-200"
                  }`}
                >
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">
                    Additional Items
                  </h4>
                  <CartList
                    items={additionalCartItems}
                    updateQuantity={updateQuantity}
                    updateQuantityByInput={updateQuantityByInput}
                    removeItem={removeItem}
                    readOnly={false}
                    openItemInstructionModal={openItemInstructionModal}
                    isDark={isDark}
                  />
                </div>
              )}

              {loadedCartItems.length === 0 &&
                additionalCartItems.length === 0 && (
                  <CartList
                    items={[]}
                    updateQuantity={updateQuantity}
                    updateQuantityByInput={updateQuantityByInput}
                    removeItem={removeItem}
                    readOnly={false}
                    openItemInstructionModal={openItemInstructionModal}
                    isDark={isDark}
                  />
                )}
            </div>

            <div
              className={`p-6 transition-colors ${
                isDark
                  ? "border-t border-white/10 bg-slate-900"
                  : "border-t border-slate-200 bg-white"
              }`}
            >
              <div
                className={`flex justify-between font-black text-2xl mb-6 px-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                <span>Grand Total</span>
                <span className="text-blue-500">
                  ₱{totalPrice.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleGenerateQR}
                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-blue-600/20"
              >
                <IoQrCode size={24} /> Generate QR Code
              </button>

              <button
                onClick={requestSaveOnly}
                className="w-full mt-3 bg-emerald-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-emerald-600/20"
              >
                <FaCheckCircle /> Save Only
              </button>

              <button
                onClick={requestClearCart}
                disabled={isCartFromDB}
                className={`w-full mt-3 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors ${
                  isCartFromDB
                    ? isDark
                      ? "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : isDark
                      ? "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200"
                }`}
              >
                <FaTrash size={18} /> Clear Cart
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[380] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-[1.8rem] shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div
                className={`px-5 py-4 flex items-center justify-between ${
                  isDark
                    ? "border-b border-white/10 bg-white/5"
                    : "border-b border-slate-200 bg-slate-50"
                }`}
              >
                <div>
                  <h2
                    className={`text-lg font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Summary Cart
                  </h2>
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Table <span className="font-bold">{tableselected}</span>
                    {transactionId ? (
                      <>
                        {" "}
                        • Transaction ID{" "}
                        <span className="font-mono font-bold">
                          {transactionId}
                        </span>
                      </>
                    ) : (
                      <> • New unsaved order</>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => setSummaryCart(false)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isDark
                      ? "bg-white/10 hover:bg-white/20 text-slate-300"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <FiX size={16} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[calc(90vh-73px)] custom-scrollbar">
                {instructions && (
                  <div
                    className={`rounded-xl px-4 py-3 mb-4 ${
                      isDark
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-widest font-bold text-amber-500 mb-1">
                      General Instructions
                    </p>
                    <p
                      className={`text-xs whitespace-pre-wrap break-words ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      {instructions}
                    </p>
                  </div>
                )}

                {groupedSummaryOrders.length === 0 ? (
                  <div
                    className={`rounded-xl p-8 text-center ${
                      isDark
                        ? "bg-white/5 border border-white/10"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <FaShoppingCart
                      className={`mx-auto text-3xl mb-3 ${
                        isDark ? "text-slate-700" : "text-slate-300"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      No order entries yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedSummaryOrders.map((group) => (
                      <div key={group.category}>
                        <div className="mb-3">
                          <div
                            className={`inline-flex items-center gap-3 px-4 py-3 rounded-2xl ${
                              isDark
                                ? "bg-white/5 border border-white/10 text-slate-200"
                                : "bg-slate-50 border border-slate-200 text-slate-800"
                            }`}
                          >
                            <span>{getCategoryIcon(group.category)}</span>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest opacity-80">
                                Category
                              </p>
                              <p className="font-bold">{group.category}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                          {group.items.map((item, index) => (
                            <div
                              key={`${group.category}-${item.code}-${index}`}
                              className={`rounded-xl p-3 ${
                                isDark
                                  ? "bg-slate-950/50 border border-white/5"
                                  : "bg-white border border-slate-200"
                              }`}
                            >
                              <p
                                className={`text-xs font-semibold break-words ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {item.name}
                              </p>

                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                    item.isLoadedFromDB
                                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  }`}
                                >
                                  {item.isLoadedFromDB ? "Saved" : "New"}
                                </span>

                                <span
                                  className={`text-[10px] ${
                                    isDark ? "text-slate-400" : "text-slate-500"
                                  }`}
                                >
                                  Qty: {item.quantity}
                                </span>
                              </div>

                              {item.code && (
                                <p
                                  className={`text-[10px] mt-1 break-words ${
                                    isDark ? "text-slate-500" : "text-slate-500"
                                  }`}
                                >
                                  {item.code}
                                </p>
                              )}

                              {item.itemInstruction && (
                                <p className="text-[10px] text-amber-500 mt-2 break-words">
                                  Note: {item.itemInstruction}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => setSummaryCart(false)}
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      isDark
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                    }`}
                  >
                    Close
                  </button>

                  <button
                    onClick={handleGenerateQR}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all"
                  >
                    Continue Order Action
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaveSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[340] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FaCheckCircle size={24} />
              </div>

              <h3
                className={`text-xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Saved Successfully
              </h3>

              <p
                className={`text-sm mb-6 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {saveSuccessMessage}
              </p>

              <button
                onClick={() => setShowSaveSuccessModal(false)}
                className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaveConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[410] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <h3
                className={`text-xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Save Order?
              </h3>

              <p
                className={`text-sm mb-6 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Do you want to save this order without printing?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveOnly}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500"
                >
                  Yes
                </button>

                <button
                  onClick={() => setShowSaveConfirmModal(false)}
                  className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                    isDark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                  }`}
                >
                  No
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showqrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[400] backdrop-blur-xl flex items-center justify-center p-4 ${
              isDark ? "bg-slate-950/60" : "bg-slate-200/60"
            }`}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`backdrop-blur-3xl rounded-[3rem] p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                isDark
                  ? "bg-white/10 border border-white/20"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div
                className={`w-16 h-1 mx-auto mb-8 rounded-full ${
                  isDark ? "bg-white/20" : "bg-slate-200"
                }`}
              />

              <div className="flex flex-col items-center mb-6">
                <div className="p-4 bg-blue-500/20 rounded-full mb-3">
                  <FaReceipt className="text-blue-500 text-2xl" />
                </div>

                <h3
                  className={`text-2xl font-black ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Total: ₱{additionalTotalPrice.toLocaleString()}
                </h3>

                <p
                  className={`text-sm mt-1 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Table {tableselected} • {additionalTotalItems} additional
                  items
                </p>
              </div>

              <div className="bg-white p-6 rounded-[2rem] inline-block mb-8 shadow-inner ring-8 ring-white/5">
                <QRCode value={qrValue} size={180} level="H" />
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-4 mb-3 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg"
              >
                <FaReceipt /> Print & Save Receipt
              </button>

              <button
                onClick={requestSaveOnly}
                className="w-full mb-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20"
              >
                <FaCheckCircle /> Save Only
              </button>

              <button
                onClick={() => setShowqrModal(false)}
                className={`w-full py-4 font-black rounded-2xl transition-colors ${
                  isDark ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                }`}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[410] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <h3
                className={`text-xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Confirm Transaction?
              </h3>

              <p
                className={`text-sm mb-6 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Do you want to confirm and print this order?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmTransactionAndPrint}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500"
                >
                  Yes
                </button>

                <button
                  onClick={() => setShowConfirmModal(false)}
                  className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                    isDark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                  }`}
                >
                  No
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearCartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[320] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <h3
                className={`text-xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Clear Cart?
              </h3>

              <p
                className={`text-sm mb-6 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Are you sure you want to remove all items?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmClearCart}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-500"
                >
                  Yes
                </button>

                <button
                  onClick={() => setShowClearCartModal(false)}
                  className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${
                    isDark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                  }`}
                >
                  No
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showItemInstructionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[360] flex items-center justify-center p-4 ${
              isDark ? "bg-black/70" : "bg-slate-900/40"
            }`}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className={`rounded-3xl p-6 max-w-md w-full shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-lg font-black ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Item Instruction
                </h3>
                <button
                  onClick={() => {
                    setShowItemInstructionModal(false);
                    setSelectedInstructionItem(null);
                    setItemInstructionText("");
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isDark
                      ? "bg-white/10 hover:bg-white/20 text-slate-300"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <FiX size={16} />
                </button>
              </div>

              <div className="mb-4">
                <p
                  className={`text-sm mb-2 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Product
                </p>
                <div
                  className={`rounded-2xl p-3 font-semibold transition-colors ${
                    isDark
                      ? "bg-white/5 border border-white/10 text-white"
                      : "bg-slate-50 border border-slate-200 text-slate-900"
                  }`}
                >
                  {selectedInstructionItem?.name}
                </div>
              </div>

              <div className="mb-5">
                <label
                  className={`text-sm block mb-2 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Special instruction
                </label>
                <textarea
                  rows="5"
                  value={itemInstructionText}
                  onChange={(e) => setItemInstructionText(e.target.value)}
                  placeholder="Example: no onions, extra spicy, less ice..."
                  className={`w-full rounded-2xl p-4 text-sm resize-none outline-none transition-colors ${
                    isDark
                      ? "bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50"
                      : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={saveItemInstruction}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500"
                >
                  Save
                </button>

                <button
                  onClick={() => {
                    setItemInstructionText("");
                    setShowItemInstructionModal(false);
                    setSelectedInstructionItem(null);
                  }}
                  className={`w-full py-3 rounded-2xl font-bold transition-colors ${
                    isDark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDiscountModal && discountTransaction && (
          <ModalDiscountTransaction
            isOpen={showDiscountModal}
            onClose={() => setShowDiscountModal(false)}
            transaction={discountTransaction}
            apiHost={apiHost}
            isDark={isDark}
            billingNo={
              discountTransaction?.billing_no ||
              discountTransaction?.billingNo ||
              ""
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBillingModal && (
          <motion.div
            className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md ${
              isDark ? "bg-slate-950/80" : "bg-slate-200/70"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden transition-colors ${
                isDark
                  ? "bg-slate-900 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div
                className={`relative p-6 transition-colors ${
                  isDark
                    ? "border-b border-white/5 bg-white/5"
                    : "border-b border-slate-200 bg-slate-50"
                }`}
              >
                <button
                  onClick={() => setShowBillingModal(false)}
                  className={`absolute right-6 top-6 p-2 rounded-full transition-all ${
                    isDark
                      ? "bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400"
                      : "bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-500"
                  }`}
                >
                  <FiX size={20} />
                </button>

                <h2
                  className={`text-2xl font-black tracking-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Table {tableselected}
                </h2>

                <p
                  className={`text-xs font-bold uppercase tracking-widest mt-1 ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Transaction History
                </p>
              </div>

              <div
                className={`p-2 flex gap-2 m-4 rounded-2xl transition-colors ${
                  isDark
                    ? "bg-slate-950/50 border border-white/5"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <button
                  onClick={() => setBillingTab("pending")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    billingTab === "pending"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : isDark
                        ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FiClock size={16} /> Pending
                </button>

                <button
                  onClick={() => setBillingTab("paid")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    billingTab === "paid"
                      ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                      : isDark
                        ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FiCheckCircle size={16} /> Paid
                </button>
              </div>

              <div className="px-6 pb-8">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {billingLoading ? (
                    <div className="py-12 text-center">
                      <p
                        className={`font-medium italic ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        Loading transactions...
                      </p>
                    </div>
                  ) : filteredBillingData.length > 0 ? (
                    filteredBillingData.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={(e) => {
                          if (e.target.closest("button")) return;
                          onBillingTransactionClick(item);
                        }}
                        className={`group flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${
                          isDark
                            ? "bg-slate-800/40 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800"
                            : "bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-white"
                        }`}
                      >
                        <div>
                          <p
                            className={`text-xs font-bold uppercase tracking-tighter ${
                              isDark ? "text-slate-500" : "text-slate-500"
                            }`}
                          >
                            Order ID
                          </p>
                          <p
                            className={`font-mono font-medium ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {item.transaction_id}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {billingTab === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => onOpenDiscountModal(item, e)}
                                className="p-3 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all"
                                title="Add Discount"
                              >
                                <FiPercent size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <div
                        className={`inline-flex p-4 rounded-full mb-3 ${
                          isDark
                            ? "bg-slate-800/50 text-slate-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <FiClock size={32} />
                      </div>
                      <p
                        className={`font-medium italic ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        No {billingTab} transactions found.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => navigate("/printbilling")}
                    className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all"
                  >
                    Go to Billing Page
                  </button>

                  <button
                    onClick={() => setShowBillingModal(false)}
                    className={`w-full py-3 rounded-2xl font-bold transition-all ${
                      isDark
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                    }`}
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden">
        <PrintableReceipt
          ref={printRef}
          productcart={{
            customer: tableselected,
            items: additionalCartItems,
          }}
          totalPrice={additionalTotalPrice}
          tableselected={tableselected}
          qrValue={qrValue}
          instructions={instructions}
          transactionId={transactionId}
          isReprint={false}
        />
      </div>

      <div className="hidden">
        <PrintableReceipt
          ref={printAllRef}
          productcart={{
            customer: tableselected,
            items: cartSummaryItems,
          }}
          totalPrice={totalPrice}
          tableselected={tableselected}
          qrValue={qrValue}
          instructions={instructions}
          transactionId={transactionId}
          isReprint={isReprint}
        />
      </div>

      {billingSelectedTransaction && billingDetailedProduct.length > 0 && (
        <div style={{ display: "none" }}>
          <Receipt
            transaction={billingSelectedTransaction}
            detailedproduct={billingDetailedProduct}
            ref={billingPrintRef}
          />
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? "#1e293b" : "#cbd5e1"};
          border-radius: 10px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

const CartList = ({
  items = [],
  updateQuantity,
  updateQuantityByInput,
  removeItem,
  readOnly = false,
  extraClassName = "",
  openItemInstructionModal,
  isDark,
}) => (
  <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${extraClassName}`}>
    {items.length === 0 ? (
      <div className="text-center py-20">
        <FaShoppingCart
          className={`mx-auto text-5xl mb-4 ${
            isDark ? "text-slate-700" : "text-slate-300"
          }`}
        />
        <p className="text-slate-500 font-medium">Your cart is feeling empty</p>
      </div>
    ) : (
      items.map((item, index) => {
        const isSpecialPaluto =
          String(item.item_category || "").toUpperCase() === "SPECIAL PALUTO";

        return (
          <div
            key={`${item.code}-${index}`}
            className={`rounded-xl p-3 border transition-colors ${
              isDark
                ? "bg-white/5 border-white/5"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-medium leading-tight block ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {item.name}
                </span>

                {item.itemInstruction && (
                  <p className="text-[10px] text-amber-500 mt-1 break-words">
                    Note: {item.itemInstruction}
                  </p>
                )}
              </div>

              {!readOnly && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => openItemInstructionModal?.(item)}
                    className={`p-2 transition-colors ${
                      isDark
                        ? "text-slate-400 hover:text-amber-300"
                        : "text-slate-500 hover:text-amber-600"
                    }`}
                    title="Add instruction"
                  >
                    <FaEdit size={18} />
                  </button>

                  <button
                    onClick={() => removeItem?.(item.code)}
                    className={`p-2 transition-colors ${
                      isDark
                        ? "text-slate-500 hover:text-red-400"
                        : "text-slate-500 hover:text-red-600"
                    }`}
                  >
                    <FaTrash size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              {readOnly ? (
                <div
                  className={`text-xs font-bold ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Qty: {item.quantity}
                </div>
              ) : isSpecialPaluto ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    Qty
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantityByInput?.(item.code, e.target.value)
                    }
                    className={`w-20 rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
                      isDark
                        ? "bg-slate-900 border border-white/10 text-white focus:border-blue-500/50"
                        : "bg-white border border-slate-300 text-slate-900 focus:border-blue-400"
                    }`}
                  />
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 rounded-lg p-1 border transition-colors ${
                    isDark
                      ? "bg-slate-900 border-white/5"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <button
                    onClick={() => updateQuantity?.(item.code, -1)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      isDark
                        ? "text-slate-300 bg-slate-800 hover:bg-slate-700"
                        : "text-slate-700 bg-white hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    <FaMinus size={8} />
                  </button>

                  <span
                    className={`text-xs font-bold px-1 min-w-[18px] text-center ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => updateQuantity?.(item.code, 1)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      isDark
                        ? "text-slate-300 bg-slate-800 hover:bg-slate-700"
                        : "text-slate-700 bg-white hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    <FaPlus size={8} />
                  </button>
                </div>
              )}

              <span className="text-blue-500 font-bold text-sm">
                ₱{(Number(item.price) * Number(item.quantity)).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })
    )}
  </div>
);

const PrintableReceipt = React.forwardRef(
  (
    {
      productcart,
      totalPrice,
      tableselected,
      instructions,
      transactionId,
      isReprint,
    },
    ref,
  ) => {
    let cartItems = [];

    if (productcart && productcart.items) {
      cartItems = productcart.items;
    } else if (Array.isArray(productcart)) {
      if (typeof productcart[0] === "string") {
        cartItems = productcart[1] || [];
      } else {
        cartItems = productcart;
      }
    }

    return (
      <div
        ref={ref}
        className="print-root"
        style={{
          width: "80mm",
          minHeight: "100vh",
          background: "#ffffff",
          backgroundColor: "#ffffff",
          color: "#000000",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "12px",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold uppercase underline">
            Order Summary
          </h2>
          <p className="font-bold text-lg">Table: {tableselected}</p>
          <p>{new Date().toLocaleString()}</p>
          <div className="border-b border-dashed border-black my-2" />
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-black text-[10px]">
              <th className="text-left py-1">Item</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1">Price</th>
            </tr>
          </thead>

          <tbody>
            {cartItems.length === 0 ? (
              <tr>
                <td
                  colSpan="3"
                  className="text-center py-4 italic text-gray-500"
                >
                  Cart is empty
                </td>
              </tr>
            ) : (
              cartItems.map((item, index) => (
                <tr
                  key={item.code || index}
                  className="border-b border-gray-100"
                >
                  <td className="py-2 leading-tight">
                    <div className="font-bold uppercase">{item.name}</div>
                    {item.itemInstruction && (
                      <div className="text-[9px] text-black italic mt-1">
                        Note: {item.itemInstruction}
                      </div>
                    )}
                    <div className="text-[9px] text-gray-400">{item.code}</div>
                  </td>
                  <td className="text-center align-top pt-2">
                    {item.quantity}
                  </td>
                  <td className="text-right align-top pt-2">
                    ₱
                    {(
                      Number(item.price) * Number(item.quantity)
                    ).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-2 mb-4">
          <div className="flex justify-between font-black text-sm">
            <span>GRAND TOTAL</span>
            <span>₱{Number(totalPrice || 0).toLocaleString()}</span>
          </div>
        </div>

        {instructions && (
          <div className="border-t border-dashed border-black pt-2 mt-2">
            <p className="font-bold uppercase text-[10px] mb-1">Instructions</p>
            <p className="text-[11px] whitespace-pre-wrap break-words">
              {instructions}
            </p>
          </div>
        )}

        {isReprint ? (
          <div className="mt-3 mb-2 text-center font-bold">
            <div className="border-y border-dashed border-black py-1">
              <p className="text-[25px] font-black uppercase tracking-widest">
                Duplicate Copy
              </p>
            </div>
          </div>
        ) : transactionId ? (
          <div className="mt-3 mb-2 text-center font-bold">
            <div className="border-y border-dashed border-black py-1">
              <p className="text-[30px] font-black uppercase tracking-widest">
                Additional Order
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 mb-2 text-center font-bold">
            <div className="border-y border-dashed border-black py-1">
              <p className="text-[30px] font-black uppercase tracking-widest">
                New Order
              </p>
            </div>
          </div>
        )}

        <div className="text-center mt-8 text-[9px] italic opacity-70">
          <p>Thank you for your order!</p>
          <p>Please present this to the counter.</p>
        </div>
      </div>
    );
  },
);

export default Orderlist;
