// utils/buildOrderlistPrintHtml.js
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Receipt from "../components/MainComponents/Receipt";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function BuildOrderReceiptHtml({
  productcart,
  totalPrice,
  tableselected,
  instructions,
  transactionId,
  printMode = "auto",
}) {
  let cartItems = [];

  if (productcart && productcart.items) {
    cartItems = productcart.items;
  } else if (Array.isArray(productcart)) {
    if (typeof productcart[0] === "string") {
      cartItems = productcart[1] || [];
    } else {
      cartItems = productcart;
    }
  }

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>Order Summary</title>
        <style>{`
          :root {
            --s: 0.85;
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

          th,
          td {
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

          .text-9 {
            font-size: calc(9px * var(--s));
          }

          .text-8 {
            font-size: calc(8px * var(--s));
          }

          .mt-1 {
            margin-top: calc(1px * var(--s));
          }

          .mt-2 {
            margin-top: calc(2px * var(--s));
          }

          .mt-3 {
            margin-top: calc(12px * var(--s));
          }

          .mt-8 {
            margin-top: calc(32px * var(--s));
          }

          .mb-2 {
            margin-bottom: calc(8px * var(--s));
          }

          .mb-4 {
            margin-bottom: calc(16px * var(--s));
          }

          .mb-8 {
            margin-bottom: calc(8px * var(--s));
          }

          .pb-4 {
            padding-bottom: calc(4px * var(--s));
          }

          .pt-2 {
            padding-top: calc(8px * var(--s));
          }

          .py-1 {
            padding-top: calc(4px * var(--s));
            padding-bottom: calc(4px * var(--s));
          }

          .py-2 {
            padding-top: calc(8px * var(--s));
            padding-bottom: calc(8px * var(--s));
          }

          .my-2 {
            margin-top: calc(8px * var(--s));
            margin-bottom: calc(8px * var(--s));
          }

          .italic {
            font-style: italic;
          }

          .uppercase {
            text-transform: uppercase;
          }

          .underline {
            text-decoration: underline;
          }

          .opacity-70 {
            opacity: 0.7;
          }

          .leading-tight {
            line-height: 1.25;
          }

          .w-full {
            width: 100%;
          }

          .nowrap {
            white-space: nowrap;
          }

          .border-dashed {
            border-style: dashed;
          }

          .border-black {
            border-color: #000000;
          }

          .border-b {
            border-bottom: 1px solid #000000;
          }

          .border-t {
            border-top: 1px solid #000000;
          }

          .border-y {
            border-top: 1px solid #000000;
            border-bottom: 1px solid #000000;
          }

          .border-t-2 {
            border-top: 2px solid #000000;
          }

          .meta-label-col {
            width: 32%;
            white-space: nowrap;
            padding-right: 0;
          }

          .meta-value-col {
            width: 68%;
            text-align: right;
            white-space: nowrap;
            overflow: visible;
            padding-right: calc(14px * var(--s));
            padding-left: 0;
          }

          .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: calc(4px * var(--s));
            font-weight: 900;
            font-size: calc(14px * var(--s));
          }

          .amount-row-label {
            white-space: nowrap;
            flex: 0 0 auto;
          }

          .amount-row-value {
            white-space: nowrap;
            text-align: right;
            padding-right: calc(16px * var(--s));
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
            padding-right: calc(16px * var(--s));
            padding-left: 0;
          }

          .item-row td {
            padding-bottom: calc(1px * var(--s));
          }

          .section-note {
            font-size: calc(11px * var(--s));
            white-space: pre-wrap;
            word-break: break-word;
          }

          .status-banner {
            font-size: calc(26px * var(--s));
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            line-height: 1.05;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }
        `}</style>
      </head>
      <body>
        <div className="print-root">
          <div className="center mb-4">
            <div className="black bigger uppercase underline">
              Order Summary
            </div>
            <div className="bold big mt-2">Table: {tableselected}</div>
            <div className="text-10 mt-1">{new Date().toLocaleString()}</div>
          </div>

          <div className="divider" />

          <table className="w-full mb-4">
            <thead>
              <tr>
                <th className="left item-col pb-4">Item</th>
                <th className="qty-col pb-4">Qty</th>
                <th className="amt-col pb-4">Price</th>
              </tr>
            </thead>

            <tbody>
              {cartItems.length === 0 ? (
                <tr>
                  <td colSpan="3" className="center py-2 italic">
                    Cart is empty
                  </td>
                </tr>
              ) : (
                cartItems.map((item, index) => (
                  <tr key={item.code || index} className="item-row">
                    <td className="py-2 leading-tight item-col">
                      <div className="bold uppercase">{item.name}</div>

                      {item.itemInstruction ? (
                        <div className="text-9 italic mt-1">
                          Note: {item.itemInstruction}
                        </div>
                      ) : null}

                      <div className="text-8 mt-1">{item.code}</div>
                    </td>

                    <td className="qty-col py-2 nowrap">{item.quantity}</td>

                    <td className="amt-col py-2 nowrap">
                      ₱{peso(Number(item.price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="divider" />

          <div className="amount-row mb-8">
            <span className="amount-row-label">GRAND TOTAL</span>
            <span className="amount-row-value">
              ₱{peso(Number(totalPrice || 0))}
            </span>
          </div>

          {instructions ? (
            <>
              <div className="divider" />
              <div className="pt-2 mt-2">
                <div className="bold uppercase text-10 mb-2">Instructions</div>
                <div className="section-note">{instructions}</div>
              </div>
            </>
          ) : null}

          {printMode === "duplicate" ? (
            <div className="mt-3 mb-2 center bold">
              <div className="py-1">
                <div className="status-banner">Duplicate Copy</div>
              </div>
            </div>
          ) : printMode === "additional" ? (
            <div className="mt-3 mb-2 center bold">
              <div className="py-1">
                <div className="status-banner">Additional Order</div>
              </div>
            </div>
          ) : printMode === "new" ? (
            <div className="mt-3 mb-2 center bold">
              <div className="py-1">
                <div className="status-banner">New Order</div>
              </div>
            </div>
          ) : transactionId ? (
            <div className="mt-3 mb-2 center bold">
              <div className="py-1">
                <div className="status-banner">Additional Order</div>
              </div>
            </div>
          ) : (
            <div className="mt-3 mb-2 center bold">
              <div className="py-1">
                <div className="status-banner">New Order</div>
              </div>
            </div>
          )}

          <div className="center mt-8 text-9 italic opacity-70">
            <div>Thank you for your order!</div>
            <div>Please present this to the counter.</div>
          </div>
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}

export function BuildBillingReceiptHtml({
  transaction,
  detailedproduct,
  title = "Billing Receipt",
}) {
  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>{title}</title>
        <style>{`
          :root {
            --s: 0.85;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            overflow: hidden;
          }

          .print-host {
            width: 76.5mm;
            padding: calc(8px * var(--s)) calc(5px * var(--s)) calc(8px * var(--s)) calc(2px * var(--s));
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }
        `}</style>
      </head>
      <body>
        <div className="print-host">
          <Receipt
            transaction={transaction}
            detailedproduct={detailedproduct}
          />
        </div>
      </body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}
