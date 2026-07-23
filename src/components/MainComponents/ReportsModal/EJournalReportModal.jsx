import React, { useState } from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaSearch,
  FaFileArchive,
} from "react-icons/fa";
import useBusinessInfo from "../../../hooks/useBusinessInfo";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const yesNoToBool = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "yes";

const TEXT_WIDTH = 42;

const padLine = (label, value, width = TEXT_WIDTH) => {
  const left = String(label ?? "");
  const right = String(value ?? "");
  const gap = Math.max(width - left.length - right.length, 1);
  return `${left}${" ".repeat(gap)}${right}`;
};

const divider = (char = "=", width = TEXT_WIDTH) => char.repeat(width);

const buildInvoiceText = (invoice, businessInfo) => {
  const items = invoice.items || [];
  const payments = invoice.payments || [];
  const otherCharges = invoice.other_charges || [];
  const discountBreakdown = invoice.discount_breakdown || [];
  const isVoidOrRefund = invoice.journal_status !== "PAID";

  const discountableGross = items.reduce((sum, item) => {
    if (!yesNoToBool(item.isDiscountable)) return sum;
    return sum + Number(item.sales_quantity || 0) * Number(item.selling_price || 0);
  }, 0);

  const discountableBase = items.reduce((sum, item) => {
    if (!yesNoToBool(item.isDiscountable)) return sum;
    const lineTotal = Number(item.sales_quantity || 0) * Number(item.selling_price || 0);
    return sum + (yesNoToBool(item.vatable) ? lineTotal / 1.12 : lineTotal);
  }, 0);

  const paymentBreakdown = Object.entries(
    payments.reduce((acc, p) => {
      const method = String(p.payment_method || "Cash").trim() || "Cash";
      acc[method] = (acc[method] || 0) + Number(p.payment_amount || 0);
      return acc;
    }, {}),
  ).map(([method, amount]) => ({ method, amount }));

  const shouldShowDiscountSummary =
    Number(invoice.customer_head_count || 0) > 0 ||
    Number(invoice.customer_count_for_discount || 0) > 0 ||
    discountBreakdown.length > 0;

  const storeAddress = splitAddressLines(businessInfo?.address || "ADDRESS");
  const posProviderAddress = splitAddressLines(businessInfo?.posProviderAddress || "");

  const lines = [];
  lines.push(divider());
  lines.push(String(businessInfo?.companyName || "COMPANY").toUpperCase());
  if (businessInfo?.storeName) lines.push(String(businessInfo.storeName).toUpperCase());
  if (businessInfo?.corpName) lines.push(String(businessInfo.corpName).toUpperCase());
  storeAddress.forEach((l) => lines.push(l));
  if (businessInfo?.tin) lines.push(`VAT REG TIN: ${businessInfo.tin}`);
  lines.push(`MIN: ${businessInfo?.machineNumber || "-"}`);
  lines.push(`S/N: ${businessInfo?.serialNumber || "-"}`);
  lines.push(divider());
  lines.push(`INVOICE${isVoidOrRefund ? ` (${invoice.journal_status})` : ""}`);
  lines.push(divider("-"));
  lines.push(padLine("Trans. No.:", invoice.transaction_id || "-"));
  lines.push(padLine("INV#:", invoice.invoice_no || "-"));
  lines.push(padLine("Trans. Date:", invoice.transaction_date || "-"));
  lines.push(padLine("Trans. Time:", invoice.transaction_time || "-"));
  lines.push(padLine("Terminal No.:", invoice.terminal_number || "-"));
  lines.push(padLine("Order Type:", invoice.order_type || "-"));
  lines.push(padLine("Ref./Tag #:", invoice.table_number || "-"));
  lines.push(padLine("Cashier:", invoice.cashier || "-"));
  lines.push(divider());

  if (!isVoidOrRefund) {
    items.forEach((item) => {
      const qty = Number(item.sales_quantity || 0);
      const price = Number(item.selling_price || 0);
      const label = `${String(item.item_name || item.product_id || "-").toUpperCase()}${
        yesNoToBool(item.isDiscountable) ? " (D)" : ""
      }`;
      lines.push(`- ${label}`);
      lines.push(
        padLine(
          `  ${qty} ${item.unit_of_measure || ""}`.trimEnd(),
          `${peso(qty * price)}${yesNoToBool(item.vatable) ? "V" : ""}`,
        ),
      );
    });
    lines.push(divider());
  }

  lines.push(padLine("TOTAL SALES:", peso(invoice.TotalSales)));
  discountBreakdown.forEach((entry) => {
    lines.push(
      padLine(
        `${String(entry.discount_type || "DISCOUNT").toUpperCase()}:`,
        `- ${peso(entry.discount_amount)}`,
      ),
    );
  });
  if (Number(invoice.VATExemptSales_VAT) > 0) {
    lines.push(padLine("VAT EXEMPTION:", `- ${peso(invoice.VATExemptSales_VAT)}`));
  }
  otherCharges.forEach((charge) => {
    lines.push(
      padLine(`${String(charge.particulars || "OTHER CHARGE").toUpperCase()}:`, peso(charge.amount)),
    );
  });
  lines.push(divider("-"));
  lines.push(padLine("AMOUNT DUE:", peso(invoice.TotalAmountDue)));
  lines.push(divider("-"));

  if (!isVoidOrRefund) {
    if (paymentBreakdown.length > 0) {
      paymentBreakdown.forEach((p) => {
        lines.push(padLine(`PAYMENT (${p.method}):`, peso(p.amount)));
      });
    } else {
      lines.push(
        padLine(`PAYMENT (${invoice.payment_method || "Cash"}):`, peso(invoice.payment_amount)),
      );
    }
    lines.push(padLine("CHANGE:", peso(invoice.change_amount)));
    lines.push(divider());
    lines.push(padLine("VATABLE SALES:", peso(invoice.VATableSales)));
    lines.push(padLine("VAT AMOUNT:", peso(invoice.VATableSales_VAT)));
    lines.push(padLine("VAT EXEMPT SALES:", peso(invoice.VATExemptSales)));
    lines.push(padLine("VAT EXEMPTION:", peso(invoice.VATExemptSales_VAT)));
    lines.push(padLine("ZERO RATED SALES:", peso(invoice.VATZeroRatedSales)));

    if (shouldShowDiscountSummary) {
      lines.push(divider());
      lines.push(padLine("Total Customers:", invoice.customer_head_count || 0));
      lines.push(padLine("Total Qualified:", invoice.customer_count_for_discount || 0));
      lines.push(padLine("Discountable Gross:", peso(discountableGross)));
      lines.push(padLine("Discountable Base:", peso(discountableBase)));
    }
  } else {
    const isVoided = invoice.journal_status === "VOIDED";
    lines.push(padLine(isVoided ? "Void No.:" : "Refund No.:", isVoided ? invoice.void_id : invoice.refund_id));
    lines.push(padLine(isVoided ? "Void Date:" : "Refund Date:", isVoided ? invoice.void_date : invoice.refund_date));
    lines.push("Remarks:");
    lines.push(isVoided ? invoice.void_remarks || "-" : invoice.refund_remarks || "-");
  }

  lines.push(divider());
  lines.push("Thank you");
  lines.push("Please come again.");
  lines.push("");
  lines.push(`SUPPLIER: ${businessInfo?.posProviderName || "POS PROVIDER"}`);
  posProviderAddress.forEach((l) => lines.push(l));
  lines.push(`TIN: ${businessInfo?.posProviderTin || "-"}`);
  lines.push(`BIR ACCR#: ${businessInfo?.posProviderBirAccreNo || "-"}`);
  lines.push(`DATE ISSUED: ${businessInfo?.posProviderAccreDateIssued || "-"}`);
  lines.push(`PTU# ${businessInfo?.posProviderPTUNo || "-"}`);
  lines.push(`PTU DATE ISSUED: ${businessInfo?.posProviderPTUDateIssued || "-"}`);

  return lines.join("\n");
};

