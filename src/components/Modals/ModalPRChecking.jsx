import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { array } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useCustomQuery from "../../hooks/useCustomQuery";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../../components/Modals/ModalSuccessNavToSelf";
import { useReactToPrint } from "react-to-print";
import "../../fonts/font-style.css";
import { findIndex, isError, orderBy } from "lodash";
import Dropdown from "../Dropdown/Dropdown";
import {
  FiBox,
  FiCheck,
  FiCheckCircle,
  FiDelete,
  FiDollarSign,
  FiEdit,
  FiFastForward,
  FiPrinter,
  FiSkipForward,
} from "react-icons/fi";
import {
  FiCalendar,
  FiUser,
  FiCreditCard,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import ModalPRChargeDeduc from "./ModalPRChargeDeduc";
import useZustandIMSBusunitCode from "../../context/useZustandIMSBusunitCode";
import autoprefixer from "autoprefixer";
import useAutoPricingStatus from "../../context/useAutoPricingStatus";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalPRChecking = ({
  setModalPRChecking,
  productItems,
  handleApproval,
  setproductTrackingId,
  transactionType,
  tentativeDate,
  settentativeDate,
  isStatus,
  buildComponentsById,
  setBuildComponentsById,
  handleApprovalWithPayment,
  busunits,
  pricingCategory,
  setPricingCategory,
  firstName,
  userId,
  invoiceStatus,
  qryCorpData,
  productTrackingId,
  setReturnmessage,
  listofcharge,
  setlistofcharge,
  productsQueueMutate,
  store,
  storeName,
  bunameprint,
  buaddressprint,
  autoPricingMutate,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const companyCode = localStorage.getItem("companycode");

  const Logo = localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGO;
  const BusunitLogo =
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_BUSUNIT_LOGO;

  const {
    imsBusunitCodeSelected,
    setIMSBusunitCodeSelected,
    imsBusunitClass,
    setIMSBusunitClass,
  } = useZustandIMSBusunitCode();

  const { isAutoPricing } = useAutoPricingStatus();

  // import PRPrintableComponent from "../InventoryManagement/PRPrintableComponent";

  const ComponentToPrint = React.forwardRef(({ text }, ref) => {
    return (
      <div ref={ref} className="flex flex-col justify-center text-md">
        <div className="w-full p-5  ">{text}</div>
      </div>
    );
  });

  const DRToPrint = React.forwardRef(({ text }, ref) => (
    <div
      ref={ref}
      className="
      flex flex-col items-center justify-center
      pt-14 text-xl leading-relaxed
      print:text-base print:font-serif print:leading-loose
      print:px-0
    "
    >
      {/* Header */}
      <header className="flex items-center justify-center w-full mb-8 print:mb-4">
        <img
          src={`${BusunitLogo}${imsBusunitCodeSelected}.png`}
          alt="Company Logo"
          className="w-16 h-auto"
        />
        <h1
          className="ml-4 text-2xl font-extrabold"
          style={{ fontFamily: "Poppins-ExtraBold" }}
        >
          Delivery Receipt
        </h1>
      </header>

      {/* Body */}
      <section className="w-3/4 px-5 print:px-0">{text}</section>
    </div>
  ));

  const [isExpanded, setIsExpanded] = useState(true);
  const [subTotalItems, setSubTotalItems] = useState(0);
  const [subTotalPayments, setsubTotalPayments] = useState(0);
  const [truckDetails, setTruckDetails] = useState("");
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(0);
  const [isDeliveryChecked, setisDeliveryChecked] = useState(false);
  const [deliveryStateData, setDeliveryStateData] = useState([]);
  const [shippingStateData, setShippingStateData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [payeeName, setPayeeName] = useState("");
  const [payeeNameCode, setPayeeNameCode] = useState("");
  const [imageurl, setimageurl] = useState("");
  const [showchargesdeduc, setshowchargesdeduc] = useState(false);
  const [triggertosavecharge, settriggertosavecharge] = useState(false);
  const [totalchargededuc, settotalchargededuc] = useState(0);
  const [particulars, setparticulars] = useState("");
  const [amount, setamount] = useState(0);
  // Track which item (by its index) is currently being edited for cost
  const [editableCostIndex, setEditableCostIndex] = useState(null);
  const [editableQtyIndex, setEditableQtyIndex] = useState(null);
  const [dispatch, setDispatch] = useState(1);
  // Temporarily hold the new cost value per item, keyed by inv_code
  const [costInputValues, setCostInputValues] = useState({});
  const [qtyInputValues, setQtyInputValues] = useState({});

  const [isEditSuccess, setIsSuccessEdit] = useState(false); //Edit Costs and Qty
  const [isEmailSuccess, setIsEmailSuccess] = useState(false);

  const [newQtyEdit, setNewQtyEdit] = useState({});
  const [newCostEdit, setNewCostEdit] = useState({});
  const [isEditModalQty, setIsEditModalQty] = useState(false);
  const [isEditModalCost, setIsEditModalCost] = useState(false);

  const [isPriceChangedSuccessModal, setIsPriceChangedSuccessModal] =
    useState(false);

  const {
    data: chargededucMutationData,
    isLoading: chargededucMutationIsLoading,
    isError: chargededucMutationIsError,
    isSuccess: chargededucMutationIsSuccess,
    mutate: chargededucMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_CHARGE_DEDUCTION_ENDPOINT,
    "POST",
  );

  //Mutate for Cost and Quantity Edit
  const {
    data: costAndQtyEditMutationData,
    isLoading: costAndQtyEditMutationIsLoading,
    isError: costAndQtyEditMutationIsError,
    isSuccess: costAndQtyEditMutationIsSuccess,
    mutate: costAndQtyEditMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_EDIT_PR_COST_QTY,
    "POST",
  );

  const handleQtyEdit = () => {
    // costAndQtyEditMutationMutate;
    costAndQtyEditMutationMutate({
      newcost: newQtyEdit.newcost,
      newquantity: newQtyEdit.newquantity,
      total_cost: newQtyEdit.total_cost,
      inv_code: newQtyEdit.inv_code,
      prd_queue_code: newQtyEdit.prd_queue_code,
      newtotalcost: newQtyEdit.newtotalcost,
    });
  };

  const handleCostEdit = () => {
    // costAndQtyEditMutationMutate;
    costAndQtyEditMutationMutate({
      newcost: newCostEdit.newcost,
      newquantity: newCostEdit.newquantity,
      total_cost: newCostEdit.total_cost,
      inv_code: newCostEdit.inv_code,
      prd_queue_code: newCostEdit.prd_queue_code,
      newtotalcost: newCostEdit.newtotalcost,
    });
  };

  useEffect(() => {
    if (
      costAndQtyEditMutationData &&
      costAndQtyEditMutationData.message === "Success"
    ) {
      setIsSuccessEdit(true);
      productsQueueMutate({
        prd_queue_code: productItems[0]?.prd_queue_code,
      });
      setNewQtyEdit({});
      setNewCostEdit({});
    }
  }, [costAndQtyEditMutationData]); //Show if edit cost and quantity is success

  useEffect(() => {
    if (
      chargededucMutationData &&
      chargededucMutationData.message === "Success"
    ) {
      setReturnmessage({
        choose: "success",
        message: `Change deduction successfully saved`,
      });
      settriggertosavecharge(false);
    }
  }, [chargededucMutationData]);

  useEffect(() => {
    if (triggertosavecharge) {
      // if (listofcharge.length === 0) {
      //   setReturnmessage({
      //     choose: "error",
      //     message: `No items to save`,
      //   });
      // }
      // }
      // else {
      // if (particulars === "" && amount === 0) {
      chargededucMutationMutate({
        transaction_id: productTrackingId,
        DeductionsData: listofcharge,
      });
      // } else {
      //   setReturnmessage({
      //     choose: "error",
      //     message: `Add Item First Before Saving`,
      //   });
      // }
    }
  }, [triggertosavecharge]);

  const {
    data: ViewChargeDeductionData,
    isLoading: ViewChargeDeductionIsLoading,
    isError: ViewChargeDeductionIsError,
    isSuccess: ViewChargeDeductionIsSuccess,
    mutate: ViewChargeDeductionMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_CHARGE_DEDUCTION_ENDPOINT,
    "POST",
  );

  useEffect(() => {
    if (productItems) {
      ViewChargeDeductionMutate({
        transaction_id: productTrackingId,
      });
    }
  }, [productItems]);

  useEffect(() => {
    ViewChargeDeductionMutate({
      transaction_id: productTrackingId,
    });
  }, [triggertosavecharge]);

  useEffect(() => {
    if (ViewChargeDeductionData) {
      setlistofcharge(ViewChargeDeductionData);

      const totalAmount = ViewChargeDeductionData.reduce(
        (sum, chargededuc) => sum + chargededuc.amount,
        0,
      );
      settotalchargededuc(totalAmount);
    }
  }, [ViewChargeDeductionData]);

  const handleCheckboxChange = (inv_code, prd_queue_code) => {
    setSelectedItems((prev) => {
      const isAlreadySelected = prev.some(
        (item) =>
          item.inv_code === inv_code && item.prd_queue_code === prd_queue_code,
      );

      let updated;
      if (isAlreadySelected) {
        // Remove item
        updated = prev.filter(
          (item) =>
            item.inv_code !== inv_code ||
            item.prd_queue_code !== prd_queue_code,
        );
      } else {
        // Add item
        updated = [...prev, { inv_code, prd_queue_code }];
      }
      // Get number of visible items
      const visibleItemsCount = productItems.filter(
        (item) =>
          !(
            item.prd_queue_code_new === productTrackingId &&
            ["PO", "Production", "Delivery", "Billing"].includes(
              transactionType,
            )
          ),
      ).length;

      // If user selected ALL visible items, cancel selection and prompt
      if (updated.length === visibleItemsCount) {
        setReturnmessage({
          choose: "error",
          message:
            "To CHOOSE ALL >>> Deselect all boxes, then choose a supplier to allocate products for purchase.",
        });
        // alert(
        //   "To CHOOSE ALL >>> Deselect all boxes, then choose a supplier to allocate products for purchase."
        // );
        return []; // Uncheck all
      }

      return updated;
    });
  };
  const [isPRPOYesNoModalOpen, setPRPOYesNoModalOpen] = useState(false);
  const [isProductsBuildYesNoModalOpen, setProductsBuildYesNoModalOpen] =
    useState(false);

  const [isProductsSkipYesNoModalOpen, setProductsSkipYesNoModalOpen] =
    useState(false);

  const [isBuildCompletedYesNoModalOpen, setBuildCompletedYesNoModalOpen] =
    useState(false);

  const [isBillingYesNoModalOpen, setBillingYesNoModalOpen] = useState(false);
  const [isCollectionYesNoModalOpen, setCollectionYesNoModalOpen] =
    useState(false);
  const [isShippingYesNoModalOpen, setShippingYesNoModalOpen] = useState(false);

  const [isDispatchYesNoModalOpen, setDispatchYesNoModalOpen] = useState(false);

  const [
    isConfirmedDispatchYesNoModalOpen,
    setConfirmedDispatchYesNoModalOpen,
  ] = useState(false);

  const [deliveryLevel, setDeliveryLevel] = useState("");

  const [isAssignShipmentYesNoModalOpen, setAssignShipmentYesNoModalOpen] =
    useState(false);

  const [isAcceptShipmentYesNoModalOpen, setAcceptShipmentYesNoModalOpen] =
    useState(false);

  const [isConfirmShipmentYesNoModalOpen, setConfirmShipmentYesNoModalOpen] =
    useState(false);

  const [isConfirmSupplierYesNoModalOpen, setConfirmSupplierYesNoModalOpen] =
    useState(false);
  const [isConfirmpartitionYesNoModalOpen, setConfirmpartitionYesNoModalOpen] =
    useState(false);
  const [isConfirmupdateYesNoModalOpen, setConfirmupdateYesNoModalOpen] =
    useState(false);
  const [isVoidYesNoModalOpen, setVoidYesNoModalOpen] = useState(false);
  const [isSendToEmailYesNoModalOpen, setSendToEmailYesNoModalOpen] =
    useState(false);
  // State for Shipping Details
  const [shippingMutationSender, setshippingMutationSender] = useState("");
  const [shippingMutationReceiver, setshippingMutationReceiver] = useState("");
  const [shippingMutationVehicle, setshippingMutationVehicle] = useState("");
  const [shippingMutationLevel, setshippingMutationLevel] = useState("");

  const [supplierProductItems, setSupplierProductItems] = useState([]);

  const [editableIndex, setEditableIndex] = useState(null);

  const [editableUomValIndex, setEditableUomValIndex] = useState(null);

  const [editableCostPerUomIndex, setEditableCostPerUomIndex] = useState(null);
  const [isPayeeError, setPayeeError] = useState(false);

  const [prevUomVal, setPrevUomVal] = useState(0);

  const [prevCostPerUom, setPrevCostPerUom] = useState(0);

  const [isSupplierVat, setIsSupplierVat] = useState(false);

  const [isDeliverySkipped, setIsDeliverySkipped] = useState(true);

  {
    /* Delivery from SUPPLIER TO STORE Receiving*/
  }
  const [searchQuery, setSearchQuery] = useState("");
  const filteredItems = supplierProductItems.filter((item) =>
    item.inv_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const [searchShippingStateData, setSearchShippingStateData] = useState("");
  const filteredItemsShipping = shippingStateData.filter((item) =>
    item.inv_code.toLowerCase().includes(searchShippingStateData.toLowerCase()),
  );
  const [searchDeliveryStateData, setSearchDeliveryStateData] = useState("");
  const filtereddeliveryStateData = deliveryStateData.filter((item) =>
    item.inv_code.toLowerCase().includes(searchDeliveryStateData.toLowerCase()),
  );

  const [expanded, setExpanded] = useState(false);

  const [completetransaction, setcompletetransaction] = useState(0);

  const toggleText = () => setExpanded(!expanded);

  useEffect(() => {
    if (productItems) {
      setSupplierProductItems(productItems);
    }
  }, [productItems]);

  useEffect(() => {
    if (supplierProductItems) {
      // console.log(supplierProductItems);
    }
  }, [supplierProductItems]);

  const [qtyForReceiving, setQtyForReceiving] = useState(0);

  const mops = ["Cash", "Cash in Bank", "Gcash", "Credit Card"];

  const dummyUserPositions = [
    { position: "Dispatcher", empid: "2023098134108971" },
  ];

  // PRINTING HOOK
  const componentRef = useRef();
  const drRef = useRef();

  // useReactToPrint hook
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  const handlePrintDR = useReactToPrint({
    content: () => drRef.current,
  });

  /********SET ROLES************/

  const { roles } = useZustandLoginCred();

  /*******ARRAY METHODS*******/
  const resetTransaction = () => {
    setModalPRChecking(false);
    setproductTrackingId("");
    setBuildComponentsById([]);
    // alert("Transaction completed");
    setReturnmessage({
      choose: "success",
      message: "Transaction completed",
    });
  };

  /*******MUTATIONS*******/

  //Retrieve net delivery qty

  const {
    data: netItemsForDeliveryMutationData,
    isLoading: netItemsForDeliveryMutationIsLoading,
    isError: netItemsForDeliveryMutationIsError,
    isSuccess: netItemsForDeliveryMutationIsSuccess,
    mutate: netItemsForDeliveryMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_READ_NET_DELIVERY_QTY,
    "POST",
  );

  const {
    data: newPRMutationData,
    isLoading: newPRMutationIsLoading,
    isError: newPRMutationIsError,
    isSuccess: newPRMutationIsSuccess,
    mutate: newPRMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_MUTATE_DIVIDE_PR,
    "POST",
  );

  const handleButtonClick = () => {
    const allSelected =
      selectedItems.length === productItems.length && productItems.length > 0;

    if (allSelected) {
      setReturnmessage({
        choose: "error",
        message: "You must not leave this PO transaction empty.",
      });
      // alert("You must not leave this PO transaction empty.");
      return;
    }

    newPRMutationMutate({ newPr: selectedItems });
  };

  useEffect(() => {
    if (newPRMutationData && newPRMutationData.message === "Success") {
      setReturnmessage({
        choose: "success",
        message: "Product Partition successful",
      });
      // alert("Product Partition successful");
      setModalPRChecking(false);
      setproductTrackingId("");
      setBuildComponentsById([]);
    }
  }, [newPRMutationData]);

  const {
    data: supplierMutationData,
    isLoading: supplierMutationIsLoading,
    isError: supplierMutationIsError,
    isSuccess: supplierMutationIsSuccess,
    mutate: supplierMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_UPDATE_SUPPLIER,
    "PATCH",
  );
  const updateSupplier = () => {
    if (!productItems || productItems.length === 0) {
      console.error("No product items available.");
      return;
    }

    const minQueueCode =
      productItems[0].prd_queue_code_new === null
        ? productItems[0].prd_queue_code
        : Math.min(...productItems.map((item) => item.prd_queue_code));
    supplierMutationMutate({
      payee: payeeNameCode,
      prd_queue_code: minQueueCode,
    });
    setReturnmessage({
      choose: "success",
      message: "Supplier set successfully",
    });
    // alert("Supplier set successfully");
    setModalPRChecking(false);
    setproductTrackingId("");
  };

  useEffect(() => {
    if (
      netItemsForDeliveryMutationData &&
      netItemsForDeliveryMutationData.length > 0
    ) {
      const cloneProducts = [...supplierProductItems];

      const cloneNetDeliveryItems = [...netItemsForDeliveryMutationData];

      cloneProducts.forEach((item) => {
        const deliveryFindIndex = netItemsForDeliveryMutationData.findIndex(
          (delivery) => delivery.inv_code === item.inv_code,
        );

        if (deliveryFindIndex !== -1) {
          item.quantity =
            item.quantity -
            netItemsForDeliveryMutationData[deliveryFindIndex].qty;
        }
      });

      // console.log(cloneProducts);
    }
  }, [netItemsForDeliveryMutationData]);

  //Payment Mutation Hook

  const {
    data: paymentsMutationData,
    isLoading: paymentsMutationIsLoading,
    isError: paymentsMutationIsError,
    isSuccess: paymentsMutationIsSuccess,
    mutate: paymentsMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_PAYMENTS_DATA_ENDPOINT,
    "POST",
  );

  useEffect(() => {
    paymentsMutationMutate({
      prd_queue_code: productTrackingId,
    });

    netItemsForDeliveryMutationMutate({
      prqueuecode: productItems[0].prd_queue_code,
    });
  }, []);

  useEffect(() => {
    if (paymentsMutationData) {
      const subTotal = paymentsMutationData.reduce((acc, item) => {
        if (item.payments !== undefined) {
          return acc + item.payments;
        } else {
          return acc;
        }
      }, 0);

      setsubTotalPayments(subTotal);
      // console.log(paymentsMutationData);
    }
  }, [paymentsMutationData]);

  const {
    data: buildActualComponentsMutationData,
    mutate: buildActualComponentsMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_ACTUAL_BUILD_COMPONENTS_DATA_ENDPOINT,
    "POST",
  );

  useEffect(() => {
    buildActualComponentsMutationMutate({
      prd_queue_code: productItems[0].prd_queue_code,
    });
  }, []);

  //Delivery Queue Mutation Hook

  const {
    data: deliveryDetailsMutationData,
    mutate: deliveryDetailsMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_DELIVERY_DETAILS_DATA_ENDPOINT,
    "POST",
  );

  //Suppliers
  const { data: suppliersData } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_SUPPLIERS_DATA_READ_ENDPOINT,
    "suppliers",
  );

  useEffect(() => {
    deliveryDetailsMutationMutate({
      deliverydetailscode: productItems[0].prd_queue_code,
      inv_code: productItems[0].classpayee === "DEPARTMENT" ? "RM" : "BD",
    });
  }, []);

  useEffect(() => {
    if (deliveryDetailsMutationData) {
      setDeliveryStateData(deliveryDetailsMutationData);
    }
  }, [deliveryDetailsMutationData]);

  useEffect(() => {
    if (deliveryStateData) {
      filterDeliveryStateData();
    }
  }, [deliveryStateData]);

  const filterDeliveryStateData = () => {
    const deliveryStateDataClone = [...deliveryStateData];

    const filteredData = deliveryStateDataClone.filter((items) => {
      return items.level === "Delivery";
    });

    setShippingStateData(filteredData);
  };

  useEffect(() => {
    if (shippingStateData) {
    }
  }, [shippingStateData]);

  //Delivery Shipping Mutation Hook

  const {
    data: shippingDetailsMutationData,
    mutate: shippingDetailsMutationMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_SHIPPING_DETAILS_DATA_ENDPOINT,
    "POST",
  );

  useEffect(() => {
    if ((isStatus = "For Shipping")) {
      shippingDetailsMutationMutate({
        del_code: productItems[0].prd_queue_code,
      });
    }
  }, []);

  useEffect(() => {
    if (shippingDetailsMutationData) {
      if (shippingDetailsMutationData.length > 0) {
        setshippingMutationSender(shippingDetailsMutationData[0].receiver);
        setshippingMutationVehicle(shippingDetailsMutationData[0].vehicle);
        setshippingMutationLevel("Delivery");
      }
    }
  }, [shippingDetailsMutationData]);

  const [inputValuesProdItems, setInputValuesProdItems] = useState({});

  const handleProductData = (value, id) => {
    setInputValuesProdItems((prevInputValues) => ({
      ...prevInputValues,
      [id]: value,
    }));
  };

  const [inputValues, setInputValues] = useState({});
  const handleReceiverData = (value, id) => {
    const numericValue = Number(value);

    setInputValues((prevInputValues) => ({
      ...prevInputValues,
      [id]: numericValue,
    }));

    setDeliveryStateData((prevData) =>
      prevData.map((item) =>
        item.inv_code === id
          ? {
              ...item,
              receiver_qty: numericValue,
              variance: numericValue - item.sender_qty,
            }
          : item,
      ),
    );
  };

  //Delivery Patch Mutation Hook

  const { data: deliveryDetailsPatchData, mutate: deliveryDetailsPatchMutate } =
    useSecuredMutation(
      localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_EDIT_DELIVERY_DETAILS_ENDPOINT,
      "PATCH",
    );

  useEffect(() => {
    if (deliveryDetailsPatchData) {
      // console.log(deliveryDetailsPatchData);
      resetTransaction();
    }
  }, [deliveryDetailsPatchData]);

  const {
    data: deliverySupplierPatchData,
    mutate: deliverySupplierPatchMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_EDIT_DELIVERY_SUPPLIER_ENDPOINT,
    "PATCH",
  );

  useEffect(() => {
    if (
      deliverySupplierPatchData &&
      deliverySupplierPatchData.message === "Success"
    ) {
      if (isAutoPricing)
        autoPricingMutate({
          status: "update",
        });
      resetTransaction();
    }
  }, [deliverySupplierPatchData]);

  //Shipping Details Patch Mutation Hook

  const { data: shippingDetailsPatchData, mutate: shippingDetailsPatchMutate } =
    useSecuredMutation(
      localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_EDIT_SHIPPING_DELIVERY_DETAILS_ENDPOINT,
      "PATCH",
    );

  useEffect(() => {
    if (shippingDetailsPatchData) {
      // console.log(shippingDetailsPatchData);
      resetTransaction();
    }
  }, [shippingDetailsPatchData]);

  //Shipping Details Patch Mutation Hook

  const {
    data: shippingConfirmationPatchData,
    mutate: shippingConfirmationPatchMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_EDIT_SHIPPING_DELIVERY_CONFIRMATION_ENDPOINT,
    "PATCH",
  );

  useEffect(() => {
    if (shippingConfirmationPatchData) {
      // console.log(shippingConfirmationPatchData);
      resetTransaction();
    }
  }, [shippingConfirmationPatchData]);
  // Queries

  useEffect(() => {
    const isSupplier =
      productItems[0].payee.substring(0, 2) === "SP" ? true : false;

    if (busunits && !isSupplier) {
      const busunitsClone = [...busunits];
      const pricingcategory = busunitsClone.filter(
        (items) => items.busunitcode === productItems[0].payee,
      );

      setPricingCategory(
        pricingcategory.length > 0 ? pricingcategory[0].pricing_category : [],
      );
    } else {
      if (suppliersData) {
        const supplierClone = [...suppliersData];
        const pricingcategory = supplierClone.filter(
          (items) => items.supplier_code === productItems[0].payee,
        );

        // console.log(pricingcategory);

        setPricingCategory(
          pricingcategory.length > 0 ? pricingcategory[0].pricing_category : [],
        );
      }
    }
  }, []);

  /*******Useform Hook and Zod for schema error check*******/
  const schema = z.object({
    payment_amount: z.string().min(1).nonempty(),
    payment_ref: z.string().min(1).nonempty(),
    mop: z.string().min(1).nonempty(),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
  });

  // console.log(productTrackingId);
  //Handle form submit
  const handleFormSubmit = (data) => {
    // let postotalchargededuc = Math.abs(totalchargededuc);

    // console.log(visibleItemsTotal);

    const netTotal = parseFloat(
      visibleItemsTotal +
        totalchargededuc -
        subTotalPayments -
        data.payment_amount,
    ).toFixed(2);

    const status = () => {
      if (netTotal > 0) {
        return "Partial";
      } else {
        return "Paid";
      }
    };

    // console.log("Net Total:", status());

    if (parseFloat(netTotal) < 0) {
      // alert("Received amount must not exceed the payable amount");
      setReturnmessage({
        choose: "error",
        message: "Received amount must not exceed the payable amount",
      });
    } else {
      handleApprovalWithPayment(
        productTrackingId,
        transactionType,
        status(),
        data,
        imageurl,
      );
    }

    reset();
  };

  // Delivery UseForm Hook & Mutation Hook

  const {
    data: deliveryMutationData,
    isLoading: deliveryMutationIsLoading,
    isError: deliveryMutationIsError,
    isSuccess: deliveryMutationIsSuccess,
    mutate: deliveryMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_DELIVERY_ENDPOINT,
    "POST",
  );

  const delSchema = z.object({
    sender: z.string().nonempty(),
    receiver: z.string().nonempty(),
    vehicle: z.string().min(1).nonempty(),
    level: z.string().min(1).nonempty(),
  });

  const {
    register: delRegister,
    handleSubmit: delHandleSubmit,
    control: delControl,
    formState: { errors: delErrors },
    reset: delReset,
  } = useForm({
    resolver: zodResolver(delSchema),
  });

  const handleDeliverySubmit = (data) => {
    deliveryMutate({
      deliveryassignment: data,
      deliveryitems: productItems,
      dispatch: dispatch,
      truckDetails: truckDetails,
    });
  };

  useEffect(() => {
    if (deliveryMutationData) {
      // console.log(deliveryMutationData);
      resetTransaction();
    }
  }, [deliveryMutationData]);

  const handlePRPOApproval = () => {
    setModalPRChecking(false);

    if (transactionType === "PR") {
      handleApproval(productTrackingId, transactionType, "Approved");
    } else if (
      (productItems[0].payee.substring(0, 2) === "BU" &&
        imsBusunitCodeSelected === productItems[0].payee) ||
      productItems[0].payee.substring(0, 2) !== "BU"
    ) {
      handleApproval(
        productTrackingId,
        transactionType,
        "Approved",
        payeeName,
        tentativeDate,
      );
    } else {
      handleApproval(
        productTrackingId,
        transactionType,
        "Approved by Purchaser",
      );
    }

    setproductTrackingId("");
  };

  const handleProductsBuild = () => {
    setModalPRChecking(
      false,
      handleApproval(
        productItems[0].prd_queue_code,
        transactionType,
        "In Progress",
      ),
    );
    setproductTrackingId("");
  };

  const handleProductsSkip = () => {
    setModalPRChecking(
      false,
      handleApproval(productTrackingId, transactionType, "Skipped"),
    );
    setproductTrackingId("");
  };

  const handleCompleteProductsBuild = () => {
    const hasNoExpiryRole = roles[0].some(
      (item) => item.rolename === "IMS-NOEXPIRY",
    );

    if (!hasNoExpiryRole) {
      const hasMissingExpiryDate = supplierProductItems.some(
        (item) => !item.expiryDate,
      );

      if (hasMissingExpiryDate) {
        setReturnmessage({
          choose: "error",
          message: "Please select expiry date for all items.",
        });
        return;
      }
    }

    setModalPRChecking(
      false,
      handleApproval(
        productItems[0].prd_queue_code,
        transactionType,
        "Completed",
      ),
    );
    setproductTrackingId("");
  };

  //Void Transactions

  const {
    data: deleteTransactionData,
    isLoading: deleteTransactionIsLoading,
    isError: deleteTransactionIsError,
    isSuccess: deleteTransactionIsSuccess,
    mutate: deleteTransactionMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PRODUCTS_QUEUE_PATCH_DELETE_MUTATION_ENDPOINT,
    "DELETE",
  );

  const handleVoidTransaction = () => {
    deleteTransactionMutate({
      id: productItems[0].prd_queue_code,
    });
  };

  useEffect(() => {
    if (deleteTransactionData) {
      // console.log(deleteTransactionData);
      resetTransaction();
    }
  }, [deleteTransactionData]);

  /*********METHODS FOR MODAL YESNO***********/

  const handleBilling = () => {
    setModalPRChecking(
      false,
      handleApproval(productTrackingId, transactionType, "Unpaid"),
    );
    setproductTrackingId("");
  };

  const handleDispatching = () => {
    deliveryDetailsPatchMutate({
      deliveryitems: deliveryStateData,
      queuedetails: productItems,
    });
  };

  const handleConfirmDispatching = () => {
    deliveryDetailsPatchMutate({
      deliveryitems: deliveryStateData,
      queuedetails: productItems,
      level: deliveryLevel,
    });
  };

  const handleAssignShipment = () => {
    shippingDetailsPatchMutate({
      sender: shippingMutationSender,
      receiver: shippingMutationReceiver,
      vehicle: shippingMutationVehicle,
      level: shippingMutationLevel,
      shippingdetails: shippingDetailsMutationData,
      deliveryitems: deliveryStateData,
    });
  };

  const handleAcceptShipment = () => {
    shippingConfirmationPatchMutate({
      deliveryitems: shippingStateData,
      queuedetails: productItems,
      level: deliveryLevel,
    });
  };

  const handleConfirmShipment = () => {
    deliveryDetailsPatchMutate({
      deliveryitems: shippingStateData,
      queuedetails: productItems,
      level: deliveryLevel,
    });
  };

  const handleConfirmSupplierDelivery = () => {
    // 1. Filter the active items for the current tracking ID
    const filteredItems = supplierProductItems.filter(
      (item) =>
        item.prd_queue_code === productTrackingId &&
        item.deletestatus === "Active",
    );

    // 2. Prepare the data: Sync the qtyreceivedsupplier with the actual UI Input state
    const updatedQueueDetails = filteredItems.map((item) => {
      // Check if user has typed a value; if not, default to the original item quantity
      const currentInputValue =
        inputValuesProdItems[item.inv_code] !== undefined
          ? inputValuesProdItems[item.inv_code]
          : item.quantity;

      return {
        ...item,
        // Ensure we send the input value as a number, not a string or the "total" field
        qtyreceivedsupplier: Number(currentInputValue),
      };
    });

    // 3. Calculate totals based on the SYNCED data for status logic
    const totalToReceiveQty = updatedQueueDetails.reduce((acc, item) => {
      return acc + parseFloat(item.quantity || 0);
    }, 0);

    const totalReceivedQty = updatedQueueDetails.reduce((acc, item) => {
      return acc + parseFloat(item.qtyreceivedsupplier || 0);
    }, 0);

    // 4. Determine status (Delivered if difference is 0, otherwise Partial)
    const isQtyReceivedVariance = totalToReceiveQty - totalReceivedQty;
    const status =
      Math.abs(isQtyReceivedVariance) < 0.01 ? "Delivered" : "Partial";

    // 5. Expiry Date Validation
    const hasNoExpiryRole = roles[0].some(
      (role) => role.rolename === "IMS-NOEXPIRY",
    );

    if (!hasNoExpiryRole) {
      const hasMissingExpiryDate = updatedQueueDetails.some(
        (item) => !item.expiryDate,
      );

      if (hasMissingExpiryDate) {
        setReturnmessage({
          choose: "error",
          message: "Please select expiry date for all items.",
        });
        return;
      }
    }

    // 6. Execute Mutation
    deliverySupplierPatchMutate({
      queuedetails: updatedQueueDetails,
      completetransaction: completetransaction,
      level:
        supplierProductItems[0]?.classpayee === null
          ? "SUPPLIER"
          : supplierProductItems[0]?.classpayee,
      status: status,
    });
  };

  const handleSupplierInvoice = () => {
    const total = supplierProductItems?.reduce((acc, total) => {
      return acc + total.total;
    }, 0);

    const payee = supplierProductItems[0]?.payee;
    const payeename = supplierProductItems[0]?.payeename;
    const busunitcode = supplierProductItems[0]?.orderedby;
    const busunitSelectedName = supplierProductItems[0]?.orderedbyname;
    // console.log(payee);

    let particulars = supplierProductItems
      ?.map((item) => `${item.productname} (${item.quantity})`)
      .join(", ")
      .substring(0, 50);

    const reference = supplierProductItems[0]?.prd_queue_code;

    particulars = reference + "-" + particulars;

    navigate("/disbursements", {
      state: {
        total: isSupplierVat ? parseFloat(total * 1.12).toFixed(2) : total,
        payee: payee,
        payeename: payeename,
        particulars: particulars,
        busunitcode: busunitcode,
        busunitSelectedName: busunitSelectedName,
      },
    });
  };

  const {
    data: approverData,
    isLoading: approverIsLoading,
    isError: approverIsError,
    isSuccess: approverIsSuccess,
    refetch: approverRefetch,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_USERIDS_ENDPOINT,
    "approver",
  );

  useEffect(() => {
    approverRefetch();
  }, [approverData]);

  const filteredApprover = approverData?.find(
    (approver) => approver.uuid === userId,
  );
  const visibleItemsTotal = productItems
    ?.filter(
      (item) =>
        !(
          item.prd_queue_code_new === productTrackingId &&
          ["PO", "Production", "Delivery", "Billing"].includes(transactionType)
        ),
    )
    .reduce((sum, item) => sum + item.total, 0);

  const getProductQueueCode = (productItems) => {
    if (!Array.isArray(productItems) || productItems.length === 0) return null;

    if (productItems[0].prd_queue_code_new === null) {
      return productItems[0].prd_queue_code;
    }

    return productItems.reduce(
      (min, item) => (item.prd_queue_code < min ? item.prd_queue_code : min),
      productItems[0].prd_queue_code,
    );
  };

  const getPayeeNameByQueueCode = (productItems) => {
    if (!Array.isArray(productItems) || productItems.length === 0) return null;

    const queueCode = getProductQueueCode(productItems);

    const matchingItem = productItems.find(
      (item) => item.prd_queue_code === queueCode,
    );

    return matchingItem ? matchingItem.payeename : null;
  };

  // Chart of Accounts Map

  // Query BusUnits | Stores for role checking
  const {
    data: chartOfAccountsMap,
    isLoading: chartOfAccountsMapIsLoading,
    isError: chartOfAccountsMapIsError,
    isSuccess: chartOfAccountsMapIsSuccess,
    refetch: chartOfAccountsMapRefetch,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_CHART_MAP_DATA_READ_ENDPOINT,
    "chartofaccountsmap",
  );

  const {
    data: chartOfAccountsData,
    isLoading: chartOfAccountsIsLoading,
    isError: chartOfAccountsIsError,
    isSuccess: chartOfAccountsIsSuccess,
    mutate: chartOfAccountsMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_FILTERED_CHART_OF_ACCOUNTS_READ_DATA_MUTATION,
    "POST",
  );

  useEffect(() => {
    if (productItems) {
      //Get Filtered Chart of Accounts by Store selected
      if (chartOfAccountsMap) {
        const chartClone = [...chartOfAccountsMap];

        const filteredChart = chartClone.filter(
          (items) => items.busunituuid === productItems[0].payee,
        );

        chartOfAccountsMutate({
          charttype: filteredChart[0]?.chart_id,
        });
      }
    }
  }, [productItems, chartOfAccountsMap]);

  const payeeNameFromQueue = getPayeeNameByQueueCode(productItems);

  const handlePrintSingleQR = (item) => {
    if (!item.expiryDate) return;

    const qrData = `ExpiryDate:${item.expiryDate}, InvCode:${item.inv_code}, QueueCode:${item.prd_queue_code}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      qrData,
    )}`;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
    <html>
      <head>
        <title>QR Sticker - ${item.productname}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .sticker {
            border: 1px solid #ccc;
            border-radius: 12px;
            width: 183px;
            height: 300;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px;
            box-sizing: border-box;
          }
          img {
            width: 150px;
            height: 150px;
            margin-bottom: 10px;
          }
          p {
            margin: 2px 0;
            font-size: 12px;
          }
          .name {
            font-weight: bold;
            font-size: 13px;
          }
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { height: auto; }
          }
        </style>
      </head>
      <body>
        <div class="sticker">
          <h4>${
            localStorage.getItem("companycode") === "tiu" ? "TWFI" : ""
          }</h4>
          <img src="${qrUrl}" alt="QR Code" />
          <p class="name">${item.productname || ""}</p>
          <p>Expiry: ${item.expiryDate}</p>
        </div>
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `);
    printWindow.document.close();
  };
  const handlePrintAllStickers = () => {
    const validItems = filteredItems.filter(
      (item) => item.quantity !== 0 && item.expiryDate,
    );

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            page-break-inside: avoid;
          }
          .qr-item {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
            border-radius: 8px;
            font-size: 10px;
          }
          img { width: 80px; height: 80px; }
          p { margin: 2px 0; }
          @media print {
            @page { size: A4; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <h3>QR Stickers</h3>
        <div class="grid">
          ${validItems
            .map((item) => {
              const qrData = `ExpiryDate:${item.expiryDate}, QueueCode:${item.prd_queue_code}, InvCode:${item.inv_code}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                qrData,
              )}`;
              return `
                <div class="qr-item">
                  <img src="${qrUrl}" />
                  <p><strong>${item.productname || ""}</strong></p>
                  <p>${item.inv_code || ""}</p>
                  <p>Expiry: ${item.expiryDate}</p>
                </div>
              `;
            })
            .join("")}
        </div>
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `);
    printWindow.document.close();
  };
  // Inside your component
  useEffect(() => {
    // Initialize qtyreceivedsupplier or expiryDate for any undefined/null items
    const cloneSupplierProduct = [...supplierProductItems];
    let updated = false;

    supplierProductItems.forEach((item, idx) => {
      if (item.qtyreceivedsupplier === undefined || item.expiryDate === null) {
        cloneSupplierProduct[idx] = {
          ...cloneSupplierProduct[idx],
          qtyreceivedsupplier: item.quantity,

          // If expiryDate is null, set a new expected expiry date
          expiryDate:
            (item.expiryDate === "0000-00-00" || item.expiryDate == null) &&
            item.expirydays != "0"
              ? new Date(
                  new Date().setDate(new Date().getDate() + item.expirydays),
                )
                  .toISOString()
                  .split("T")[0] // 👈 FIX — store ISO string
              : item.expiryDate,
        };

        updated = true;
      }
    });

    if (updated) {
      setSupplierProductItems(cloneSupplierProduct);
    }
  }, [supplierProductItems]);
  // Send Email Mutation
  const {
    data: poEmail,
    isLoading: poEmailIsLoading,
    mutate: sendEmailMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_SEND_EMAIL_ENDPOINT,
    "POST",
  );

  const handleSubmitEmail = async () => {
    const payload = {
      username: productItems[0].email, // change to actual logged-in user
      items: productItems.map((item) => ({
        prd_queue_code: item.prd_queue_code,
        transdate: item.transdate,
        orderedby: item.orderedby,
        orderedbyname: item.orderedbyname,
        payee: item.payee,
        payeename: item.payeename,
        address: item.address,
        productname: item.productname,
        quantity: item.quantity,
        uom: item.uom,
        uomval: item.uomval,
        cost_per_uom: item.cost_per_uom,
        total: item.total,
        pr_fullname: item.pr_fullname,
      })),
    };
    sendEmailMutate({ payload });
  };
  useEffect(() => {
    if (poEmail && poEmail.message === "Purchase Order sent successfully") {
      setIsEmailSuccess(true);
    }
  }, [poEmail]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft(secondsLeft - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (secondsLeft === 0 && isDisabled) {
      setIsDisabled(false);
    }
  }, [secondsLeft, isDisabled]);
  return (
    <>
      {showchargesdeduc && (
        <ModalPRChargeDeduc
          setshowchargesdeduc={setshowchargesdeduc}
          listofcharge={listofcharge}
          setlistofcharge={setlistofcharge}
          settriggertosavecharge={settriggertosavecharge}
          transactionno={productItems[0].prd_queue_code}
          particulars={particulars}
          amount={amount}
          setparticulars={setparticulars}
          setamount={setamount}
          baseAmount={visibleItemsTotal}
        />
      )}
      {/* ModalYesNO Start Summary */}
      {isPRPOYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setPRPOYesNoModalOpen}
          triggerYesNoEvent={handlePRPOApproval}
        />
      )}

      {isProductsSkipYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to Skip Production?"
          setYesNoModalOpen={setProductsSkipYesNoModalOpen}
          triggerYesNoEvent={handleProductsSkip}
        />
      )}

      {isProductsBuildYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setProductsBuildYesNoModalOpen}
          triggerYesNoEvent={handleProductsBuild}
        />
      )}

      {isBuildCompletedYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setBuildCompletedYesNoModalOpen}
          triggerYesNoEvent={handleCompleteProductsBuild}
        />
      )}

      {isBillingYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setBillingYesNoModalOpen}
          triggerYesNoEvent={handleBilling}
        />
      )}

      {isCollectionYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setCollectionYesNoModalOpen}
          triggerYesNoEvent={handleSubmit(handleFormSubmit)}
        />
      )}

      {isShippingYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setShippingYesNoModalOpen}
          triggerYesNoEvent={handleDeliverySubmit}
        />
      )}

      {isDispatchYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setDispatchYesNoModalOpen}
          triggerYesNoEvent={handleDispatching}
        />
      )}

      {isConfirmedDispatchYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setConfirmedDispatchYesNoModalOpen}
          triggerYesNoEvent={handleConfirmDispatching}
        />
      )}

      {isAssignShipmentYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setAssignShipmentYesNoModalOpen}
          triggerYesNoEvent={handleAssignShipment}
        />
      )}

      {isAcceptShipmentYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setAcceptShipmentYesNoModalOpen}
          triggerYesNoEvent={handleAcceptShipment}
        />
      )}

      {isConfirmShipmentYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setConfirmShipmentYesNoModalOpen}
          triggerYesNoEvent={handleConfirmShipment}
        />
      )}

      {isVoidYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setVoidYesNoModalOpen}
          triggerYesNoEvent={handleVoidTransaction}
        />
      )}

      {isConfirmSupplierYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setConfirmSupplierYesNoModalOpen}
          triggerYesNoEvent={handleConfirmSupplierDelivery}
        />
      )}
      {isConfirmpartitionYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setConfirmpartitionYesNoModalOpen}
          triggerYesNoEvent={handleButtonClick}
        />
      )}
      {isConfirmupdateYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setConfirmupdateYesNoModalOpen}
          triggerYesNoEvent={updateSupplier}
        />
      )}
      {isSendToEmailYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Do you want to continue?"
          setYesNoModalOpen={setSendToEmailYesNoModalOpen}
          triggerYesNoEvent={handleSubmitEmail}
        />
      )}
      {isEmailSuccess && (
        <ModalSuccessNavToSelf
          header={"Success"}
          message={"Email Sent Successfully"}
          button="Save"
          setIsModalOpen={setIsEmailSuccess}
        />
      )}

      {/* Edit Quantity in PR */}
      {isEditModalQty && (
        <ModalYesNoReusable
          header="Confirmation"
          message={
            `Change quantity from ${newQtyEdit.quantity} to ${newQtyEdit.newquantity}?\n\n` +
            `Unit cost: ₱${newQtyEdit.newcost.toFixed(2)}\n` +
            `New total: ₱${newQtyEdit.total_cost.toFixed(2)}`
          }
          setYesNoModalOpen={setIsEditModalQty}
          triggerYesNoEvent={handleQtyEdit}
        />
      )}

      {/* Edit Cost in PR */}
      {isEditModalCost && (
        <ModalYesNoReusable
          header="Confirmation"
          message={
            `Change cost from ₱${newCostEdit.initialcost} to ₱${newCostEdit.newcost}?\n\n` +
            `Quantity: ${newCostEdit.newquantity}\n` +
            `New total cost: ₱${newCostEdit.total_cost.toFixed(2)}`
          }
          setYesNoModalOpen={setIsEditModalCost}
          triggerYesNoEvent={handleCostEdit}
        />
      )}

      {/* ModalYesNO End Summary */}

      {/* PR/PO Print */}
      <div style={{ display: "none" }}>
        <DRToPrint
          ref={drRef}
          text={
            <>
              {/* Delivery Summary */}
              <div className="border-2 border-zinc-800 font-['Poppins-Medium'] rounded-lg overflow-hidden">
                {/* Title */}
                <div className="bg-zinc-700 text-white text-start ps-2 py-2">
                  <h3 className="text-lg font-semibold">Summary</h3>
                </div>

                {/* Column headers */}
                <div
                  className="
                    grid grid-cols-[3fr_1fr_1fr]
                    bg-gray-50 text-colorTextSecondary
                    px-4 py-2 font-semibold text-center
                  "
                >
                  <div className="text-left">Items</div>
                  <div>Quantity</div>
                  <div>UOM</div>
                  {/* <div>Price</div> */}
                </div>

                {/* Rows */}
                <div className="px-4 py-4 space-y-2">
                  {productItems.map((item, idx) =>
                    item.prd_queue_code_new === productTrackingId ? null : (
                      <div
                        key={idx}
                        className="grid grid-cols-[3fr_1fr_1fr] items-center gap-4 py-2"
                      >
                        {/* 1st col: wrap full product name */}
                        <div className="font-semibold whitespace-normal break-words">
                          {item.productname}
                        </div>

                        {/* 2nd col: quantity */}
                        {(deliveryStateData.length > 0 ||
                          isStatus === "Delivered") &&
                        (deliveryStateData[0]?.status === "Confirmed" ||
                          isStatus === "Delivered") ? (
                          <div className="font-semibold text-center">
                            {item.quantity}
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* 3rd col: UOM */}
                        {/* <div className="font-semibold text-center">
                          {`${item.uomval}${item.uom}`}
                        </div> */}

                        <div className="font-semibold text-center">
                          {item.uom}
                        </div>

                        {/* 4th col: price */}
                        {/* <div className="font-semibold text-center">
                          ₱{item.cost_per_uom} ea
                        </div> */}
                      </div>
                    ),
                  )}
                </div>
              </div>
              <h1 className="mt-10 font-['Poppins-Medium']">Received by:</h1>
            </>
          }
        />
      </div>
      {companyCode === "bagaburger" ? (
        <div style={{ display: "none" }}>
          <ComponentToPrint
            ref={componentRef}
            text={
              <>
                <style>
                  {`
                @media print {
                  @page {
                    margin: 0;
                    size: 80mm auto;
                  }

                  * {
                    margin: 0 !important;
                    padding: 0 !important;
                  }

                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 80mm !important;
                  }
                  
                  .print-container {
                    width: 80mm !important;
                    padding: 3mm !important;
                    font-family: 'Courier New', monospace !important;
                    font-size: 10px !important;
                    line-height: 1.4 !important;
                    text-align: center !important;
                  }

                  /* Header - Centered receipt style */
                  .print-container > div:first-child {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    text-align: center !important;
                    gap: 2mm !important;
                    margin-bottom: 4mm !important;
                    padding-bottom: 3mm !important;
                    border-bottom: 1px dashed #000 !important;
                  }

                  .print-container > div:first-child > div:first-child {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    gap: 1mm !important;
                  }

                  .print-container img {
                    display: none !important;
                  }

                  .print-container > div:first-child p {
                    font-size: 9px !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    text-align: center !important;
                    line-height: 1.3 !important;
                  }

                  .print-container > div:first-child h1 {
                    font-size: 12px !important;
                    margin: 2mm 0 0 0 !important;
                    padding: 0 !important;
                    text-align: center !important;
                    font-weight: bold !important;
                  }

                  /* Order/Billing Information Section */
                  .print-container > div:nth-child(2),
                  .print-container > div:nth-child(3) {
                    margin-bottom: 3mm !important;
                    padding: 2mm 0 !important;
                    text-align: left !important;
                  }

                  .print-container > div:nth-child(2) h2,
                  .print-container > div:nth-child(3) h2 {
                    display: none !important;
                  }

                  .print-container > div:nth-child(2) .grid,
                  .print-container > div:nth-child(3) .grid {
                    display: block !important;
                    gap: 0 !important;
                    padding: 0 !important;
                    font-size: 9px !important;
                  }

                  .print-container > div:nth-child(2) p,
                  .print-container > div:nth-child(3) p {
                    text-align: left !important;
                    font-size: 9px !important;
                    margin: 1mm 0 !important;
                    padding: 0 !important;
                  }

                  /* Order Summary Table */
                  .print-container .border.rounded-lg {
                    margin: 2mm 0 !important;
                    border: none !important;
                    border-radius: 0 !important;
                  }

                  .print-container .grid.grid-cols-12 {
                    display: flex !important;
                    font-size: 9px !important;
                    padding: 1mm 0 !important;
                    line-height: 1.3 !important;
                    justify-content: space-between !important;
                  }

                  .print-container .grid.grid-cols-12.bg-gray-100 {
                    font-size: 9px !important;
                    font-weight: bold !important;
                    border-bottom: 1px dashed #000 !important;
                    margin-bottom: 1mm !important;
                    padding-bottom: 1mm !important;
                  }

                  .print-container .grid.grid-cols-12 > div {
                    display: inline !important;
                  }

                  .print-container .col-span-5 {
                    text-align: left !important;
                    flex: 1 !important;
                  }

                  .print-container .col-span-2,
                  .print-container .col-span-1 {
                    text-align: center !important;
                    flex: 0 0 auto !important;
                  }

                  .print-container .text-right {
                    text-align: right !important;
                  }

                  /* Totals section */
                  .print-container > div:nth-child(4) {
                    margin-top: 2mm !important;
                    padding-top: 2mm !important;
                    border-top: 1px dashed #000 !important;
                  }

                  .print-container > div:nth-child(4) .flex.justify-end {
                    display: flex !important;
                    justify-content: space-between !important;
                    font-size: 9px !important;
                    margin: 1mm 0 !important;
                  }

                  .print-container > div:nth-child(4) .text-2xl {
                    font-size: 11px !important;
                    margin-top: 2mm !important;
                    font-weight: bold !important;
                  }

                  /* Notes section */
                  .print-container > div:nth-child(5),
                  .print-container > div:nth-child(6) {
                    padding: 2mm 0 !important;
                    margin-bottom: 2mm !important;
                    font-size: 8px !important;
                  }

                  /* Bank details section */
                  .print-container > div:nth-child(7) {
                    font-size: 8px !important;
                    text-align: center !important;
                  }

                  .print-container > div:nth-child(7) h1 {
                    font-size: 8px !important;
                    margin: 1mm 0 !important;
                  }

                  /* Signatures section */
                  .print-container > div:last-child {
                    display: none !important;
                  }
                }
              `}
                </style>

                <div className="print-container w-full max-w-4xl mx-auto p-6 text-xs print:text-[10px] font-extrabold">
                  {/* Header Section - Receipt Style */}
                  <div className="flex flex-col items-center justify-center mb-4">
                    <div className="flex flex-col items-center gap-1">
                      <p className="font-semibold text-center text-sm">
                        {(localStorage.getItem("companycode") === "tiu" &&
                          transactionType === "Billing" &&
                          productItems[0].orderedbyname
                            ?.toLowerCase()
                            .includes("b1t1")) ||
                        productItems[0].orderedbyname
                          ?.toLowerCase()
                          .includes("tah-mee") ||
                        productItems[0].orderedbyname
                          ?.toLowerCase()
                          .includes("kqt")
                          ? "TIU WORLDWIDE FRANCHISE INC."
                          : localStorage.getItem("companycode") === "tiu" &&
                              transactionType === "Billing"
                            ? "LOBO INTERNATIONAL FRANCHISE INC."
                            : bunameprint}
                      </p>
                      <p className="text-xs text-center leading-tight">
                        {(localStorage.getItem("companycode") === "tiu" &&
                          transactionType === "Billing" &&
                          productItems[0].orderedbyname
                            ?.toLowerCase()
                            .includes("b1t1")) ||
                        productItems[0].orderedbyname
                          ?.toLowerCase()
                          .includes("tah-mee") ||
                        productItems[0].orderedbyname
                          ?.toLowerCase()
                          .includes("kqt")
                          ? "UNIT 1216, 12TH FLOOR, 32ND ST. CORNER 11TH AVENUE, PARK TRIANGLE CORPORATE PLAZA BONIFACIO GLOBAL CITY TAGUIG"
                          : localStorage.getItem("companycode") === "tiu" &&
                              transactionType === "Billing"
                            ? "UNIT 26B 26TH FLOOR FORT PALM SPRING BLDG. 30TH STREET CORNER 1ST AVENUE BGC FORT BONIFACIO TAGUIG CITY"
                            : buaddressprint}
                      </p>
                    </div>

                    <div className="text-center mt-2">
                      {isStatus === "Approved" && transactionType === "PR" && (
                        <h1 className="text-base font-bold">
                          PURCHASE REQUEST
                        </h1>
                      )}
                      {isStatus === "Approved" && transactionType === "PO" && (
                        <h1 className="text-base font-bold">PURCHASE ORDER</h1>
                      )}
                      {isStatus === "Pending" && transactionType === "PO" && (
                        <h1 className="text-base font-bold">PURCHASE ORDER</h1>
                      )}
                      {isStatus === "Pending" &&
                        transactionType === "Billing" && (
                          <h1 className="text-base font-bold">
                            BILLING INVOICE
                          </h1>
                        )}
                      {transactionType === "Delivery" && (
                        <h1 className="text-base font-bold">
                          DELIVERY RECEIPT
                        </h1>
                      )}
                    </div>
                  </div>

                  {/* Order/Billing Information Section */}
                  <div
                    className={
                      transactionType === "PR" ||
                      transactionType === "PO" ||
                      transactionType === "Delivery"
                        ? "mb-6"
                        : "hidden"
                    }
                  >
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md">
                      <p>
                        <span className="font-semibold">
                          {transactionType === "PO" ? "PO No:" : "PR No:"}{" "}
                        </span>
                        {getProductQueueCode(productItems)}
                      </p>
                      <p className="text-right">
                        <span className="font-semibold">
                          Transaction date:{" "}
                        </span>
                        {productItems[0].transdate}
                      </p>
                      <p>
                        <span className="font-semibold">Ordered by: </span>
                        {productItems[0].orderedbyname}
                      </p>
                      <p className="text-right">
                        <span className="font-semibold">Delivery Type: </span>
                        {productItems[0].delivery_type}
                      </p>
                      <p>
                        <span className="font-semibold">Payee: </span>
                        {productItems[0].payeename}
                      </p>
                    </div>
                  </div>

                  {/* Billing Information Section */}
                  <div
                    className={
                      transactionType === "Billing" ? "mb-6" : "hidden"
                    }
                  >
                    <h2 className="text-xl font-semibold text-center mb-4">
                      ORDER INFORMATION
                    </h2>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md">
                      <p>
                        <span className="font-semibold">Invoice No: </span>
                        {productItems[0].prd_queue_code}
                      </p>
                      <p>
                        <span className="font-semibold">Invoice date: </span>
                        {productItems[0].transdate}
                      </p>
                      <p>
                        <span className="font-semibold">Terms: </span>.
                      </p>
                      <p>
                        <span className="font-semibold">Ordered by: </span>
                        {productItems[0].orderedbyname}
                      </p>

                      <p>
                        <span className="font-semibold">Payee: </span>
                        {productItems[0].payeename}
                      </p>

                      <p>
                        <span className="font-semibold">Adress:</span>{" "}
                        {productItems[0].address}
                      </p>
                    </div>
                  </div>

                  {/* Order Summary Table */}
                  <div className="mb-6">
                    {(transactionType === "PR" || transactionType === "PO") && (
                      <h2 className="text-lg font-semibold text-gray-700 mb-2">
                        Order Summary
                      </h2>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-gray-100 p-2 font-medium">
                        <div className="col-span-5">Item|</div>
                        <div className="col-span-2 text-center px-1">
                          Quantity|
                        </div>
                        <div className="col-span-1 text-center px-1">Uom</div>
                        {transactionType !== "PR" && (
                          <>
                            <div className="col-span-2 text-center px-1">
                              Cost|
                            </div>
                            <div className="col-span-2 text-right px-1">
                              Total Cost|
                            </div>
                          </>
                        )}
                      </div>

                      {/* Table Body */}
                      {productItems &&
                        productItems.map((item, index) =>
                          item.prd_queue_code_new ===
                          productTrackingId ? null : (
                            <div
                              key={index}
                              className={`grid grid-cols-12 p-2 ${
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }${
                                item.prd_queue_code_new === productTrackingId &&
                                transactionType === "Billing"
                                  ? "hidden"
                                  : ""
                              }`}
                            >
                              <div className="col-span-5 truncate">
                                {item.productname}|
                              </div>
                              <div className="col-span-2 text-center px-1">
                                ({item.quantity})|
                              </div>
                              <div className="col-span-1 text-center px-1">
                                {`${item.uomval} ${item.uom}`}|
                              </div>
                              {transactionType !== "PR" && (
                                <>
                                  <div className="col-span-2 text-center px-1">
                                    (₱{item.cost_per_uom})|
                                  </div>
                                  <div className="col-span-2 text-right px-1">
                                    (₱{item.total})|
                                  </div>
                                </>
                              )}
                              {item.deletestatus == "Inactive" && (
                                <div className="text-red-600 col-span-2 text-right">
                                  Voided
                                </div>
                              )}
                            </div>
                          ),
                        )}
                    </div>
                    <div className="flex flex-row w-full justify-end pe-10 text-sm">
                      <div className="flex space-x-10">
                        <p className="w-32 text-bold">Subtotal:</p>
                        <p className="w-28 text-end">
                          {transactionType !== "PR"
                            ? visibleItemsTotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                    {listofcharge &&
                      listofcharge.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-row w-full justify-end pe-10 text-sm"
                        >
                          {transactionType !== "PR" && (
                            <div className="flex space-x-10">
                              <p className="w-32 text-bold">
                                {item.particulars}
                                {":"}
                              </p>
                              <p className="w-28 text-end">
                                {item.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Total */}
                    {transactionType !== "PR" && (
                      <div className="flex justify-end mt-3 text-2xl font-bold">
                        <div className="bg-gray-200 px-4 py-2 rounded font-semibold">
                          Total: ₱
                          {parseFloat(
                            visibleItemsTotal + totalchargededuc,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  {productItems[0].notes !== "" && (
                    <div className="mb-6 bg-gray-50 p-3 rounded-md">
                      <h3 className="font-medium text-gray-700">Note</h3>
                      <p className="text-gray-600">{productItems[0].notes}</p>
                    </div>
                  )}

                  {(localStorage.getItem("companycode") === "tiu" &&
                    transactionType === "Billing" &&
                    productItems[0].orderedbyname
                      ?.toLowerCase()
                      .includes("b1t1")) ||
                  productItems[0].orderedbyname
                    ?.toLowerCase()
                    .includes("tah-mee") ||
                  productItems[0].orderedbyname
                    ?.toLowerCase()
                    .includes("kqt") ? (
                    <div className="flex w-full flex-col justify-end items-end pb-2 text-xs text-slate-800">
                      <h1 className="flex w-full text-sm">
                        Please see below our Bank Details.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT : BDO - TIU WORLDWIDE FRANCHISE INC.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT NUMBER : 0036 - 4801 - 9674
                      </h1>
                      <h1 className="flex w-full text-sm">
                        NOTE: Kindly put the Franchisee's name on "payor's name"
                        on every deposit slip.
                      </h1>
                    </div>
                  ) : localStorage.getItem("companycode") === "tiu" &&
                    transactionType === "Billing" ? (
                    <div className="flex w-full flex-col justify-end items-end pb-2 text-xs text-slate-800">
                      <h1 className="flex w-full text-sm">
                        Please see below our Bank Details.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT : BDO - LOBO INTERNATIONAL FRANCHISE INC.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT NUMBER : 0036 - 4802 - 3051
                      </h1>
                      <h1 className="flex w-full text-sm">
                        NOTE: Kindly put the Franchisee's name on "payor's name"
                        on every deposit slip.
                      </h1>
                    </div>
                  ) : (
                    ""
                  )}

                  {/* Signatures Section */}
                  <div
                    className={
                      transactionType === "Billing" &&
                      localStorage.getItem("companycode") === "tiu"
                        ? "grid grid-cols-3 gap-8 mt-12"
                        : "grid grid-cols-2 gap-8 mt-12"
                    }
                  >
                    <div className="text-center pt-6">
                      <p className="mb-1">{productItems[0].fullname}</p>
                      <div className="border-t pt-1">
                        <p className="font-medium">Prepared by</p>
                      </div>
                    </div>
                    {localStorage.getItem("companycode") === "tiu" &&
                      transactionType === "Billing" && (
                        <div className="flex flex-col w-1/2 mx-10 text-center pt-6 space-y-1">
                          <h1 className="text-xs">Michael P. Gida</h1>
                          <h1 className="flex justify-center w-full border-t-2 pt-1">
                            Checked by:
                          </h1>
                        </div>
                      )}

                    <div className="text-center">
                      {transactionType === "PR" || transactionType === "PO" ? (
                        <>
                          <p
                            className={
                              productItems[0]?.po_fullname
                                ? "mb-1"
                                : "mb-8 opacity-0"
                            }
                          >
                            {transactionType == "PR"
                              ? productItems[0]?.pr_fullname
                              : productItems[0]?.po_fullname}
                          </p>
                          <div className="border-t pt-1">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </>
                      ) : localStorage.getItem("companycode") !== "tiu" ? (
                        <>
                          <p
                            className={
                              productItems[0]?.pr_fullname
                                ? "mb-1"
                                : "mb-11 opacity-0 "
                            }
                          >
                            {productItems[0].pr_fullname}
                          </p>
                          <div className="border-t">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </>
                      ) : (
                        <div className="pt-6">
                          <p
                            className={
                              productItems[0]?.pr_fullname
                                ? "mb-1"
                                : "mb-12 opacity-0"
                            }
                          >
                            Mon Peñero
                          </p>
                          <div className="border-t pt-1">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            }
          />
        </div>
      ) : (
        <div style={{ display: "none" }}>
          <ComponentToPrint
            ref={componentRef}
            text={
              <>
                <style>
                  {`
            @media print {
              @page {
                margin: 5mm;
                size: auto;
              }

              /* Only apply thermal styling for 80mm paper */
              @media (max-width: 80mm) {
                @page {
                  margin: 0;
                  size: 80mm auto;
                }

                body {
                  margin: 0;
                  padding: 0;
                }
                
                .print-container {
                  width: 80mm !important;
                  padding: 4mm !important;
                  font-family: 'Courier New', monospace !important;
                  font-size: 9pt !important;
                  line-height: 1.3 !important;
                }

                /* Header - Center everything on thermal */
                .print-container > div:first-child {
                  flex-direction: column !important;
                  align-items: center !important;
                  text-align: center !important;
                  gap: 2mm !important;
                  margin-bottom: 3mm !important;
                }

                .print-container > div:first-child > div:first-child {
                  flex-direction: column !important;
                  align-items: center !important;
                  gap: 2mm !important;
                }

                .print-container img {
                  width: 12mm !important;
                  height: auto !important;
                }

                .print-container > div:first-child p {
                  font-size: 8pt !important;
                  margin: 0.5mm 0 !important;
                  text-align: center !important;
                }

                .print-container > div:first-child h1 {
                  font-size: 10pt !important;
                  margin: 1mm 0 !important;
                  text-align: center !important;
                }

                /* Order/Billing Information Section */
                .print-container > div:nth-child(2),
                .print-container > div:nth-child(3) {
                  margin-bottom: 3mm !important;
                }

                .print-container > div:nth-child(2) h2,
                .print-container > div:nth-child(3) h2 {
                  font-size: 9pt !important;
                  margin-bottom: 2mm !important;
                }

                .print-container > div:nth-child(2) .grid,
                .print-container > div:nth-child(3) .grid {
                  grid-template-columns: 1fr !important;
                  gap: 1mm !important;
                  padding: 2mm !important;
                  font-size: 8pt !important;
                }

                .print-container > div:nth-child(2) p,
                .print-container > div:nth-child(3) p {
                  text-align: left !important;
                  font-size: 8pt !important;
                  margin: 0.5mm 0 !important;
                }

                /* Order Summary Table */
                .print-container .border.rounded-lg {
                  margin: 2mm 0 !important;
                }

                .print-container .grid.grid-cols-12 {
                  font-size: 7pt !important;
                  padding: 1mm !important;
                  line-height: 1.2 !important;
                }

                .print-container .grid.grid-cols-12.bg-gray-100 {
                  font-size: 8pt !important;
                  font-weight: bold !important;
                }

                /* Totals section */
                .print-container > div:nth-child(4) .flex.justify-end {
                  font-size: 8pt !important;
                  margin: 1mm 0 !important;
                }

                .print-container > div:nth-child(4) .text-2xl {
                  font-size: 10pt !important;
                  margin-top: 2mm !important;
                }

                /* Notes section */
                .print-container > div:nth-child(5),
                .print-container > div:nth-child(6) {
                  padding: 2mm !important;
                  margin-bottom: 2mm !important;
                  font-size: 8pt !important;
                }

                /* Bank details section */
                .print-container > div:nth-child(7) h1 {
                  font-size: 7pt !important;
                  margin: 0.5mm 0 !important;
                }

                /* Signatures section */
                .print-container > div:last-child {
                  grid-template-columns: 1fr !important;
                  gap: 4mm !important;
                  margin-top: 6mm !important;
                }

                .print-container > div:last-child > div {
                  padding-top: 2mm !important;
                }

                .print-container > div:last-child p {
                  font-size: 8pt !important;
                  margin-bottom: 0.5mm !important;
                }

                .print-container > div:last-child .border-t {
                  padding-top: 0.5mm !important;
                  font-size: 7pt !important;
                }
              }
            }
          `}
                </style>

                <div className="print-container w-full max-w-4xl mx-auto p-6 text-xs print:text-[10px]">
                  {/* Header Section */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      {(localStorage.getItem("companycode") === "tiu" &&
                        transactionType === "Billing" &&
                        productItems[0].orderedbyname
                          ?.toLowerCase()
                          .includes("b1t1")) ||
                      productItems[0].orderedbyname
                        ?.toLowerCase()
                        .includes("tah-mee") ||
                      productItems[0].orderedbyname
                        ?.toLowerCase()
                        .includes("kqt") ? (
                        <>
                          <img
                            src={`${BusunitLogo}${"BU-c09e5f9bf892"}.png`}
                            alt="Company Logo"
                            className="w-16"
                          />
                          <div>
                            <p className="font-medium">
                              TIU WORLDWIDE FRANCHISE INC.
                            </p>
                            <p className="text-gray-600">
                              UNIT 1216, 12TH FLOOR, 32ND ST. CORNER 11TH
                              AVENUE, PARK TRIANGLE CORPORATE PLAZA BONIFACIO
                              GLOBAL CITY TAGUIG
                            </p>
                          </div>
                        </>
                      ) : localStorage.getItem("companycode") === "tiu" &&
                        transactionType === "Billing" ? (
                        <>
                          <img
                            src={`${BusunitLogo}${"BU-fd69e4c21112"}.png`}
                            alt="Company Logo"
                            className="w-16"
                          />
                          <div>
                            <p className="font-medium">
                              LOBO INTERNATIONAL FRANCHISE INC.
                            </p>
                            <p className="text-gray-600">
                              UNIT 26B 26TH FLOOR FORT PALM SPRING BLDG. 30TH
                              STREET CORNER 1ST AVENUE BGC FORT BONIFACIO TAGUIG
                              CITY
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <img
                            src={`${BusunitLogo}${imsBusunitCodeSelected}.png`}
                            alt="Company Logo"
                            className="w-16"
                          />
                          <div>
                            <p className="font-medium">{bunameprint}</p>
                            <p className="text-gray-600">{buaddressprint}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      {isStatus === "Approved" && transactionType === "PR" && (
                        <h1 className="text-2xl font-bold text-gray-800">
                          Purchase Request
                        </h1>
                      )}
                      {isStatus === "Approved" && transactionType === "PO" && (
                        <h1 className="text-2xl font-bold text-gray-800">
                          Purchase Order
                        </h1>
                      )}
                      {isStatus === "Pending" && transactionType === "PO" && (
                        <h1 className="text-2xl font-bold text-gray-800">
                          Purchase Order
                        </h1>
                      )}
                      {isStatus === "Pending" &&
                        transactionType === "Billing" && (
                          <h1 className="text-2xl font-bold text-gray-800">
                            Billing Invoice
                          </h1>
                        )}
                      {transactionType === "Delivery" && (
                        <h1 className="text-2xl font-bold text-gray-800">
                          Delivery Receipt
                        </h1>
                      )}
                    </div>
                  </div>

                  {/* Order Information Section */}
                  <div
                    className={
                      transactionType === "PR" ||
                      transactionType === "PO" ||
                      transactionType === "Delivery"
                        ? "mb-6"
                        : "hidden"
                    }
                  >
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md">
                      <p>
                        <span className="font-semibold">
                          {transactionType === "PO" ? "PO No:" : "PR No:"}{" "}
                        </span>
                        {getProductQueueCode(productItems)}
                      </p>
                      <p className="text-right">
                        <span className="font-semibold">
                          Transaction date:{" "}
                        </span>
                        {productItems[0].transdate}
                      </p>
                      <p>
                        <span className="font-semibold">Ordered by: </span>
                        {productItems[0].orderedbyname}
                      </p>
                      <p className="text-right">
                        <span className="font-semibold">Delivery Type: </span>
                        {productItems[0].delivery_type}
                      </p>
                      <p>
                        <span className="font-semibold">Payee: </span>
                        {productItems[0].payeename}
                      </p>
                    </div>
                  </div>

                  {/* Billing Information Section */}
                  <div
                    className={
                      transactionType === "Billing" ? "mb-6" : "hidden"
                    }
                  >
                    <h2 className="text-xl font-semibold text-center mb-4">
                      ORDER INFORMATION
                    </h2>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md">
                      <p>
                        <span className="font-semibold">Invoice No: </span>
                        {productItems[0].prd_queue_code}
                      </p>
                      <p>
                        <span className="font-semibold">Invoice date: </span>
                        {productItems[0].transdate}
                      </p>
                      <p>
                        <span className="font-semibold">Terms: </span>.
                      </p>
                      <p>
                        <span className="font-semibold">Ordered by: </span>
                        {productItems[0].orderedbyname}
                      </p>

                      <p>
                        <span className="font-semibold">Payee: </span>
                        {productItems[0].payeename}
                      </p>

                      <p>
                        <span className="font-semibold">Adress:</span>{" "}
                        {productItems[0].address}
                      </p>
                    </div>
                  </div>

                  {/* Order Summary Table */}
                  <div className="mb-6">
                    {(transactionType === "PR" || transactionType === "PO") && (
                      <h2 className="text-lg  font-semibold text-gray-700 mb-2">
                        Order Summary
                      </h2>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-gray-100 p-2 font-medium">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-2 text-center">Quantity</div>
                        <div className="col-span-1 text-center">Uom</div>
                        {transactionType !== "PR" && (
                          <>
                            <div className="col-span-2 text-center">Cost</div>
                            <div className="col-span-2 text-right">
                              Total Cost
                            </div>
                          </>
                        )}
                      </div>

                      {/* Table Body */}
                      {productItems &&
                        productItems.map((item, index) =>
                          item.prd_queue_code_new ===
                          productTrackingId ? null : (
                            <div
                              key={index}
                              className={`grid grid-cols-12 p-2 ${
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }${
                                item.prd_queue_code_new === productTrackingId &&
                                transactionType === "Billing"
                                  ? "hidden"
                                  : ""
                              }`}
                            >
                              <div className="col-span-5 truncate">
                                {item.productname}
                              </div>
                              <div className="col-span-2 text-center">
                                {item.quantity}
                              </div>
                              <div className="col-span-1 text-center">{`${item.uomval}${item.uom}`}</div>
                              {transactionType !== "PR" && (
                                <>
                                  <div className="col-span-2 text-center">
                                    ₱{item.cost_per_uom} ea
                                  </div>
                                  <div className="col-span-2 text-right">
                                    ₱{item.total}
                                  </div>
                                </>
                              )}
                              {item.deletestatus == "Inactive" && (
                                <div className=" text-red-600 col-span-2 text-right">
                                  Voided
                                </div>
                              )}
                            </div>
                          ),
                        )}
                    </div>
                    <div className="flex flex-row w-full justify-end pe-10 text-sm">
                      <div className="flex space-x-10">
                        <p className="w-32 text-bold">Subtotal:</p>
                        <p className="w-28 text-end">
                          {transactionType !== "PR"
                            ? visibleItemsTotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                    {listofcharge &&
                      listofcharge.map((item, index) => (
                        <div className="flex flex-row w-full justify-end pe-10 text-sm">
                          {transactionType !== "PR" && (
                            <div className="flex space-x-10">
                              <p className="w-32 text-bold">
                                {item.particulars}
                                {":"}
                              </p>
                              <p className="w-28 text-end">
                                {item.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Total */}
                    {transactionType !== "PR" && (
                      <div className="flex justify-end mt-3 text-2xl font-bold">
                        <div className="bg-gray-200 px-4 py-2 rounded font-semibold">
                          Total: ₱
                          {parseFloat(
                            visibleItemsTotal + totalchargededuc,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  {productItems[0].notes !== "" && (
                    <div className="mb-6 bg-gray-50 p-3 rounded-md">
                      <h3 className="font-medium text-gray-700">Note</h3>
                      <p className="text-gray-600">{productItems[0].notes}</p>
                    </div>
                  )}

                  {(localStorage.getItem("companycode") === "tiu" &&
                    transactionType === "Billing" &&
                    productItems[0].orderedbyname
                      ?.toLowerCase()
                      .includes("b1t1")) ||
                  productItems[0].orderedbyname
                    ?.toLowerCase()
                    .includes("tah-mee") ||
                  productItems[0].orderedbyname
                    ?.toLowerCase()
                    .includes("kqt") ? (
                    <div className="flex w-full flex-col justify-end items-end pb-2 text-xs text-slate-800">
                      <h1 className="flex w-full text-sm">
                        Please see below our Bank Details.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT : BDO - TIU WORLDWIDE FRANCHISE INC.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT NUMBER : 0036 - 4801 - 9674
                      </h1>
                      <h1 className="flex w-full text-sm">
                        NOTE: Kindly put the Franchisee's name on "payor's name"
                        on every deposit slip.
                      </h1>
                    </div>
                  ) : localStorage.getItem("companycode") === "tiu" &&
                    transactionType === "Billing" ? (
                    <div className="flex w-full flex-col justify-end items-end pb-2 text-xs text-slate-800">
                      <h1 className="flex w-full text-sm">
                        Please see below our Bank Details.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT : BDO - LOBO INTERNATIONAL FRANCHISE INC.
                      </h1>
                      <h1 className="flex w-full text-sm">
                        BANK ACCOUNT NUMBER : 0036 - 4802 - 3051
                      </h1>
                      <h1 className="flex w-full text-sm">
                        NOTE: Kindly put the Franchisee's name on "payor's name"
                        on every deposit slip.
                      </h1>
                    </div>
                  ) : (
                    ""
                  )}

                  {/* Signatures Section */}
                  <div
                    className={
                      transactionType === "Billing" &&
                      localStorage.getItem("companycode") === "tiu"
                        ? "grid grid-cols-3 gap-8 mt-12"
                        : "grid grid-cols-2 gap-8 mt-12"
                    }
                  >
                    <div className="text-center pt-6">
                      <p className="mb-1">{productItems[0].fullname}</p>
                      <div className="border-t pt-1">
                        <p className="font-medium">Prepared by</p>
                      </div>
                    </div>
                    {localStorage.getItem("companycode") === "tiu" &&
                      transactionType === "Billing" && (
                        <div className="flex flex-col w-1/2 mx-10 text-center pt-6 space-y-1">
                          <h1 className="text-xs">Michael P. Gida</h1>
                          <h1 className="flex justify-center w-full  border-t-2 pt-1">
                            Checked by:
                          </h1>
                        </div>
                      )}

                    <div className="text-center">
                      {transactionType === "PR" || transactionType === "PO" ? (
                        <>
                          <p
                            className={
                              productItems[0]?.po_fullname
                                ? "mb-1"
                                : "mb-8 opacity-0"
                            }
                          >
                            {transactionType == "PR"
                              ? productItems[0]?.pr_fullname
                              : productItems[0]?.po_fullname}
                          </p>
                          <div className="border-t pt-1">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </>
                      ) : localStorage.getItem("companycode") !== "tiu" ? (
                        <>
                          <p
                            className={
                              productItems[0]?.pr_fullname
                                ? "mb-1"
                                : "mb-11 opacity-0 "
                            }
                          >
                            {productItems[0].pr_fullname}
                          </p>
                          <div className="border-t">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </>
                      ) : (
                        <div className="pt-6">
                          <p
                            className={
                              productItems[0]?.pr_fullname
                                ? "mb-1"
                                : "mb-12 opacity-0"
                            }
                          >
                            Mon Peñero
                          </p>
                          <div className="border-t pt-1">
                            <p className="font-medium">Approved by</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            }
          />
        </div>
      )}

      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0 px-5 lg:px-0">
        <div
          onClick={(e) => {
            if (e.target.id === "closingdiv") {
              setModalPRChecking(false);
              setproductTrackingId("");
              setBuildComponentsById([]);
            }
          }}
          id="closingdiv"
          className="flex flex-row justify-center p-5 pt-20 lg:ms-10 lg:px-10 lg:pt-10 h-screen z-20 bg-opacity-100"
        >
          <div className="flex flex-col justify-start w-full lg:w-1/2 ">
            <div className="lg:scale-100  flex flex-col scrollbar  overflow-y-auto  lg:mt-10 h-auto pb-5 shadow-2xl rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row relative justify-center text-white w-full  bg-gradient-to-br from-colorBrand via-redAccent  to-colorBrandSecondary rounded-t-xl p-1"></div>

              {/* Header Section */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6 transition-all duration-300 hover:shadow-lg">
                {/* Header with toggle */}
                <div
                  className="flex justify-between items-center mb-4 cursor-pointer"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <div className="flex items-center">
                    <FiFileText className="text-colorBrand mr-2 h-5 w-5" />
                    <h2 className="text-lg font-bold text-gray-800">
                      Transaction Details
                    </h2>
                  </div>
                  <button className="text-gray-500 hover:text-colorBrand transition-colors">
                    {isExpanded ? (
                      <FiChevronUp className="h-5 w-5" />
                    ) : (
                      <FiChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Collapsible content */}
                {isExpanded && (
                  <div className="space-y-4 transition-all duration-300">
                    {/* Transaction number with badge */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pb-3 border-b border-gray-100">
                      <div className="flex items-center">
                        <div className="bg-blue-50 text-colorBrand px-3 py-2 rounded-md flex items-center">
                          <span className="font-medium mr-2">
                            {transactionType === "PO" ? "PO No:" : "PR No:"}
                          </span>
                          <span className="text-colorBrand font-bold">
                            {getProductQueueCode(productItems)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <FiCalendar className="mr-2 h-4 w-4" />
                        <span className="text-sm">
                          Transaction date: {productItems[0].transdate}
                        </span>
                      </div>
                    </div>

                    {/* Ordered by */}
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        <FiUser className="text-gray-500 mr-2 h-4 w-4" />
                        <span className="text-gray-700">Ordered by:</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {productItems[0].orderedbyname}
                      </span>
                    </div>

                    {/* Payee info - only shown for certain transaction types */}
                    {transactionType !== "PR" && (
                      <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-md">
                        <div className="flex items-center">
                          <FiCreditCard className="text-colorBrand mr-2 h-4 w-4" />
                          <span className="text-gray-700">Payee:</span>
                        </div>
                        <span className="font-semibold text-gray-800">
                          {payeeNameFromQueue}
                        </span>
                      </div>
                    )}
                    {productItems[0]?.notes?.trim() !== "" && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-white shadow-sm flex-shrink-0">
                            <FiCreditCard className="text-colorBrand h-4 w-4" />
                          </div>

                          <div className="flex flex-col w-full">
                            <span className="text-xs font-medium uppercase tracking-wide text-blue-600 mb-1">
                              Note
                            </span>

                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                              {productItems[0].notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Supplier selection - conditionally rendered */}
                    {(!payeeNameFromQueue || payeeNameFromQueue === "") &&
                      transactionType === "PO" &&
                      selectedItems.length < 1 && (
                        <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              Payee:
                              {isPayeeError && (
                                <span className="text-red-500 text-sm font-medium animate-pulse">
                                  * Set Supplier First
                                </span>
                              )}
                            </label>

                            <Dropdown
                              label={""}
                              value={payeeName}
                              isRequired={false}
                              optionsList={
                                productItems[0]?.["class"] === "STORE"
                                  ? (suppliersData ?? []).filter((s) =>
                                      s.supplier_code?.startsWith("BU"),
                                    )
                                  : productItems[0]?.["class"] === "COMMI"
                                    ? (suppliersData ?? []).filter((s) =>
                                        s.supplier_code?.startsWith("SP"),
                                      )
                                    : (suppliersData ?? [])
                              }
                              optionsField01={"supplier_code"}
                              optionsField02={"supplier_name"}
                              allowCustom={false}
                              enableBrandColor={true}
                              onChange={(selectedID, selectedValue) => {
                                setPayeeNameCode(selectedID);
                                setPayeeName(selectedValue);
                              }}
                            />

                            {payeeNameCode !== "" && (
                              <button
                                onClick={() =>
                                  setConfirmupdateYesNoModalOpen(true)
                                }
                                className="mt-3 bg-colorBrand text-white px-4 py-2 rounded-md hover:bg-colorBrand transition-colors duration-200 flex items-center justify-center w-full sm:w-auto"
                              >
                                <FiUser className="mr-2 h-4 w-4" />
                                Set Supplier
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
              {/* ✅ PRINT ALL BUTTON */}
              {(transactionType === "Production" ||
                transactionType === "Delivery") &&
                isStatus === "Delivered" &&
                supplierProductItems[0]?.expiryDate &&
                supplierProductItems[0]?.expiryDate != "0000-00-00" &&
                (console.log(supplierProductItems[0]?.expiryDate),
                (
                  <div className="flex md:justify-end w-full  ">
                    <button
                      onClick={handlePrintAllStickers}
                      className="bg-colorBrand hover:bg-colorBrandSecondary w-full md:w-48 text-white font-semibold py-2 px-4 rounded-lg duration-200"
                    >
                      🖨️ Print All Stickers
                    </button>
                  </div>
                ))}

              {/* Item Section & Order Summary Section */}
              {roles[0].findIndex(
                (item) => item.rolename === "IMS-DISPATCHER",
              ) === -1 && (
                <>
                  <div className="flex flex-col  p-5 px-10 w-full bg-gray-50 rounded-lg">
                    <h1 className="text-xl  font-bold text-gray-800 mb-2 border-b pb-2">
                      Order Summary
                    </h1>

                    {/* Header Row */}
                    <div className="lg:flex flex-col lg:flex-row hidden items-center text-white bg-colorBrand justify-between py-3 px-4 shadow-lg rounded-t-lg  font-medium">
                      <p className="w-12"></p>
                      <div className="flex-1">
                        <p>Item</p>
                      </div>
                      <p className="flex w-24 justify-center">Quantity</p>
                      <p className="flex w-24 justify-center">Uom</p>
                      {transactionType !== "PR" && (
                        <p className="flex w-24 justify-end">Cost</p>
                      )}
                      {isStatus === "In Progress" &&
                        !roles[0]?.some(
                          (item) => item.rolename === "IMS-NOEXPIRY",
                        ) && (
                          <p className="flex w-24 justify-center">
                            Expiry Date
                          </p>
                        )}
                      {supplierProductItems[0]?.expiryDate &&
                        supplierProductItems[0]?.expiryDate != "0000-00-00" && (
                          <p className="flex w-24 justify-center">QR</p>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="">
                      {productItems &&
                        productItems.map((item, index) => (
                          <div
                            key={index}
                            className={`${
                              item.prd_queue_code_new === productTrackingId &&
                              (transactionType === "PO" ||
                                transactionType === "Production" ||
                                transactionType === "Delivery" ||
                                transactionType === "Billing")
                                ? "hidden"
                                : ""
                            }`}
                          >
                            <div className="bg-white shadow-md  border cursor-pointer overflow-hidden transition-all duration-200 hover:bg-colorBrandLighter">
                              <div className="flex flex-col lg:flex-row lg:gap-0 items-start lg:items-center text-sm justify-start py-3 px-4 w-full">
                                {/* Checkbox for PO */}
                                {item.prd_queue_code_new == null &&
                                  (item.payee === "Default Department" ||
                                    item.payee === "") &&
                                  transactionType === "PO" &&
                                  isStatus === "Pending" && (
                                    <input
                                      type="checkbox"
                                      className="w-5 h-5 mr-2 accent-colorBrand"
                                      onChange={() =>
                                        handleCheckboxChange(
                                          item.inv_code,
                                          item.prd_queue_code,
                                        )
                                      }
                                      checked={selectedItems.some(
                                        (selected) =>
                                          selected.inv_code === item.inv_code &&
                                          selected.prd_queue_code ===
                                            item.prd_queue_code,
                                      )}
                                    />
                                  )}
                                {/* Voided Status */}
                                {item.deletestatus == "Inactive" && (
                                  <div className="flex flex-row text-red-600 self-end lg:self-center border border-red-300 px-2 py-1 mt-2 lg:mt-0 rounded-full text-xs font-medium">
                                    Voided
                                  </div>
                                )}
                                {/* Product Icon */}
                                <div className="w-12 flex items-center justify-center">
                                  <FiBox className="w-6 h-6 text-gray-600" />
                                </div>
                                {/* Product Name */}
                                <div className="flex-1 mb-2 lg:mb-0">
                                  <span className="font-semibold self-end lg:self-start bg-gradient-to-br from-colorBrand via-colorBrand to-colorBrand text-white px-3 py-1 shadow-md rounded-md">
                                    {item.productname}
                                  </span>
                                </div>
                                {/* Quantity and UOM Logic */}
                                <>
                                  {/* Edit Quantity */}
                                  <div className="flex flex-row items-center lg:justify-center w-24">
                                    {editableQtyIndex === index &&
                                    roles[0].some(
                                      (item) =>
                                        item.rolename === `IMS-PRICING EDITOR`,
                                    ) ? (
                                      <input
                                        type="number"
                                        autoFocus
                                        value={
                                          qtyInputValues[item.inv_code] !==
                                          undefined
                                            ? qtyInputValues[item.inv_code]
                                            : item.quantity
                                        }
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setQtyInputValues((prev) => ({
                                            ...prev,
                                            [item.inv_code]: v,
                                          }));
                                        }}
                                        onBlur={() => {
                                          const newQty = parseFloat(
                                            qtyInputValues[item.inv_code] ??
                                              item.quantity,
                                          );
                                          const currentCost = parseFloat(
                                            costInputValues[item.inv_code] !==
                                              undefined
                                              ? costInputValues[item.inv_code]
                                              : item.cost_per_uom,
                                          );
                                          const totalCost =
                                            newQty * currentCost;

                                          if (
                                            true
                                            // window.confirm(
                                            //   `Change quantity from ${item.quantity} to ${newQty}?\n\n` +
                                            //     `Unit cost: ₱${currentCost.toFixed(
                                            //       2
                                            //     )}\n` +
                                            //     `New total: ₱${totalCost.toFixed(
                                            //       2
                                            //     )}`
                                            // )
                                          ) {
                                            newQty <= 0
                                              ? alert(
                                                  "Qty cannot be less than or equal to 0",
                                                )
                                              : setIsEditModalQty(true);
                                            setNewQtyEdit({
                                              quantity: item.quantity,
                                              newcost: currentCost,
                                              newquantity: newQty,
                                              total_cost: totalCost,
                                              inv_code: item.inv_code,
                                              prd_queue_code:
                                                item.prd_queue_code,
                                              newtotalcost:
                                                visibleItemsTotal +
                                                (totalCost - item.total),
                                            });
                                          }

                                          setEditableQtyIndex(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            e.target.blur();
                                          if (e.key === "Escape")
                                            setEditableQtyIndex(null);
                                        }}
                                        className="w-16 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-colorBrand"
                                      />
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <div
                                          // onDoubleClick={() => {
                                          //   setEditableQtyIndex(index);
                                          //   setQtyInputValues((prev) => ({
                                          //     ...prev,
                                          //     [item.inv_code]: item.quantity,
                                          //   }));
                                          // }}
                                          className="text-colorBrand font-medium cursor-pointer"
                                        >
                                          {item.quantity}
                                        </div>
                                        {isStatus !== "Approved" &&
                                          transactionType === "PO" && (
                                            <FiEdit
                                              size={16}
                                              className="text-redAccent hover:text-colorBrand cursor-pointer"
                                              onClick={() => {
                                                setEditableQtyIndex(index);
                                                setQtyInputValues((prev) => ({
                                                  ...prev,
                                                  [item.inv_code]:
                                                    item.quantity,
                                                }));
                                              }}
                                            />
                                          )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-gray-700 flex flex-row space-x-1 lg:justify-center w-24 py-1">
                                    <span className="lg:hidden mr-2">UOM:</span>
                                    <p>{`${item.uomval}${item.uom}`}</p>
                                  </div>

                                  {/* EDIT COST SECTION */}
                                  {transactionType !== "PR" && (
                                    <div className="text-gray-700 border-t lg:border-0 flex flex-row items-center lg:justify-end w-32 py-1 space-x-1">
                                      <span className="lg:hidden mr-2">
                                        {transactionType !== "PR" && "Cost:"}
                                      </span>

                                      {/** If this row is in “editing” mode, show an input; otherwise show text + edit icon */}
                                      {editableCostIndex === index &&
                                      roles[0].some(
                                        (item) =>
                                          item.rolename ===
                                          `IMS-PRICING EDITOR`,
                                      ) ? (
                                        <input
                                          type="number"
                                          autoFocus
                                          value={
                                            costInputValues[item.inv_code] !==
                                            undefined
                                              ? costInputValues[item.inv_code]
                                              : item.cost_per_uom
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setCostInputValues((prev) => ({
                                              ...prev,
                                              [item.inv_code]: value,
                                            }));
                                          }}
                                          onBlur={() => {
                                            const newCost = parseFloat(
                                              costInputValues[item.inv_code] ??
                                                item.cost_per_uom,
                                            );
                                            const totalCost =
                                              newCost * item.quantity;

                                            // ask for confirmation before “saving”:
                                            if (true) {
                                              newCost <= 0
                                                ? alert(
                                                    "New cost cannot be equal or less than to 0",
                                                  )
                                                : setIsEditModalCost(true);
                                              setNewCostEdit({
                                                initialcost: item.cost_per_uom,
                                                newcost: newCost,
                                                newquantity: item.quantity,
                                                total_cost: totalCost,
                                                inv_code: item.inv_code,
                                                prd_queue_code:
                                                  item.prd_queue_code,
                                                newtotalcost:
                                                  visibleItemsTotal +
                                                  (totalCost - item.total),
                                              });
                                            }

                                            // exit edit mode
                                            setEditableCostIndex(null);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.target.blur();
                                            }
                                            if (e.key === "Escape") {
                                              setEditableCostIndex(null);
                                            }
                                          }}
                                          className="w-20 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-colorBrand"
                                        />
                                      ) : (
                                        <div className="flex items-center space-x-1">
                                          <p className="font-medium cursor-pointer">
                                            ₱
                                            {item.cost_per_uom.toLocaleString(
                                              undefined,
                                              { minimumFractionDigits: 2 },
                                            )}{" "}
                                            ea
                                          </p>
                                          {isStatus !== "Approved" &&
                                            transactionType === "PO" && (
                                              <FiEdit
                                                size={16}
                                                className="text-redAccent hover:text-colorBrand cursor-pointer"
                                                onClick={() => {
                                                  setEditableCostIndex(index);
                                                  setCostInputValues(
                                                    (prev) => ({
                                                      ...prev,
                                                      [item.inv_code]:
                                                        item.cost_per_uom,
                                                    }),
                                                  );
                                                }}
                                              />
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {isStatus === "In Progress" &&
                                    !roles[0]?.some(
                                      (item) =>
                                        item.rolename === "IMS-NOEXPIRY",
                                    ) && (
                                      <div className="flex flex-col w-full sm:w-1/3 md:w-1/4 lg:w-44 space-y-1 mt-2 lg:mt-0">
                                        <div className="flex items-center">
                                          <FiCalendar className="text-gray-500 mr-2 lg:hidden" />
                                          <input
                                            type="date"
                                            value={
                                              supplierProductItems[index]
                                                ?.expiryDate || ""
                                            }
                                            onChange={(e) => {
                                              const updated = [
                                                ...supplierProductItems,
                                              ];
                                              updated[index].expiryDate =
                                                e.target.value;
                                              setSupplierProductItems(updated);
                                            }}
                                            className="pt-2 pb-2 px-3 rounded-md bg-transparent border focus:outline-none focus:ring-1 focus:ring-colorBrand border-gray-300 w-full"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  {supplierProductItems[index]?.expiryDate &&
                                    supplierProductItems[index]?.expiryDate !=
                                      "0000-00-00" &&
                                    !roles[0]?.some(
                                      (item) =>
                                        item.rolename === "IMS-NOEXPIRY",
                                    ) &&
                                    (transactionType === "Production" ||
                                      transactionType === "Delivery") && (
                                      <div className="flex justify-center items-center py-2">
                                        <div
                                          className="border rounded-lg shadow-sm p-2 text-center bg-white cursor-pointer hover:shadow-md transition"
                                          style={{ width: "110px" }}
                                          onClick={() =>
                                            handlePrintSingleQR(item)
                                          }
                                        >
                                          <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(
                                              `ExpiryDate:${supplierProductItems[index].expiryDate},InvCode:${item.inv_code},QueueCode:${item.prd_queue_code}`,
                                            )}`}
                                            alt="QR Code"
                                            className="mx-auto mb-1"
                                            style={{
                                              width: "90px",
                                              height: "90px",
                                            }}
                                          />
                                          <p className="font-semibold text-[11px] leading-tight">
                                            {item.productname}
                                          </p>
                                          <p className="text-[10px] text-gray-600 leading-tight">
                                            {item.inv_code}
                                          </p>
                                          <p className="text-[10px] text-gray-600 leading-tight">
                                            Exp:{" "}
                                            {
                                              supplierProductItems[index]
                                                .expiryDate
                                            }
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                </>
                              </div>

                              {/* Item Total */}
                              {transactionType !== "PR" && (
                                <div className="flex flex-row justify-end pe-4 pb-3">
                                  <div className="flex items-center">
                                    <p className="font-semibold  text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
                                      ₱{item.total}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Partition Button */}
                    {transactionType === "PO" && selectedItems.length > 0 && (
                      <button
                        onClick={() => setConfirmpartitionYesNoModalOpen(true)}
                        className="bg-colorBrand text-white px-5 py-2 rounded-md mt-3 hover:bg-colorBrand transition-colors duration-200 shadow-md self-start"
                      >
                        Partition Selected Items
                      </button>
                    )}
                  </div>
                  <div className="flex flex-row font-['Poppins-Black'] text-colorBrand w-full justify-end pe-10 text-xl">
                    <div className="flex space-x-10">
                      <p className="w-32 text-bold">Subtotal:</p>
                      <p className="w-28 text-end">
                        {transactionType !== "PR"
                          ? visibleItemsTotal.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : ""}
                      </p>
                    </div>
                  </div>
                  {listofcharge &&
                    listofcharge.map((item, index) => (
                      <div className="flex flex-row w-full justify-end pe-10 text-sm">
                        {transactionType !== "PR" && (
                          <div className="flex space-x-10">
                            <p className="w-32 text-bold">
                              {item.particulars}
                              {":"}
                            </p>
                            <p className="w-28 text-end">
                              {item.amount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                  {/* Order Total */}
                  <div className="flex flex-row w-full justify-end pe-10 py-5">
                    {transactionType !== "PR" && (
                      <div className="flex items-center bg-gray-100 px-5 py-3 rounded-md shadow-md">
                        <span className="text-lg text-gray-700 font-bold mr-2">
                          Total:
                        </span>
                        <span className="text-lg text-colorBrand font-bold">
                          ₱
                          {parseFloat(
                            visibleItemsTotal + totalchargededuc,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Build Components */}
              <div className="flex flex-col space-y-1 p-5 px-10 w-full">
                {transactionType === "Production" && (
                  <div className="lg:flex flex-col lg:flex-row hidden  items-start lg:items-center text-zinc-600 justify-start cursor-pointer py-2 px-3  lg:w-full bg-white shadow-lg rounded-sm ">
                    <h1 className="text-xl font-semibold text-zinc-600 mb-3">
                      Suggested Build Components:
                    </h1>
                  </div>
                )}

                {transactionType === "Production" &&
                  buildComponentsById &&
                  buildComponentsById.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col lg:flex-row lg:gap-0 items-start lg:items-center text-sm justify-start lg:justify-between cursor-pointer py-2 px-3 space-x-4 lg:w-full bg-white shadow-lg rounded-md hover:scale-95 duration-200 "
                    >
                      <div className="w-8">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-zinc-600"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <span className="font-semibold self-end lg:self-start bg-darkitemimary shadow-zinc-400   text-zinc-600 px-2">
                          {item.builddesc}
                        </span>
                      </div>

                      <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                        <p className="font-semibold bg-darkitemimary shadow-zinc-400  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary text-white shadow rounded-sm px-2">
                          {item.componentdesc}
                        </p>
                      </div>

                      {/* Quantity Edit */}
                      {editableIndex === index && (
                        <input
                          onDoubleClick={() => {
                            setEditableIndex(null);
                          }}
                          style={{
                            fontSize: "16px", // Set font size to prevent auto-zoom
                            maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                          }}
                          className="self-end w-auto border border-zinc-400 rounded-md px-1  text-zinc-600 font-semibold text-center focus:outline-none"
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          onChange={(e) => {
                            const cloneBuildComponents = [
                              ...buildComponentsById,
                            ];

                            cloneBuildComponents[index].qty = e.target.value;

                            setBuildComponentsById(cloneBuildComponents);
                            showToast(
                              `Added ${e.target.value} ${purchase.name}`,
                              1000,
                            );
                          }}
                        />
                      )}

                      <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                        <p
                          onDoubleClick={() => {
                            if (isStatus === "In Progress") {
                              setEditableIndex(index);
                            }
                          }}
                          className="font-semibold rounded-lg shadow-lg shadow-zinc-400 bg-white text-red-500 px-2 py-1"
                        >
                          {item.qty}
                        </p>
                      </div>

                      {/* Edit Manual Unit of Measure */}

                      {editableUomValIndex === index && (
                        <input
                          onDoubleClick={() => {
                            setEditableUomValIndex(null);
                          }}
                          style={{
                            fontSize: "16px", // Set font size to prevent auto-zoom
                            maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                          }}
                          className="w-auto border border-zinc-400 rounded-md px-1 text-sm text-zinc-600 font-semibold text-center focus:outline-none"
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          onChange={(e) => {
                            const cloneBuildComponents = [
                              ...buildComponentsById,
                            ];

                            cloneBuildComponents[index].uomval = parseFloat(
                              e.target.value,
                            );

                            cloneBuildComponents[index].cost_per_uom =
                              parseFloat(
                                (prevCostPerUom *
                                  cloneBuildComponents[index].uomval) /
                                  prevUomVal,
                              ).toFixed(2);

                            setBuildComponentsById(cloneBuildComponents);
                          }}
                        />
                      )}

                      <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                        <p
                          onDoubleClick={() => {
                            if (
                              parseInt(item.qty) === 1 &&
                              isStatus === "In Progress"
                            ) {
                              setPrevUomVal(item.uomval);
                              setPrevCostPerUom(item.cost_per_uom);
                              setEditableUomValIndex(index);
                            } else {
                              // alert("Quantity should be set to 1");
                              setReturnmessage({
                                choose: "error",
                                message: "Quantity should be set to 1",
                              });
                            }
                          }}
                          className="font-semibold"
                        >{`${item.uomval} ${item.uom}`}</p>
                      </div>

                      {/* Manual Edit Cost per UOM */}

                      {editableCostPerUomIndex === index && (
                        <input
                          onDoubleClick={() => {
                            setEditableCostPerUomIndex(null);
                          }}
                          style={{
                            fontSize: "16px", // Set font size to prevent auto-zoom
                            maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                          }}
                          className="w-auto border border-zinc-400 rounded-md px-1 text-zinc-600 font-semibold text-center focus:outline-none"
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          onChange={(e) => {
                            const cloneBuildComponents = [
                              ...buildComponentsById,
                            ];

                            cloneBuildComponents[index].cost_per_uom =
                              e.target.value;

                            setTotalPurchaseSummary(cloneBuildComponents);
                          }}
                        />
                      )}

                      <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                        <p
                          onDoubleClick={() => {
                            if (
                              parseInt(item.qty) === 1 &&
                              isStatus === "In Progress"
                            ) {
                              setEditableCostPerUomIndex(index);
                            } else {
                              // alert("Quantity should be set to 1");
                              setReturnmessage({
                                choose: "error",
                                message: "Quantity should be set to 1",
                              });
                            }
                          }}
                          className="font-semibold text-darkerPrimary"
                        >
                          ₱{item.cost_per_uom} ea
                        </p>
                      </div>
                      {/* Remove Icon */}
                      <div
                        className="cursor-pointer text-red-500 hover:text-red-700 ml-3"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to remove "${item.componentdesc}"?`,
                            )
                          ) {
                            const updatedList = buildComponentsById.filter(
                              (_, i) => i !== index,
                            );
                            setBuildComponentsById(updatedList);
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}

                {transactionType === "Production" && isStatus !== "Pending" && (
                  <h1 className="text-xl font-semibold text-zinc-600 p-3">
                    Actual Build Components Used:
                  </h1>
                )}

                {transactionType === "Production" &&
                  isStatus !== "Pending" &&
                  buildActualComponentsMutationData &&
                  buildActualComponentsMutationData
                    .filter((items) => items.qty >= 0)
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col lg:flex-row  items-start lg:items-center text-sm justify-start lg:justify-between cursor-pointer py-2 px-3 space-x-10 lg:w-full bg-white shadow-lg rounded-md hover:scale-95 duration-200 "
                      >
                        <div className="w-12">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-6 h-6 text-green-600"
                          >
                            <path
                              fillRule="evenodd"
                              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold bg-darkitemimary shadow-zinc-400  bg-green-700 text-white shadow rounded-sm px-2">
                            {item.desc}
                          </p>
                        </div>

                        <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                          <p className="font-semibold rounded-lg shadow-lg shadow-zinc-400 bg-white text-red-500 px-2 py-1">
                            {item.qty}
                          </p>
                        </div>
                        <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                          <p className="font-semibold">{`${item.uom_val} ${item.uom}`}</p>
                        </div>
                        <div className="text-zinc-600  flex flex-row space-x-1  lg:justify-center w-20">
                          <p className="font-semibold text-darkerPrimary">
                            ₱{item.cost_per_uom} ea
                          </p>
                        </div>
                      </div>
                    ))}
              </div>

              {/* Payment schedule */}
              <div className="flex flex-col space-y-1 p-5 px-10 w-full">
                {(isStatus === "Unpaid" ||
                  isStatus === "Partial" ||
                  isStatus === "Paid") &&
                  transactionType === "Billing" &&
                  paymentsMutationData &&
                  paymentsMutationData.map((item, index) => (
                    <div className="bg-white shadow-lg p-3 hover:bg-colorBrandLighter duration-200 ">
                      <div
                        key={index}
                        className="flex flex-col lg:flex-row  items-start lg:items-center text-sm justify-start lg:justify-between cursor-pointer py-2 px-3 space-x-10 lg:w-full "
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-zinc-600"
                        >
                          <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                          <path
                            fillRule="evenodd"
                            d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 14.625v-9.75zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75-.75V9.75z"
                          />
                          <path d="M2.25 18a.75.75 0 000 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 00-.75-.75H2.25z" />
                        </svg>

                        <p className="font-semibold">{item.mop}</p>
                        <p className="font-semibold">{item.payment_ref}</p>
                        <p className="font-semibold  shadow-zinc-400  bg-colorBrand text-white px-2">
                          ₱
                          {item.payments.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      {item.imageurl !== "" ? (
                        <p
                          className="font-semibold cursor-pointer w-full break-words whitespace-normal"
                          onClick={toggleText}
                        >
                          {expanded
                            ? item.imageurl
                            : `${item.imageurl.slice(0, 40)}...`}
                        </p>
                      ) : (
                        ""
                      )}
                    </div>
                  ))}
              </div>

              {(isStatus === "Unpaid" ||
                isStatus === "Partial" ||
                isStatus === "Paid") &&
                transactionType === "Billing" &&
                paymentsMutationData && (
                  <div className="flex flex-row w-full justify-end pe-20 py-5 ">
                    <p className="text-2xl font-bold shadow-lg bg-colorBrand text-white p-2 rounded-md">
                      Balance: ₱
                      {(
                        subTotalItems -
                        subTotalPayments +
                        totalchargededuc +
                        visibleItemsTotal
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                )}

              {["PR", "PO"].includes(transactionType) &&
                roles[0].some(
                  (item) => item.rolename === `IMS-${transactionType}-APPROVER`,
                ) &&
                ["Pending", "In Progress"].includes(isStatus) &&
                // imsBusunitCodeSelected === productItems[0].orderedby &&
                (transactionType === "PR" ||
                  transactionType === "PO" ||
                  transactionType === "Production") && (
                  <div className="flex flex-row w-full justify-end mb-5 px-5 space-x-3">
                    <button
                      onClick={() => setVoidYesNoModalOpen(true)}
                      className="self-start bg-red-500  py-1 px-5 rounded-sm text-white hover:scale-95 duration-200"
                    >
                      Void
                    </button>
                  </div>
                )}
              {/* Buttons for approval */}
              {isStatus === "Approved by Purchaser" && (
                <div className="flex flex-col self-end pb-4 mr-5">
                  <label
                    htmlFor="tentativeDate"
                    className="flex items-center text-sm font-semibold text-gray-700 mb-1"
                  >
                    Tentative Date:
                  </label>
                  <input
                    id="tentativeDate"
                    type="date"
                    value={tentativeDate}
                    onChange={(e) => settentativeDate(e.target.value)}
                    className="h-10 w-40 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand"
                  />
                </div>
              )}

              {/* PR & PO Buttons */}
              {(isStatus === "Pending" ||
                (isStatus === "Approved by Purchaser" &&
                  productItems[0].payee === imsBusunitCodeSelected) ||
                (isStatus === "Pending" &&
                  imsBusunitCodeSelected === productItems[0].orderedby)) &&
                (transactionType === "PR" || transactionType === "PO") && (
                  <div className="flex flex-row w-full justify-end px-5 space-x-3">
                    {/* ================= EDIT BUTTON ================= */}
                    {roles[0].some(
                      (item) => item.rolename === `IMS-${transactionType}-EDIT`,
                    ) && (
                      <button
                        onClick={() => {
                          navigate(
                            `/purchaserequest/${productItems[0].prd_queue_code}?type=${transactionType}`,
                          );
                          setproductTrackingId("");
                        }}
                        className="self-start bg-gradient-to-br from-yellow-500 to-zinc-500 py-1 px-8 rounded-sm text-white hover:scale-95 duration-200"
                      >
                        Edit
                      </button>
                    )}

                    {/* ================= APPROVE BUTTON ================= */}
                    {roles[0].some(
                      (item) =>
                        item.rolename === `IMS-${transactionType}-APPROVER`,
                    ) && (
                      <button
                        onClick={() => {
                          if (
                            (productItems[0].payeename == null ||
                              productItems[0].payeename === "") &&
                            transactionType === "PO"
                          ) {
                            setPayeeError(true);
                            return;
                          }
                          setPRPOYesNoModalOpen(true);
                        }}
                        className={`self-start bg-green-700 py-1 px-5 rounded-sm text-white hover:scale-95 duration-200 ${
                          getPayeeNameByQueueCode(productItems) == null &&
                          transactionType === "PO"
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {transactionType === "PR"
                          ? "Approve"
                          : productItems[0].payee.substring(0, 2) === "BU" &&
                              imsBusunitCodeSelected === productItems[0].payee
                            ? "Approve by Seller"
                            : "Approve by Purchaser"}
                      </button>
                    )}
                  </div>
                )}
              {transactionType === "PO" && productItems[0].email && (
                <div className="flex flex-row w-full justify-end px-5 space-x-3 mt-5">
                  <button
                    disabled={isDisabled}
                    className={`self-start py-1 px-5 rounded-sm text-white duration-200 
                      ${isDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-green-700 hover:scale-95"}`}
                    onClick={() => {
                      setSendToEmailYesNoModalOpen(true);
                      setIsDisabled(true);
                      setSecondsLeft(15);
                    }}
                  >
                    {isDisabled ? `Wait ${secondsLeft}s` : "Send PO Details"}
                  </button>
                </div>
              )}
              {(transactionType === "PR" || transactionType === "PO") && (
                <div className="flex flex-row w-full justify-end px-5 space-x-3 mt-5">
                  <button
                    className="me-5 self-end bg-colorBrand   p-3 rounded-full text-white  hover:scale-95 duration-200"
                    onClick={() => {
                      handlePrint();
                    }}
                  >
                    <FiPrinter />
                  </button>
                </div>
              )}

              {/* Production Buttons*/}

              {isStatus === "Pending" &&
                transactionType === "Production" &&
                ((imsBusunitClass === "COMMI" &&
                  imsBusunitCodeSelected === productItems[0].payee) ||
                  (imsBusunitClass === "STORE" &&
                    imsBusunitCodeSelected === productItems[0].payee)) && (
                  <div className="flex flex-row w-full justify-end px-5 space-x-3">
                    <button
                      onClick={() => setProductsSkipYesNoModalOpen(true)}
                      className="self-start flex flex-row items-center bg-green-600 mb-2 py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                    >
                      <FiSkipForward />
                      Skip
                    </button>
                  </div>
                )}

              {isStatus === "Pending" &&
                transactionType === "Production" &&
                imsBusunitClass === "COMMI" &&
                imsBusunitCodeSelected === productItems[0].payee && (
                  <div className="flex flex-row w-full justify-end px-5 space-x-3">
                    <button
                      onClick={() => setProductsBuildYesNoModalOpen(true)}
                      className="self-start flex flex-row items-center bg-green-700  py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                    >
                      <FiCheckCircle />
                      Build
                    </button>
                  </div>
                )}
              {isStatus === "In Progress" &&
                transactionType === "Production" && (
                  <div className="flex flex-row w-full justify-end px-5 space-x-3">
                    <button
                      onClick={() => setBuildCompletedYesNoModalOpen(true)}
                      className="self-start bg-darkerPrimary shadow-lg shadow-zinc-400 py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                    >
                      Completed
                    </button>
                  </div>
                )}

              {/* Billing Buttons*/}
              {isStatus === "Pending" &&
                transactionType === "Billing" &&
                imsBusunitCodeSelected === productItems[0].payee && (
                  <div className="flex flex-row w-full justify-end px-5 space-x-3">
                    {/* skip button */}
                    {roles[0].findIndex(
                      (item) => item.rolename === "IMS-BILLING VIEW KEY",
                    ) !== -1 && (
                      <>
                        <button
                          onClick={() => setProductsSkipYesNoModalOpen(true)}
                          className="self-start flex flex-row items-center  bg-green-600  shadow-zinc-400 py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                        >
                          <FiFastForward />
                          Skip
                        </button>

                        <button
                          onClick={() => setBillingYesNoModalOpen(true)}
                          className="self-start flex flex-row items-center bg-green-700 shadow-lg  py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                        >
                          <FiCheck />
                          BILL {productItems[0].orderedbyname}
                        </button>
                      </>
                    )}
                  </div>
                )}
              {transactionType === "Billing" &&
                imsBusunitCodeSelected === productItems[0].payee && (
                  <div className="flex flex-row w-full justify-end px-5 pt-2 space-x-3">
                    {isStatus === "Pending" && (
                      <button
                        onClick={() => {
                          setshowchargesdeduc(true);
                        }}
                        className="self-start bg-gradient-to-br from-yellow-500 to-zinc-500 py-1 px-8 rounded-sm text-white  hover:scale-95 duration-200"
                      >
                        Charge/Deduction
                      </button>
                    )}
                    <button
                      className=" self-start bg-colorBrand py-4 px-4 rounded-full text-white  hover:scale-95 duration-200"
                      onClick={() => {
                        handlePrint();
                      }}
                    >
                      <FiPrinter />
                    </button>
                  </div>
                )}

              {/* Billing Buttons*/}
              {(isStatus === "Unpaid" || isStatus === "Partial") &&
                transactionType === "Billing" && (
                  <div className="flex flex-col w-full justify-end px-5 space-x-3">
                    <div className="flex flex-col items-center p-3">
                      <form
                        className="flex flex-col items-center w-full bg-white shadow-2xl p-5 rounded-lg"
                        onSubmit={(e) => {
                          e.preventDefault();
                        }}
                      >
                        <h1 className="text-lg self-start mb-3 text-zinc-600">
                          Payment details:
                        </h1>
                        <div className="relative z-0 mb-7 w-full">
                          <input
                            style={{
                              fontSize: "16px", // Set font size to prevent auto-zoom
                              maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                            }}
                            type="number"
                            onWheel={(e) => e.target.blur()}
                            name="payment_amount"
                            {...register("payment_amount")}
                            placeholder=" "
                            autoComplete="off"
                            className="pt-3 w-full pb-2 block px-2 rounded-lg mt-0 bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                          />
                          <label
                            htmlFor="payment_amount"
                            className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
                          >
                            Amount received
                          </label>
                          {errors.payment_amount && (
                            <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-full bottom-8">
                              {errors.payment_amount.message}
                            </span>
                          )}
                        </div>
                        <div className="relative z-0 mb-7 w-full">
                          <input
                            style={{
                              fontSize: "16px", // Set font size to prevent auto-zoom
                              maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                            }}
                            type="text"
                            name="payment_ref"
                            {...register("payment_ref")}
                            placeholder=" "
                            autoComplete="off"
                            className="pt-3 w-full pb-2 px-2 block rounded-lg mt-0 bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                          />
                          <label
                            htmlFor="payment_ref"
                            className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
                          >
                            Reference
                          </label>
                          {errors.payment_ref && (
                            <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-full bottom-8">
                              {errors.payment_ref.message}
                            </span>
                          )}
                        </div>
                        <div className="relative z-0  mb-5 w-full">
                          <h1 className="text-xs text-zinc-600 ms-1 mb-1">
                            Mode of Payment
                          </h1>
                          <Controller
                            name="mop"
                            control={control}
                            defaultValue=""
                            render={({ field }) => (
                              <select
                                {...field}
                                className="pt-3 pb-2 px-5 block w-full rounded-lg items mt-0 bg-transparent border-2 appearance-none z-1 focus:outline-none focus:ring-0 focus:border-zinc-500"
                              >
                                <option value="" disabled hidden></option>
                                {Array.isArray(chartOfAccountsData) &&
                                  chartOfAccountsData
                                    .filter(
                                      (item) =>
                                        item.slcode.startsWith("100") ||
                                        item.slcode.startsWith("110"),
                                    )
                                    .map((coa, index) => (
                                      <option key={index} value={coa.slcode}>
                                        {coa.sl_description}
                                      </option>
                                    ))}
                              </select>
                            )}
                          />
                          {errors.mop && (
                            <span className="text-red-500">
                              {errors.mop.message}
                            </span>
                          )}
                        </div>
                        <div className="relative z-0 mb-7 w-full">
                          <input
                            style={{
                              fontSize: "16px", // Set font size to prevent auto-zoom
                              maxWidth: "100%", // Set max-width to prevent zooming beyond screen width
                            }}
                            type="text"
                            name="payment_ref"
                            value={imageurl}
                            onChange={(e) => setimageurl(e.target.value)}
                            placeholder=" "
                            autoComplete="off"
                            className="pt-3 w-full pb-2 px-2 block rounded-lg mt-0 bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                          />
                          <label
                            htmlFor="payment_ref"
                            className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
                          >
                            Image URL
                          </label>
                        </div>
                        {roles[0].findIndex(
                          (item) => item.rolename === "IMS-BILLING VIEW KEY",
                        ) !== -1 && (
                          <button
                            onClick={() => setCollectionYesNoModalOpen(true)}
                            className="self-end bg-gradient-to-br from-green-700  to-green-500  py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                          >
                            Pay
                          </button>
                        )}
                      </form>
                    </div>
                  </div>
                )}

              {/* Delivery from SUPPLIER TO STORE Receiving_________SKIPPED DRIVER & DISPATCHER & CASHIER CYCLE*/}

              {/* POV OF SELLER */}
              {transactionType === "Delivery" &&
                isStatus === "Pending" &&
                productItems[0].orderedby !== productItems[0].payee &&
                imsBusunitCodeSelected === productItems[0].payee && (
                  <div className="flex flex-col justify-end px-5 pt-2 space-y-3">
                    {/* Truck Details Input */}
                    <input
                      type="text"
                      placeholder="Enter Truck Details"
                      value={truckDetails}
                      onChange={(e) => setTruckDetails(e.target.value)}
                      className="self-end border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-colorBrand"
                    />

                    {/* Dispatch Button */}
                    <div className="flex flex-row justify-end space-x-3">
                      <button
                        className="self-start bg-white border-2 border-colorBrand py-2 px-4 rounded-full text-colorBrand hover:scale-95 duration-200"
                        onClick={() => {
                          setShippingYesNoModalOpen(true);
                        }}
                      >
                        📦 Dispatch & Deliver 🚚
                      </button>
                    </div>
                  </div>
                )}

              {transactionType === "Delivery" &&
                isStatus === "For Receiving" &&
                productItems[0].orderedby !== productItems[0].payee &&
                imsBusunitCodeSelected === productItems[0].payee && (
                  <div className="flex flex-row w-full justify-end px-5 pt-2 space-x-3">
                    <button
                      className=" self-start bg-white  border-2 border-colorBrand py-2 px-4 rounded-full text-colorBrand  hover:scale-95 duration-200"
                      onClick={() => {
                        setShippingYesNoModalOpen(true);
                        setDispatch(0);
                      }}
                    >
                      🔙 Undispatch 🚚
                    </button>
                  </div>
                )}

              {/* POV OF BUYER */}
              {((isStatus === "For Receiving" && isDeliverySkipped) ||
                (isStatus === "Pending" &&
                  productItems[0].payee.substring(0, 2) === "SP") ||
                isStatus === "Partial") &&
                transactionType === "Delivery" &&
                imsBusunitCodeSelected === productItems[0].orderedby &&
                (roles[0].findIndex((item) => item.rolename === "IMS-ADMIN") !==
                  -1 ||
                  roles[0].findIndex(
                    (item) => item.rolename === "IMS-DELIVERY",
                  ) !== -1 ||
                  roles[0].findIndex(
                    (item) => item.rolename === "ACCTG-DISBURSEMENT",
                  ) === -1) && (
                  <>
                    <div className="flex flex-row w-full justify-end px-5">
                      <button
                        className="self-end flex flex-row items-center bg-gradient-to-br from-colorBrand to-colorBrandSecondary py-1 px-2 rounded-full text-white  hover:scale-95 duration-200"
                        onClick={() => setisDeliveryChecked(true)}
                      >
                        <FiCheckCircle />
                        Check Queue
                      </button>

                      {isStatus === "Partial" && (
                        <button
                          className="self-end mx-2 bg-gradient-to-br from-green-700   to-green-800 py-1 px-5 rounded-full text-white  hover:scale-95 duration-200"
                          onClick={() => {
                            setConfirmSupplierYesNoModalOpen(true);
                            setcompletetransaction(1);
                          }}
                        >
                          Complete Transaction
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col w-full justify-end px-5 space-x-3"></div>

                    <div className="w-full flex flex-col space-y-2 py-3 px-10 mt-5 bg-colorBrandLighter">
                      {productItems.length > 0 && isDeliveryChecked && (
                        <>
                          <div className="flex items-center">
                            {" "}
                            <p className="text-zinc-600">Items to receive:</p>
                            <div className="flex ml-2 items-center space-x-2 mb-4">
                              <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pt-3 pb-2 px-5 block w-full lg:w-64 rounded-lg mt-0 bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-700 border-zinc-500"
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {isDeliveryChecked && (
                        <>
                          {/* ✅ PRINT ALL BUTTON */}
                          {supplierProductItems[0]?.expiryDate !=
                            "0000-00-00" && (
                            <div className="flex justify-end mb-4">
                              <button
                                onClick={handlePrintAllStickers}
                                className="bg-colorBrand hover:bg-colorBrandSecondary text-white font-semibold py-2 px-4 rounded-lg duration-200"
                              >
                                🖨️ Print All Stickers
                              </button>
                            </div>
                          )}

                          {/* ✅ ITEM LIST */}
                          {filteredItems
                            .filter((item) => item.quantity != 0)
                            .map((item, index) => {
                              const qrData = `ExpiryDate:${item.expiryDate},  QueueCode:${item.prd_queue_code},InvCode:${item.inv_code}`;
                              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                                qrData,
                              )}`;

                              return (
                                <div
                                  key={item.inv_code}
                                  className={`flex flex-col lg:flex-row mb-2 items-start lg:items-center text-sm justify-start cursor-pointer py-2 px-3 space-x-10 lg:w-full bg-white border rounded-md hover:bg-zinc-100 duration-200 ${
                                    item.prd_queue_code_new ===
                                      productTrackingId &&
                                    transactionType === "Delivery"
                                      ? "hidden"
                                      : ""
                                  }`}
                                >
                                  <p className="font-semibold lg:w-56 mt-6">
                                    {item.productname}
                                  </p>

                                  {/* Quantity display */}
                                  {roles[0].findIndex(
                                    (role) =>
                                      role.rolename === "IMS-DISPATCHER",
                                  ) === -1 && (
                                    <p className="font-semibold lg:w-auto bg-gradient-to-br mt-6 from-colorBrand to-colorBrandSecondary text-white py-2 px-3 rounded-full">
                                      {item.quantity}
                                    </p>
                                  )}

                                  {/* Quantity input */}
                                  {isStatus !== "Delivered" ? (
                                    <input
                                      style={{
                                        fontSize: "16px",
                                        maxWidth: "100%",
                                      }}
                                      onChange={(e) => {
                                        const cloneSupplierProduct = [
                                          ...supplierProductItems,
                                        ];
                                        cloneSupplierProduct[
                                          index
                                        ].qtyreceivedsupplier = e.target.value;
                                        setSupplierProductItems(
                                          cloneSupplierProduct,
                                        );
                                        handleProductData(
                                          e.target.value,
                                          item.inv_code,
                                        );
                                      }}
                                      value={
                                        inputValuesProdItems[item.inv_code] !==
                                        undefined
                                          ? inputValuesProdItems[item.inv_code]
                                          : item.quantity
                                      }
                                      type="number"
                                      onWheel={(e) => e.target.blur()}
                                      autoComplete="off"
                                      className="pt-3 pb-2 px-5 block w-4/12 lg:w-32 rounded-lg mt-6 bg-transparent border-2 focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                                    />
                                  ) : (
                                    <p className="font-semibold text-zinc-600 lg:w-auto">
                                      {item.quantity}s
                                    </p>
                                  )}

                                  {/* Difference display */}
                                  {roles[0].findIndex(
                                    (role) =>
                                      role.rolename === "IMS-DISPATCHER",
                                  ) === -1 && (
                                    <p className="font-semibold text-red-500 w-16">
                                      {(inputValuesProdItems[item.inv_code] !==
                                      undefined
                                        ? inputValuesProdItems[item.inv_code]
                                        : item.quantity) - item.quantity}
                                    </p>
                                  )}

                                  {/* Expiry Date input */}
                                  {!roles[0]?.some(
                                    (r) => r.rolename === "IMS-NOEXPIRY",
                                  )
                                    ? (!supplierProductItems[index]
                                        .expiryDate ||
                                        isStatus.status !== "Delivered") && (
                                        <div className="flex flex-col w-full sm:w-1/3 md:w-1/4 lg:w-44 space-y-1">
                                          <label>Expiry Date</label>
                                          <input
                                            type="date"
                                            value={
                                              supplierProductItems[index]
                                                ?.expiryDate ||
                                              new Date(
                                                new Date().setDate(
                                                  new Date().getDate() +
                                                    (supplierProductItems[index]
                                                      ?.expirydays || 0),
                                                ),
                                              )
                                                .toISOString()
                                                .split("T")[0]
                                            }
                                            onChange={(e) => {
                                              const updated = [
                                                ...supplierProductItems,
                                              ];
                                              updated[index].expiryDate =
                                                e.target.value;
                                              setSupplierProductItems(updated);
                                            }}
                                            className="pt-2 pb-2 px-3 rounded-lg bg-transparent border-2 focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200 w-full"
                                          />
                                        </div>
                                      )
                                    : ""}

                                  {/* ✅ QR Code — click to download */}
                                  {item.expiryDate &&
                                    item.expiryDate != "0000-00-00" && (
                                      <div className="mt-4 lg:mt-0 text-center">
                                        <img
                                          src={qrUrl}
                                          alt="QR Code"
                                          title="Click to download QR"
                                          onClick={() =>
                                            handlePrintSingleQR(item)
                                          }
                                          className="w-20 h-20 border rounded-md cursor-pointer hover:scale-105 duration-200"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">
                                          (click to download)
                                        </p>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                        </>
                      )}

                      {supplierProductItems && isDeliveryChecked && (
                        <>
                          <p className="font-semibold w-fit rounded-sm py-1  text-white bg-gradient-to-br from-green-600  to-green-700 px-3">
                            Status: {isStatus}
                          </p>
                          <div className="flex flex-col w-full justify-end px-5 space-x-3">
                            {isStatus.status !== "Delivered" && (
                              <button
                                className="self-end bg-gradient-to-br from-green-700   to-green-800 py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                                onClick={() =>
                                  setConfirmSupplierYesNoModalOpen(true)
                                }
                              >
                                Confirm
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

              {/* POV OF BUYER PAYMENTS */}
              {((isStatus === "For Receiving" && isDeliverySkipped) ||
                (isStatus === "Pending" &&
                  productItems[0].orderedby === imsBusunitCodeSelected &&
                  productItems[0].orderedby !== productItems[0].payee) ||
                (isStatus === "Delivered" &&
                  productItems[0].orderedby === imsBusunitCodeSelected &&
                  productItems[0].orderedby !== productItems[0].payee) ||
                isStatus === "Partial") &&
                invoiceStatus !== "Invoiced" &&
                transactionType === "Delivery" &&
                imsBusunitCodeSelected === productItems[0].orderedby &&
                (roles[0].findIndex((item) => item.rolename === "IMS-ADMIN") !==
                  -1 ||
                  roles[0].findIndex(
                    (item) => item.rolename === "IMS-DELIVERY",
                  ) !== -1 ||
                  roles[0].findIndex(
                    (item) => item.rolename === "ACCTG-DISBURSEMENT",
                  ) === -1) &&
                "SP" == productItems[0].payee.substring(0, 2) && (
                  <>
                    <div
                      onClick={() => handleSupplierInvoice()}
                      className="cursor-pointer flex flex-row justify-end w-full p-2 pe-5"
                    >
                      <div className="flex flex-row  items-center space-x-1 bg-white border-2 border-colorBrand text-colorBrand px-2 py-1 rounded-full  hover:scale-95 duration-200">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
                            clipRule="evenodd"
                          />
                          <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                        </svg>
                        <button>Process Payment</button>
                      </div>
                    </div>
                  </>
                )}

              {/* Delivery from SUPPLIER TO STORE Receiving*/}
              {transactionType === "Delivery" && (
                <div className="flex flex-col w-full justify-end px-5 space-x-3 mt-2">
                  <button
                    className="self-end bg-colorBrand   shadow-zinc-400 py-4 px-4 rounded-full text-white  hover:scale-95 duration-200"
                    onClick={() => handlePrint()}
                  >
                    <FiPrinter />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {isEditSuccess && (
        <ModalSuccessNavToSelf
          header={"Success"}
          message={"Edit success"}
          button="Save"
          setIsModalOpen={setIsSuccessEdit}
        />
      )}

      <AnimatePresence>
        {isPayeeError && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <h2 className="text-lg font-semibold text-red-600 mb-2">
                Missing Supplier
              </h2>

              <p className="text-sm text-gray-700">
                You must set a supplier before proceeding.
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setPayeeError(false)}
                  className="px-4 py-2 bg-colorBrand text-white rounded-md hover:bg-colorBrandSecondary transition-colors duration-200"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ModalPRChecking;
