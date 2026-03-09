import {
  FiEdit3,
  FiClipboard,
  FiPackage,
  FiTruck,
  FiCreditCard,
  FiSmile,
  FiCheckCircle,
} from "react-icons/fi";

export const QueueStages = [
  {
    title: "Quotation",
    icon: <FiEdit3 className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Quotation Drafted",
      "Quotation Sent",
      "Quotation Accepted",
      "Quotation Rejected",
    ],
  },
  {
    title: "Order Entry",
    icon: <FiClipboard className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Sales Order Created",
      "Approved Sales Order",
      "Cancelled Sales Order",
    ],
  },
  {
    title: "Fulfillment",
    icon: <FiPackage className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Forwarded to Fulfillment",
      "Stock Allocation",
      "Packed",
      "Dispatched",
    ],
  },
  {
    title: "Delivery",
    icon: <FiTruck className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Dispatched",
      "In Transit / On Delivery",
      "Attempted Delivery",
      "Delivered",
      "Partially Delivered",
    ],
  },
  {
    title: "Invoicing & Payment",
    icon: <FiCreditCard className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Invoice Generated",
      "Invoice Sent",
      "Payment Pending",
      "Payment Received",
      "Payment Overdue",
      "Payment Failed",
    ],
  },
  {
    title: "Post-Sales",
    icon: <FiSmile className="w-6 h-6 text-colorBrand" />,
    statuses: [
      "Order Closed / Completed",
      "Return Requested",
      "Returned / Refunded",
      "Warranty / Support",
    ],
  },
];
