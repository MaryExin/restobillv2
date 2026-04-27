import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode.react";
import {
  FaSearch,
  FaShoppingCart,
  FaTrash,
  FaCheck,
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
import {
  FiX,
  FiPrinter,
  FiClock,
  FiCheckCircle,
  FiPercent,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";
import ModalDiscountTransaction from "./ModalDiscountTransaction";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ButtonComponent from "./Common/ButtonComponent";
import {
  BuildBillingReceiptHtml,
  BuildOrderReceiptHtml,
} from "../../utils/BuildOrderlistPrintHtml";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";

const Orderlist = ({
  tableselected,
  setshoworderlist,
  dateSelected,
  transactionId,
}) => {
  const defaultPrinterName = useGetDefaultPrinter();

  const [isPrintingOnly, setIsPrintingOnly] = useState(false);

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

  const [isReprint, setIsReprint] = useState(false);

  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);

  const userId = localStorage.getItem("user_id") || "0";
  const userName = localStorage.getItem("Cashier") || "Store Crew";
  const email = localStorage.getItem("email") || "Store Crew";
  const unit_code = localStorage.getItem("posBusinessUnitCode") || "";
  const category_code = localStorage.getItem("posBusinessCategoryCode") || "";
  const [salesTypeList, setSalesTypeList] = useState([]);
  const [selectedSalesType, setSelectedSalesType] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [showTransferConfirmModal, setShowTransferConfirmModal] =
    useState(false);
  const [isTransferringTable, setIsTransferringTable] = useState(false);
  const [transferMode, setTransferMode] = useState("fixed");
  const [transferSearch, setTransferSearch] = useState("");
  const [selectedTransferTable, setSelectedTransferTable] = useState("");
  const [selectedMergeTables, setSelectedMergeTables] = useState([]);
  const [customTransferTableName, setCustomTransferTableName] = useState("");
  const [customMergeTableName, setCustomMergeTableName] = useState("");
  const [transferTableList, setTransferTableList] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [sourceTransactionSummary, setSourceTransactionSummary] = useState({});
  const [transferItemSelections, setTransferItemSelections] = useState({});
  const [destinationTransferSummary, setDestinationTransferSummary] =
    useState(null);
  const [destinationTransferItems, setDestinationTransferItems] = useState([]);
  const [destinationTransferLoading, setDestinationTransferLoading] =
    useState(false);

  const [newtransaction, setNewTransaction] = useState({
    business_info: {},
    inventory_types: [],
    sales_types: [],
    item_categories: [],
  });

  const [pricingData, setPricingData] = useState({
    sales_type_id: "",
    pricing_category: "",
    products: [],
  });

  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // let escposWarmedUp = false;

  useEffect(() => {
    // if (escposWarmedUp) return;

    const warmupPrinter = async () => {
      try {
        if (!window?.electronAPI?.warmupEscPos) return;

        const result = await window.electronAPI.warmupEscPos();
        console.log("ESC/POS warm-up result:", result);

        // if (result?.success) {
        //   escposWarmedUp = true;
        // }
      } catch (error) {
        console.error("ESC/POS warm-up failed:", error);
      }
    };

    warmupPrinter();
  }, []);

  const makeLineId = (prefix = "LINE") =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  useEffect(() => {
    if (!apiHost) return;

    const fetchNewTransaction = async () => {
      try {
        const response = await fetch(`${apiHost}/api/new_transactions.php`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId || 0,
          }),
        });

        const result = await response.json();

        if (result?.status === "success") {
          const salesTypes = Array.isArray(result.sales_types)
            ? result.sales_types
            : [];
          const itemCategories = Array.isArray(result.item_categories)
            ? result.item_categories
            : [];

          setNewTransaction({
            business_info: result.business_info || {},
            inventory_types: Array.isArray(result.inventory_types)
              ? result.inventory_types
              : [],
            sales_types: salesTypes,
            item_categories: itemCategories,
          });

          setSalesTypeList(salesTypes);
          setcategorylist(itemCategories);

          if (salesTypes.length > 0) {
            setSelectedSalesType(String(salesTypes[0].sales_type_id));
          }

          if (itemCategories.length > 0) {
            setselectcategory(itemCategories[0].item_category);
          }
        } else {
          setNewTransaction({
            business_info: {},
            inventory_types: [],
            sales_types: [],
            item_categories: [],
          });
          setSalesTypeList([]);
          setcategorylist([]);
        }
      } catch (error) {
        console.error("Failed to fetch new transaction setup:", error);
        setNewTransaction({
          business_info: {},
          inventory_types: [],
          sales_types: [],
          item_categories: [],
        });
        setSalesTypeList([]);
        setcategorylist([]);
      }
    };

    fetchNewTransaction();
  }, [apiHost, userId]);

  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const list = await window.electronAPI?.getPrinters?.();
        const safeList = Array.isArray(list) ? list : [];

        setPrinters(safeList);

        console.log("Electron printers:", safeList);
        console.log("Printer count:", safeList.length);
        console.log("Default printer from hook:", defaultPrinterName);

        const matchedPrinter = safeList.find(
          (p) =>
            String(p.name || "").trim() ===
            String(defaultPrinterName || "").trim(),
        );

        const fallbackElectronDefault = safeList.find((p) => p.isDefault);

        const resolvedPrinterName =
          matchedPrinter?.name ||
          String(defaultPrinterName || "").trim() ||
          fallbackElectronDefault?.name ||
          "";

        setPrinterName(resolvedPrinterName);

        console.log(
          "Matched printer from hook:",
          matchedPrinter?.name || "(none)",
        );
        console.log(
          "Electron default printer:",
          fallbackElectronDefault?.name || "(none)",
        );
        console.log("Resolved printer name:", resolvedPrinterName);
      } catch (error) {
        console.error("Failed to load printers:", error);
        setPrinterName(String(defaultPrinterName || "").trim());
      }
    };

    loadPrinters();
  }, [defaultPrinterName]);

  const printViaElectron = async ({
    html,
    fallbackDocumentName = "receipt",
    afterSuccess,
  }) => {
    try {
      if (!window.electronAPI?.printReceipt) {
        throw new Error("Electron print API is not available.");
      }

      console.log("Selected printerName:", printerName);
      console.log("Available printers:", printers);
      console.log(
        "Is aligned:",
        printers.some((p) => p.name === printerName),
      );

      const result = await window.electronAPI.printReceipt({
        html,
        printerName: printerName || defaultPrinterName || "",
        silent: true,
        copies: 1,
      });

      console.log("Print result:", result);

      if (!result?.success) {
        throw new Error(
          result?.message || `Failed to print ${fallbackDocumentName}.`,
        );
      }

      if (typeof afterSuccess === "function") {
        afterSuccess();
      }

      return { ok: true };
    } catch (error) {
      console.error(error);
      alert(error.message || `Failed to print ${fallbackDocumentName}.`);
      return { ok: false };
    }
  };

  // const handlePrintAdditionalOrderElectron = async () => {
  // const html = BuildOrderReceiptHtml({
  // productcart: {
  //   customer: tableselected,
  //   items: additionalCartItems,
  // },
  // totalPrice: additionalTotalPrice,
  // tableselected,
  // instructions,
  // transactionId,
  // printMode: transactionId ? "additional" : "new",
  //   });

  //   return printViaElectron({
  //     html,
  //     fallbackDocumentName: transactionId
  //       ? `additional-order-${transactionId}`
  //       : `new-order-${tableselected}`,
  //     afterSuccess: () => {
  //       setIsReprint(false);
  //       setShowqrModal(false);
  //       setShowCartMobile(false);
  //       setShowDesktopCartActions(false);
  //       setshoworderlist(false);
  //     },
  //   });
  // };

  // const handlePrintAllElectron = async (printMode = "auto") => {
  //   const html = BuildOrderReceiptHtml({
  //     productcart: {
  //       customer: tableselected,
  //       items: cartSummaryItems,
  //     },
  //     totalPrice,
  //     tableselected,
  //     instructions,
  //     transactionId,
  //     printMode,
  //   });

  //   return printViaElectron({
  //     html,
  //     fallbackDocumentName: transactionId
  //       ? `full-order-${transactionId}`
  //       : `full-order-${tableselected}`,
  //     afterSuccess: () => {
  //       setIsReprint(false);
  //       setShowqrModal(false);
  //       setShowCartMobile(false);
  //       setShowDesktopCartActions(false);
  //     },
  //   });
  // };

  const handlePrintAdditionalOrderElectron = async (transactionIds) => {
    try {
      const printResult = await window.electronAPI.printEscPos({
        table: tableselected,
        items: additionalCartItems,
        total: additionalTotalPrice,
        instructions,
        transactionId: transactionId ? transactionId : transactionIds,
        printMode: transactionId ? "additional" : "new",
        printerName: printerName || defaultPrinterName || "",
      });

      console.log("ESC/POS additional print result:", printResult);

      if (!printResult?.success) {
        alert(printResult?.message || "Printing failed");
        // return;
      }

      setIsReprint(false);
      setShowqrModal(false);
      setShowCartMobile(false);
      setShowDesktopCartActions(false);
      setshoworderlist(false);
    } catch (error) {
      console.error("handlePrintAdditionalOrderElectron error:", error);
      alert(error?.message || "Unexpected printing error");
    }
  };

  const handlePrintAllElectron = async (printMode = "auto") => {
    try {
      const printResult = await window.electronAPI.printEscPos({
        table: tableselected,
        items: cartSummaryItems,
        total: totalPrice,
        instructions,
        transactionId,
        printerName: printerName || defaultPrinterName || "",
        printMode:
          printMode === "auto"
            ? transactionId
              ? "additional"
              : "new"
            : printMode,
      });

      console.log("ESC/POS full print result:", printResult);

      if (!printResult?.success) {
        alert(printResult?.message || "Printing failed");
        return;
      }

      setIsReprint(false);
      setShowqrModal(false);
      setShowCartMobile(false);
      setShowDesktopCartActions(false);
    } catch (error) {
      console.error("handlePrintAllElectron error:", error);
      alert(error?.message || "Unexpected printing error");
    }
  };

  const handleBillingPrintElectron = async (transaction, detailedItems) => {
    try {
      const printResult = await window.electronAPI.printEscPosBilling({
        transaction,
        detailedproduct: detailedItems,
        printerName: printerName || defaultPrinterName || "",
        title: transaction?.billing_no
          ? `billing-${transaction.billing_no}`
          : transaction?.transaction_id
            ? `billing-${transaction.transaction_id}`
            : `billing-${tableselected}`,
      });

      console.log("ESC/POS billing print result:", printResult);

      if (!printResult?.success) {
        alert(printResult?.message || "Billing printing failed");
        return;
      }

      setBillingSelectedTransaction(null);
      setBillingDetailedProduct([]);
    } catch (error) {
      console.error("handleBillingPrintElectron error:", error);
      alert(error?.message || "Unexpected billing printing error");
    }
  };

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

  const selectedSalesTypeObject = useMemo(() => {
    return (
      salesTypeList.find(
        (item) => String(item.sales_type_id) === String(selectedSalesType),
      ) || null
    );
  }, [salesTypeList, selectedSalesType]);

  useEffect(() => {
    if (!apiHost) return;

    const categoryCode = newtransaction?.business_info?.Category_Code || "";
    const unitCode = newtransaction?.business_info?.Unit_Code || "";
    const salesTypeDesc =
      selectedSalesTypeObject?.sales_type ||
      selectedSalesTypeObject?.description ||
      "";

    if (!categoryCode || !unitCode || !salesTypeDesc || !selectcategory) {
      setPricingData({
        sales_type_id: "",
        pricing_category: "",
        products: [],
      });
      setproductlist([]);
      return;
    }

    const fetchPricingProducts = async () => {
      try {
        setIsPricingLoading(true);

        const response = await fetch(
          `${apiHost}/api/get_pricing_selection.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              category_code: categoryCode,
              unit_code: unitCode,
              sales_type: salesTypeDesc,
              item_category: selectcategory,
              search: productsearch || "",
              limit: 100,
            }),
          },
        );

        const result = await response.json();

        if (result?.status === "success") {
          const mappedProducts = Array.isArray(result.products)
            ? result.products.map((item, index) => ({
                id: item.product_id || `${item.sku || "ITEM"}-${index}`,
                product_id: item.product_id || "",
                item_name: item.item_name || "NO NAME",
                selling_price: Number(item.selling_price || 0),
                sku: item.sku || "",
                item_category: item.item_category || "",
                isDiscountable: item.isDiscountable || "",
                vatable: item.vatable || "",
                unit_cost: Number(item.unit_cost || 0),
                unit_of_measure: item.unit_of_measure || "",
                inventory_type: item.inventory_type || "",
                raw: item,
              }))
            : [];

          setPricingData({
            sales_type_id: result.sales_type_id || "",
            pricing_category: result.pricing_category || "",
            products: mappedProducts,
          });

          setproductlist(mappedProducts);
        } else {
          setPricingData({
            sales_type_id: "",
            pricing_category: "",
            products: [],
          });
          setproductlist([]);
        }
      } catch (error) {
        console.error("Failed to fetch pricing products:", error);
        setPricingData({
          sales_type_id: "",
          pricing_category: "",
          products: [],
        });
        setproductlist([]);
      } finally {
        setIsPricingLoading(false);
      }
    };

    fetchPricingProducts();
  }, [
    apiHost,
    newtransaction?.business_info?.Category_Code,
    newtransaction?.business_info?.Unit_Code,
    selectedSalesTypeObject?.sales_type,
    selectedSalesTypeObject?.description,
    selectcategory,
    productsearch,
  ]);

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
        if (!data) return;

        if (data.summary?.order_type && Array.isArray(salesTypeList)) {
          const matched = salesTypeList.find(
            (item) =>
              String(item.sales_type || item.description).toUpperCase() ===
              String(data.summary.order_type).toUpperCase(),
          );

          if (matched) {
            setSelectedSalesType(String(matched.sales_type_id));
          }
        }

        if (!Array.isArray(data.order_details)) return;

        const mappedCart = data.order_details.map((item, index) => ({
          lineId: item.ID ? `db-${item.ID}` : `db-${item.product_id}-${index}`,
          code: item.product_id,
          name: item.item_name || item.product_id,
          price: Number(item.selling_price || 0),
          unit_cost: Number(item.unit_cost || 0),
          quantity: Number(item.sales_quantity || 0),
          isDiscountable: item.isDiscountable,
          vatable: item.vatable || "Yes",
          itemInstruction: item.item_instruction || "",
          item_category: item.item_category || "",
          isLoadedFromDB: true,
        }));

        setSourceTransactionSummary(data.summary || {});

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
  }, [apiHost, transactionId, tableselected, salesTypeList]);

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

  const normalizeTableName = (value) =>
    String(value || "")
      .replace(/\s*&\s*/g, " & ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const currentTableParts = useMemo(() => {
    return String(tableselected || "")
      .split("&")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [tableselected]);

  const buildUniqueTableNames = (tables = []) => {
    const seen = new Set();
    const merged = [];

    tables.forEach((tableName) => {
      const cleanName = String(tableName || "").trim();
      const normalizedName = normalizeTableName(cleanName);

      if (!cleanName || seen.has(normalizedName)) return;

      seen.add(normalizedName);
      merged.push(cleanName);
    });

    return merged.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  };

  const getTransferTableName = (row) =>
    String(
      row?.table_name ||
        row?.table_number ||
        row?.table ||
        row?.customer ||
        row?.customer_name ||
        "",
    ).trim();

  const getTransferTableStatus = (row) =>
    String(
      row?.status_label ||
        row?.remarks ||
        row?.order_status ||
        row?.status ||
        "",
    )
      .trim()
      .toLowerCase();

  const getTransferTransactionId = (row) =>
    String(
      row?.transaction_id ?? row?.Transaction_ID ?? row?.order_slip_no ?? "",
    ).trim();

  const mapPendingTableRows = (rows = []) => {
    return rows
      .map((row, index) => ({
        ...row,
        ID: row?.ID ?? row?.id ?? `pending-table-${index}`,
        table_name: getTransferTableName(row),
        pending_status: getTransferTableStatus(row),
        pending_transaction_id: getTransferTransactionId(row),
      }))
      .filter((row) => {
        if (!row.table_name) return false;

        const isPending =
          row.pending_status.includes("pending") ||
          row.pending_status.includes("unpaid") ||
          row.pending_status.includes("open");

        const isCurrentTable = currentTableParts.some(
          (part) =>
            normalizeTableName(part) === normalizeTableName(row.table_name),
        );

        return isPending && !isCurrentTable;
      })
      .sort((a, b) =>
        String(a.table_name).localeCompare(String(b.table_name), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  };

  const filteredTransferTables = useMemo(() => {
    return (transferTableList || []).filter((table) => {
      const rawTableName = table.table_name || "";
      const normalizedTableName = normalizeTableName(rawTableName);

      return normalizedTableName.includes(normalizeTableName(transferSearch));
    });
  }, [transferTableList, transferSearch]);

  const selectedTransferTableRow = useMemo(() => {
    return (
      transferTableList.find(
        (table) =>
          normalizeTableName(getTransferTableName(table)) ===
          normalizeTableName(selectedTransferTable),
      ) || null
    );
  }, [transferTableList, selectedTransferTable]);

  const mergeSelectableTables = useMemo(() => {
    const baseTables = Array.isArray(filteredTransferTables)
      ? [...filteredTransferTables]
      : [];

    currentTableParts.forEach((tableName, index) => {
      const exists = baseTables.some(
        (table) =>
          normalizeTableName(table?.table_name || "") ===
          normalizeTableName(tableName),
      );

      if (!exists) {
        baseTables.unshift({
          ID: `current-table-${index}-${tableName}`,
          table_name: tableName,
        });
      }
    });

    return baseTables;
  }, [filteredTransferTables, currentTableParts]);

  const mergePreview = useMemo(() => {
    const merged = buildUniqueTableNames([
      ...selectedMergeTables,
      customMergeTableName,
    ]);

    return merged.length ? merged.join(" & ") : "None";
  }, [selectedMergeTables, customMergeTableName]);

  const cartSummaryItems = productcart.items;
  const isCartFromDB = false;

  const loadedCartItems = cartSummaryItems.filter(
    (item) => item.isLoadedFromDB === true,
  );

  const additionalCartItems = cartSummaryItems.filter(
    (item) => item.isLoadedFromDB !== true,
  );

  const transferProductItems = useMemo(() => {
    return (cartSummaryItems || []).map((item, index) => ({
      ...item,
      transferKey: item.lineId || `${item.code}-${index}`,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
    }));
  }, [cartSummaryItems]);

  const selectedTransferProductTotalQty = useMemo(() => {
    return transferProductItems.reduce(
      (sum, item) =>
        sum +
        Math.min(
          Number(item.quantity || 0),
          Number(transferItemSelections[item.transferKey] || 0),
        ),
      0,
    );
  }, [transferProductItems, transferItemSelections]);

  const selectedTransferProductSubtotal = useMemo(() => {
    return transferProductItems.reduce((sum, item) => {
      const qty = Math.min(
        Number(item.quantity || 0),
        Number(transferItemSelections[item.transferKey] || 0),
      );

      return sum + qty * Number(item.price || 0);
    }, 0);
  }, [transferProductItems, transferItemSelections]);

  const remainingTransferProductTotalQty = useMemo(() => {
    return transferProductItems.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          Number(item.quantity || 0) -
            Number(transferItemSelections[item.transferKey] || 0),
        ),
      0,
    );
  }, [transferProductItems, transferItemSelections]);

  const buildCartMergeKey = (item) => {
    const code = String(item?.code || "")
      .trim()
      .toLowerCase();
    const instruction = String(item?.itemInstruction || "")
      .trim()
      .toLowerCase();
    const price = Number(item?.price || 0);

    return `${code}__${instruction}__${price}`;
  };

  const recentDisplayItems = useMemo(() => {
    if (loadedCartItems.length === 0) return [];

    const additionalQtyMap = additionalCartItems.reduce((acc, item) => {
      const key = buildCartMergeKey(item);
      acc[key] = (acc[key] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});

    const originalQtyByLineId = originalLoadedItems.reduce((acc, item) => {
      acc[item.lineId] = Number(item.quantity || 0);
      return acc;
    }, {});

    return loadedCartItems.map((item) => {
      const key = buildCartMergeKey(item);
      const additionalQty = Number(additionalQtyMap[key] || 0);
      const originalQuantity = Number(
        originalQtyByLineId[item.lineId] ?? item.quantity ?? 0,
      );

      return {
        ...item,
        sourceLineId: item.lineId,
        lineId: `recent-${key}`,
        mergedKey: key,
        quantity: Number(item.quantity || 0),
        currentQuantity: Number(item.quantity || 0),
        originalQuantity,
        additionalQuantity: additionalQty,
        hasAdditionalEntry: additionalQty > 0,
      };
    });
  }, [loadedCartItems, additionalCartItems, originalLoadedItems]);

  const visibleAdditionalCartItems = useMemo(
    () => additionalCartItems,
    [additionalCartItems],
  );

  const mergedCartItemsForSave = useMemo(() => {
    const mergedMap = new Map();

    cartSummaryItems.forEach((item) => {
      const key = buildCartMergeKey(item);
      const existing = mergedMap.get(key);

      if (existing) {
        existing.quantity += Number(item.quantity || 0);
        return;
      }

      mergedMap.set(key, {
        ...item,
        quantity: Number(item.quantity || 0),
      });
    });

    return Array.from(mergedMap.values());
  }, [cartSummaryItems]);

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

  const syncCartState = (updater) => {
    setproductcart((prev) => ({
      ...prev,
      items: updater(prev.items),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: updater(prev.items),
    }));
  };

  const addOrUpdateRecentProxyItem = (proxyItem, delta = 1) => {
    const mergedKey = proxyItem?.mergedKey || buildCartMergeKey(proxyItem);

    syncCartState((items) => {
      const nextItems = [...items];
      const additionalIndex = nextItems.findIndex(
        (entry) =>
          entry.isLoadedFromDB !== true &&
          buildCartMergeKey(entry) === mergedKey,
      );

      if (additionalIndex >= 0) {
        nextItems[additionalIndex] = {
          ...nextItems[additionalIndex],
          quantity: Math.max(
            1,
            Number(nextItems[additionalIndex].quantity || 0) + delta,
          ),
        };

        return nextItems;
      }

      nextItems.push({
        ...proxyItem,
        lineId: makeLineId("new"),
        quantity: Math.max(1, delta),
        isLoadedFromDB: false,
      });

      return nextItems;
    });
  };

  const restoreLoadedQuantityByCode = (
    items,
    productCode,
    qtyToRestore = 1,
  ) => {
    let remaining = Math.max(0, Number(qtyToRestore || 0));
    if (remaining <= 0) {
      return { items, restored: 0 };
    }

    const originalByLineId = originalLoadedItems.reduce((acc, item) => {
      acc[item.lineId] = Number(item.quantity || 0);
      return acc;
    }, {});

    const nextItems = items.map((entry) => ({ ...entry }));

    for (let i = 0; i < nextItems.length && remaining > 0; i += 1) {
      const entry = nextItems[i];
      if (entry.isLoadedFromDB !== true) continue;
      if (String(entry.code) !== String(productCode)) continue;

      const originalQty = Number(originalByLineId[entry.lineId] || 0);
      const currentQty = Number(entry.quantity || 0);
      const deficit = Math.max(0, originalQty - currentQty);
      if (deficit <= 0) continue;

      const restore = Math.min(deficit, remaining);
      entry.quantity = currentQty + restore;
      remaining -= restore;
    }

    return {
      items: nextItems,
      restored: Math.max(0, Number(qtyToRestore || 0) - remaining),
    };
  };

  const updateRecentDisplayQuantity = (lineId, delta, proxyItem) => {
    if (isCartFromDB || !proxyItem) return;

    const mergedKey = proxyItem?.mergedKey || buildCartMergeKey(proxyItem);

    if (delta > 0) {
      syncCartState((items) => {
        const restoredResult = restoreLoadedQuantityByCode(
          items,
          proxyItem.code,
          delta,
        );

        const remaining = Math.max(
          0,
          Number(delta || 0) - restoredResult.restored,
        );
        if (remaining <= 0) {
          return restoredResult.items;
        }

        const nextItems = [...restoredResult.items];
        const additionalIndex = nextItems.findIndex(
          (entry) =>
            entry.isLoadedFromDB !== true &&
            buildCartMergeKey(entry) === mergedKey,
        );

        if (additionalIndex >= 0) {
          nextItems[additionalIndex] = {
            ...nextItems[additionalIndex],
            quantity:
              Number(nextItems[additionalIndex].quantity || 0) + remaining,
          };
          return nextItems;
        }

        nextItems.push({
          ...proxyItem,
          lineId: makeLineId("new"),
          quantity: remaining,
          isLoadedFromDB: false,
        });

        return nextItems;
      });
      return;
    }

    let remaining = Math.abs(delta);

    syncCartState((items) => {
      const nextItems = items.map((entry) => ({ ...entry }));

      for (let i = 0; i < nextItems.length && remaining > 0; i += 1) {
        const entry = nextItems[i];
        if (entry.isLoadedFromDB === true) continue;
        if (buildCartMergeKey(entry) !== mergedKey) continue;

        const currentQty = Number(entry.quantity || 0);
        const deduct = Math.min(currentQty, remaining);
        entry.quantity = currentQty - deduct;
        remaining -= deduct;
      }

      for (let i = 0; i < nextItems.length && remaining > 0; i += 1) {
        const entry = nextItems[i];
        if (entry.isLoadedFromDB !== true) continue;
        if (buildCartMergeKey(entry) !== mergedKey) continue;

        const currentQty = Number(entry.quantity || 0);
        const deduct = Math.min(currentQty, remaining);
        entry.quantity = currentQty - deduct;
        remaining -= deduct;
      }

      return nextItems.filter((entry) => Number(entry.quantity || 0) > 0);
    });
  };

  const removeRecentDisplayItem = (lineId, proxyItem) => {
    if (isCartFromDB || !proxyItem) return;

    const sourceLineId = String(proxyItem?.sourceLineId || "").trim();
    const mergedKey = proxyItem?.mergedKey || buildCartMergeKey(proxyItem);

    syncCartState((items) =>
      items.filter((entry) => {
        if (entry.isLoadedFromDB !== true) return true;

        if (sourceLineId) {
          return String(entry.lineId || "") !== sourceLineId;
        }

        return buildCartMergeKey(entry) !== mergedKey;
      }),
    );
  };

  const requestRemoveItem = (lineId, item = null) => {
    setItemToDelete({ lineId, item });
    setShowDeleteItemModal(true);
  };

  const confirmRemoveItem = () => {
    if (!itemToDelete?.lineId) return;

    if (String(itemToDelete.lineId).startsWith("recent-")) {
      removeRecentDisplayItem(itemToDelete.lineId, itemToDelete.item);
    } else {
      removeItem(itemToDelete.lineId);
    }

    setItemToDelete(null);
    setShowDeleteItemModal(false);
  };

  const cancelRemoveItem = () => {
    setItemToDelete(null);
    setShowDeleteItemModal(false);
  };

  const addToCart = (product) => {
    syncCartState((items) => {
      const restoredResult = restoreLoadedQuantityByCode(
        items,
        product.product_id,
        1,
      );

      if (restoredResult.restored >= 1) {
        return restoredResult.items;
      }

      const nextItems = [...restoredResult.items];
      const existing = nextItems.find(
        (i) => i.code === product.product_id && i.isLoadedFromDB !== true,
      );

      if (existing) {
        return nextItems.map((i) =>
          i.code === product.product_id && i.isLoadedFromDB !== true
            ? { ...i, quantity: Number(i.quantity || 0) + 1 }
            : i,
        );
      }

      nextItems.push({
        lineId: makeLineId("new"),
        code: product.product_id,
        name: product.item_name,
        price: Number(product.selling_price) || 0,
        unit_cost: Number(product.unit_cost) || 0,
        quantity: 1,
        isDiscountable: product.isDiscountable,
        itemInstruction: "",
        vatable: product.vatable,
        item_category: product.item_category || "",
        isLoadedFromDB: false,
      });

      return nextItems;
    });
  };

  const updateQuantityByInput = (lineId, value) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.lineId === lineId && i.isLoadedFromDB !== true
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
        i.lineId === lineId && i.isLoadedFromDB !== true
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

  const updateQuantity = (lineId, delta) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items
        .map((i) =>
          i.lineId === lineId && i.isLoadedFromDB !== true
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
          i.lineId === lineId && i.isLoadedFromDB !== true
            ? {
                ...i,
                quantity: Math.max(1, Number(i.quantity || 1) + delta),
              }
            : i,
        )
        .filter((i) => Number(i.quantity) > 0),
    }));
  };

  const removeItem = (lineId) => {
    if (isCartFromDB) return;

    setproductcart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.lineId !== lineId),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.lineId !== lineId),
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
        item.lineId === selectedInstructionItem.lineId &&
        item.isLoadedFromDB !== true
          ? { ...item, itemInstruction: itemInstructionText }
          : item,
      ),
    }));

    setcartforqr((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.lineId === selectedInstructionItem.lineId &&
        item.isLoadedFromDB !== true
          ? { ...item, itemInstruction: itemInstructionText }
          : item,
      ),
    }));

    setShowItemInstructionModal(false);
    setSelectedInstructionItem(null);
    setItemInstructionText("");
  };

  const buildShortQrValue = () => {
    const refTx = transactionId || `NEW-${Date.now()}`;
    const tableRef = tableselected || "NA";
    return `ORDER|TABLE:${tableRef}|TX:${refTx}`;
  };

  const handleGenerateQR = () => {
    const sourceItems = cartSummaryItems?.length
      ? cartSummaryItems
      : productcart.items;

    if (!sourceItems || sourceItems.length === 0) {
      alert("Cart is empty");
      return;
    }

    const shortQr = buildShortQrValue();

    setQrValue(shortQr);
    setShowqrModal(true);
  };

  const openBillingModal = () => {
    if (!apiHost || !tableselected) return;

    setShowBillingModal(true);
    setBillingTab("pending");
    setBillingLoading(true);

    const params = new URLSearchParams({
      date: dateSelected,
      table_number: tableselected,
    });

    const url = `${apiHost}/api/transactio_per_table.php?${params.toString()}`;

    console.log("tableselected:", tableselected);
    console.log("billing url:", url);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction");
        return res.json();
      })
      .then((data) => {
        setBillingData(Array.isArray(data) ? data : data.data || []);
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
      category_code: transaction.Category_Code || transaction.category_code,
      unit_code: transaction.Unit_Code || transaction.unit_code || "",

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
      const finalTransaction = {
        ...item,
        billing_no: billingResult.billing_no,
        invoice_no: billingResult.invoice_no,
      };

      setBillingDetailedProduct(detailedItems);
      setBillingSelectedTransaction(finalTransaction);

      await handleBillingPrintElectron(finalTransaction, detailedItems);
    } catch (error) {
      console.error("Billing transaction click error:", error);
      alert(error.message || "Failed to process billing.");
    }
  };
  const selectedTypeObj = salesTypeList.find(
    (item) => String(item.sales_type_id) === String(selectedSalesType),
  );

  const orderTypeName = selectedTypeObj
    ? selectedTypeObj.sales_type || selectedTypeObj.description
    : "DINE IN";

  const saveOrderToServer = async () => {
    if (productcart.items.length === 0) {
      alert("Cart is empty");
      return { ok: false };
    }

    try {
      const now = new Date();
      const formData = new FormData();
      const txId = transactionId || Date.now();

      const loggedUserId =
        localStorage.getItem("userId") ||
        sessionStorage.getItem("userId") ||
        "0";

      formData.append("transaction_id", txId);
      formData.append("Category_Code", category_code);
      formData.append("Unit_Code", unit_code);
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
      formData.append(
        "terminal_number",
        localStorage.getItem("posTerminalNumber"),
      );
      formData.append("order_slip_no", txId);
      formData.append("table_number", tableselected);
      formData.append("order_type", orderTypeName);
      formData.append("customer_head_count", 1);
      formData.append("discount_type", "");
      formData.append("payment_method", "");
      formData.append("special_instructions", instructions || "");
      formData.append("cashier", userName);
      formData.append("user_id", userId);
      formData.append("user_name", email);
      formData.append("remarks", "Pending for Payment");
      formData.append("order_status", "Pending");
      formData.append("status", "Active");
      formData.append("void_date", "");
      formData.append("refund_date", "");

      formData.append(
        "cart_items",
        JSON.stringify(
          mergedCartItemsForSave.map((item) => ({
            product_id: item.code,
            sku: item.code,
            sales_quantity: item.quantity,
            landing_cost: 0,
            unit_cost: Number(item.unit_cost || 0),
            selling_price: Number(item.price || 0),
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
        transaction_id: result.transaction_id || txId,
      };
    } catch (error) {
      console.error(error);
      alert("Server error while saving order");
      return { ok: false };
    }
  };

  const [isConfirmingTransaction, setIsConfirmingTransaction] = useState(false);

  const confirmTransactionAndPrint = async () => {
    if (isConfirmingTransaction) return;

    if (additionalCartItems.length === 0) {
      alert("No additional items to print.");
      return;
    }

    try {
      setIsConfirmingTransaction(true);

      const result = await saveOrderToServer();
      if (!result.ok) return;

      setShowConfirmModal(false);
      setShowqrModal(false);

      await handlePrintAdditionalOrderElectron(result.transaction_id);
    } catch (error) {
      console.error("Confirm transaction error:", error);
    } finally {
      setIsConfirmingTransaction(false);
    }
  };

  const handlePrintOnly = async () => {
    if (isPrintingOnly) return;

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

    try {
      setIsPrintingOnly(true);
      setShowqrModal(false);
      setShowConfirmModal(false);

      await handlePrintAllElectron("duplicate");
    } finally {
      setIsPrintingOnly(false);
    }
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
    setShowqrModal(false);
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

  const seedCurrentMergeTables = () => {
    setSelectedMergeTables(buildUniqueTableNames(currentTableParts));
  };

  const loadTransferTables = async (mode = "fixed") => {
    if (!apiHost) return;

    try {
      setTransferLoading(true);
      setTransferTableList([]);

      if (mode === "transferItem") {
        const selectedDateValue =
          dateSelected ||
          sourceTransactionSummary?.transaction_date?.slice?.(0, 10) ||
          new Date().toISOString().slice(0, 10);

        const response = await fetch(
          `${apiHost}/api/table_list.php?date=${encodeURIComponent(selectedDateValue)}&onlyPending=true`,
        );
        const data = await response.json();
        const pendingTables = mapPendingTableRows(
          Array.isArray(data) ? data : [],
        );
        console.log("pendingTables from table_list.php", pendingTables, data);
        setTransferTableList(pendingTables);
        return;
      }

      const response = await fetch(`${apiHost}/api/master_table_list.php`);
      const data = await response.json();
      setTransferTableList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load transfer tables:", error);
      setTransferTableList([]);
    } finally {
      setTransferLoading(false);
    }
  };

  const resetTransferState = () => {
    setShowTransferModal(false);
    setTransferSearch("");
    setSelectedTransferTable("");
    setSelectedMergeTables([]);
    setCustomTransferTableName("");
    setCustomMergeTableName("");
    setTransferTableList([]);
    setTransferLoading(false);
    setShowTransferConfirmModal(false);
    setIsTransferringTable(false);
    setTransferMode("fixed");
  };

  const openTransferModal = async () => {
    if (!apiHost) return;

    setTransferLoading(true);
    setShowTransferModal(true);
    setTransferSearch("");
    setSelectedTransferTable("");
    setSelectedMergeTables(buildUniqueTableNames(currentTableParts));
    setCustomTransferTableName("");
    setCustomMergeTableName("");
    setTransferMode("fixed");

    await loadTransferTables("fixed");
  };

  useEffect(() => {
    if (!showTransferModal || !apiHost) return;
    loadTransferTables(transferMode);
  }, [showTransferModal, transferMode, apiHost]);

  useEffect(() => {
    if (
      !showTransferModal ||
      transferMode !== "transferItem" ||
      !selectedTransferTableRow?.pending_transaction_id ||
      !apiHost
    ) {
      setDestinationTransferSummary(null);
      setDestinationTransferItems([]);
      setDestinationTransferLoading(false);
      return;
    }

    let isMounted = true;

    const fetchDestinationPreview = async () => {
      try {
        setDestinationTransferLoading(true);

        const response = await fetch(
          `${apiHost}/api/view_table_transaction.php?transaction_id=${encodeURIComponent(
            selectedTransferTableRow.pending_transaction_id,
          )}`,
        );

        if (!response.ok) {
          throw new Error("Failed to load destination table order.");
        }

        const data = await response.json();

        if (!isMounted) return;

        setDestinationTransferSummary(data?.summary || null);
        setDestinationTransferItems(
          Array.isArray(data?.order_details) ? data.order_details : [],
        );
      } catch (error) {
        console.error("Failed to load destination transfer preview:", error);
        if (!isMounted) return;
        setDestinationTransferSummary(null);
        setDestinationTransferItems([]);
      } finally {
        if (isMounted) {
          setDestinationTransferLoading(false);
        }
      }
    };

    fetchDestinationPreview();

    return () => {
      isMounted = false;
    };
  }, [showTransferModal, transferMode, selectedTransferTableRow, apiHost]);

  const requestTransferConfirm = () => {
    if (!transactionId) {
      alert("No transaction selected.");
      return;
    }

    if (transferMode === "fixed") {
      if (!(customTransferTableName.trim() || selectedTransferTable)) {
        alert("Please select a fixed table or type a custom table name.");
        return;
      }
    }

    if (transferMode === "merge") {
      const mergedTables = buildUniqueTableNames([
        ...selectedMergeTables,
        customMergeTableName,
      ]);

      if (mergedTables.length === 0) {
        alert(
          "Please select at least one table to merge or type a custom table name.",
        );
        return;
      }
    }

    if (transferMode === "transferItem") {
      if (!selectedTransferTable) {
        alert("Please select a pending table.");
        return;
      }

      if (!selectedTransferTableRow?.pending_transaction_id) {
        alert(
          "The selected pending table does not have a valid transaction id.",
        );
        return;
      }

      if (selectedTransferProductTotalQty <= 0) {
        alert("Please select at least one product quantity to transfer.");
        return;
      }

      if (remainingTransferProductTotalQty <= 0) {
        alert("At least one product must remain on the current table.");
        return;
      }
    }

    setShowTransferConfirmModal(true);
  };

  const toggleMergeTableSelection = (tableName) => {
    const normalizedIncoming = normalizeTableName(tableName);

    setSelectedMergeTables((prev) => {
      const exists = prev.some(
        (item) => normalizeTableName(item) === normalizedIncoming,
      );

      if (exists) {
        return prev.filter(
          (item) => normalizeTableName(item) !== normalizedIncoming,
        );
      }

      return buildUniqueTableNames([...prev, tableName]);
    });
  };

  const mergeTablePreview = useMemo(() => {
    const merged = buildUniqueTableNames([
      ...selectedMergeTables,
      customMergeTableName,
    ]);

    return merged.length ? merged.join(" & ") : "None";
  }, [selectedMergeTables, customMergeTableName]);

  const handleTransferProductQtyChange = (item, nextValue) => {
    const safeMax = Number(item?.quantity || 0);
    const numericValue = Number(String(nextValue || "").replace(/[^\d]/g, ""));
    const safeValue = Number.isFinite(numericValue)
      ? Math.min(safeMax, Math.max(0, numericValue))
      : 0;

    setTransferItemSelections((prev) => ({
      ...prev,
      [item.transferKey]: safeValue,
    }));
  };

  const buildTransferMergeKey = (item) => {
    const code = String(item?.product_id || item?.code || "")
      .trim()
      .toLowerCase();
    const instruction = String(
      item?.item_instruction || item?.itemInstruction || "",
    )
      .trim()
      .toLowerCase();
    const price = Number(item?.selling_price ?? item?.price ?? 0);

    return `${code}__${instruction}__${price}`;
  };

  const mergeTransferOrderItems = (items = []) => {
    const mergedMap = new Map();

    items.forEach((item) => {
      const key = buildTransferMergeKey(item);
      const existing = mergedMap.get(key);
      const quantity = Number(item?.sales_quantity ?? item?.quantity ?? 0);

      if (quantity <= 0) return;

      if (existing) {
        existing.sales_quantity += quantity;
        return;
      }

      mergedMap.set(key, {
        product_id: item?.product_id || item?.code || "",
        sku: item?.sku || item?.product_id || item?.code || "",
        sales_quantity: quantity,
        landing_cost: Number(item?.landing_cost || 0),
        unit_cost: Number(item?.unit_cost || 0),
        selling_price: Number(item?.selling_price ?? item?.price ?? 0),
        vatable: item?.vatable || "Yes",
        isDiscountable: item?.isDiscountable,
        order_status: item?.order_status || "ACTIVE",
        item_instruction: item?.item_instruction || item?.itemInstruction || "",
      });
    });

    return Array.from(mergedMap.values());
  };

  const transferProductTransaction = async ({
    source_transaction_id,
    source_table_number,
    destination_transaction_id,
    destination_table_number,
    source_items,
    destination_items,
    source_summary,
    destination_summary,
  }) => {
    const formData = new FormData();

    formData.append("Category_Code", "Crab & Crack");
    formData.append("Unit_Code", unit_code);

    formData.append("source_transaction_id", source_transaction_id);
    formData.append("source_table_number", source_table_number || "");

    formData.append("destination_transaction_id", destination_transaction_id);
    formData.append("destination_table_number", destination_table_number || "");

    formData.append(
      "transaction_date",
      dateSelected ||
        source_summary?.transaction_date ||
        destination_summary?.transaction_date ||
        "",
    );

    formData.append(
      "source_order_type",
      source_summary?.order_type ||
        selectedSalesTypeObject?.sales_type ||
        selectedSalesTypeObject?.description ||
        selectedSalesType ||
        "DINE IN",
    );

    formData.append(
      "destination_order_type",
      destination_summary?.order_type ||
        selectedSalesTypeObject?.sales_type ||
        selectedSalesTypeObject?.description ||
        selectedSalesType ||
        "DINE IN",
    );

    formData.append(
      "source_terminal_number",
      localStorage.getItem("posTerminalNumber") || "1",
    );
    formData.append(
      "destination_terminal_number",
      localStorage.getItem("posTerminalNumber") || "1",
    );

    formData.append(
      "source_special_instructions",
      source_summary?.special_instructions ||
        source_summary?.instructions ||
        instructions ||
        "",
    );

    formData.append(
      "destination_special_instructions",
      destination_summary?.special_instructions ||
        destination_summary?.instructions ||
        "",
    );

    formData.append("cashier", userName);
    formData.append("user_id", userId);
    formData.append("user_name", email);

    formData.append(
      "source_items",
      JSON.stringify(mergeTransferOrderItems(source_items)),
    );
    formData.append(
      "destination_items",
      JSON.stringify(mergeTransferOrderItems(destination_items)),
    );

    const response = await fetch(`${apiHost}/api/transfer_product.php`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || result?.status !== "success") {
      throw new Error(result?.message || "Failed to transfer products.");
    }

    return result;
  };

  const handleConfirmTransferTable = async () => {
    if (isTransferringTable) return;
    if (!apiHost || !transactionId) return;

    try {
      setIsTransferringTable(true);

      if (transferMode === "transferItem") {
        const destinationTxId =
          selectedTransferTableRow?.pending_transaction_id;
        const destinationTableName = getTransferTableName(
          selectedTransferTableRow,
        );

        if (!destinationTxId || !destinationTableName) {
          throw new Error("Please select a valid pending table.");
        }

        const sourceSelectedItems = [];
        const sourceRemainingItems = [];

        transferProductItems.forEach((item) => {
          const selectedQty = Math.min(
            Number(item.quantity || 0),
            Number(transferItemSelections[item.transferKey] || 0),
          );
          const remainingQty = Math.max(
            0,
            Number(item.quantity || 0) - selectedQty,
          );

          if (selectedQty > 0) {
            sourceSelectedItems.push({
              product_id: item.code,
              sku: item.code,
              sales_quantity: selectedQty,
              landing_cost: 0,
              unit_cost: Number(item.unit_cost || 0),
              selling_price: Number(item.price || 0),
              vatable: item.vatable || "Yes",
              isDiscountable: item.isDiscountable,
              order_status: "ACTIVE",
              item_instruction: item.itemInstruction || "",
            });
          }

          if (remainingQty > 0) {
            sourceRemainingItems.push({
              product_id: item.code,
              sku: item.code,
              sales_quantity: remainingQty,
              landing_cost: 0,
              unit_cost: Number(item.unit_cost || 0),
              selling_price: Number(item.price || 0),
              vatable: item.vatable || "Yes",
              isDiscountable: item.isDiscountable,
              order_status: "ACTIVE",
              item_instruction: item.itemInstruction || "",
            });
          }
        });

        if (sourceSelectedItems.length === 0) {
          throw new Error("Please select at least one product to transfer.");
        }

        if (sourceRemainingItems.length === 0) {
          throw new Error(
            "At least one product must remain on the current table.",
          );
        }

        const destinationResponse = await fetch(
          `${apiHost}/api/view_table_transaction.php?transaction_id=${encodeURIComponent(destinationTxId)}`,
        );

        if (!destinationResponse.ok) {
          throw new Error("Failed to load destination table order.");
        }

        const destinationData = await destinationResponse.json();
        const destinationItems = Array.isArray(destinationData?.order_details)
          ? destinationData.order_details
          : [];

        const mergedDestinationItems = mergeTransferOrderItems([
          ...destinationItems,
          ...sourceSelectedItems,
        ]);

        await transferProductTransaction({
          source_transaction_id: transactionId,
          source_table_number: tableselected,
          destination_transaction_id: destinationTxId,
          destination_table_number: destinationTableName,
          source_items: sourceRemainingItems,
          destination_items: mergedDestinationItems,
          source_summary: sourceTransactionSummary || {},
          destination_summary:
            destinationData?.summary || destinationTransferSummary || {},
        });

        setShowTransferConfirmModal(false);
        setShowTransferModal(false);
        setSaveSuccessMessage(
          `Selected products transferred from ${tableselected} to ${destinationTableName}.`,
        );
        setShowSaveSuccessModal(true);

        setTimeout(() => {
          setshoworderlist(false);
        }, 1200);

        return;
      }

      let finalTableValue = "";
      let finalRemarks = "";
      let finalTransactionType = "";

      if (transferMode === "fixed") {
        finalTableValue =
          customTransferTableName.trim() || selectedTransferTable;
        finalRemarks = `Transferred from table ${tableselected} to ${finalTableValue}`;
        finalTransactionType = "TRANSFER TABLE";
      } else if (transferMode === "merge") {
        finalTableValue = buildUniqueTableNames([
          ...selectedMergeTables,
          customMergeTableName,
        ]).join(" & ");
        finalRemarks = `Merged table ${tableselected} to ${finalTableValue}`;
        finalTransactionType = "MERGE TABLE";
      }

      if (!finalTableValue) {
        throw new Error("Invalid transfer table.");
      }

      const formData = new FormData();

      formData.append("Category_Code", category_code);
      formData.append("Unit_Code", unit_code);
      formData.append("transaction_id", transactionId);
      formData.append("old_table_number", tableselected || "");
      formData.append("new_table_number", finalTableValue);
      formData.append("remarks", finalRemarks);
      formData.append("cashier", userName);
      formData.append("transaction_date", dateSelected || "");
      formData.append(
        "terminal_number",
        localStorage.getItem("posTerminalNumber"),
      );
      formData.append("order_slip_no", transactionId);
      formData.append("transaction_type", finalTransactionType);
      formData.append("user_id", userId);
      formData.append("user_name", email);

      const response = await fetch(`${apiHost}/api/transfer_table.php`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result?.status !== "success") {
        throw new Error(result?.message || "Failed to process table action.");
      }

      setShowTransferConfirmModal(false);
      setShowTransferModal(false);

      setSaveSuccessMessage(
        transferMode === "merge"
          ? `Table merged successfully: ${finalTableValue}`
          : `Table transferred from ${tableselected} to ${finalTableValue}.`,
      );

      setShowSaveSuccessModal(true);

      setTimeout(() => {
        setshoworderlist(false);
      }, 1200);
    } catch (error) {
      console.error("Table action error:", error);
      alert(error.message || "Failed to process table action.");
    } finally {
      setIsTransferringTable(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`fixed inset-0 z-[100] flex items-center justify-center p-0 backdrop-blur-xl sm:p-4 ${
          isDark ? "bg-slate-950/80" : "bg-slate-200/70"
        }`}
      >
        <div
          className={`flex h-full w-full max-w-7xl flex-col overflow-hidden shadow-2xl transition-colors sm:rounded-3xl ${
            isDark
              ? "border border-white/10 bg-slate-900/50"
              : "border border-slate-200 bg-white"
          }`}
        >
          <div
            className={`flex items-center justify-between px-6 py-4 transition-colors ${
              isDark
                ? "border-b border-white/5 bg-white/5"
                : "border-b border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMobileCats(!showMobileCats)}
                className={`rounded-xl p-3 transition-colors md:hidden ${
                  isDark
                    ? "bg-slate-800 text-blue-400"
                    : "bg-slate-100 text-blue-600"
                }`}
              >
                <FaFilter />
              </button>

              <div className="flex items-center justify-between gap-4">
                {/* Left Side: Table Info */}
                <div>
                  <h2
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    <span
                      className="text-blue-500"
                      style={{
                        color: "var(--app-accent)",
                      }}
                    >
                      {tableselected || "Select Table"}
                    </span>
                  </h2>
                  <p
                    className={`text-xs uppercase tracking-widest ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Digital Menu
                  </p>
                </div>

                {/* Right Side: Transfer Table Action */}
                {transactionId && loadedCartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={openTransferModal}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200 ${
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600"
                    }`}
                    title="Manage Table"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      <path d="M16 3L21 8L16 13" />
                      <path d="M21 8H9C6.23858 8 4 10.2386 4 13V19" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Manage Table
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {transactionId && (
                <button
                  onClick={openBillingModal}
                  className="flex items-center gap-2 rounded-xl  px-4 py-2 text-sm font-semibold text-gray-100 "
                  style={{
                    backgroundColor: "var(--app-accent)",
                    boxShadow: "0 12px 28px var(--app-accent-glow)",
                  }}
                >
                  <FaReceipt /> View Billing
                </button>
              )}

              <button
                onClick={() => setshoworderlist(false)}
                className={`rounded-full p-2 transition-colors ${
                  isDark
                    ? "text-slate-400 hover:bg-white/10"
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <IoMdClose size={28} />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1">
            <aside
              className={`no-scrollbar absolute z-20 h-full min-h-0 w-64 overflow-auto transition-transform duration-300 md:relative ${
                showMobileCats
                  ? "translate-x-0"
                  : "-translate-x-full md:translate-x-0"
              } ${
                isDark
                  ? "border-r border-white/5 bg-slate-900"
                  : "border-r border-slate-200 bg-white"
              }`}
            >
              <div className="mb-2 px-4 pt-4">
                <label
                  className={`mb-2 block px-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Service Type
                </label>

                <div className="group relative">
                  <select
                    value={selectedSalesType}
                    onChange={(e) => setSelectedSalesType(e.target.value)}
                    className={`w-full cursor-pointer appearance-none rounded-2xl py-3.5 pl-5 pr-12 text-sm font-semibold outline-none transition-all duration-300 ${
                      isDark
                        ? "border border-slate-700 bg-slate-800/40 text-white focus:border-blue-500/50 focus:bg-slate-800/60"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm focus:border-blue-400 focus:shadow-md"
                    }`}
                  >
                    <option value="" disabled>
                      Choose Sales Type...
                    </option>
                    {salesTypeList.map((item) => (
                      <option
                        key={item.sales_type_id}
                        value={String(item.sales_type_id)}
                        className={
                          isDark
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-900"
                        }
                      >
                        {item.sales_type || item.description}
                      </option>
                    ))}
                  </select>

                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-transform group-focus-within:rotate-180">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={isDark ? "text-slate-500" : "text-slate-400"}
                    >
                      <path
                        d="M2.5 4.5L6 8L9.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {isDark && (
                    <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 blur transition duration-500 group-hover:opacity-100" />
                  )}
                </div>
              </div>

              <div className="flex h-full flex-col p-4">
                <h3
                  className={`mb-4 px-2 text-[10px] font-bold uppercase tracking-widest ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Menu Sections
                </h3>

                <div className="no-scrollbar flex-1 overflow-y-auto space-y-2">
                  {categorylist.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setselectcategory(cat.item_category);
                        setShowMobileCats(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all `}
                      style={{
                        backgroundColor:
                          selectcategory === cat.item_category
                            ? "var(--app-accent)"
                            : "transparent",
                        color:
                          selectcategory === cat.item_category
                            ? "#ffffff"
                            : "var(--app-text)",
                        boxShadow:
                          selectcategory === cat.item_category
                            ? "0 12px 28px var(--app-accent-glow)"
                            : "none",
                      }}
                    >
                      <span>{getCategoryIcon(cat.item_category)}</span>
                      {cat.item_category}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main
              className={`flex min-h-0 min-w-0 flex-1 flex-col transition-colors ${
                isDark ? "bg-slate-900/20" : "bg-slate-50"
              }`}
            >
              <div className="shrink-0 p-4">
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
                    className={`w-full rounded-2xl border py-3 pl-12 pr-4 outline-none transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-800/40 text-white focus:border-blue-500/50"
                        : "border-slate-300 bg-white text-slate-900 focus:border-blue-400"
                    }`}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((p, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ y: -6, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(p)}
                      className="group relative overflow-hidden rounded-[28px] border text-left transition-all duration-300"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-surface)",
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{
                          background:
                            "linear-gradient(to right, transparent, var(--app-accent), transparent)",
                        }}
                      />

                      <div className="relative flex min-h-[145px] flex-col justify-between p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h4
                            className="max-w-[calc(100%-56px)] break-words text-[15px] font-black leading-snug"
                            style={{ color: "var(--app-text)" }}
                          >
                            {p.item_name}
                          </h4>

                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all group-hover:text-white"
                            style={{
                              backgroundColor: "var(--app-surface-soft)",
                              color: "var(--app-accent)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--app-accent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--app-surface-soft)";
                            }}
                          >
                            <FaPlus size={13} />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <div className="text-right">
                            <div
                              className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Price
                            </div>
                            <div
                              className="text-[22px] font-black"
                              style={{ color: "var(--app-accent)" }}
                            >
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
              className="relative hidden min-h-0 w-80 flex-col overflow-hidden transition-colors lg:flex"
              style={{
                borderLeft: "1px solid var(--app-border)",
                backgroundColor: "var(--app-surface-soft)",
              }}
            >
              <div
                className="flex items-center gap-2 border-b p-6 font-bold transition-colors"
                style={{
                  borderColor: "var(--app-border)",
                  color: "var(--app-text)",
                }}
              >
                <FaShoppingCart style={{ color: "var(--app-accent)" }} /> Cart
                Summary
                {isCartFromDB && (
                  <span className="ml-auto rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] text-green-400">
                    Loaded Order
                  </span>
                )}
              </div>

              <button
                onClick={() => setSummaryCart(true)}
                className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-100"
                style={{
                  background:
                    "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                  boxShadow: "0 12px 28px var(--app-accent-glow)",
                }}
              >
                <FaReceipt /> View Full Summary
              </button>

              <div className="absolute right-4 top-[10px] z-20 flex flex-row items-center gap-2">
                <button
                  onClick={() => setShowDesktopCartActions((prev) => !prev)}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-gray-100 transition"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                    boxShadow: "0 12px 28px var(--app-accent-glow)",
                  }}
                >
                  Save
                </button>

                {canPrintOnly && (
                  <ButtonComponent
                    onClick={handlePrintOnly}
                    variant="warning"
                    icon={<FiPrinter size={16} />}
                    fullWidth={false}
                    isLoading={isPrintingOnly}
                    disabled={isPrintingOnly}
                    loadingText=""
                    className="mt-3 mb-0 h-10 min-w-[44px] rounded-xl px-4 text-sm"
                  ></ButtonComponent>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                {visibleAdditionalCartItems.length > 0 && (
                  <div
                    className="border-t p-4 pt-2"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-500">
                      New Items
                    </h4>
                    <CartList
                      items={visibleAdditionalCartItems}
                      updateQuantity={updateQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={requestRemoveItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                    />
                  </div>
                )}

                {loadedCartItems.length > 0 && (
                  <div className="p-4 pb-2">
                    <h4
                      className="mb-3 text-xs font-bold uppercase tracking-widest"
                      style={{ color: "var(--app-muted-text)" }}
                    >
                      Recent Orders
                    </h4>
                    <CartList
                      items={recentDisplayItems}
                      updateQuantity={updateRecentDisplayQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={requestRemoveItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                      showInstructionButton={false}
                    />
                  </div>
                )}

                {loadedCartItems.length === 0 &&
                  visibleAdditionalCartItems.length === 0 && (
                    <CartList
                      items={[]}
                      updateQuantity={updateQuantity}
                      updateQuantityByInput={updateQuantityByInput}
                      removeItem={removeItem}
                      readOnly={false}
                      openItemInstructionModal={openItemInstructionModal}
                    />
                  )}
              </div>

              <AnimatePresence>
                {showDeleteItemModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[370] flex items-center justify-center p-4"
                    style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 10 }}
                      className="w-full max-w-sm rounded-3xl border p-8 text-center shadow-2xl transition-colors"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-surface)",
                        color: "var(--app-text)",
                      }}
                    >
                      <h3 className="mb-2 text-xl font-black">Remove Item?</h3>

                      <p
                        className="mb-6 text-sm"
                        style={{ color: "var(--app-muted-text)" }}
                      >
                        Are you sure you want to delete this item from the cart?
                      </p>

                      <div className="flex gap-3">
                        <button
                          onClick={confirmRemoveItem}
                          className="flex-1 rounded-2xl bg-red-600 py-3 font-bold text-white hover:bg-red-500"
                        >
                          Yes
                        </button>

                        <button
                          onClick={cancelRemoveItem}
                          className="flex-1 rounded-2xl py-3 font-bold transition-colors"
                          style={{
                            backgroundColor: "var(--app-surface-soft)",
                            color: "var(--app-text)",
                            border: "1px solid var(--app-border)",
                          }}
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
                    className="absolute inset-y-0 right-0 z-20 flex w-[88%] max-w-[320px] flex-col border-l p-5 shadow-2xl backdrop-blur-xl transition-colors"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-surface)",
                    }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className="text-lg font-black"
                        style={{ color: "var(--app-text)" }}
                      >
                        Cart Actions
                      </h3>

                      <button
                        onClick={() => setShowDesktopCartActions(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                        style={{
                          backgroundColor: "var(--app-surface-soft)",
                          color: "var(--app-text)",
                          border: "1px solid var(--app-border)",
                        }}
                      >
                        <FiX size={16} />
                      </button>
                    </div>

                    <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
                      <div
                        className="rounded-2xl border p-4 transition-colors"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-surface-soft)",
                        }}
                      >
                        <div
                          className="flex items-center justify-between text-xl font-black"
                          style={{ color: "var(--app-text)" }}
                        >
                          <span>Total</span>
                          <span style={{ color: "var(--app-accent)" }}>
                            ₱{totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--app-muted-text)" }}
                        >
                          {totalItems} item{totalItems !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div
                        className="rounded-2xl border p-3 transition-colors"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-surface-soft)",
                        }}
                      >
                        <label
                          className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: "var(--app-muted-text)" }}
                        >
                          Printer
                        </label>

                        <select
                          value={printerName}
                          onChange={(e) => setPrinterName(e.target.value)}
                          className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                          style={{
                            border: "1px solid var(--app-border)",
                            backgroundColor: "var(--app-surface)",
                            color: "var(--app-text)",
                          }}
                        >
                          <option value="">Default Printer</option>
                          {printers.map((printer) => (
                            <option key={printer.name} value={printer.name}>
                              {printer.displayName || printer.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div
                      className="space-y-3 border-t pt-4"
                      style={{ borderColor: "var(--app-border)" }}
                    >
                      <button
                        onClick={handleGenerateQR}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold text-white shadow-xl"
                        style={{
                          background:
                            "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                          boxShadow: "0 12px 28px var(--app-accent-glow)",
                        }}
                      >
                        <IoQrCode size={20} /> Confirm Order
                      </button>

                      <button
                        onClick={requestClearCart}
                        disabled={isCartFromDB}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-colors"
                        style={{
                          backgroundColor: isCartFromDB
                            ? "var(--app-surface-soft)"
                            : "var(--app-surface)",
                          color: isCartFromDB
                            ? "var(--app-muted-text)"
                            : "var(--app-text)",
                          border: "1px solid var(--app-border)",
                          opacity: isCartFromDB ? 0.6 : 1,
                        }}
                      >
                        <FaTrash size={16} /> Clear Cart
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showTransferModal && (
                  <motion.div
                    className="fixed inset-0 z-[500] flex items-center justify-center px-3 py-3 backdrop-blur-sm sm:px-4"
                    style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, y: 8 }}
                      className="w-full max-w-[820px] rounded-[1.5rem] border p-4 shadow-2xl sm:p-5"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-text)",
                      }}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-black sm:text-xl">
                            Transfer Table
                          </h2>
                          <p
                            className="text-xs sm:text-sm"
                            style={{ color: "var(--app-muted-text)" }}
                          >
                            Choose fixed table, merge tables, or type a special
                            table name.
                          </p>
                        </div>

                        <button
                          onClick={resetTransferState}
                          className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
                          style={{
                            backgroundColor: "var(--app-surface-soft)",
                            color: "var(--app-text)",
                            border: "1px solid var(--app-border)",
                          }}
                        >
                          <FiX size={16} />
                        </button>
                      </div>

                      <div
                        className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border p-1"
                        style={{
                          backgroundColor: "var(--app-surface-soft)",
                          borderColor: "var(--app-border)",
                        }}
                      >
                        <button
                          onClick={() => setTransferMode("fixed")}
                          className="rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                          style={{
                            backgroundColor:
                              transferMode === "fixed"
                                ? "var(--app-accent)"
                                : "transparent",
                            color:
                              transferMode === "fixed"
                                ? "#ffffff"
                                : "var(--app-muted-text)",
                          }}
                        >
                          Fixed Table
                        </button>

                        <button
                          onClick={() => {
                            setTransferMode("merge");
                            seedCurrentMergeTables();
                          }}
                          className="rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                          style={{
                            backgroundColor:
                              transferMode === "merge"
                                ? "var(--app-accent)"
                                : "transparent",
                            color:
                              transferMode === "merge"
                                ? "#ffffff"
                                : "var(--app-muted-text)",
                          }}
                        >
                          Merge Table
                        </button>

                        <button
                          onClick={() => {
                            setTransferMode("transferItem");
                            setSelectedTransferTable("");
                            setTransferSearch("");
                          }}
                          className="rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                          style={{
                            backgroundColor:
                              transferMode === "transferItem"
                                ? "var(--app-accent)"
                                : "transparent",
                            color:
                              transferMode === "transferItem"
                                ? "#ffffff"
                                : "var(--app-muted-text)",
                          }}
                        >
                          Transfer Product
                        </button>
                      </div>

                      {transferMode === "fixed" ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <FaSearch
                              className="absolute left-4 top-1/2 -translate-y-1/2"
                              style={{ color: "var(--app-muted-text)" }}
                            />
                            <input
                              type="text"
                              placeholder="Search fixed table..."
                              value={transferSearch}
                              onChange={(e) =>
                                setTransferSearch(e.target.value)
                              }
                              className="w-full rounded-xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                border: "1px solid var(--app-border)",
                                color: "var(--app-text)",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Select Fixed Table
                            </label>

                            <div
                              className="max-h-[200px] overflow-y-auto rounded-2xl border p-2"
                              style={{
                                borderColor: "var(--app-border)",
                                backgroundColor: "var(--app-surface-soft)",
                              }}
                            >
                              {transferTableList.filter((table) =>
                                String(table.table_name || "")
                                  .toLowerCase()
                                  .includes(transferSearch.toLowerCase()),
                              ).length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                  {transferTableList
                                    .filter((table) =>
                                      String(table.table_name || "")
                                        .toLowerCase()
                                        .includes(transferSearch.toLowerCase()),
                                    )
                                    .map((table) => {
                                      const tableName = table.table_name;
                                      const isSelected =
                                        String(selectedTransferTable) ===
                                        String(tableName);

                                      return (
                                        <button
                                          key={table.ID ?? tableName}
                                          type="button"
                                          onClick={() =>
                                            setSelectedTransferTable(tableName)
                                          }
                                          className="group relative rounded-xl border px-3 py-3 text-left shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                                          style={{
                                            backgroundColor: isSelected
                                              ? "color-mix(in srgb, var(--app-accent) 12%, transparent)"
                                              : "var(--app-surface)",
                                            borderColor: isSelected
                                              ? "var(--app-accent)"
                                              : "var(--app-border)",
                                            color: "var(--app-text)",
                                          }}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <p
                                                className="mb-1 text-[9px] font-black uppercase tracking-[0.2em]"
                                                style={{
                                                  color: isSelected
                                                    ? "var(--app-accent)"
                                                    : "var(--app-muted-text)",
                                                }}
                                              >
                                                Table
                                              </p>
                                              <p className="break-words text-sm font-extrabold leading-tight">
                                                {tableName}
                                              </p>
                                            </div>

                                            <div
                                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
                                              style={{
                                                backgroundColor: isSelected
                                                  ? "var(--app-accent)"
                                                  : "var(--app-surface-soft)",
                                                color: isSelected
                                                  ? "#ffffff"
                                                  : "var(--app-muted-text)",
                                              }}
                                            >
                                              {isSelected ? (
                                                <FaCheck size={9} />
                                              ) : (
                                                <span className="text-[9px] font-bold">
                                                  +
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                </div>
                              ) : (
                                <div
                                  className="rounded-xl px-4 py-5 text-center text-sm"
                                  style={{
                                    backgroundColor: "var(--app-surface)",
                                    color: "var(--app-muted-text)",
                                    border: "1px dashed var(--app-border)",
                                  }}
                                >
                                  No fixed table found.
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label
                              className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Or Type Custom / Special Table
                            </label>

                            <input
                              type="text"
                              placeholder="e.g. VIP Table, Function Hall"
                              value={customTransferTableName}
                              onChange={(e) =>
                                setCustomTransferTableName(e.target.value)
                              }
                              className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                border: "1px solid var(--app-border)",
                                color: "var(--app-text)",
                              }}
                            />
                          </div>

                          <div
                            className="rounded-2xl border px-4 py-4"
                            style={{
                              backgroundColor: "var(--app-surface-soft)",
                              borderColor: "var(--app-border)",
                            }}
                          >
                            <p
                              className="mb-2 text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Selected
                            </p>

                            <div
                              className="rounded-xl border px-4 py-3"
                              style={{
                                backgroundColor: "var(--app-surface)",
                                borderColor: "var(--app-border)",
                              }}
                            >
                              <p className="text-sm font-bold leading-relaxed sm:text-base">
                                {customTransferTableName.trim() ||
                                  selectedTransferTable ||
                                  "None"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : transferMode === "merge" ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <FaSearch
                              className="absolute left-4 top-1/2 -translate-y-1/2"
                              style={{ color: "var(--app-muted-text)" }}
                            />
                            <input
                              type="text"
                              placeholder="Search tables to merge..."
                              value={transferSearch}
                              onChange={(e) =>
                                setTransferSearch(e.target.value)
                              }
                              className="w-full rounded-xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                border: "1px solid var(--app-border)",
                                color: "var(--app-text)",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Select Tables To Merge
                            </label>

                            <div
                              className="max-h-[200px] overflow-y-auto rounded-2xl border p-2"
                              style={{
                                borderColor: "var(--app-border)",
                                backgroundColor: "var(--app-surface-soft)",
                              }}
                            >
                              {mergeSelectableTables.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                  {mergeSelectableTables.map((table) => {
                                    const tableName = table.table_name;
                                    const isSelected = selectedMergeTables.some(
                                      (item) =>
                                        normalizeTableName(item) ===
                                        normalizeTableName(tableName),
                                    );
                                    const isCurrentTable =
                                      currentTableParts.some(
                                        (item) =>
                                          normalizeTableName(item) ===
                                          normalizeTableName(tableName),
                                      );

                                    return (
                                      <button
                                        key={table.ID ?? tableName}
                                        type="button"
                                        onClick={() =>
                                          toggleMergeTableSelection(tableName)
                                        }
                                        className="group relative rounded-xl border px-3 py-3 text-left shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                                        style={{
                                          backgroundColor: isSelected
                                            ? "color-mix(in srgb, var(--app-accent) 12%, transparent)"
                                            : "var(--app-surface)",
                                          borderColor: isSelected
                                            ? "var(--app-accent)"
                                            : "var(--app-border)",
                                          color: "var(--app-text)",
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p
                                              className="mb-1 text-[9px] font-black uppercase tracking-[0.2em]"
                                              style={{
                                                color: isSelected
                                                  ? "var(--app-accent)"
                                                  : "var(--app-muted-text)",
                                              }}
                                            >
                                              {isCurrentTable
                                                ? "Current"
                                                : "Table"}
                                            </p>
                                            <p className="break-words text-sm font-extrabold leading-tight">
                                              {tableName}
                                            </p>
                                          </div>

                                          <div
                                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
                                            style={{
                                              backgroundColor: isSelected
                                                ? "var(--app-accent)"
                                                : "var(--app-surface-soft)",
                                              color: isSelected
                                                ? "#ffffff"
                                                : "var(--app-muted-text)",
                                            }}
                                          >
                                            {isSelected ? (
                                              <FaCheck size={9} />
                                            ) : (
                                              <span className="text-[9px] font-bold">
                                                +
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div
                                  className="rounded-xl px-4 py-5 text-center text-sm"
                                  style={{
                                    backgroundColor: "var(--app-surface)",
                                    color: "var(--app-muted-text)",
                                    border: "1px dashed var(--app-border)",
                                  }}
                                >
                                  No tables found.
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label
                              className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Add Custom / Special Table To Merge
                            </label>

                            <input
                              type="text"
                              placeholder="e.g. VIP Table, Function Hall"
                              value={customMergeTableName}
                              onChange={(e) =>
                                setCustomMergeTableName(e.target.value)
                              }
                              className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                border: "1px solid var(--app-border)",
                                color: "var(--app-text)",
                              }}
                            />
                          </div>

                          <div
                            className="rounded-2xl border px-4 py-4"
                            style={{
                              backgroundColor: "var(--app-surface-soft)",
                              borderColor: "var(--app-border)",
                            }}
                          >
                            <p
                              className="mb-2 text-[10px] font-black uppercase tracking-[0.25em]"
                              style={{ color: "var(--app-muted-text)" }}
                            >
                              Preview
                            </p>

                            <div
                              className="rounded-xl border px-4 py-3"
                              style={{
                                backgroundColor: "var(--app-surface)",
                                borderColor: "var(--app-border)",
                              }}
                            >
                              <p className="text-sm font-bold leading-relaxed sm:text-base">
                                {mergeTablePreview}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : transferMode === "transferItem" ? (
                        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.95fr]">
                          <div className="space-y-4">
                            <div
                              className="rounded-2xl border px-4 py-4"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                borderColor: "var(--app-border)",
                              }}
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p
                                    className="text-[10px] font-black uppercase tracking-[0.25em]"
                                    style={{ color: "var(--app-muted-text)" }}
                                  >
                                    Current Order
                                  </p>
                                  <p className="mt-1 text-sm font-bold">
                                    Select Product to move from {tableselected}
                                  </p>
                                </div>

                                <div
                                  className="rounded-xl border px-3 py-2 text-right"
                                  style={{
                                    backgroundColor: "var(--app-surface)",
                                    borderColor: "var(--app-border)",
                                  }}
                                >
                                  <p
                                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                                    style={{ color: "var(--app-muted-text)" }}
                                  >
                                    Selected
                                  </p>
                                  <p
                                    className="text-base font-black"
                                    style={{ color: "var(--app-accent)" }}
                                  >
                                    {selectedTransferProductTotalQty} item
                                    {selectedTransferProductTotalQty !== 1
                                      ? "s"
                                      : ""}
                                  </p>
                                  <p
                                    className="text-xs"
                                    style={{ color: "var(--app-muted-text)" }}
                                  >
                                    ₱
                                    {selectedTransferProductSubtotal.toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                                {transferProductItems.length > 0 ? (
                                  transferProductItems.map((item) => {
                                    const selectedQty = Math.min(
                                      Number(item.quantity || 0),
                                      Number(
                                        transferItemSelections[
                                          item.transferKey
                                        ] || 0,
                                      ),
                                    );
                                    const remainingQty = Math.max(
                                      0,
                                      Number(item.quantity || 0) - selectedQty,
                                    );

                                    return (
                                      <div
                                        key={item.transferKey}
                                        className="rounded-2xl border p-3"
                                        style={{
                                          backgroundColor: "var(--app-surface)",
                                          borderColor: "var(--app-border)",
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-extrabold">
                                              {item.name}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                                              <span
                                                className="rounded-full px-2 py-1"
                                                style={{
                                                  backgroundColor:
                                                    "var(--app-surface-soft)",
                                                  color:
                                                    "var(--app-muted-text)",
                                                }}
                                              >
                                                Qty:{" "}
                                                {Number(item.quantity || 0)}
                                              </span>
                                              <span
                                                className="rounded-full px-2 py-1"
                                                style={{
                                                  backgroundColor:
                                                    "var(--app-surface-soft)",
                                                  color:
                                                    "var(--app-muted-text)",
                                                }}
                                              >
                                                Remaining: {remainingQty}
                                              </span>
                                              {item.item_category ? (
                                                <span
                                                  className="rounded-full px-2 py-1"
                                                  style={{
                                                    backgroundColor:
                                                      "var(--app-surface-soft)",
                                                    color:
                                                      "var(--app-muted-text)",
                                                  }}
                                                >
                                                  {item.item_category}
                                                </span>
                                              ) : null}
                                            </div>
                                            {item.itemInstruction ? (
                                              <p
                                                className="mt-2 text-xs"
                                                style={{
                                                  color:
                                                    "var(--app-muted-text)",
                                                }}
                                              >
                                                Note: {item.itemInstruction}
                                              </p>
                                            ) : null}
                                          </div>

                                          <div className="w-[190px] shrink-0">
                                            <label
                                              className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em]"
                                              style={{
                                                color: "var(--app-muted-text)",
                                              }}
                                            >
                                              Transfer Qty
                                            </label>

                                            <div
                                              className="rounded-2xl border p-2"
                                              style={{
                                                borderColor:
                                                  "var(--app-border)",
                                                backgroundColor:
                                                  "var(--app-surface-soft)",
                                              }}
                                            >
                                              <div className="grid grid-cols-[50px_1fr_50px] gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentQty = Number(
                                                      transferItemSelections[
                                                        item.transferKey
                                                      ] || 0,
                                                    );
                                                    handleTransferProductQtyChange(
                                                      item,
                                                      Math.max(
                                                        0,
                                                        currentQty - 1,
                                                      ),
                                                    );
                                                  }}
                                                  className="flex h-14 items-center justify-center rounded-2xl text-3xl font-black transition active:scale-95"
                                                  style={{
                                                    backgroundColor:
                                                      "var(--app-surface)",
                                                    color: "var(--app-text)",
                                                    border:
                                                      "1px solid var(--app-border)",
                                                  }}
                                                >
                                                  −
                                                </button>

                                                <div
                                                  className="flex h-15 flex-col items-center justify-center rounded-2xl border"
                                                  style={{
                                                    backgroundColor:
                                                      "var(--app-surface)",
                                                    color: "var(--app-text)",
                                                    borderColor:
                                                      "var(--app-border)",
                                                  }}
                                                >
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    max={Number(
                                                      item.quantity || 0,
                                                    )}
                                                    inputMode="numeric"
                                                    value={
                                                      transferItemSelections[
                                                        item.transferKey
                                                      ] ?? 0
                                                    }
                                                    onChange={(e) =>
                                                      handleTransferProductQtyChange(
                                                        item,
                                                        e.target.value,
                                                      )
                                                    }
                                                    className="w-full bg-transparent text-center text-2xl font-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    style={{
                                                      color: "var(--app-text)",
                                                    }}
                                                  />
                                                  <span
                                                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                                                    style={{
                                                      color:
                                                        "var(--app-muted-text)",
                                                    }}
                                                  >
                                                    selected
                                                  </span>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentQty = Number(
                                                      transferItemSelections[
                                                        item.transferKey
                                                      ] || 0,
                                                    );
                                                    const maxQty = Number(
                                                      item.quantity || 0,
                                                    );
                                                    handleTransferProductQtyChange(
                                                      item,
                                                      Math.min(
                                                        maxQty,
                                                        currentQty + 1,
                                                      ),
                                                    );
                                                  }}
                                                  className="flex h-14 items-center justify-center rounded-2xl text-3xl font-black text-white transition active:scale-95"
                                                  style={{
                                                    background:
                                                      "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                                                  }}
                                                >
                                                  +
                                                </button>
                                              </div>

                                              <div className="mt-2 grid grid-cols-2 gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleTransferProductQtyChange(
                                                      item,
                                                      0,
                                                    )
                                                  }
                                                  className="h-12 rounded-xl text-sm font-black transition active:scale-95"
                                                  style={{
                                                    backgroundColor:
                                                      "var(--app-surface)",
                                                    color: "var(--app-text)",
                                                    border:
                                                      "1px solid var(--app-border)",
                                                  }}
                                                >
                                                  Clear
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleTransferProductQtyChange(
                                                      item,
                                                      Number(
                                                        item.quantity || 0,
                                                      ),
                                                    )
                                                  }
                                                  className="h-12 rounded-xl bg-emerald-600 text-sm font-black text-white transition active:scale-95 hover:bg-emerald-500"
                                                >
                                                  All
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div
                                    className="rounded-xl px-4 py-5 text-center text-sm"
                                    style={{
                                      backgroundColor: "var(--app-surface)",
                                      color: "var(--app-muted-text)",
                                      border: "1px dashed var(--app-border)",
                                    }}
                                  >
                                    No order items available for transfer.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="relative">
                              <FaSearch
                                className="absolute left-4 top-1/2 -translate-y-1/2"
                                style={{ color: "var(--app-muted-text)" }}
                              />
                              <input
                                type="text"
                                placeholder="Search pending tables..."
                                value={transferSearch}
                                onChange={(e) =>
                                  setTransferSearch(e.target.value)
                                }
                                className="w-full rounded-xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none"
                                style={{
                                  backgroundColor: "var(--app-surface-soft)",
                                  border: "1px solid var(--app-border)",
                                  color: "var(--app-text)",
                                }}
                              />
                            </div>

                            <div
                              className="rounded-2xl border p-3"
                              style={{
                                borderColor: "var(--app-border)",
                                backgroundColor: "var(--app-surface-soft)",
                              }}
                            >
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                  <p
                                    className="text-[10px] font-black uppercase tracking-[0.25em]"
                                    style={{ color: "var(--app-muted-text)" }}
                                  >
                                    Pending Tables
                                  </p>
                                </div>
                                <span
                                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                  style={{
                                    backgroundColor: "var(--app-surface)",
                                    color: "var(--app-muted-text)",
                                    border: "1px solid var(--app-border)",
                                  }}
                                >
                                  {filteredTransferTables.length}
                                </span>
                              </div>

                              <div className="max-h-[220px] overflow-y-auto pr-1">
                                {filteredTransferTables.length > 0 ? (
                                  <div className="space-y-2">
                                    {filteredTransferTables.map((table) => {
                                      const tableName =
                                        getTransferTableName(table);
                                      const isSelected =
                                        normalizeTableName(
                                          selectedTransferTable,
                                        ) === normalizeTableName(tableName);

                                      return (
                                        <button
                                          key={table.ID ?? tableName}
                                          type="button"
                                          onClick={() =>
                                            setSelectedTransferTable(tableName)
                                          }
                                          className="w-full rounded-xl border px-3 py-3 text-left transition-all"
                                          style={{
                                            backgroundColor: isSelected
                                              ? "color-mix(in srgb, var(--app-accent) 12%, transparent)"
                                              : "var(--app-surface)",
                                            borderColor: isSelected
                                              ? "var(--app-accent)"
                                              : "var(--app-border)",
                                            color: "var(--app-text)",
                                          }}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <p
                                                className="text-[10px] font-black uppercase tracking-[0.2em]"
                                                style={{
                                                  color: isSelected
                                                    ? "var(--app-accent)"
                                                    : "var(--app-muted-text)",
                                                }}
                                              >
                                                Pending Table
                                              </p>
                                              <p className="mt-1 text-sm font-extrabold">
                                                {tableName}
                                              </p>
                                            </div>
                                            <div
                                              className="mt-1 flex h-5 w-5 items-center justify-center rounded-full"
                                              style={{
                                                backgroundColor: isSelected
                                                  ? "var(--app-accent)"
                                                  : "var(--app-surface-soft)",
                                                color: isSelected
                                                  ? "#ffffff"
                                                  : "var(--app-muted-text)",
                                              }}
                                            >
                                              {isSelected ? (
                                                <FaCheck size={9} />
                                              ) : (
                                                <span className="text-[9px] font-bold">
                                                  +
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div
                                    className="rounded-xl px-4 py-5 text-center text-sm"
                                    style={{
                                      backgroundColor: "var(--app-surface)",
                                      color: "var(--app-muted-text)",
                                      border: "1px dashed var(--app-border)",
                                    }}
                                  >
                                    No pending tables found.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div
                              className="rounded-2xl border p-4"
                              style={{
                                backgroundColor: "var(--app-surface-soft)",
                                borderColor: "var(--app-border)",
                              }}
                            >
                              <p
                                className="text-[10px] font-black uppercase tracking-[0.25em]"
                                style={{ color: "var(--app-muted-text)" }}
                              >
                                Destination Preview
                              </p>
                              <p
                                className="mt-1 text-lg font-bold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {selectedTransferTable ||
                                  "No pending table selected"}
                              </p>
                              {destinationTransferLoading ? (
                                <p
                                  className="mt-3 text-sm"
                                  style={{ color: "var(--app-muted-text)" }}
                                >
                                  Loading destination order...
                                </p>
                              ) : (
                                <p
                                  className="mt-3 text-sm"
                                  style={{ color: "var(--app-muted-text)" }}
                                ></p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex gap-2 pt-4">
                        <button
                          onClick={resetTransferState}
                          className="flex-1 rounded-xl px-4 py-3 text-sm transition-all"
                          style={{
                            backgroundColor: "var(--app-surface-soft)",
                            color: "var(--app-text)",
                            border: "1px solid var(--app-border)",
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          onClick={requestTransferConfirm}
                          className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all"
                          style={{
                            background:
                              "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                            boxShadow: "0 12px 28px var(--app-accent-glow)",
                          }}
                        >
                          Confirm Transfer
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showTransferConfirmModal && (
                  <ModalYesNoReusable
                    header={
                      transferMode === "merge"
                        ? "Confirm Table Merge"
                        : transferMode === "transferItem"
                          ? "Confirm Product Transfer"
                          : "Confirm Table Transfer"
                    }
                    message={
                      transferMode === "merge"
                        ? `Are you sure you want to update this transaction table into ${mergePreview}?`
                        : transferMode === "transferItem"
                          ? `Are you sure you want to transfer ${selectedTransferProductTotalQty} selected item${selectedTransferProductTotalQty !== 1 ? "s" : ""} from ${tableselected} to pending table ${selectedTransferTable}?`
                          : `Are you sure you want to transfer this order from ${tableselected} to ${customTransferTableName.trim() || selectedTransferTable}?`
                    }
                    setYesNoModalOpen={setShowTransferConfirmModal}
                    triggerYesNoEvent={handleConfirmTransferTable}
                  />
                )}
              </AnimatePresence>
            </aside>
          </div>

          <div
            className={`p-4 transition-colors lg:hidden ${
              isDark
                ? "border-t border-white/10 bg-slate-900"
                : "border-t border-slate-200 bg-white"
            }`}
          >
            <button
              onClick={() => setShowCartMobile(true)}
              className="flex w-full justify-between rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white shadow-xl"
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
                    items={recentDisplayItems}
                    updateQuantity={updateRecentDisplayQuantity}
                    updateQuantityByInput={updateQuantityByInput}
                    removeItem={requestRemoveItem}
                    readOnly={false}
                    openItemInstructionModal={openItemInstructionModal}
                    isDark={isDark}
                    showInstructionButton={false}
                  />
                </div>
              )}

              {visibleAdditionalCartItems.length > 0 && (
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
                    items={visibleAdditionalCartItems}
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
                visibleAdditionalCartItems.length === 0 && (
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

              <div className="mb-3">
                <label
                  className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Printer
                </label>

                <select
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-3 text-sm outline-none ${
                    isDark
                      ? "border border-slate-700 bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Default Printer</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateQR}
                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-blue-600/20"
              >
                <IoQrCode size={24} /> Generate QR Code
              </button>

              <button
                disabled={isConfirmingTransaction}
                onClick={requestSaveOnly}
                className="w-full mt-3 bg-emerald-600 text-gray-100 font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-emerald-600/20"
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
        {showqrModal && !showConfirmModal && (
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

              <div className="mb-4">
                <label
                  className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Printer
                </label>

                <select
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-3 text-sm outline-none ${
                    isDark
                      ? "border border-slate-700 bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Default Printer</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-6 rounded-[2rem] inline-block mb-8 shadow-inner ring-8 ring-white/5">
                {qrValue && qrValue.length <= 300 ? (
                  <QRCode value={qrValue} size={180} level="M" />
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center text-center text-sm font-semibold text-red-500">
                    QR data is too long to generate.
                  </div>
                )}
              </div>

              <ButtonComponent
                onClick={() => setShowConfirmModal(true)}
                isLoading={isConfirmingTransaction}
                icon={<FaReceipt />}
                loadingText="Saving..."
              >
                Save & Print Receipt
              </ButtonComponent>

              <ButtonComponent
                onClick={requestSaveOnly}
                isLoading={isConfirmingTransaction}
                icon={<FaCheckCircle />}
                loadingText="Saving..."
                variant={"success"}
              >
                Save Only
              </ButtonComponent>

              <ButtonComponent
                onClick={() => setShowqrModal(false)}
                loadingText="Saving..."
                variant={"secondary"}
              >
                Close
              </ButtonComponent>
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
                <ButtonComponent
                  onClick={confirmTransactionAndPrint}
                  isLoading={isConfirmingTransaction}
                  loadingText="Saving..."
                  variant="success"
                >
                  Yes
                </ButtonComponent>

                <ButtonComponent
                  onClick={() => setShowConfirmModal(false)}
                  isLoading={isConfirmingTransaction}
                  loadingText="Closing..."
                  variant="secondary"
                >
                  No
                </ButtonComponent>
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
                  {tableselected}
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
                <div className="mb-4">
                  <label
                    className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] ${
                      isDark ? "text-slate-500" : "text-slate-500"
                    }`}
                  >
                    Printer
                  </label>

                  <select
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className={`w-full rounded-xl px-3 py-3 text-sm outline-none ${
                      isDark
                        ? "border border-slate-700 bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    <option value="">Default Printer</option>
                    {printers.map((printer) => (
                      <option key={printer.name} value={printer.name}>
                        {printer.displayName || printer.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                          onOpenDiscountModal(item, e);
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
  showInstructionButton = true,
}) => (
  <div className={`flex-1 space-y-3 overflow-y-auto p-4 ${extraClassName}`}>
    {items.length === 0 ? (
      <div className="py-20 text-center">
        <FaShoppingCart
          className="mx-auto mb-4 text-5xl"
          style={{ color: "var(--app-muted-text)" }}
        />
        <p className="font-medium" style={{ color: "var(--app-muted-text)" }}>
          Your cart is feeling empty
        </p>
      </div>
    ) : (
      items.map((item, index) => {
        const isSpecialPaluto =
          String(item.item_category || "").toUpperCase() === "SPECIAL PALUTO";

        return (
          <div
            key={item.lineId || `${item.code}-${index}`}
            className="rounded-xl border p-3 transition-colors"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--app-text)",
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className="block text-xs font-medium leading-tight"
                  style={{ color: "var(--app-text)" }}
                >
                  {item.name}
                </span>

                {item.itemInstruction && (
                  <p className="mt-1 break-words text-[10px] text-amber-500">
                    Note: {item.itemInstruction}
                  </p>
                )}
              </div>

              {!readOnly && (
                <div className="flex shrink-0 items-center gap-3">
                  {showInstructionButton && (
                    <button
                      onClick={() => openItemInstructionModal?.(item)}
                      className="p-2 transition-colors"
                      style={{ color: "var(--app-muted-text)" }}
                      title="Add instruction"
                    >
                      <FaEdit size={18} />
                    </button>
                  )}

                  <button
                    onClick={() => removeItem?.(item.lineId, item)}
                    className="p-2 transition-colors"
                    style={{ color: "var(--app-muted-text)" }}
                  >
                    <FaTrash size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              {readOnly || item.hasAdditionalEntry ? (
                <div
                  className="text-xs font-bold"
                  style={{ color: "var(--app-muted-text)" }}
                >
                  Qty: {item.quantity}
                  {item.originalQuantity > 0 &&
                  item.originalQuantity !== item.quantity
                    ? ` / Original: ${item.originalQuantity}`
                    : ""}
                </div>
              ) : isSpecialPaluto ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs"
                    style={{ color: "var(--app-muted-text)" }}
                  >
                    Qty
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateQuantityByInput?.(item.lineId, e.target.value)
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (
                        value === "" ||
                        Number(value) <= 0 ||
                        Number.isNaN(Number(value))
                      ) {
                        updateQuantityByInput?.(item.lineId, "1");
                      }
                    }}
                    className="w-20 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-surface-soft)",
                      border: "1px solid var(--app-border)",
                      color: "var(--app-text)",
                    }}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 rounded-lg border p-1 transition-colors"
                  style={{
                    backgroundColor: "var(--app-surface-soft)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <button
                    onClick={() => updateQuantity?.(item.lineId, -1, item)}
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                    style={{
                      color: "var(--app-text)",
                      backgroundColor: "var(--app-surface)",
                      border: "1px solid var(--app-border)",
                    }}
                  >
                    <FaMinus size={8} />
                  </button>

                  <span
                    className="min-w-[18px] px-1 text-center text-xs font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => updateQuantity?.(item.lineId, 1, item)}
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                    style={{
                      color: "var(--app-text)",
                      backgroundColor: "var(--app-surface)",
                      border: "1px solid var(--app-border)",
                    }}
                  >
                    <FaPlus size={8} />
                  </button>
                </div>
              )}

              <span
                className="text-sm font-bold"
                style={{ color: "var(--app-accent)" }}
              >
                ₱{(Number(item.price) * Number(item.quantity)).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })
    )}
  </div>
);

export default Orderlist;
