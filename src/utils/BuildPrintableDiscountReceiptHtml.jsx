import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedNegativePeso = (value) => `- ${peso(value)}`;

export function BuildPrintableDiscountReceiptHtml({
  transaction,
  dateFrom,
  computed,
  items,
  scale = 0.85,
}) {
  const activeBreakdown = Array.isArray(computed?.discountBreakdown)
    ? computed.discountBreakdown.filter(
        (entry) =>
          Number(entry?.qualifiedCount || 0) > 0 ||
          Number(entry?.discountAmount || 0) > 0,
      )
    : [];

  const totalQualifiedAll = Number(computed?.totalQualifiedAll || 0);
  const statutoryQualifiedCount = Number(
    computed?.statutoryQualifiedCount || 0,
  );

  const safeItems = Array.isArray(items) ? items : [];

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>Billing Receipt</title>
        <style>{`
          :root {
            --s: ${Number(scale) || 0.85};
          }

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
            padding: "14px 29px",
            font-size: calc(11px * var(--s));
            line-height: 1.2;
          }

          .divider {
            border-top: 1px solid #000;
            margin: calc(10px * var(--s)) 0 calc(8px * var(--s));
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: calc(10px * var(--s));
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

          .big {
            font-size: calc(14px * var(--s));
          }

          .bigger {
            font-size: calc(15px * var(--s));
          }

          .text-12 {
            font-size: calc(12px * var(--s));
          }

          .text-10 {
            font-size: calc(10px * var(--s));
          }

          .mt-2 {
            margin-top: calc(2px * var(--s));
          }

          .mt-3 {
            margin-top: calc(3px * var(--s));
          }

          .mt-12 {
            margin-top: calc(12px * var(--s));
          }

          .mb-4 {
            margin-bottom: calc(4px * var(--s));
          }

          .mb-8 {
            margin-bottom: calc(8px * var(--s));
          }

          .pb-4 {
            padding-bottom: calc(4px * var(--s));
          }

          .signature-line {
            border-bottom: 1px solid #000;
            height: calc(18px * var(--s));
            margin-top: calc(3px * var(--s));
          }

          .amount-due {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-weight: 900;
            font-size: calc(14px * var(--s));
          }

          .label-col {
            width: 40%;
            white-space: nowrap;
          }

          .value-col {
            width: 60%;
          }

          /* adjusted here */
          .item-col {
            width: 40%;
            word-break: break-word;
            overflow-wrap: break-word;
          }

          .qty-col {
            width: 20%;
            text-align: center;
            white-space: nowrap;
          }

          .amt-col {
            width: 40%;
            text-align: right;
            white-space: nowrap;
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
            <div className="black bigger">CRABS N CRACK SEAFOOD HOUSE</div>
            <div className="bold text-12 mt-2">
              AND SHAKING CRABS - STA. MARIA
            </div>
            <div className="bold text-12">ARU FOOD CORP.</div>
          </div>

          <div className="divider" />

          <div className="center black big mb-8">BILLING</div>

          <table>
            <tbody>
              <tr>
                <td className="bold label-col">Trans. No.:</td>
                <td className="right value-col">
                  {transaction?.transaction_id || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Billing No.:</td>
                <td className="right value-col">
                  {transaction?.billing_no || transaction?.billingNo || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Invoice No.:</td>
                <td className="right value-col">
                  {transaction?.invoice_no || transaction?.invoiceNo || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Date:</td>
                <td className="right value-col">
                  {transaction?.transaction_date || dateFrom || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Time:</td>
                <td className="right value-col">
                  {transaction?.transaction_time || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Terminal No.:</td>
                <td className="right value-col">
                  {transaction?.terminal_number || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Order Type:</td>
                <td className="right value-col">
                  {transaction?.order_type || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Ref./Tag #:</td>
                <td className="right value-col">
                  {transaction?.table_number || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Cashier:</td>
                <td className="right value-col">
                  {transaction?.cashier || "-"}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="divider" />

          <table>
            <thead>
              <tr>
                <th className="left item-col pb-4">Item</th>
                <th className="qty-col pb-4">Qty</th>
                <th className="amt-col pb-4">Amt</th>
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

          <table>
            <tbody>
              <tr>
                <td className="bold label-col">TOTAL SALES:</td>
                <td className="right value-col">
                  {peso(computed?.grossTotal)}
                </td>
              </tr>

              {activeBreakdown.map((entry) =>
                Number(entry?.discountAmount || 0) > 0 ? (
                  <tr key={`disc-${entry.key}`}>
                    <td className="bold label-col">
                      {String(entry?.label || "DISCOUNT").toUpperCase()}:
                    </td>
                    <td className="right value-col">
                      {signedNegativePeso(entry?.discountAmount)}
                    </td>
                  </tr>
                ) : null,
              )}

              {Number(computed?.totalVatExemption || 0) > 0 ? (
                <tr>
                  <td className="bold label-col">VAT EXEMPTION:</td>
                  <td className="right value-col">
                    {signedNegativePeso(computed?.totalVatExemption)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="divider" />

          <div className="amount-due mb-8">
            <span>AMOUNT DUE:</span>
            <span>{peso(computed?.netAfterDiscount)}</span>
          </div>

          <div className="divider" />

          <table>
            <tbody>
              <tr>
                <td className="bold label-col">VATABLE SALES:</td>
                <td className="right value-col">
                  {peso(computed?.vatableSales)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">VAT AMOUNT:</td>
                <td className="right value-col">
                  {peso(computed?.vatableSalesVat)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">VAT EXEMPT SALES:</td>
                <td className="right value-col">
                  {peso(computed?.vatExemptSales)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">VAT EXEMPTION:</td>
                <td className="right value-col">
                  {peso(computed?.totalVatExemption)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">ZERO RATED SALES:</td>
                <td className="right value-col">
                  {peso(computed?.vatZeroRatedSales)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="divider" />

          <table>
            <tbody>
              <tr>
                <td className="bold label-col">Total Customers:</td>
                <td className="right value-col">
                  {computed?.safeCustomerCount ?? 0}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Total Qualified:</td>
                <td className="right value-col">{totalQualifiedAll}</td>
              </tr>
              <tr>
                <td className="bold label-col">Statutory Qualified:</td>
                <td className="right value-col">{statutoryQualifiedCount}</td>
              </tr>

              {activeBreakdown.map((entry) => (
                <React.Fragment key={`print-breakdown-${entry.key}`}>
                  <tr>
                    <td className="bold label-col">{entry.label} Count:</td>
                    <td className="right value-col">{entry.qualifiedCount}</td>
                  </tr>
                  <tr>
                    <td className="bold label-col">{entry.label} Amount:</td>
                    <td className="right value-col">
                      {peso(entry.discountAmount)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}

              <tr>
                <td className="bold label-col">Discountable Gross:</td>
                <td className="right value-col">
                  {peso(computed?.discountableGross)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Discountable Base:</td>
                <td className="right value-col">
                  {peso(computed?.discountableBase)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-12 text-10">
            <div className="bold">Customer Signature:</div>
            <div className="signature-line" />
          </div>

          <div className="divider" />

          <div className="center text-10">
            <div className="bold">Thank you</div>
            <div className="bold">Please come again.</div>
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}
