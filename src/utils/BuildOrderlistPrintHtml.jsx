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
  isReprint,
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
          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: monospace;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 80mm;
          }

          .print-root {
            width: 80mm;
            min-height: 100vh;
            background: #ffffff;
            color: #000000;
            padding: 16px;
            font-size: 12px;
          }

          .text-center {
            text-align: center;
          }

          .mb-4 {
            margin-bottom: 16px;
          }

          .mt-8 {
            margin-top: 32px;
          }

          .mt-3 {
            margin-top: 12px;
          }

          .mb-2 {
            margin-bottom: 8px;
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

          .py-1 {
            padding-top: 4px;
            padding-bottom: 4px;
          }

          .py-2 {
            padding-top: 8px;
            padding-bottom: 8px;
          }

          .pt-2 {
            padding-top: 8px;
          }

          .my-2 {
            margin-top: 8px;
            margin-bottom: 8px;
          }

          .italic {
            font-style: italic;
          }

          .font-bold {
            font-weight: 700;
          }

          .font-black {
            font-weight: 900;
          }

          .uppercase {
            text-transform: uppercase;
          }

          .underline {
            text-decoration: underline;
          }

          .text-xl {
            font-size: 20px;
          }

          .text-lg {
            font-size: 18px;
          }

          .text-sm {
            font-size: 14px;
          }

          .text-10 {
            font-size: 10px;
          }

          .text-9 {
            font-size: 9px;
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

          .right {
            text-align: right;
          }

          .center {
            text-align: center;
          }

          .left {
            text-align: left;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            vertical-align: top;
          }

          .item-col {
            width: 52%;
            word-break: break-word;
            overflow-wrap: break-word;
          }

          .qty-col {
            width: 16%;
            text-align: center;
            white-space: nowrap;
          }

          .amt-col {
            width: 32%;
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
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold uppercase underline">
              Order Summary
            </h2>
            <p className="font-bold text-lg">Table: {tableselected}</p>
            <p>{new Date().toLocaleString()}</p>
            <div className="border-b border-dashed border-black my-2" />
          </div>

          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-black text-10">
                <th className="left py-1 item-col">Item</th>
                <th className="qty-col py-1">Qty</th>
                <th className="amt-col py-1">Price</th>
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
                  <tr key={item.code || index}>
                    <td className="py-2 leading-tight item-col">
                      <div className="font-bold uppercase">{item.name}</div>

                      {item.itemInstruction ? (
                        <div className="text-9 italic mt-1">
                          Note: {item.itemInstruction}
                        </div>
                      ) : null}

                      <div className="text-9">{item.code}</div>
                    </td>

                    <td className="qty-col py-2">{item.quantity}</td>

                    <td className="amt-col py-2">
                      ₱{peso(Number(item.price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="border-t-2 border-black pt-2 mb-4">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 900,
                fontSize: "14px",
              }}
            >
              <span>GRAND TOTAL</span>
              <span>₱{peso(Number(totalPrice || 0))}</span>
            </div>
          </div>

          {instructions ? (
            <div className="border-t border-dashed border-black pt-2 mt-2">
              <p className="font-bold uppercase text-10 mb-2">Instructions</p>
              <p
                style={{
                  fontSize: "11px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {instructions}
              </p>
            </div>
          ) : null}

          {isReprint ? (
            <div className="mt-3 mb-2 text-center font-bold">
              <div className="border-y border-dashed border-black py-1">
                <p
                  style={{
                    fontSize: "25px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Duplicate Copy
                </p>
              </div>
            </div>
          ) : transactionId ? (
            <div className="mt-3 mb-2 text-center font-bold">
              <div className="border-y border-dashed border-black py-1">
                <p
                  style={{
                    fontSize: "30px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Additional Order
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 mb-2 text-center font-bold">
              <div className="border-y border-dashed border-black py-1">
                <p
                  style={{
                    fontSize: "30px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  New Order
                </p>
              </div>
            </div>
          )}

          <div className="text-center mt-8 text-9 italic opacity-70">
            <p>Thank you for your order!</p>
            <p>Please present this to the counter.</p>
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
          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 80mm;
          }

          .print-host {
            width: 80mm;
            background: #ffffff !important;
            color: #000000 !important;
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
