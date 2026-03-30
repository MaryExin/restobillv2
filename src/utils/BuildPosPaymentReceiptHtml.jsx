import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedNegativePeso = (value) => `- ${peso(value)}`;

export function BuildPosPaymentReceiptHtml({
  transaction,
  items = [],
  computed,
  payments = [],
  otherCharges = [],
  customerCards = [],
  isDuplicateCopy = false,
  terminalConfig = {},
}) {
  const yesNoToBool = (value) =>
    String(value || "")
      .trim()
      .toLowerCase() === "yes";

  const safeTransaction = transaction || {};
  const safeItems = Array.isArray(items) ? items : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOtherCharges = Array.isArray(otherCharges) ? otherCharges : [];
  const safeCustomerCards = Array.isArray(customerCards) ? customerCards : [];

  const paymentLabel =
    safePayments.length > 0
      ? [
          ...new Set(safePayments.map((p) => p.payment_method).filter(Boolean)),
        ].join(", ")
      : safeTransaction?.payment_method || "Cash";

  const activeBreakdown = Array.isArray(computed?.discountBreakdown)
    ? computed.discountBreakdown.filter(
        (entry) =>
          Number(entry?.qualifiedCount || 0) > 0 ||
          Number(entry?.discountAmount || 0) > 0,
      )
    : [];

  const getDiscountCountLabel = (entry) => {
    if (entry?.key === "senior") return "Senior Citizen Discount Count:";
    if (entry?.key === "pwd") return "PWD Discount Count:";
    if (entry?.key === "manual") return "Manual Discount Count:";
    return `${entry?.label || "Discount"} Count:`;
  };

  const getDiscountAmountLabel = (entry) => {
    if (entry?.key === "senior") return "Senior Citizen Discount Amount:";
    if (entry?.key === "pwd") return "PWD Discount Amount:";
    if (entry?.key === "manual") return "Manual Discount Amount:";
    return `${entry?.label || "Discount"} Amount:`;
  };

  const shouldShowDiscountSummary =
    Number(computed?.safeCustomerCount || 0) > 0 ||
    Number(computed?.totalQualifiedCount || computed?.totalQualifiedAll || 0) >
      0 ||
    Number(computed?.statutoryQualifiedCount || 0) > 0 ||
    activeBreakdown.length > 0;

  const MetaColGroup = () => (
    <colgroup>
      <col style={{ width: "32%" }} />
      <col style={{ width: "68%" }} />
    </colgroup>
  );

  const splitAddressLines = (value) => {
    const raw = String(value || "")
      .split(/\r?\n|\|/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (raw.length > 0) return raw;
    return [];
  };

  const companyName =
    terminalConfig?.corpName || "CRABS N CRACK SEAFOOD HOUSE";

  const businessUnitName =
    terminalConfig?.businessUnitName || "AND SHAKING CRABS - STA. MARIA";

  const legalEntityName =
    terminalConfig?.legalEntityName ||
    terminalConfig?.companyName ||
    terminalConfig?.registeredName ||
    "";

  const addressLines = splitAddressLines(
    terminalConfig?.unitAddress ||
      terminalConfig?.address ||
      terminalConfig?.businessAddress ||
      "",
  );

  const vatTin =
    terminalConfig?.vatTin ||
    terminalConfig?.tin ||
    terminalConfig?.vatRegTin ||
    "";

  const supplierName =
    terminalConfig?.supplierName || "LIGHTEM SOLUTIONS INCORPORATED";

  const supplierAddressLines = splitAddressLines(
    terminalConfig?.supplierAddress ||
      terminalConfig?.supplierAddressLine1 ||
      "1187, PARULAN, PLARIDEL|BULACAN, PHILIPPINES",
  );

  const supplierTin = terminalConfig?.supplierTin || "626717559-000";
  const supplierBirAccNo =
    terminalConfig?.supplierBirAccNo || "25A6267175592023091853";
  const supplierDateIssued =
    terminalConfig?.supplierDateIssued || "12/04/2023";

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>
          {safeTransaction?.transaction_id || "receipt"}-
          {isDuplicateCopy ? "duplicate-invoice" : "invoice"}
        </title>
        <style>{`
          :root {
            --s: 1;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            overflow: hidden;
          }

          .print-root {
            width: 76.5mm;
            padding: calc(8px * var(--s)) calc(5px * var(--s)) calc(8px * var(--s)) calc(2px * var(--s));
            font-size: calc(10.5px * var(--s));
            line-height: 1.18;
            margin: 0;
            background: #ffffff;
            color: #000000;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: calc(9.6px * var(--s));
          }

          td,
          th {
            padding: 0;
            vertical-align: top;
            line-height: 1.1;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
          }

          .left {
            text-align: left;
          }

          .bold {
            font-weight: 700;
          }

          .black {
            font-weight: 900;
          }

          .header-title {
            font-weight: 900;
            font-size: calc(15px * var(--s));
            line-height: 1.15;
          }

          .sub-title {
            font-weight: 700;
            font-size: calc(12px * var(--s));
            margin-top: calc(2px * var(--s));
          }

          .small {
            font-size: calc(10px * var(--s));
          }

          .invoice-title {
            text-align: center;
            font-weight: 900;
            font-size: calc(14px * var(--s));
            margin-bottom: calc(4px * var(--s));
          }

          .duplicate-copy {
            text-align: center;
            font-weight: 900;
            font-size: calc(11px * var(--s));
            margin-bottom: calc(8px * var(--s));
          }

          .divider {
            border-top: 1px solid #000;
            margin: calc(8px * var(--s)) 0 calc(7px * var(--s));
          }

          .divider-tight {
            border-top: 1px solid #000;
            margin: calc(8px * var(--s)) 0 calc(6px * var(--s));
          }

          .meta-table th,
          .meta-table td {
            font-size: calc(9.6px * var(--s));
          }

          .meta-table th {
            padding-bottom: calc(4px * var(--s));
          }

          .label-col {
            width: 38%;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            padding-right: calc(4px * var(--s));
          }

          .value-col {
            width: 62%;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
            padding-right: calc(12px * var(--s));
            padding-left: 0;
          }

          .item-table th,
          .item-table td {
            font-size: calc(9.6px * var(--s));
          }

          .item-table th {
            padding-bottom: calc(4px * var(--s));
          }

          .item-col {
            width: 44%;
            text-align: left;
            word-break: break-word;
            overflow-wrap: break-word;
            padding-right: calc(1px * var(--s));
            padding-left: 0;
          }

          .qty-col {
            width: 8%;
            text-align: center;
            white-space: nowrap;
            padding-right: 0;
            padding-left: 0;
          }

          .amt-col {
            width: 44%;
            text-align: right;
            white-space: nowrap;
            padding-right: calc(16px * var(--s));
            padding-left: 0;
          }

          .item-row td {
            padding-bottom: calc(1px * var(--s));
          }

          .amount-due {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: calc(4px * var(--s));
            font-weight: 900;
            font-size: calc(16px * var(--s));
          }

          .amount-due-label {
            white-space: nowrap;
            flex: 0 0 auto;
          }

          .amount-due-value {
            white-space: nowrap;
            text-align: right;
            padding-right: calc(16px * var(--s));
            flex: 1 1 auto;
          }

          .customer-section-title {
            font-size: calc(10px * var(--s));
            font-weight: 700;
            margin-bottom: calc(4px * var(--s));
          }

          .thanks {
            text-align: center;
            font-size: calc(10px * var(--s));
          }

          .supplier-block {
            margin-top: calc(10px * var(--s));
            text-align: center;
            font-size: calc(10px * var(--s));
          }

          .supplier-block .bold {
            font-weight: 700;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }
        `}</style>
      </head>
      <body>
        <div className="print-root">
          <div className="center">
            <div className="header-title">{businessUnitName}</div>

            <div className="sub-title">{String(companyName).toUpperCase()}</div>

            {legalEntityName ? (
              <div className="sub-title">{String(legalEntityName).toUpperCase()}</div>
            ) : null}

            {addressLines.map((line, index) => (
              <div
                key={`address-${index}`}
                className="small"
                style={index === 0 ? { marginTop: "8px" } : undefined}
              >
                {line}
              </div>
            ))}

            {vatTin ? (
              <div className="small">VAT REG TIN: {vatTin}</div>
            ) : null}

            <div className="small">
              MIN: {terminalConfig?.machineNumber || "-"}
            </div>
            <div className="small">
              S/N: {terminalConfig?.serialNumber || "-"}
            </div>
          </div>

          <div className="divider" />

          <div className="invoice-title">INVOICE</div>

          {isDuplicateCopy ? (
            <div className="duplicate-copy">DUPLICATE INVOICE COPY</div>
          ) : null}

          <table className="meta-table">
            <MetaColGroup />
            <tbody>
              <tr>
                <td className="bold label-col">Trans. No.:</td>
                <td className="value-col">
                  {safeTransaction?.transaction_id || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">INV#:</td>
                <td className="value-col">{safeTransaction?.invoice_no || "-"}</td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Date:</td>
                <td className="value-col">
                  {safeTransaction?.transaction_date || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Time:</td>
                <td className="value-col">
                  {safeTransaction?.transaction_time || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Terminal No.:</td>
                <td className="value-col">
                  {safeTransaction?.terminal_number ||
                    terminalConfig?.terminalNumber ||
                    "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Order Type:</td>
                <td className="value-col">{safeTransaction?.order_type || "-"}</td>
              </tr>
              <tr>
                <td className="bold label-col">Ref./Tag #:</td>
                <td className="value-col">{safeTransaction?.table_number || "-"}</td>
              </tr>
              <tr>
                <td className="bold label-col">Cashier:</td>
                <td className="value-col">{safeTransaction?.cashier || "-"}</td>
              </tr>
            </tbody>
          </table>

          <div className="divider" />

          <table className="item-table">
            <thead>
              <tr>
                <th className="item-col">Item</th>
                <th className="qty-col">Qty</th>
                <th className="amt-col">Amt</th>
              </tr>
            </thead>
            <tbody>
              {safeItems.map((item, index) => {
                const qty = Number(item.sales_quantity || 0);
                const price = Number(item.selling_price || 0);
                const lineTotal = qty * price;

                const isDiscountable = yesNoToBool(item.isDiscountable);
                const itemLabel = String(
                  item.item_name || item.product_id || "-",
                ).toUpperCase();

                return (
                  <tr key={item.ID || index} className="item-row">
                    <td className="item-col">
                      • {itemLabel}
                      {isDiscountable ? " (D)" : ""}
                    </td>
                    <td className="qty-col">
                      {qty} {item.unit_of_measure || ""}
                    </td>
                    <td className="amt-col">{peso(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="divider" />

          <table className="meta-table">
            <MetaColGroup />
            <tbody>
              <tr>
                <td className="bold label-col">TOTAL SALES:</td>
                <td className="value-col">{peso(computed?.grossTotal)}</td>
              </tr>

              {activeBreakdown.map((entry) =>
                Number(entry?.discountAmount || 0) > 0 ? (
                  <tr key={entry.key}>
                    <td className="bold label-col">
                      {String(entry?.label || "DISCOUNT").toUpperCase()}:
                    </td>
                    <td className="value-col">
                      {signedNegativePeso(entry?.discountAmount)}
                    </td>
                  </tr>
                ) : null,
              )}

              {Number(computed?.totalVatExemption || 0) > 0 ? (
                <tr>
                  <td className="bold label-col">VAT EXEMPTION:</td>
                  <td className="value-col">
                    {signedNegativePeso(computed?.totalVatExemption)}
                  </td>
                </tr>
              ) : null}

              {safeOtherCharges.map((charge, index) => (
                <tr key={`${charge.particulars}-${index}`}>
                  <td className="bold label-col">
                    {String(charge.particulars || "OTHER CHARGE").toUpperCase()}:
                  </td>
                  <td className="value-col">{peso(charge.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divider-tight" />

          <div className="amount-due">
            <span className="amount-due-label">AMOUNT DUE:</span>
            <span className="amount-due-value">
              {peso(computed?.totalAmountDue)}
            </span>
          </div>

          <div className="divider-tight" />

          <table className="meta-table">
            <MetaColGroup />
            <tbody>
              <tr>
                <td className="bold label-col">PAYMENT ({paymentLabel}):</td>
                <td className="value-col">{peso(computed?.totalPaid)}</td>
              </tr>
              <tr>
                <td className="bold label-col">CHANGE:</td>
                <td className="value-col">{peso(computed?.changeAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="divider-tight" />

          <table className="meta-table">
            <MetaColGroup />
            <tbody>
              <tr>
                <td className="bold label-col">VATABLE SALES:</td>
                <td className="value-col">{peso(computed?.vatableSales)}</td>
              </tr>
              <tr>
                <td className="bold label-col">VAT AMOUNT:</td>
                <td className="value-col">{peso(computed?.vatableSalesVat)}</td>
              </tr>
              <tr>
                <td className="bold label-col">VAT EXEMPT SALES:</td>
                <td className="value-col">{peso(computed?.vatExemptSales)}</td>
              </tr>
              <tr>
                <td className="bold label-col">VAT EXEMPTION:</td>
                <td className="value-col">{peso(computed?.totalVatExemption)}</td>
              </tr>
              <tr>
                <td className="bold label-col">ZERO RATED SALES:</td>
                <td className="value-col">{peso(computed?.vatZeroRatedSales)}</td>
              </tr>
            </tbody>
          </table>

          {shouldShowDiscountSummary ? (
            <>
              <div className="divider" />

              <table className="meta-table">
                <MetaColGroup />
                <tbody>
                  <tr>
                    <td className="bold label-col">Total Customers:</td>
                    <td className="value-col">
                      {Number(computed?.safeCustomerCount || 0)}
                    </td>
                  </tr>

                  <tr>
                    <td className="bold label-col">Total Qualified:</td>
                    <td className="value-col">
                      {Number(
                        computed?.totalQualifiedCount ||
                          computed?.totalQualifiedAll ||
                          0,
                      )}
                    </td>
                  </tr>

                  {activeBreakdown.map((entry) => (
                    <React.Fragment key={`summary-${entry.key}`}>
                      <tr>
                        <td className="bold label-col">
                          {getDiscountCountLabel(entry)}
                        </td>
                        <td className="value-col">
                          {Number(entry?.qualifiedCount || 0)}
                        </td>
                      </tr>

                      <tr>
                        <td className="bold label-col">
                          {getDiscountAmountLabel(entry)}
                        </td>
                        <td className="value-col">{peso(entry?.discountAmount)}</td>
                      </tr>
                    </React.Fragment>
                  ))}

                  <tr>
                    <td className="bold label-col">Discountable Gross:</td>
                    <td className="value-col">{peso(computed?.discountableGross)}</td>
                  </tr>

                  <tr>
                    <td className="bold label-col">Discountable Base:</td>
                    <td className="value-col">{peso(computed?.discountableBase)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : null}

          {safeCustomerCards.length > 0 ? (
            <>
              <div className="divider" />

              <div className="customer-section-title">
                DISCOUNT CUSTOMER DETAILS
              </div>

              {safeCustomerCards.map((card, index) => (
                <table
                  key={index}
                  className="meta-table"
                  style={{ marginBottom: "6px" }}
                >
                  <MetaColGroup />
                  <tbody>
                    <tr>
                      <td className="label-col bold">Name:</td>
                      <td className="value-col">{card.customer_name || ""}</td>
                    </tr>
                    <tr>
                      <td className="label-col bold">ID:</td>
                      <td className="value-col">
                        {card.customer_exclusive_id || ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="label-col bold">Signature:</td>
                      <td className="value-col"></td>
                    </tr>
                  </tbody>
                </table>
              ))}
            </>
          ) : null}

          <div className="divider" />

          <div className="thanks">
            <div className="bold">Thank you</div>
            <div className="bold">Please come again.</div>
          </div>

          <div className="supplier-block">
            {supplierName ? <div className="bold">SUPPLIER: {supplierName}</div> : null}
            {supplierAddressLines.map((line, index) => (
              <div key={`supplier-${index}`}>{line}</div>
            ))}
            {supplierTin ? <div>TIN: {supplierTin}</div> : null}
            {supplierBirAccNo ? <div>BIR ACC#: {supplierBirAccNo}</div> : null}
            {supplierDateIssued ? <div>DATE ISSUED: {supplierDateIssued}</div> : null}
            {terminalConfig?.ptuNumber ? <div>PTU: {terminalConfig.ptuNumber}</div> : null}
            {terminalConfig?.ptuDateIssued ? (
              <div>PTU DATE ISSUED: {terminalConfig.ptuDateIssued}</div>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}

export default BuildPosPaymentReceiptHtml;
