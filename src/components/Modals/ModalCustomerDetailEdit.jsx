import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalCustomerDetailEdit = ({
  customerDetails,
  setIsModalCustomerDetailEdit,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [customerID, setCustomerID] = useState(customerDetails.customer_id);
  const [customerName, setCustomerName] = useState(
    customerDetails.customername
  );
  const [customerEmail, setCustomerEmail] = useState(customerDetails.email);
  const [customerContactNo, setCustomerContactNo] = useState(
    customerDetails.contact_no
  );
  const [customerBranchName, setCustomerBranchName] = useState(
    customerDetails.branchname
  );
  const [customerTIN, setCustomerTIN] = useState(customerDetails.tin);
  const [customerOtherInfo, setCustomerOtherInfo] = useState(
    customerDetails.otherinfo
  );
  const [customerAddress, setCustomerAddress] = useState(
    customerDetails.address
  );

  const {
    data: customerEditData,
    isLoading: customerEditIsLoading,
    isError: customerEditIsError,
    isSuccess: customerEditIsSuccess,
    mutate: customerEditMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_CUSTOMER_EDIT_ENDPOINT,
    "POST"
  );

  const handleUpdate = () => {
    customerEditMutate({
      customername: customerName,
      branchname: customerBranchName,
      tin: customerTIN,
      address: customerAddress,
      contact_no: customerContactNo,
      email: customerEmail,
      otherinfo: customerOtherInfo,
      customer_id: customerID,
    });
    alert("Saved");
    setIsModalCustomerDetailEdit(false);
  };

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800  bg-opacity-50 z-50 fixed top-0 left-0 px-3  lg:px-0 lg:mt-0">
        <div className="flex flex-row justify-center lg:ms-10  lg:px-2 pt-2 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-center w-full md:w-1/2 z-50">
            <div className="scale-90 lg:scale-100  flex flex-col mt-5 lg:mt-5 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl  bg-slate-50 z-20">
              <div className="flex flex-row relative justify-center text-white w-full  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary rounded-t-xl p-10">
                <div
                  onClick={() => {
                    setIsModalCustomerDetailEdit(false);
                  }}
                  className="cursor-pointer absolute right-2 top-2 hover:scale-105 duration-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-10 h-10"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <motion.div
                  className="flex flex-row justify-center"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                ></motion.div>
              </div>

              {/* Main Form */}

              <div className="flex flex-col space-y-5 py-5 px-5">
                <h1 className="text-zinc-600 text-2xl font-semibold">
                  Customer Details
                </h1>

                <div className="flex flex-col space-y-3 justify-evenly items-center border border-zinc-400 p-3 rounded-sm ">
                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-md text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Customer ID:
                    </p>
                    <p className="border-b text-zinc-600 font-semibold text-sm  px-2">
                      {customerID}
                    </p>
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Customer Name:
                    </p>
                    <input
                      type="text"
                      value={customerName}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Customer Name"
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Email:
                    </p>
                    <input
                      type="text"
                      value={customerEmail}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Email"
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Contact:
                    </p>
                    <input
                      type="text"
                      value={customerContactNo}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Contact"
                      onChange={(e) => setCustomerContactNo(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Branch:
                    </p>
                    <input
                      type="text"
                      value={customerBranchName}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Branch"
                      onChange={(e) => setCustomerBranchName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      TIN:
                    </p>
                    <input
                      type="text"
                      value={customerTIN}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="TIN"
                      onChange={(e) => setCustomerTIN(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Information:
                    </p>
                    <input
                      type="text"
                      value={customerOtherInfo}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Information"
                      onChange={(e) => setCustomerOtherInfo(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="group-hover:bg-softerPrimary text-sm text-zinc-600 bg-zinc-300 font-semibold px-2 rounded-sm">
                      Address:
                    </p>
                    <input
                      type="text"
                      value={customerAddress}
                      className="border-b text-zinc-600 font-semibold text-sm px-2 w-full"
                      placeholder="Address"
                      onChange={(e) => setCustomerAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p
                    className="bg-darkerPrimary cursor-pointer text-white text-md shadow-lg shadow-zinc-400 rounded-md p-1 hover:bg-darkPrimary"
                    onClick={() => handleUpdate()}
                  >
                    Update Details
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalCustomerDetailEdit;
