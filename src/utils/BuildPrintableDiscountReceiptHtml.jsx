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
  businessInfo = {},
}) {
  const safeTransaction = transaction || {};
  const safeComputed = computed || {};
  const safeItems = Array.isArray(items) ? items : [];

  const companyName = String(businessInfo?.companyName || "COMPANY").trim();
  const storeName = String(businessInfo?.storeName || "STORE").trim();
  const corpName = String(businessInfo?.corpName || "CORPORATION").trim();

  const activeBreakdown = Array.isArray(safeComputed?.discountBreakdown)
    ? safeComputed.discountBreakdown.filter(
        (entry) =>
          Number(entry?.qualifiedCount || 0) > 0 ||
          Number(entry?.discountAmount || 0) > 0,
      )
    : [];

  const totalQualifiedAll = Number(safeComputed?.totalQualifiedAll || 0);
  const statutoryQualifiedCount = Number(
    safeComputed?.statutoryQualifiedCount || 0,
  );

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

          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            min-width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible;
          }

          body {
            overflow: visible;
          }

          .print-root {
            width: 76.5mm;
            margin: 0;
            padding: calc(8px * var(--s)) calc(16px * var(--s)) calc(20px * var(--s)) calc(1px * var(--s));
            background: #ffffff;
            color: #000000;
            font-size: calc(10.5px * var(--s));
            line-height: 1.18;
            overflow: visible;
          }

          .section {
            display: block;
            width: 100%;
          }

          .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
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

          thead {
            display: table-header-group;
          }

          tbody {
            display: table-row-group;
          }

          td,
          th {
            padding: 0;
            vertical-align: top;
            line-height: 1.1;
            page-break-inside: auto;
            break-inside: auto;
          }

          .center {
            text-align: center;
          }

          .left {
            text-align: left;
          }

          .right {
            text-align: right;
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
            width: 34%;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            padding-right: calc(4px * var(--s));
          }

          .value-col {
            width: 66%;
            text-align: right;
            white-space: nowrap;
            overflow: visible;
            padding-right: calc(16px * var(--s));
            padding-left: 0;
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
            width: 10%;
            text-align: center;
            white-space: nowrap;
            padding-right: 0;
            padding-left: 0;
          }

          .amt-col {
            width: 46%;
            text-align: right;
            white-space: nowrap;
            padding-right: calc(16px * var(--s));
            padding-left: 0;
          }

          .item-table th {
            padding-bottom: calc(4px * var(--s));
          }

          .item-row td {
            padding-bottom: calc(1px * var(--s));
          }

          .nowrap {
            white-space: nowrap;
          }

          .amount-due-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-weight: 900;
            font-size: calc(14px * var(--s));
          }

          .amount-due-label-cell {
            text-align: left;
            white-space: nowrap;
          }

          .amount-due-value-cell {
            text-align: right;
            white-space: nowrap;
            padding-right: calc(16px * var(--s));
          }
        `}</style>
      </head>
      <body>
        <div className="print-root">
          <div className="section keep-together">
            <div className="center">
              <div className="black bigger">{companyName}</div>
              <div className="mt-2 bold text-12">{storeName}</div>
              <div className="bold text-12">{corpName}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="section keep-together">
            <div className="mb-8 center black big">BILLING</div>
          </div>

          <div className="section">
            <table>
              <tbody>
                <tr>
                  <td className="bold label-col">Trans. No.:</td>
                  <td className="value-col">
                    {safeTransaction?.transaction_id || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Billing No.:</td>
                  <td className="value-col">
                    {safeTransaction?.billing_no ||
                      safeTransaction?.billingNo ||
                      "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Invoice No.:</td>
                  <td className="value-col">
                    {safeTransaction?.invoice_no ||
                      safeTransaction?.invoiceNo ||
                      "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Trans. Date:</td>
                  <td className="value-col">
                    {safeTransaction?.transaction_date || dateFrom || "-"}
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
                    {safeTransaction?.terminal_number || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Order Type:</td>
                  <td className="value-col">
                    {safeTransaction?.order_type || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Ref./Tag #:</td>
                  <td className="value-col">
                    {safeTransaction?.table_number || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Cashier:</td>
                  <td className="value-col">
                    {safeTransaction?.cashier || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section">
            <table className="item-table">
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
          </div>

          <div className="divider" />

          <div className="section">
            <table>
              <tbody>
                <tr>
                  <td className="bold label-col">TOTAL SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.grossTotal)}
                  </td>
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

                {Number(safeComputed?.totalVatExemption || 0) > 0 ? (
                  <tr>
                    <td className="bold label-col">VAT EXEMPTION:</td>
                    <td className="value-col">
                      {signedNegativePeso(safeComputed?.totalVatExemption)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section keep-together mb-8">
            <table className="amount-due-table">
              <tbody>
                <tr>
                  <td className="amount-due-label-cell">AMOUNT DUE:</td>
                  <td className="amount-due-value-cell">
                    {peso(safeComputed?.netAfterDiscount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section">
            <table>
              <tbody>
                <tr>
                  <td className="bold label-col">VATABLE SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatableSales)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT AMOUNT:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatableSalesVat)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT EXEMPT SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatExemptSales)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">VAT EXEMPTION:</td>
                  <td className="value-col">
                    {peso(safeComputed?.totalVatExemption)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">ZERO RATED SALES:</td>
                  <td className="value-col">
                    {peso(safeComputed?.vatZeroRatedSales)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider" />

          <div className="section">
            <table>
              <tbody>
                <tr>
                  <td className="bold label-col">Total Customers:</td>
                  <td className="value-col">
                    {safeComputed?.safeCustomerCount ?? 0}
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
                      <td className="value-col">
                        {peso(entry.discountAmount)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                <tr>
                  <td className="bold label-col">Discountable Gross:</td>
                  <td className="value-col">
                    {peso(safeComputed?.discountableGross)}
                  </td>
                </tr>
                <tr>
                  <td className="bold label-col">Discountable Base:</td>
                  <td className="value-col">
                    {peso(safeComputed?.discountableBase)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="section keep-together mt-12 text-10">
            <div className="bold">Customer Signature:</div>
            <div className="signature-line" />
          </div>

          <div className="divider" />

          <div className="section keep-together center text-10">
            <div className="bold">Thank you</div>
            <div className="bold">Please come again.</div>
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}