const buildInvoiceFileName = (invoice) => {
  const ref = invoice.invoice_no || invoice.transaction_id || "invoice";
  const safeRef = String(ref).replace(/[^a-z0-9-_]/gi, "");
  return `${safeRef}_${invoice.journal_status}.txt`;
};

const STATUS_BADGE = {
  PAID: "bg-emerald-600",
  VOIDED: "bg-red-500",
  REFUNDED: "bg-orange-500",
};

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const splitAddressLines = (value) =>
  String(value || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

const InvoiceReceipt = ({ invoice, businessInfo }) => {
  const items = invoice.items || [];
  const payments = invoice.payments || [];
  const otherCharges = invoice.other_charges || [];
  const discountBreakdown = invoice.discount_breakdown || [];

  const discountableGross = items.reduce((sum, item) => {
    if (!yesNoToBool(item.isDiscountable)) return sum;
    return sum + Number(item.sales_quantity || 0) * Number(item.selling_price || 0);
  }, 0);

  const discountableBase = items.reduce((sum, item) => {
    if (!yesNoToBool(item.isDiscountable)) return sum;
    const lineTotal = Number(item.sales_quantity || 0) * Number(item.selling_price || 0);
    return sum + (yesNoToBool(item.vatable) ? lineTotal / 1.12 : lineTotal);
  }, 0);

  const paymentBreakdown = Object.entries(
    payments.reduce((acc, p) => {
      const method = String(p.payment_method || "Cash").trim() || "Cash";
      acc[method] = (acc[method] || 0) + Number(p.payment_amount || 0);
      return acc;
    }, {}),
  ).map(([method, amount]) => ({ method, amount }));

  const shouldShowDiscountSummary =
    Number(invoice.customer_head_count || 0) > 0 ||
    Number(invoice.customer_count_for_discount || 0) > 0 ||
    discountBreakdown.length > 0;

  const isVoidOrRefund = invoice.journal_status !== "PAID";

  const storeAddress = splitAddressLines(businessInfo?.address || "ADDRESS");
  const posProviderAddress = splitAddressLines(businessInfo?.posProviderAddress || "");

  return (
    <div className="bg-white text-black font-sans px-1 py-4 border-b-2 border-dashed border-slate-300 last:border-b-0">
      <div className="flex justify-end mb-1">
        <span
          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white ${
            STATUS_BADGE[invoice.journal_status] || "bg-slate-500"
          }`}
        >
          {invoice.journal_status}
        </span>
      </div>

      {/* HEADER */}
      <div className="text-center">
        <div className="font-black text-[13px] leading-tight uppercase">
          {businessInfo?.companyName || "COMPANY"}
        </div>
        <div className="font-bold text-[11px] uppercase">
          {businessInfo?.storeName || ""}
        </div>
        {businessInfo?.corpName ? (
          <div className="font-bold text-[11px] uppercase">
            {businessInfo.corpName}
          </div>
        ) : null}
        {storeAddress.map((line, idx) => (
          <div key={idx} className="text-[10px] mt-0.5">
            {line}
          </div>
        ))}
        {businessInfo?.tin ? (
          <div className="text-[10px]">VAT REG TIN: {businessInfo.tin}</div>
        ) : null}
        <div className="text-[10px]">MIN: {businessInfo?.machineNumber || "-"}</div>
        <div className="text-[10px]">S/N: {businessInfo?.serialNumber || "-"}</div>
      </div>

      <div className="my-2 border-t border-black" />

      <div className="text-center font-black text-[13px] mb-2">
        INVOICE{isVoidOrRefund ? ` (${invoice.journal_status})` : ""}
      </div>

      {/* META */}
      <table className="w-full text-[10px]">
        <tbody>
          {[
            ["Trans. No.:", invoice.transaction_id],
            ["INV#:", invoice.invoice_no],
            ["Trans. Date:", invoice.transaction_date],
            ["Trans. Time:", invoice.transaction_time],
            ["Terminal No.:", invoice.terminal_number],
            ["Order Type:", invoice.order_type],
            ["Ref./Tag #:", invoice.table_number],
            ["Cashier:", invoice.cashier],
          ].map(([label, value]) => (
            <tr key={label}>
              <td className="font-bold py-0.5 w-[42%]">{label}</td>
              <td className="text-right py-0.5">{value || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-black" />

      {/* ITEMS */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="font-bold">
            <td className="text-left pb-1">Item</td>
            <td className="text-center pb-1">Qty</td>
            <td className="text-right pb-1">Amt</td>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const qty = Number(item.sales_quantity || 0);
            const price = Number(item.selling_price || 0);
            return (
              <tr key={idx}>
                <td className="align-top py-0.5 pr-1">
                  • {String(item.item_name || item.product_id || "-").toUpperCase()}
                  {yesNoToBool(item.isDiscountable) ? " (D)" : ""}
                </td>
                <td className="align-top py-0.5 text-center whitespace-nowrap">
                  {qty} {item.unit_of_measure || ""}
                </td>
                <td className="align-top py-0.5 text-right whitespace-nowrap">
                  {peso(qty * price)}
                  {yesNoToBool(item.vatable) ? "V" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="my-2 border-t border-black" />

      <table className="w-full text-[10px]">
        <tbody>
          <tr>
            <td className="font-bold py-0.5">TOTAL SALES:</td>
            <td className="text-right py-0.5">{peso(invoice.TotalSales)}</td>
          </tr>
          {discountBreakdown.map((entry, idx) => (
            <tr key={idx}>
              <td className="font-bold py-0.5">
                {String(entry.discount_type || "DISCOUNT").toUpperCase()}:
              </td>
              <td className="text-right py-0.5">
                - {peso(entry.discount_amount)}
              </td>
            </tr>
          ))}
          {Number(invoice.VATExemptSales_VAT) > 0 && (
            <tr>
              <td className="font-bold py-0.5">VAT EXEMPTION:</td>
              <td className="text-right py-0.5">
                - {peso(invoice.VATExemptSales_VAT)}
              </td>
            </tr>
          )}
          {otherCharges.map((charge, idx) => (
            <tr key={idx}>
              <td className="font-bold py-0.5">
                {String(charge.particulars || "OTHER CHARGE").toUpperCase()}:
              </td>
              <td className="text-right py-0.5">{peso(charge.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-1.5 border-t border-black" />

      <table className="w-full">
        <tbody>
          <tr>
            <td className="font-black text-[15px]">AMOUNT DUE:</td>
            <td className="text-right font-black text-[15px]">
              {peso(invoice.TotalAmountDue)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="my-1.5 border-t border-black" />

      {!isVoidOrRefund && (
        <>
          <table className="w-full text-[10px]">
            <tbody>
              {paymentBreakdown.length > 0 ? (
                paymentBreakdown.map((p, idx) => (
                  <tr key={idx}>
                    <td className="font-bold py-0.5">PAYMENT ({p.method}):</td>
                    <td className="text-right py-0.5">{peso(p.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="font-bold py-0.5">
                    PAYMENT ({invoice.payment_method || "Cash"}):
                  </td>
                  <td className="text-right py-0.5">{peso(invoice.payment_amount)}</td>
                </tr>
              )}
              <tr>
                <td className="font-bold py-0.5">CHANGE:</td>
                <td className="text-right py-0.5">{peso(invoice.change_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="my-2 border-t border-black" />

          <table className="w-full text-[10px]">
            <tbody>
              <tr>
                <td className="font-bold py-0.5">VATABLE SALES:</td>
                <td className="text-right py-0.5">{peso(invoice.VATableSales)}</td>
              </tr>
              <tr>
                <td className="font-bold py-0.5">VAT AMOUNT:</td>
                <td className="text-right py-0.5">{peso(invoice.VATableSales_VAT)}</td>
              </tr>
              <tr>
                <td className="font-bold py-0.5">VAT EXEMPT SALES:</td>
                <td className="text-right py-0.5">{peso(invoice.VATExemptSales)}</td>
              </tr>
              <tr>
                <td className="font-bold py-0.5">VAT EXEMPTION:</td>
                <td className="text-right py-0.5">{peso(invoice.VATExemptSales_VAT)}</td>
              </tr>
              <tr>
                <td className="font-bold py-0.5">ZERO RATED SALES:</td>
                <td className="text-right py-0.5">{peso(invoice.VATZeroRatedSales)}</td>
              </tr>
            </tbody>
          </table>

          {shouldShowDiscountSummary && (
            <>
              <div className="my-2 border-t border-black" />
              <table className="w-full text-[10px]">
                <tbody>
                  <tr>
                    <td className="font-bold py-0.5">Total Customers:</td>
                    <td className="text-right py-0.5">
                      {invoice.customer_head_count || 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Total Qualified:</td>
                    <td className="text-right py-0.5">
                      {invoice.customer_count_for_discount || 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Discountable Gross:</td>
                    <td className="text-right py-0.5">{peso(discountableGross)}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Discountable Base:</td>
                    <td className="text-right py-0.5">{peso(discountableBase)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {isVoidOrRefund && (
        <table className="w-full text-[10px]">
          <tbody>
            <tr>
              <td className="font-bold py-0.5 w-[42%]">
                {invoice.journal_status === "VOIDED" ? "Void No.:" : "Refund No.:"}
              </td>
              <td className="text-right py-0.5">
                {invoice.journal_status === "VOIDED"
                  ? invoice.void_id
                  : invoice.refund_id}
              </td>
            </tr>
            <tr>
              <td className="font-bold py-0.5">
                {invoice.journal_status === "VOIDED" ? "Void Date:" : "Refund Date:"}
              </td>
              <td className="text-right py-0.5">
                {invoice.journal_status === "VOIDED"
                  ? invoice.void_date
                  : invoice.refund_date}
              </td>
            </tr>
            <tr>
              <td className="font-bold py-0.5 align-top">Remarks:</td>
              <td className="text-right py-0.5">
                {invoice.journal_status === "VOIDED"
                  ? invoice.void_remarks || "-"
                  : invoice.refund_remarks || "-"}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="my-2 border-t border-black" />

      <div className="text-center font-bold text-[10px]">
        <div>Thank you</div>
        <div>Please come again.</div>
      </div>

      <div className="mt-2.5 text-center text-[9.5px] text-slate-700">
        <div className="font-bold">
          SUPPLIER: {businessInfo?.posProviderName || "POS PROVIDER"}
        </div>
        {posProviderAddress.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
        <div>TIN: {businessInfo?.posProviderTin || "-"}</div>
        <div>BIR ACCR#: {businessInfo?.posProviderBirAccreNo || "-"}</div>
        <div>DATE ISSUED: {businessInfo?.posProviderAccreDateIssued || "-"}</div>
        <div>PTU# {businessInfo?.posProviderPTUNo || "-"}</div>
        <div>PTU DATE ISSUED: {businessInfo?.posProviderPTUDateIssued || "-"}</div>
      </div>
    </div>
  );
};

const EJournalReportModal = ({ isOpen, onClose, reportData, isLoading, onFilter }) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [refundNo, setRefundNo] = useState("");
  const [voidNo, setVoidNo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { businessInfo } = useBusinessInfo();

  if (!isOpen) return null;

  const invoices = Array.isArray(reportData) ? reportData : [];

  const handleFilter = () => {
    const hasIdSearch = transactionId || invoiceNo || refundNo || voidNo;

    if (!hasIdSearch && (!dateFrom || !dateTo)) {
      alert(
        "Please select both Date From and Date To, or search by Transaction ID / Invoice Number / Refund Number / Void Number.",
      );
      return;
    }
    if (onFilter) {
      onFilter({ dateFrom, dateTo, transactionId, invoiceNo, refundNo, voidNo });
    }
  };

  const handleExportText = async () => {
    if (invoices.length === 0) return;

    setIsExporting(true);
    try {
      if (invoices.length === 1) {
        const invoice = invoices[0];
        const text = buildInvoiceText(invoice, businessInfo);
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        saveAs(blob, buildInvoiceFileName(invoice));
        return;
      }

      const zip = new JSZip();
      const usedNames = new Map();

      invoices.forEach((invoice) => {
        const text = buildInvoiceText(invoice, businessInfo);
        let fileName = buildInvoiceFileName(invoice);

        const count = usedNames.get(fileName) || 0;
        usedNames.set(fileName, count + 1);
        if (count > 0) {
          fileName = fileName.replace(/\.txt$/, `_${count + 1}.txt`);
        }

        zip.file(fileName, text);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(
        zipBlob,
        `E-JOURNAL-${(dateFrom || "from").replace(/\//g, "-")}_${(
          dateTo || "to"
        ).replace(/\//g, "-")}.zip`,
      );
    } catch (error) {
      console.error("Text export failed:", error);
      alert("Failed to export text file(s).");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300 print:static print:bg-white print:p-0">
      <div className="relative w-full max-w-[900px] flex flex-col md:flex-row gap-6 h-[95vh] animate-in fade-in zoom-in duration-300 print:h-auto print:max-w-full print:block">
        {/* LEFT SIDE: SIDEBAR FILTER */}
        <div className="w-full md:w-[280px] bg-white rounded-2xl p-6 shadow-2xl border-2 border-blue-100 flex flex-col shrink-0 overflow-y-auto print:hidden">
          <div className="flex items-center gap-2.5 mb-6 text-blue-600 font-bold uppercase text-[11px] tracking-[0.2em]">
            <FaCalendarAlt size={16} />
            <span>Select Report Period</span>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <div className="flex-1 h-px bg-slate-200" />
              or search by
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Transaction ID
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 1000008868"
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. 4000008865"
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Refund Number
              </label>
              <input
                type="text"
                value={refundNo}
                onChange={(e) => setRefundNo(e.target.value)}
                placeholder="Refund #"
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Void Number
              </label>
              <input
                type="text"
                value={voidNo}
                onChange={(e) => setVoidNo(e.target.value)}
                placeholder="Void #"
                className="w-full p-3 text-sm border-2 shadow-inner outline-none border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleFilter}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 text-xs shadow-lg active:scale-95"
            >
              <FaSearch size={13} /> SEARCH RECORDS
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: JOURNAL PREVIEW */}
        <div className="flex flex-col flex-1 h-full min-w-0 print:h-auto">
          <div className="flex items-center justify-between mb-3 text-[11px] font-bold tracking-[0.2em] text-white uppercase px-1 print:hidden">
            <span>E-Journal Report</span>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 hover:text-rose-400 transition-colors"
            >
              CLOSE <FaTimes size={18} />
            </button>
          </div>

          <div className="bg-[#fefefe] shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-y-auto rounded-sm flex-1 border-2 border-blue-100 scrollbar-thin print:shadow-none print:border-0 print:overflow-visible">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 italic animate-pulse text-slate-400 py-20">
                <div className="w-8 h-8 border-4 rounded-full border-slate-200 border-t-blue-500 animate-spin"></div>
                Retrieving Data...
              </div>
            ) : (
              <div className="max-w-[360px] mx-auto bg-white">
                {invoices.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 italic text-sm">
                    No records found. Select a date range or search by ID.
                  </div>
                ) : (
                  invoices.map((inv, idx) => (
                    <InvoiceReceipt
                      key={inv.transaction_id || idx}
                      invoice={inv}
                      businessInfo={businessInfo}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex w-full gap-3 mt-4 print:hidden">
            <button
              onClick={handleExportText}
              disabled={invoices.length === 0 || isExporting}
              className="flex items-center justify-center flex-1 gap-2.5 py-4 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              <FaFileArchive size={16} />
              {isExporting
                ? "Exporting..."
                : invoices.length > 1
                  ? "Export as Text Files (.zip)"
                  : "Export as Text File"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EJournalReportModal;
