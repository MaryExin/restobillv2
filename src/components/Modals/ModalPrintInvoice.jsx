import React, { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ComponentToPrint = React.forwardRef(({ text }, ref) => {
  return (
    <div
      ref={ref}
      className="w-full flex flex-col bg-white rounded-2xl shadow-lg p-6 space-y-6"
    >
      {text}
    </div>
  );
});

const ModalPrintInvoice = ({
  setIsModalPrint,
  invoiceData,
  branchSelected,
  isSalesid,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const Logo = localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGO;
  const [totalSales, setTotalSales] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);

  useEffect(() => {
    if (invoiceData?.salesdetails) {
      const sum = invoiceData.salesdetails.reduce(
        (acc, detail) => acc + detail.total_sales,
        0
      );
      setTotalSales(sum);
    }
  }, [invoiceData]);

  useEffect(() => {
    if (invoiceData?.discounts) {
      const sum = invoiceData.discounts.reduce(
        (acc, detail) => acc + detail.amount,
        0
      );
      setTotalDiscount(sum);
    }
  }, [invoiceData]);

  // Compute sums

  const payableAmount = totalSales - totalDiscount;

  const initialPaymentsSum =
    invoiceData?.initialpayments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const amountStillDue = payableAmount - initialPaymentsSum;

  const componentRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  return (
    <>
      {/* Hidden print layout */}
      <div className="hidden">
        <ComponentToPrint
          ref={componentRef}
          text={
            <>
              {/* Header */}
              <div className="flex flex-col items-end space-y-2 px-5">
                <img src={Logo} alt="Logo" className="h-20" />
                <h1 className="mt-4 text-2xl font-extrabold text-colorBrand">
                  Sales Invoice
                </h1>
              </div>

              {/* Invoice & Bill-To Details */}
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Invoice Info */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold ">Invoice No:</span>
                    <span className="text-colorBrand font-['Poppins-Black']">
                      {isSalesid}
                    </span>
                  </div>
                  {/* <div>
                    <span className="font-semibold">Address:</span>
                    <span className="ml-1">
                      {invoiceData?.branchdetails?.address || ""}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Email:</span>
                    <span className="ml-1">
                      {invoiceData?.branchdetails?.email || ""}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Contact No.:</span>
                    <span className="ml-1">
                      {invoiceData?.branchdetails?.contact_no || ""}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">TIN:</span>
                    <span className="ml-1">
                      {invoiceData?.branchdetails?.tin || ""}
                    </span>
                  </div> */}
                </div>

                {/* Bill To */}
                <div className="space-y-2">
                  <h2 className="font-bold text-colorBrand">Bill To:</h2>
                  {invoiceData?.customerdetails?.[0] && (
                    <>
                      <div className="flex space-x-1">
                        <span className="font-semibold">Customer Name:</span>
                        <span>
                          {invoiceData.customerdetails[0].customername}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <span className="font-semibold">Address:</span>
                        <span>{invoiceData.customerdetails[0].address}</span>
                      </div>
                      <div className="flex space-x-1">
                        <span className="font-semibold">Email:</span>
                        <span>{invoiceData.customerdetails[0].email}</span>
                      </div>
                      <div className="flex space-x-1">
                        <span className="font-semibold">Contact No.:</span>
                        <span>{invoiceData.customerdetails[0].contact_no}</span>
                      </div>
                      <div className="flex space-x-1">
                        <span className="font-semibold">TIN:</span>
                        <span>{invoiceData.customerdetails[0].tin}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Invoice Summary Table */}
              <div className="mt-8 overflow-hidden rounded-lg border-2 border-colorBrand">
                <table className="w-full table-auto">
                  <thead className="bg-colorBrand">
                    <tr>
                      <th
                        className="px-4 py-2 text-left text-lg font-semibold text-white"
                        colSpan={6}
                      >
                        Invoice Summary
                      </th>
                    </tr>
                    <tr className="bg-gray-100 text-colorBrand text-sm font-semibold">
                      <th className="px-4 py-2 text-left">Items</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-center">Tax Type</th>
                      <th className="px-4 py-2 text-center">Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoiceData?.salesdetails?.map((item, idx) => (
                      <tr key={idx} className="text-sm text-colorTextPrimary">
                        <td className="px-4 py-2">{item.productname}</td>
                        <td className="px-4 py-2 text-center">{item.qty}</td>
                        <td className="px-4 py-2 text-right">
                          {item.srp.toLocaleString("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          })}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.total_sales.toLocaleString("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          })}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {item.tax_type}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {item.discount_amount
                            ? item.discount_amount.toLocaleString("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              })
                            : "-"}
                        </td>
                      </tr>
                    ))}

                    {/* Discount Row */}
                    {invoiceData?.discounts?.length > 0 && (
                      <tr className="bg-gray-50 text-sm text-colorTextPrimary">
                        <td className="px-4 py-2 font-semibold" colSpan={6}>
                          Discounts:
                        </td>
                      </tr>
                    )}
                    {invoiceData?.discounts?.map((d, idx) => (
                      <tr
                        key={`disc-${idx}`}
                        className="text-sm text-colorTextPrimary"
                      >
                        <td className="px-4 py-2">{d.description}</td>
                        <td className="px-4 py-2 text-center">-</td>
                        <td className="px-4 py-2 text-right">
                          {d.amount.toLocaleString("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          })}
                        </td>
                        <td className="px-4 py-2 text-right">-</td>
                        <td className="px-4 py-2 text-center">-</td>
                        <td className="px-4 py-2 text-center">
                          {d.discount_ref_no}
                        </td>
                      </tr>
                    ))}

                    {/* Payable Amount Footer */}
                    <tr className="bg-gray-100 text-lg font-bold text-colorBrand">
                      <td className="px-4 py-2" colSpan={4}>
                        Payable Amount:
                      </td>
                      <td className="px-4 py-2 text-right">
                        {payableAmount.toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </td>
                      <td className="px-4 py-2 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Initial Payments Table */}
              {invoiceData?.initialpayments?.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-lg border-2 border-colorBrand">
                  <table className="w-full table-auto">
                    <thead className="bg-colorBrand">
                      <tr>
                        <th
                          className="px-4 py-2 text-center text-lg font-semibold text-white"
                          colSpan={3}
                        >
                          Initial Payments
                        </th>
                      </tr>
                      <tr className="bg-gray-100 text-colorBrand text-sm font-semibold">
                        <th className="px-4 py-2 text-center">MOP</th>
                        <th className="px-4 py-2 text-center">Amount</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm text-colorTextPrimary">
                      {invoiceData.initialpayments.map((p, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-center">
                            {p.description}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {p.amount.toLocaleString("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            })}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {p.payment_status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Amount Still Due */}
              <div className="mt-4 p-4 bg-colorBrandLighter border-2 border-colorBrand rounded-lg text-colorBrand font-bold text-lg text-center">
                Amount Still Due:
                <span className="ml-2">
                  {amountStillDue.toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  })}
                </span>
              </div>
            </>
          }
        />
      </div>

      {/* Modal Overlay */}
      <div
        onClick={() => {
          setIsModalPrint(false);
        }}
        className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center "
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-h-[90vh] mt-[10vh] max-w-4xl mx-4 lg:mx-0   bg-white rounded-2xl shadow-2xl overflow-y-auto"
        >
          {/* Modal Header */}
          <div className="bg-gradient-to-br from-colorBrand to-colorBrandTertiary text-white rounded-t-2xl p-6 flex justify-center">
            <h2 className="text-2xl lg:text-3xl font-bold">Sales Invoice</h2>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6">
            {/* Invoice & Bill-To Details */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              {/* <div className="space-y-2">
                <div>
                  <span className="font-semibold">Address:</span>
                </div>
                <div>
                  <span className="font-semibold">Email:</span>
                </div>
                <div>
                  <span className="font-semibold">Contact No.:</span>
                </div>
                <div>
                  <span className="font-semibold">TIN:</span>
                </div>
              </div> */}
              <div className="space-y-2">
                <div className="flex flex-row items-center space-x-2 justify-end w-full">
                  <span className="font-bold">Invoice No.:</span>
                  <span className="text-colorBrand font-['Poppins-Black']">
                    {isSalesid}
                  </span>
                </div>
                <h3 className="text-md font-bold text-colorBrand">Bill To:</h3>
                {invoiceData?.customerdetails?.[0] && (
                  <>
                    <div className="flex space-x-1">
                      <span className="text-colorBrand">Customer Name:</span>
                      <span className="">
                        {invoiceData.customerdetails[0].customername}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <span className="text-colorBrand ">Address:</span>
                      <span className="">
                        {invoiceData.customerdetails[0].address}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <span className="text-colorBrand ">Email:</span>
                      <span className="">
                        {invoiceData.customerdetails[0].email}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <span className="text-colorBrand ">Contact No.:</span>
                      <span className="">
                        {invoiceData.customerdetails[0].contact_no}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <span className="text-colorBrand ">TIN:</span>
                      <span className="">
                        {invoiceData.customerdetails[0].tin}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Invoice Summary */}
            <div className="border-2 border-colorBrand rounded-lg overflow-hidden">
              <div className="bg-colorBrand text-white px-4 py-2">
                <h3 className="text-lg font-semibold text-center">
                  Invoice Summary
                </h3>
              </div>

              {/* Table Header */}
              <div className="hidden lg:grid grid-cols-6 bg-gray-100 text-colorBrand text-sm font-semibold px-4 py-2">
                <div className="col-span-2 text-center">Items</div>
                <div className="text-center">Qty</div>
                <div className="text-center">Price</div>
                <div className="text-center">Total</div>
                <div className="text-center">Tax Type</div>
              </div>

              {/* Table Rows */}
              {invoiceData?.salesdetails?.length > 0 && (
                <div className="divide-y divide-gray-200">
                  {invoiceData.salesdetails.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 lg:grid-cols-6 px-4 py-3 lg:text-sm text-xs"
                    >
                      <div className="lg:col-span-2 text-center">
                        {item.productname}
                      </div>
                      <div className="text-center">{item.qty}</div>
                      <div className="text-center">
                        {item.srp.toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </div>
                      <div className="text-center">
                        {item.total_sales.toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </div>
                      <div className="text-center">{item.tax_type}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discount Section */}
              {invoiceData?.discounts?.length > 0 && (
                <>
                  <div className="bg-gray-100 text-colorBrand text-sm font-semibold px-4 py-2 mt-4">
                    <h4 className="text-center">Discounts</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {invoiceData.discounts.map((d, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 lg:grid-cols-3 px-4 py-3 lg:text-sm text-xs"
                      >
                        <div className="text-center">{d.description}</div>
                        <div className="text-center">
                          {d.amount.toLocaleString("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          })}
                        </div>
                        <div className="text-center">{d.discount_ref_no}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Payable Amount */}
              <div className="flex justify-end items-center bg-gray-50 px-4 py-3 font-bold text-colorBrand text-lg">
                <span className="mr-2">Payable Amount:</span>
                <span>
                  {payableAmount.toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  })}
                </span>
              </div>
            </div>

            {/* Initial Payments */}
            {invoiceData?.initialpayments?.length > 0 && (
              <div className="border-2 border-colorBrand rounded-lg mt-6 space-y-2">
                <div className="bg-colorBrand text-white px-4 py-2">
                  <h4 className="text-center font-semibold">
                    Initial Payments
                  </h4>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 bg-gray-100 text-colorBrand text-sm font-semibold px-4 py-2">
                  <div className="text-center">MOP</div>
                  <div className="text-center">Amount</div>
                  <div className="text-center">Status</div>
                </div>
                <div className="divide-y divide-gray-200">
                  {invoiceData.initialpayments.map((p, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 lg:grid-cols-3 px-4 py-3 lg:text-sm text-xs"
                    >
                      <div className="text-center">{p.description}</div>
                      <div className="text-center">
                        {p.amount.toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })}
                      </div>
                      <div className="text-center">{p.payment_status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Still Due */}
            <div className="mt-4 p-4 bg-colorBrandLighter border-2 border-colorBrand rounded-lg text-colorBrand font-bold text-lg text-center">
              Amount Still Due:
              <span className="ml-2">
                {amountStillDue.toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP",
                })}
              </span>
            </div>
          </div>

          {/* Print Button */}
          <div className="flex justify-center py-4">
            <button
              className="bg-gradient-to-br from-colorBrand to-colorBrandTertiary text-white font-semibold px-6 py-2 rounded-lg shadow hover:scale-105 transition-transform"
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPrintInvoice;
