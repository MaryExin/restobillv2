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
        }

          .divider {
            border-top: 1px solid #000;
            margin: calc(8px * var(--s)) 0 calc(7px * var(--s));
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

          .mt-12 {
            margin-top: calc(12px * var(--s));
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

      .label-col {
          width: 32%;
          white-space: nowrap;
          padding-right: 0;
        }

        .value-col {
          width: 68%;
          text-align: right;
          white-space: nowrap;
          overflow: visible;
          padding-right: calc(14px * var(--s));
          padding-left: 0;
        }

        .amount-due {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: calc(4px * var(--s));
          font-weight: 900;
          font-size: calc(14px * var(--s));
        }

        .amount-due-label {
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .amount-due-value {
          white-space: nowrap;
          text-align: right;
          padding-right: calc(14px * var(--s));
          flex: 1 1 auto;
        }

      .item-col {
        width: 44%;
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
        padding-right: calc(12px * var(--s));
        padding-left: 0;
      }
                  

     .item-row td {
        padding-bottom: calc(1px * var(--s));
      }

          .nowrap {
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
            <div className="mt-2 bold text-12">
              AND SHAKING CRABS - GUIGUINTO
            </div>
            <div className="bold text-12">ARU FOOD CORP.</div>
          </div>

          <div className="divider" />

          <div className="mb-8 center black big">BILLING</div>

          <table>
            <tbody>
              <tr>
                <td className="bold label-col">Trans. No.:</td>
                <td className="value-col">
                  {transaction?.transaction_id || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Billing No.:</td>
                <td className="value-col">
                  {transaction?.billing_no || transaction?.billingNo || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Invoice No.:</td>
                <td className="value-col">
                  {transaction?.invoice_no || transaction?.invoiceNo || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Date:</td>
                <td className="value-col">
                  {transaction?.transaction_date || dateFrom || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Trans. Time:</td>
                <td className="value-col">
                  {transaction?.transaction_time || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Terminal No.:</td>
                <td className="value-col">
                  {transaction?.terminal_number || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Order Type:</td>
                <td className="value-col">{transaction?.order_type || "-"}</td>
              </tr>
              <tr>
                <td className="bold label-col">Ref./Tag #:</td>
                <td className="value-col">
                  {transaction?.table_number || "-"}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Cashier:</td>
                <td className="value-col">{transaction?.cashier || "-"}</td>
              </tr>
            </tbody>
          </table>

          <div className="divider" />

          <table>
            <thead>
              <tr>
                <th className="pb-4 left item-col">Item</th>
                <th className="pb-4 qty-col">Qty</th>
                <th className="pb-4 amt-col">Amt</th>
              </tr>
            </thead>
            <tbody>
              {safeItems.map((item, index) => {
                const qty = Number(item.sales_quantity || 0);
                const price = Number(item.selling_price || 0);
                const lineTotal = qty * price;

                const isDiscountable =
                  String(item.isDiscountable || "")
                    .trim()
                    .toLowerCase() === "yes";

                const itemLabel = String(
                  item.item_name || item.product_id || "-",
                ).toUpperCase();

                return (
                  <tr key={item.ID || index} className="item-row">
                    <td className="item-col">
                      • {itemLabel}
                      {isDiscountable ? " (D)" : ""}
                    </td>
                    <td className="qty-col nowrap">
                      {qty} {item.unit_of_measure || ""}
                    </td>
                    <td className="amt-col nowrap">{peso(lineTotal)}</td>
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
                <td className="value-col">{peso(computed?.grossTotal)}</td>
              </tr>

              {activeBreakdown.map((entry) =>
                Number(entry?.discountAmount || 0) > 0 ? (
                  <tr key={`disc-${entry.key}`}>
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
            </tbody>
          </table>

          <div className="divider" />

          <div className="mb-8 amount-due">
            <span className="amount-due-label">AMOUNT DUE:</span>
            <span className="amount-due-value">
              {peso(computed?.netAfterDiscount)}
            </span>
          </div>

          <div className="divider" />

          <table>
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
                <td className="value-col">
                  {peso(computed?.totalVatExemption)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">ZERO RATED SALES:</td>
                <td className="value-col">
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
                <td className="value-col">
                  {computed?.safeCustomerCount ?? 0}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Total Qualified:</td>
                <td className="value-col">{totalQualifiedAll}</td>
              </tr>
              <tr>
                <td className="bold label-col">Statutory Qualified:</td>
                <td className="value-col">{statutoryQualifiedCount}</td>
              </tr>

              {activeBreakdown.map((entry) => (
                <React.Fragment key={`print-breakdown-${entry.key}`}>
                  <tr>
                    <td className="bold label-col">{entry.label} Count:</td>
                    <td className="value-col">{entry.qualifiedCount}</td>
                  </tr>
                  <tr>
                    <td className="bold label-col">{entry.label} Amount:</td>
                    <td className="value-col">{peso(entry.discountAmount)}</td>
                  </tr>
                </React.Fragment>
              ))}

              <tr>
                <td className="bold label-col">Discountable Gross:</td>
                <td className="value-col">
                  {peso(computed?.discountableGross)}
                </td>
              </tr>
              <tr>
                <td className="bold label-col">Discountable Base:</td>
                <td className="value-col">
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
