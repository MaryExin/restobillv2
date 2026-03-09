import React, { useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ComponentToPrint = React.forwardRef(({ text }, ref) => {
  return (
    <div ref={ref} className="flex flex-col px-1 w-full justify-center pt-2 ">
      <div className="w-full  px-5">{text}</div>
    </div>
  );
});
const ModalPayslip = ({
  setisModalPrint,
  EEPayslipSummaryData,
  dateFrom,
  dateTo,
  memberData,
  busunit,
}) => {
  useEffect(() => {
    if ((EEPayslipSummaryData, memberData)) {
      // console.log("Data:", EEPayslipSummaryData);
      // console.log("Data:", memberData);
    }
  }, [EEPayslipSummaryData, memberData]);
  // PRINTING HOOK
  const componentRef = useRef();
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  // useReactToPrint hook
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    // onAfterPrint: () => setIsModalYesNoSubmit(false),
  });

  function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: "long", day: "2-digit", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  }
  const formattedDateFrom = formatDate(dateFrom);
  const formattedDateTo = formatDate(dateTo);
  return (
    <>
      <div style={{ display: "none" }}>
        <ComponentToPrint
          ref={componentRef}
          text={
            <>
              <div className="flex flex-col space-y-2 w-full p-3">
                <div className="flex flex-col  border-2  rounded-lg ">
                  <div className="w-full flex flex-col  space-y-1 justify-center items-center bg-colorBrand text-white font-bold text-xl">
                    <h1>{busunit}</h1>
                    <h2>PAYSLIP</h2>
                  </div>
                  <div className="flex flex-col space-y-2 w-full">
                    <div className="flex flex-col   w-full">
                      <div className="w-full flex flex-row justify-center items-center text-center  font-bold text-lg">
                        <h1 className="w-1/2">RECIPIENT:</h1>
                        <h1 className="w-1/2">{`${memberData[0].firstname} ${memberData[0].middlename} ${memberData[0].lastname}`}</h1>
                      </div>
                    </div>
                    <div className="flex flex-row justify-center items-center text-center  font-bold text-lg">
                      <h1 className="w-full"> DATE:</h1>
                      <div className="flex flex-row w-full">
                        <div className="flex flex-row justify-center w-full">
                          <h1 className="w-full"> {formattedDateFrom} </h1>
                        </div>
                        <h1>-</h1>
                        <div className="flex flex-row justify-center w-full ">
                          <h1 className="w-full"> {formattedDateTo}</h1>
                        </div>
                      </div>
                    </div>
                    {/* <div className="w-1/2 flex justify-center">
                    <img src={logo} alt="" className="" />
                </div> */}
                  </div>
                  <div className="flex flex-col p-3  text-zinc-600">
                    <div className="mb-3 bg-gradient-to-br from-colorBrand to-colorBrandSecondary rounded-md shadow-lg shadow-zinc-400 text-white flex flex-row text-center font-semibold p-3 w-full justify-evenly">
                      <p className="w-1/2 text-center">Summary</p>
                      <p className="w-1/2 text-center">Amount</p>
                    </div>
                    {EEPayslipSummaryData &&
                      EEPayslipSummaryData.map((emp) => (
                        <>
                          {/* Basic */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Basic
                            </p>
                            <p className="text-center w-1/2">
                              {emp.basic.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Basic */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Tardiness
                            </p>
                            <p className="text-center text-red-500 w-1/2">
                              {emp.tardiness.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Overtime */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              NightDiff
                            </p>
                            <p className="text-center w-1/2">
                              {emp.nightdiff.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>

                          {/* Overtime */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Overtime
                            </p>
                            <p className="text-center w-1/2">
                              {emp.overtime.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* PaidLeaves */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Paid Leaves
                            </p>
                            <p className="text-center w-1/2">
                              {emp.paidleaves.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* PaidLeaves */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Cola
                            </p>
                            <p className="text-center w-1/2">
                              {emp.cola.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Grosspay */}
                          <div className="bg-zinc-200 rounded-sm font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Gross Pay
                            </p>
                            <p className="text-center w-1/2">
                              {emp.gross_pay.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Deductions:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>

                          {/* SSS EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              SSS
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.sss_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>

                          {/* Phic EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Philhealth{" "}
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.phic_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* MDF EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Pag-ibig
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.mdf_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Whtx */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Withholding Tax
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.whtx.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Netpay */}
                          <div className="bg-zinc-200 rounded-sm font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Net Pay
                            </p>
                            <p className="text-center w-1/2">
                              {emp.net_pay.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Other Deductions:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>
                          {/* SSS Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              SSS Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.sss_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* MDF Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Pag-ibig Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.mdf_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Coop Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Coop Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.coop_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Housing Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Advances
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.advances.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Employee Advances */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Other Deductions
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.other_deductions.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Allowances:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>
                          {/* Others 1 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 1
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_1.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Others 2 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 2
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_2.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Others 3 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 3
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_3.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Payout */}
                          <div className="py-2 text-lg bg-gradient-to-br from-colorBrand to-colorBrandSecondary rounded-sm shadow-lg shadow-zinc-400 text-white font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center w-1/2">Net Salary</p>
                            <p className="text-center w-1/2">
                              {emp.net_cash.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* <div className="w-full flex justify-end pt-10">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-10 h-10 bg-gradient-to-br from-darkerPrimary via-darkPrimary to-softPrimary text-white rounded-lg p-2 shadow-xl"
                              onClick={() => setisModalPrint(true)}
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 0 0 3 3h.27l-.155 1.705A1.875 1.875 0 0 0 7.232 22.5h9.536a1.875 1.875 0 0 0 1.867-2.045l-.155-1.705h.27a3 3 0 0 0 3-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0 0 18 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM16.5 6.205v-2.83A.375.375 0 0 0 16.125 3h-8.25a.375.375 0 0 0-.375.375v2.83a49.353 49.353 0 0 1 9 0Zm-.217 8.265c.178.018.317.16.333.337l.526 5.784a.375.375 0 0 1-.374.409H7.232a.375.375 0 0 1-.374-.409l.526-5.784a.373.373 0 0 1 .333-.337 41.741 41.741 0 0 1 8.566 0Zm.967-3.97a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H18a.75.75 0 0 1-.75-.75V10.5ZM15 9.75a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V10.5a.75.75 0 0 0-.75-.75H15Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div> */}
                        </>
                      ))}
                  </div>
                </div>
              </div>
            </>
          }
        />
      </div>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div
          className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100"
          onClick={(e) => {
            setisModalPrint(false);
          }}
          id="closingdiv"
        >
          <div className="flex flex-col justify-center w-full lg:w-3/5 lg:p-6">
            <div className="scale-90 lg:scale-100  flex flex-col h-auto pb-5 shadow-2xl  rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row relative justify-center text-white w-full  bg-gradient-to-br from-colorBrand   to-colorBrandSecondary rounded-t-xl p-10">
                <div className="w-full flex flex-col items-center justify-center">
                  <h1 className="w-full text-center p-1 text-3xl lg:text-3xl font-extrabold "></h1>
                </div>
              </div>
              <div className="flex flex-col space-y-2 w-full p-3">
                <div className="flex flex-col  rounded-lg ">
                  <div className="w-full flex flex-row justify-center items-center bg-colorBrand text-white font-bold text-xl">
                    <h1>{busunit}</h1>
                  </div>
                  <div className="flex flex-col w-full justify-center">
                    <div className="flex flex-col justify-center  w-1/2">
                      <div className="w-full flex flex-row justify-center items-center text-center  font-bold text-lg">
                        <h1 className="w-1/2">RECIPIENT:</h1>
                        <h1 className="w-1/2">{`${memberData[0].firstname} ${memberData[0].middlename} ${memberData[0].lastname}`}</h1>
                      </div>
                      <div className="w-full flex flex-row justify-center items-center text-center  font-bold text-lg">
                        <h1 className="w-full"> DATE:</h1>
                        <div className="flex flex-row w-full">
                          <div className="flex flex-row justify-center w-full">
                            <h1 className="w-full"> {formattedDateFrom} </h1>
                          </div>
                          <h1>-</h1>
                          <div className="flex flex-row justify-center w-full ">
                            <h1 className="w-full"> {formattedDateTo}</h1>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* <div className="w-1/2 flex justify-center">
                    <img src={logo} alt="" className="" />
                </div> */}
                  </div>
                  <div className="flex flex-col p-3 h-[50vh] scrollbar overflow-y-auto text-zinc-600">
                    <div className="mb-3 bg-gradient-to-br from-colorBrand to-colorBrandSecondary rounded-md shadow-lg shadow-zinc-400 text-white flex flex-row text-center font-semibold p-3 w-full justify-evenly">
                      <p className="w-1/2 text-center">Summary</p>
                      <p className="w-1/2 text-center">Amount</p>
                    </div>
                    {EEPayslipSummaryData &&
                      EEPayslipSummaryData.map((emp) => (
                        <>
                          {/* Basic */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Basic
                            </p>
                            <p className="text-center w-1/2">
                              {emp.basic.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Basic */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Tardiness
                            </p>
                            <p className="text-center text-red-500 w-1/2">
                              {emp.tardiness.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Overtime */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              NightDiff
                            </p>
                            <p className="text-center w-1/2">
                              {emp.nightdiff.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>

                          {/* Overtime */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Overtime
                            </p>
                            <p className="text-center w-1/2">
                              {emp.overtime.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* PaidLeaves */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Paid Leaves
                            </p>
                            <p className="text-center w-1/2">
                              {emp.paidleaves.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* PaidLeaves */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Cola
                            </p>
                            <p className="text-center w-1/2">
                              {emp.cola.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Grosspay */}
                          <div className="bg-zinc-200 rounded-sm font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Gross Pay
                            </p>
                            <p className="text-center w-1/2">
                              {emp.gross_pay.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Deductions:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>

                          {/* SSS EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              SSS
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.sss_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>

                          {/* Phic EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Philhealth{" "}
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.phic_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* MDF EE */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Pag-ibig
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.mdf_employee.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Whtx */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Withholding Tax
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.whtx.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Netpay */}
                          <div className="bg-zinc-200 rounded-sm font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Net Pay
                            </p>
                            <p className="text-center w-1/2">
                              {emp.net_pay.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Other Deductions:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>
                          {/* SSS Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              SSS Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.sss_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* MDF Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Pag-ibig Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.mdf_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Coop Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Coop Loan
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.coop_loan.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Housing Loan */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Advances
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.advances.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Employee Advances */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Other Deductions
                            </p>
                            <p className="text-red-500 text-center w-1/2">
                              {emp.other_deductions.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Deductions */}
                          <div className="mt-3 ps-5 mb-2 font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-start text-zinc-600 w-1/2">
                              Allowances:
                            </p>
                            <p className="text-center w-1/2"></p>
                          </div>
                          {/* Others 1 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 1
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_1.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Others 2 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 2
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_2.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Others 3 */}
                          <div className="flex flex-row w-full justify-center text-center">
                            <p className="text-center  text-zinc-600 w-1/2">
                              Allowance 3
                            </p>
                            <p className="text-zinc-600 text-center w-1/2">
                              {emp.allowance_3.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {/* Payout */}
                          <div className="py-2 text-lg bg-gradient-to-br from-colorBrand to-colorBrandSecondary rounded-sm  text-white font-semibold flex flex-row w-full justify-center text-center">
                            <p className="text-center w-1/2">Net Salary</p>
                            <p className="text-center w-1/2">
                              {emp.net_cash.toLocaleString("en-US", {
                                style: "decimal",
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div className="w-full flex justify-end pt-10">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-10 h-10 bg-gradient-to-br cursor-pointer hover:scale-105 duaration-300 from-colorBrand to-colorBrandSecondary text-white rounded-lg p-2"
                              onClick={() => handlePrint()}
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 0 0 3 3h.27l-.155 1.705A1.875 1.875 0 0 0 7.232 22.5h9.536a1.875 1.875 0 0 0 1.867-2.045l-.155-1.705h.27a3 3 0 0 0 3-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0 0 18 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM16.5 6.205v-2.83A.375.375 0 0 0 16.125 3h-8.25a.375.375 0 0 0-.375.375v2.83a49.353 49.353 0 0 1 9 0Zm-.217 8.265c.178.018.317.16.333.337l.526 5.784a.375.375 0 0 1-.374.409H7.232a.375.375 0 0 1-.374-.409l.526-5.784a.373.373 0 0 1 .333-.337 41.741 41.741 0 0 1 8.566 0Zm.967-3.97a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H18a.75.75 0 0 1-.75-.75V10.5ZM15 9.75a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V10.5a.75.75 0 0 0-.75-.75H15Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPayslip;
