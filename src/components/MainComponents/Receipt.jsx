import React, { forwardRef } from "react";

const rowStyle = { display: "flex", justifyContent: "space-between", margin: "1px 0" };
const labelStyle = { fontWeight: 600 };
const hrStyle = { margin: "4px 0", border: "none", borderTop: "1px dashed #000" };

const Receipt = forwardRef(({ transaction, detailedproduct, businessInfo = {} }, ref) => {
  const items = Array.isArray(detailedproduct) ? detailedproduct : [];

  const computedTotalSales = items.reduce((total, item) => {
    const price = parseFloat(item?.selling_price) || 0;
    const quantity = parseFloat(item?.sales_quantity) || 0;
    return total + price * quantity;
  }, 0);

  const discount = Number(transaction?.Discount || 0);
  const amountDue = computedTotalSales - discount;

  const addressLines = String(businessInfo?.address || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

  const receiptData = {
    billing: {
      transNo: transaction?.transaction_id || "N/A",
      billingNo: transaction?.billing_no || "N/A",
      transDate: transaction?.transaction_date || "N/A",
      transTime: transaction?.transaction_time || "N/A",
      terminalNo: transaction?.terminal_number || "N/A",
      orderType: transaction?.order_type || "N/A",
      refTag: transaction?.table_number || "N/A",
      cashier: transaction?.cashier || "N/A",
    },
    items: items.map((item) => {
      const price = parseFloat(item?.selling_price) || 0;
      const quantity = parseFloat(item?.sales_quantity) || 0;
      const lineTotal = price * quantity;

      return {
        name: item?.item_name,
        qty: `${item?.sales_quantity} ${item?.unit_of_measure || ""}`.trim(),
        amt: lineTotal,
      };
    }),
    totals: {
      totalSales: computedTotalSales.toFixed(2),
      discount: discount.toFixed(2),
      amountDue: amountDue.toFixed(2),
    },
    customer: {
      name: "",
      id: "",
      tin: "",
      address: "",
      signature: "",
    },
  };

  const formatLabel = (key) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

  return (
    <div
      ref={ref}
      style={{
        width: "240px",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: 1.2,
        padding: "16px",
      }}
    >
      <div style={{ lineHeight: 1.2, textAlign: "center" }}>
        {businessInfo?.companyName ? (
          <h2 style={{ fontWeight: 700, fontSize: "14px", margin: 0 }}>
            {businessInfo.companyName}
          </h2>
        ) : null}
        {businessInfo?.storeName ? (
          <h3 style={{ fontWeight: 700, fontSize: "14px", margin: 0 }}>
            {businessInfo.storeName}
          </h3>
        ) : null}
        {businessInfo?.corpName ? (
          <p style={{ fontWeight: 600, margin: 0 }}>{businessInfo.corpName}</p>
        ) : null}
        {addressLines.map((line, index) => (
          <p style={{ margin: 0 }} key={index}>
            {line}
          </p>
        ))}
        {businessInfo?.tin ? (
          <p style={{ margin: 0 }}>VAT REG TIN: {businessInfo.tin}</p>
        ) : null}
        {businessInfo?.machineNumber ? (
          <p style={{ margin: 0 }}>MIN: {businessInfo.machineNumber}</p>
        ) : null}
        {businessInfo?.serialNumber ? (
          <p style={{ margin: 0 }}>S/N: {businessInfo.serialNumber}</p>
        ) : null}
      </div>

      <hr style={hrStyle} />

      <div style={{ padding: "8px 0", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "14px" }}>BILLING</h1>
      </div>

      {Object.entries(receiptData.billing).map(([key, value]) => (
        <div style={rowStyle} key={key}>
          <span style={labelStyle}>{formatLabel(key)}:</span>
          <span>{value}</span>
        </div>
      ))}

      <hr style={hrStyle} />

      <table style={{ width: "100%", marginBottom: "4px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Item</th>
            <th>Qty</th>
            <th style={{ textAlign: "right" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {receiptData.items.map((item, index) => (
            <tr key={index}>
              <td style={{ textAlign: "left" }}>{item.name}</td>
              <td style={{ textAlign: "center" }}>{item.qty}</td>
              <td style={{ textAlign: "right" }}>{Number(item.amt).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={hrStyle} />

      {Object.entries(receiptData.totals).map(([key, value]) => (
        <div
          style={{
            ...rowStyle,
            ...(key === "amountDue" ? { fontWeight: 700, fontSize: "16px" } : {}),
          }}
          key={key}
        >
          <span style={labelStyle}>{formatLabel(key)}:</span>
          <span>{value}</span>
        </div>
      ))}

      <hr style={hrStyle} />

      <p style={{ margin: 0 }}>Customer Name: {receiptData.customer.name}</p>
      <p style={{ margin: 0 }}>Customer ID: {receiptData.customer.id}</p>
      <p style={{ margin: 0 }}>TIN: {receiptData.customer.tin}</p>
      <p style={{ margin: 0 }}>Address: {receiptData.customer.address}</p>
      <p style={{ margin: 0 }}>Customer Signature: _______________________________</p>
    </div>
  );
});

Receipt.displayName = "Receipt";

export default Receipt;
