const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const row = (label, value) => `
  <div class="row"><span>${label}</span><span>${value}</span></div>
`;

const yesNoToBool = (value) =>
  String(value || "").trim().toLowerCase() === "yes" || value === true;

export const buildVoidRefundHtml = ({
  type = "void",
  transaction = {},
  computed = {},
  voidRefundInfo = {},
  items = [],
  businessInfo = {},
}) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safeComputed = computed || {};
  const activeBreakdown = Array.isArray(safeComputed?.discountBreakdown)
    ? safeComputed.discountBreakdown.filter(
        (entry) =>
          Number(entry?.qualifiedCount || 0) > 0 ||
          Number(entry?.discountAmount || 0) > 0,
      )
    : [];
  const shouldShowDiscountSummary =
    Number(safeComputed?.safeCustomerCount || 0) > 0 ||
    Number(
      safeComputed?.totalQualifiedCount || safeComputed?.totalQualifiedAll || 0,
    ) > 0 ||
    Number(safeComputed?.statutoryQualifiedCount || 0) > 0 ||
    activeBreakdown.length > 0;

  const addressLines = String(businessInfo?.address || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
  const posProviderAddressLines = String(businessInfo?.posProviderAddress || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

  const receiptTitle = type === "refund" ? "REFUND RECEIPT" : "VOID RECEIPT";
  const actionLabel = type === "refund" ? "Refund" : "Void";
  const voidRefundNumber =
    type === "refund"
      ? String(transaction?.refund_id || "")
      : String(transaction?.void_id || "");

  const metaRows = [
    ["Trans. No.:", transaction?.transaction_id || "-"],
    ["INV#:", transaction?.invoice_no || "-"],
    ...(voidRefundNumber ? [[`${actionLabel} #:`, voidRefundNumber]] : []),
    ["Trans. Date:", transaction?.transaction_date || "-"],
    ["Trans. Time:", transaction?.transaction_time || "-"],
    ["Terminal No.:", transaction?.terminal_number || "-"],
    ["Order Type:", transaction?.order_type || "-"],
    ["Ref./Tag #:", transaction?.table_number || "-"],
    ["Cashier:", transaction?.cashier || "-"],
    [`${actionLabel} Date:`, voidRefundInfo?.actionDate || "-"],
    [`${actionLabel} Time:`, voidRefundInfo?.actionTime || "-"],
  ];

  const itemRows = safeItems
    .map((item) => {
      const isDiscountable = yesNoToBool(item?.isDiscountable);
      const name = `${String(item?.item_name || item?.product_id || "-").toUpperCase()}${
        isDiscountable ? " (D)" : ""
      }`;
      const qty = Number(item?.sales_quantity || 0);
      const lineTotal =
        Number(item?.subtotal || 0) ||
        Number(item?.sales_quantity || 0) * Number(item?.selling_price || 0);
      const subtotal = `${peso(lineTotal)}${item?.vatable === "Yes" ? "V" : ""}`;

      return `
        <tr>
          <td class="name">${name}</td>
          <td class="qty">${qty}</td>
          <td class="amt">${subtotal}</td>
        </tr>
      `;
    })
    .join("");

  const discountRows = activeBreakdown
    .filter((entry) => Number(entry?.discountAmount || 0) > 0)
    .map((entry) =>
      row(
        `${String(entry?.label || "DISCOUNT").toUpperCase()}:`,
        `- ${peso(entry.discountAmount)}`,
      ),
    )
    .join("");

  const discountSummaryRows = shouldShowDiscountSummary
    ? `
      <div class="line"></div>
      ${row("Total Customers:", Number(safeComputed?.safeCustomerCount || 0))}
      ${row(
        "Total Qualified:",
        Number(
          safeComputed?.totalQualifiedCount || safeComputed?.totalQualifiedAll || 0,
        ),
      )}
      ${activeBreakdown
        .map(
          (entry) => `
          ${row(String(entry?.label || "").toUpperCase() + " Qualified:", Number(entry?.qualifiedCount || 0))}
          ${row(String(entry?.label || "").toUpperCase() + " Amount:", peso(entry?.discountAmount || 0))}
        `,
        )
        .join("")}
      ${row("Discountable Gross:", peso(safeComputed?.discountableGross || 0))}
      ${row("Discountable Base:", peso(safeComputed?.discountableBase || 0))}
    `
    : "";

  const remarks = String(voidRefundInfo?.remarks || "NO REMARKS");

  const posProviderBlock = businessInfo?.posProviderName
    ? `
      <div class="line"></div>
      <div class="center">
        <div class="strong">${businessInfo.posProviderName}</div>
        ${posProviderAddressLines.map((line) => `<div>${line}</div>`).join("")}
        ${businessInfo?.posProviderTin ? `<div>TIN: ${businessInfo.posProviderTin}</div>` : ""}
        ${businessInfo?.posProviderBirAccreNo ? `<div>BIR ACC#: ${businessInfo.posProviderBirAccreNo}</div>` : ""}
        ${businessInfo?.posProviderAccreDateIssued ? `<div>DATE ISSUED: ${businessInfo.posProviderAccreDateIssued}</div>` : ""}
        ${businessInfo?.posProviderPTUNo ? `<div>PTU: ${businessInfo.posProviderPTUNo}</div>` : ""}
        ${businessInfo?.posProviderPTUDateIssued ? `<div>PTU DATE ISSUED: ${businessInfo.posProviderPTUDateIssued}</div>` : ""}
      </div>
    `
    : "";

  const payMethod = String(safeComputed?.paymentMethod || "Cash");
  const payAmt = Number(
    safeComputed?.paymentAmount || safeComputed?.totalPaid || safeComputed?.totalAmountDue || 0,
  );
  const changeAmt = Number(safeComputed?.changeAmount || 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${receiptTitle}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: 80mm auto; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
          }
          .receipt {
            width: 76.5mm;
            padding: 8px 16px 8px 1px;
            font-size: 10.5px;
            line-height: 1.2;
          }
          .center { text-align: center; }
          .strong { font-weight: 700; }
          .title { font-weight: 900; font-size: 14px; margin: 6px 0; }
          .line { border-top: 1px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
          th, td { padding: 1px 0; vertical-align: top; }
          th { text-align: left; border-bottom: 1px solid #000; }
          .name { text-align: left; word-break: break-word; }
          .qty { text-align: center; width: 16%; }
          .amt { text-align: right; width: 32%; }
          .amount-due { text-align: center; font-weight: 900; font-size: 18px; margin: 6px 0; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <div class="strong">${businessInfo?.companyName || ""}</div>
            ${businessInfo?.storeName ? `<div>${businessInfo.storeName}</div>` : ""}
            ${businessInfo?.corpName ? `<div>${businessInfo.corpName}</div>` : ""}
            ${addressLines.map((line) => `<div>${line}</div>`).join("")}
            ${businessInfo?.tin ? `<div>VAT REG TIN: ${businessInfo.tin}</div>` : ""}
            ${businessInfo?.machineNumber ? `<div>MIN: ${businessInfo.machineNumber}</div>` : ""}
            ${businessInfo?.serialNumber ? `<div>S/N: ${businessInfo.serialNumber}</div>` : ""}
            <div class="title">${receiptTitle}</div>
          </div>

          ${metaRows.map(([label, value]) => row(label, value)).join("")}

          <div class="line"></div>

          ${
            safeItems.length > 0
              ? `
            <table>
              <thead>
                <tr><th class="name">Item</th><th class="qty">Qty</th><th class="amt">Price</th></tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div class="line"></div>
          `
              : ""
          }

          ${row("TOTAL SALES:", peso(safeComputed?.grossTotal || 0))}
          ${discountRows}
          ${
            Number(safeComputed?.totalVatExemption || 0) > 0
              ? row("VAT EXEMPTION:", `- ${peso(safeComputed.totalVatExemption)}`)
              : ""
          }

          <div class="amount-due">
            AMOUNT DUE<br />${peso(safeComputed?.totalAmountDue || 0)}
          </div>

          <div class="line"></div>
          ${row(`PAYMENT (${payMethod}):`, peso(payAmt))}
          ${row("TOTAL PAYMENT:", peso(payAmt))}
          ${row("CHANGE:", peso(changeAmt))}

          <div class="line"></div>
          ${row("VATABLE SALES:", peso(safeComputed?.vatableSales || 0))}
          ${row("VAT AMOUNT:", peso(safeComputed?.vatableSalesVat || 0))}
          ${row("VAT EXEMPT SALES:", peso(safeComputed?.vatExemptSales || 0))}
          ${row("VAT EXEMPTION:", peso(safeComputed?.totalVatExemption || 0))}
          ${row("ZERO RATED SALES:", peso(safeComputed?.vatZeroRatedSales || 0))}

          ${discountSummaryRows}

          <div class="line"></div>
          ${row("Auth By:", voidRefundInfo?.authBy || "-")}
          <div>Remarks:</div>
          <div>&nbsp;&nbsp;${remarks}</div>

          ${posProviderBlock}
        </div>
      </body>
    </html>
  `;
};
