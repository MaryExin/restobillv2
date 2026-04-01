import React, { forwardRef } from "react";

const Receipt = forwardRef(({ transaction, detailedproduct }, ref) => {
  // 1️⃣ Compute total sales from items
  const computedTotalSales = detailedproduct.reduce((total, item) => {
    const price = parseFloat(item.selling_price) || 0;
    const quantity = parseFloat(item.sales_quantity) || 0;
    return total + price * quantity;
  }, 0);

  // 2️⃣ Get discount safely
  const discount = Number(transaction?.Discount || 0);

  // 3️⃣ Compute amount due
  const amountDue = computedTotalSales - discount;

  const receiptData = {
    company: {
      name: "STA MARIA",
      subname: "CNC",
      address: "Address",
      vatTin: "123-456-789-00000",
      min: "24022114560011504",
      sn: "22401040301510",
    },
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
    items: detailedproduct.map((item) => {
      const price = parseFloat(item.selling_price) || 0;
      const quantity = parseFloat(item.sales_quantity) || 0;
      const lineTotal = price * quantity;

      return {
        name: item.item_name,
        qty: `${item.sales_quantity} ${item.unit_of_measure}`,
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
      className="w-[240px] font-mono text-[12px] leading-tight p-4"
    >
      <div className="leading-tight text-center">
        <h2 className="font-bold text-[14px]">CRABS N CRACK SEAFOOD HOUSE</h2>
        <h3 className="font-bold text-[14px]">
          AND SHAKING CRABS - GUIGUINTO
        </h3>
        <p className="font-semibold">ARU FOOD CORP.</p>
        <p>PLARIDEL BYPASS ROAD TIAONG GUIGUINTO</p>
        <p>BULACAN</p>
        <p>VAT REG TIN: 634-742-586-00013</p>
        <p>MIN: 26032413224205435</p>
        <p>S/N: 2510AI5508128156WL24026</p>
      </div>

      <hr className="my-1 border-dashed" />

      <div className="py-2 text-center">
        <h1>BILLING</h1>
      </div>

      {/* Billing */}
      {Object.entries(receiptData.billing).map(([key, value]) => (
        <div className="flex justify-between my-[1px]" key={key}>
          <span className="font-semibold">{formatLabel(key)}:</span>
          <span>{value}</span>
        </div>
      ))}

      <hr className="my-1 border-dashed" />

      {/* Items */}
      <table className="w-full mb-1">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th>Qty</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {receiptData.items.map((item, index) => (
            <tr key={index}>
              <td className="text-left">{item.name}</td>
              <td className="text-center">{item.qty}</td>
              <td className="text-right">{Number(item.amt).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-1 border-dashed" />

      {/* Totals */}
      {Object.entries(receiptData.totals).map(([key, value]) => (
        <div
          className={`flex justify-between my-[1px] ${
            key === "amountDue" ? "font-bold text-lg" : ""
          }`}
          key={key}
        >
          <span className="font-semibold">{formatLabel(key)}:</span>
          <span>{value}</span>
        </div>
      ))}

      <hr className="my-1 border-dashed" />

      <p>Customer Name: {receiptData.customer.name}</p>
      <p>Customer ID: {receiptData.customer.id}</p>
      <p>TIN: {receiptData.customer.tin}</p>
      <p>Address: {receiptData.customer.address}</p>
      <p>Customer Signature: _______________________________</p>
    </div>
  );
});

export default Receipt;
