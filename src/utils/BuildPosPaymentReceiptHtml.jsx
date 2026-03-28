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

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>
          {safeTransaction?.transaction_id || "receipt"}-
          {isDuplicateCopy ? "duplicate-invoice" : "invoice"}
        </title>
        <style>{`
          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 80mm;
          }

          .print-root {
            width: 80mm;
            min-height: auto;
            background: #ffffff;
            color: #000000;
            padding: 14px 29px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.25;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          td,
          th {
            padding: 0;
            vertical-align: top;
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
            font-size: 15px;
            line-height: 1.15;
          }

          .sub-title {
            font-weight: 700;
            font-size: 12px;
            margin-top: 2px;
          }

          .small {
            font-size: 10px;
          }

          .invoice-title {
            text-align: center;
            font-weight: 900;
            font-size: 14px;
            margin-bottom: 4px;
          }

          .duplicate-copy {
            text-align: center;
            font-weight: 900;
            font-size: 11px;
            margin-bottom: 8px;
          }

          .divider {
            border-top: 1px solid #000;
            margin: 10px 0 8px;
          }

          .divider-tight {
            border-top: 1px solid #000;
            margin: 8px 0 6px;
          }

          .meta-table td {
            font-size: 10px;
            padding: 1px 0;
          }

          .item-table th,
          .item-table td {
            font-size: 10px;
            padding: 2px 0;
          }

          .item-table th {
            padding-bottom: 4px;
          }

          .item-col {
            width: 46%;
            text-align: left;
            word-break: break-word;
            overflow-wrap: break-word;
          }

          .qty-col {
            width: 22%;
            text-align: center;
            white-space: nowrap;
          }

          .amt-col {
            width: 32%;
            text-align: right;
            white-space: nowrap;
          }

          .amount-due {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-weight: 900;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .customer-section-title {
            font-size: 10px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .thanks {
            text-align: center;
            font-size: 10px;
          }

          .supplier-block {
            margin-top: 10px;
            text-align: center;
            font-size: 10px;
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
            <div className="header-title">
              {String(
                terminalConfig?.corpName || "CRABS N CRACK SEAFOOD HOUSE",
              ).toUpperCase()}
            </div>

            <div className="sub-title">
              {terminalConfig?.businessUnitName ||
                "AND SHAKING CRABS - STA. MARIA"}
            </div>

            <div className="sub-title">ARU FOOD CORP.</div>

            <div className="small" style={{ marginTop: "8px" }}>
              BYPASS ROAD TABING BAKOD P. STA MARIA
            </div>
            <div className="small">BULACAN</div>
            <div className="small">VAT REG TIN: 634-742-586-00012</div>
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
            <tbody>
              <tr>
                <td className="bold">Trans. No.:</td>
                <td className="right">
                  {safeTransaction?.transaction_id || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold">INV#:</td>
                <td className="right">{safeTransaction?.invoice_no || "-"}</td>
              </tr>
              <tr>
                <td className="bold">Trans. Date:</td>
                <td className="right">
                  {safeTransaction?.transaction_date || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold">Trans. Time:</td>
                <td className="right">
                  {safeTransaction?.transaction_time || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold">Terminal No.:</td>
                <td className="right">
                  {safeTransaction?.terminal_number ||
                    terminalConfig?.terminalNumber ||
                    "-"}
                </td>
              </tr>
              <tr>
                <td className="bold">Order Type:</td>
                <td className="right">{safeTransaction?.order_type || "-"}</td>
              </tr>
              <tr>
                <td className="bold">Ref./Tag #:</td>
                <td className="right">
                  {safeTransaction?.table_number || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold">Cashier:</td>
                <td className="right">{safeTransaction?.cashier || "-"}</td>
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

                return (
                  <tr key={item.ID || index}>
                    <td className="item-col">
                      •{" "}
                      {String(
                        item.item_name || item.product_id || "-",
                      ).toUpperCase()}
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
            <tbody>
              <tr>
                <td className="bold">TOTAL SALES:</td>
                <td className="right">{peso(computed?.grossTotal)}</td>
              </tr>

              {activeBreakdown.map((entry) =>
                Number(entry?.discountAmount || 0) > 0 ? (
                  <tr key={entry.key}>
                    <td className="bold">
                      {String(entry?.label || "DISCOUNT").toUpperCase()}:
                    </td>
                    <td className="right">
                      {signedNegativePeso(entry?.discountAmount)}
                    </td>
                  </tr>
                ) : null,
              )}

              {Number(computed?.totalVatExemption || 0) > 0 ? (
                <tr>
                  <td className="bold">VAT EXEMPTION:</td>
                  <td className="right">
                    {signedNegativePeso(computed?.totalVatExemption)}
                  </td>
                </tr>
              ) : null}

              {safeOtherCharges.map((charge, index) => (
                <tr key={`${charge.particulars}-${index}`}>
                  <td className="bold">
                    {String(charge.particulars || "OTHER CHARGE").toUpperCase()}
                    :
                  </td>
                  <td className="right">{peso(charge.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divider-tight" />

          <div className="amount-due">
            <span>AMOUNT DUE:</span>
            <span>{peso(computed?.totalAmountDue)}</span>
          </div>

          <table className="meta-table">
            <tbody>
              <tr>
                <td className="bold">PAYMENT ({paymentLabel}):</td>
                <td className="right">{peso(computed?.totalPaid)}</td>
              </tr>
              <tr>
                <td className="bold">CHANGE:</td>
                <td className="right">{peso(computed?.changeAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="divider-tight" />

          <table className="meta-table">
            <tbody>
              <tr>
                <td className="bold">VATABLE SALES:</td>
                <td className="right">{peso(computed?.vatableSales)}</td>
              </tr>
              <tr>
                <td className="bold">VAT AMOUNT:</td>
                <td className="right">{peso(computed?.vatableSalesVat)}</td>
              </tr>
              <tr>
                <td className="bold">VAT EXEMPT SALES:</td>
                <td className="right">{peso(computed?.vatExemptSales)}</td>
              </tr>
              <tr>
                <td className="bold">VAT EXEMPTION:</td>
                <td className="right">{peso(computed?.totalVatExemption)}</td>
              </tr>
              <tr>
                <td className="bold">ZERO RATED SALES:</td>
                <td className="right">{peso(computed?.vatZeroRatedSales)}</td>
              </tr>
            </tbody>
          </table>

          {shouldShowDiscountSummary ? (
            <>
              <div className="divider" />

              <table className="meta-table">
                <tbody>
                  <tr>
                    <td className="bold">Total Customers:</td>
                    <td className="right">
                      {Number(computed?.safeCustomerCount || 0)}
                    </td>
                  </tr>

                  <tr>
                    <td className="bold">Total Qualified:</td>
                    <td className="right">
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
                        <td className="bold">{getDiscountCountLabel(entry)}</td>
                        <td className="right">
                          {Number(entry?.qualifiedCount || 0)}
                        </td>
                      </tr>

                      <tr>
                        <td className="bold">
                          {getDiscountAmountLabel(entry)}
                        </td>
                        <td className="right">{peso(entry?.discountAmount)}</td>
                      </tr>
                    </React.Fragment>
                  ))}

                  <tr>
                    <td className="bold">Discountable Gross:</td>
                    <td className="right">
                      {peso(computed?.discountableGross)}
                    </td>
                  </tr>

                  <tr>
                    <td className="bold">Discountable Base:</td>
                    <td className="right">
                      {peso(computed?.discountableBase)}
                    </td>
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
                  <tbody>
                    <tr>
                      <td>{card.customer_name || ""}</td>
                    </tr>

                    <tr>
                      <td className="bold">Name:</td>
                      <td>{card.customer_name || ""}</td>
                    </tr>
                    <tr>
                      <td className="bold">ID:</td>
                      <td>{card.customer_exclusive_id || ""}</td>
                    </tr>
                    <tr>
                      <td className="bold">Signature:</td>
                      <td></td>
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
            <div className="bold">SUPPLIER: LIGHTEM SOLUTIONS INCORPORATED</div>
            <div>1187, PARULAN, PLARIDEL</div>
            <div>BULACAN, PHILIPPINES</div>
            <div>TIN: 626717559-000</div>
            <div>BIR ACC#: 25A6267175592023091853</div>
            <div>DATE ISSUED: 12/04/2023</div>
            <div>PTU: {terminalConfig?.ptuNumber || ""}</div>
            <div>DATE ISSUED: {terminalConfig?.ptuDateIssued || ""}</div>
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}

export default BuildPosPaymentReceiptHtml;
