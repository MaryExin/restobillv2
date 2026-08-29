import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function BuildQrItemsHtml({ items, table, transactionId }) {
  const safeItems = Array.isArray(items) ? items : [];

  const slips = safeItems.map((item, index) => {
    const name = String(item?.name || item?.originalName || item?.code || "ITEM")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    const code = String(item?.code || "").trim();
    const copyLabel =
      Number(item?.qrCopyPerItem) > 1
        ? `ITEM ${item?.qrItemNumber || index + 1} COPY ${item?.qrCopyNumber || 1}/${item?.qrCopyPerItem}`
        : `ITEM ${item?.qrItemNumber || index + 1}`;
    const isLast = index === safeItems.length - 1;

    return (
      <div
        className="qr-slip"
        key={index}
        style={isLast ? {} : { pageBreakAfter: "always" }}
      >
        <div className="qr-name">{name}</div>
        {code ? <div>{code}</div> : null}
        {table ? <div>TABLE: {table}</div> : null}
        {transactionId ? <div>TX: {transactionId}</div> : null}
        <div>{copyLabel}</div>
        <div className="qr-price">P{peso(item?.price)}</div>
        <div className="qr-code">
          <QRCodeSVG value={String(item?.qrValue || "")} size={140} includeMargin />
        </div>
        <div className="qr-divider" />
      </div>
    );
  });

  const receipt = (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>QR Items</title>
        <style>{`
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif;
          }
          .qr-slip {
            width: 76.5mm;
            padding: 10px 5px;
            text-align: center;
          }
          .qr-name { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
          .qr-price { margin: 4px 0; }
          .qr-code { display: flex; justify-content: center; margin: 8px 0; }
          .qr-divider {
            border-top: 1px dashed #000;
            margin-top: 8px;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        `}</style>
      </head>
      <body>{slips}</body>
    </html>
  );

  return "<!DOCTYPE html>" + renderToStaticMarkup(receipt);
}
