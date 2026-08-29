const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const buildSalesPerProductHtml = (data) => {
  const {
    title = "SALES REPORT",
    dateFrom = "",
    dateTo = "",
    printedAt = "",
    items = [],
    totals = {},
  } = data || {};

  const safeItems = Array.isArray(items) ? items : [];

  const itemRows = safeItems
    .map(
      (item) => `
      <tr>
        <td class="name">${String(item?.name || "-").toUpperCase()}</td>
        <td class="qty">${Number(item?.qty || 0)}</td>
        <td class="amt">${peso(item?.amount || 0)}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
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
          .title { font-weight: 900; font-size: 14px; }
          .dates { font-size: 11px; }
          .line { border-top: 1px solid #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
          th, td { padding: 1px 0; vertical-align: top; }
          th { text-align: left; border-bottom: 1px solid #000; }
          .name { text-align: left; word-break: break-word; }
          .qty { text-align: center; width: 18%; }
          .amt { text-align: right; width: 32%; }
          .meta-row { display: flex; justify-content: space-between; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <div class="title">${String(title || "SALES REPORT").toUpperCase()}</div>
            <div class="dates">${dateFrom || "-"} - ${dateTo || "-"}</div>
          </div>

          <div class="line"></div>

          <table>
            <thead>
              <tr>
                <th class="name">ITEM</th>
                <th class="qty">QTY</th>
                <th class="amt">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <div class="line"></div>

          <div class="meta-row"><span>TOTAL QTY:</span><span>${Number(totals?.qty || 0)}</span></div>
          <div class="meta-row"><span>GRAND TOTAL:</span><span>P${peso(totals?.amount || 0)}</span></div>

          <div class="line"></div>

          <div class="center">DATE: ${printedAt || "-"}</div>
        </div>
      </body>
    </html>
  `;
};
