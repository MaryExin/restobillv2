import React, { useEffect, useRef, useState } from "react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";
import QRCode from "qrcode.react"; // Import QR code generator library
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const BarcodePrint = React.forwardRef(({ text }, ref) => {
  return (
    <div ref={ref} className="flex flex-col px-5 w-full justify-center pt-5 ">
      <div className="w-full flex flex-col justify-center items-center"></div>
      <div className="w-full  px-5">{text}</div>
    </div>
  );
});

const ModalBarcode = ({ data, setModalBarcode, id }) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const componentRef = useRef();
  const [count, setCount] = useState(1); // State to hold the count of barcodes to print
  const [isChecked, setIsChecked] = useState(false);
  const [isToggled, setIsToggled] = useState("BR");

  const toggleCheckbox = () => {
    setIsChecked((prevChecked) => !prevChecked);
    setIsToggled(isChecked ? "BR" : "QR");
  };

  // useReactToPrint hook
  const handleBarcodePrint = useReactToPrint({
    content: () => componentRef.current,
    onAfterPrint: () => setModalBarcode(false),
  });

  // Function to handle changes in the count input box
  const handleCountChange = (action) => {
    if (action === "increment") {
      setCount((prevCount) => prevCount + 1);
    } else if (action === "decrement" && count > 1) {
      setCount((prevCount) => prevCount - 1);
    }
  };

  useEffect(() => {
    // console.log("barcodeData:", data);
  }, [data]);

  return (
    <>
      <div style={{ display: "none" }}>
        <BarcodePrint
          ref={componentRef}
          text={
            <>
              <div className="flex flex-col justify-center ">
                <div className="flex flex-wrap items-center  justify-center  p-5 overflow-auto">
                  {[...Array(count)].map((_, index) => (
                    <div
                      key={index}
                      className="flex flex-col justify-center m-1 items-center border-2 rounded-md p-5"
                    >
                      <div className={isToggled === "BR" ? "" : "hidden"}>
                        <h1 className="font-bold text-xl w-full text-center">
                          {id}
                        </h1>
                        <Barcode value={data} width={1} height={35} />
                      </div>
                      ;
                      <div
                        className={
                          isToggled === "QR"
                            ? "flex flex-col justify-center items-center space-y-5"
                            : "hidden"
                        }
                      >
                        <h1 className="font-bold">{data}</h1>
                        <QRCode value={data} width={1} height={50} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          }
        />
      </div>
      <div
        className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed
      top-0 left-0"
      >
        <div className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div
            id="closingdiv"
            className="flex flex-col justify-center w-full md:w-1/2"
          >
            <div className="scale-75 lg:scale-100  flex flex-col lg:mt-20 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl bg-slate-50 z-10">
              <div className="p-2 flex flex-col space-y-1  justify-center text-white w-full px-5 pt-12  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary rounded-t-xl">
                <div
                  className="cursor-pointer absolute right-2 top-2 hover:scale-105 duration-300"
                  onClick={() => setModalBarcode(false)}
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
              </div>
              <div className=" w-full flex justify-between space-x-2 items-center p-1">
                <div className=" w-1/4 flex justify-start space-x-2 items-center p-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      className="sr-only peer"
                      type="checkbox"
                      checked={isChecked}
                      onChange={toggleCheckbox}
                    />
                    <div className="peer rounded-r-full  hover:translate-y-0.5 hover:translate-x-0.5  rounded-l-full outline-none duration-100 after:duration-500 w-14 h-7  bg-gradient-to-l from-darkPrimary to-softPrimary peer-focus:outline-none  text-2xs after:content-['BR'] after:absolute after:outline-none after:rounded-r-full after:rounded-l-full after:h-5 after:w-5 after:bg-white after:top-1 after:left-1 after:flex after:justify-center after:items-center after:text-darkerPrimary after:font-bold peer-checked:after:translate-x-7 peer-checked:after:content-['QR'] peer-checked:bg-gradient-to-r"></div>
                  </label>
                </div>
                {isChecked ? (
                  <div className=" w-full flex justify-center space-x-2 items-center p-1">
                    {/* plus */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 text-green-300 rounded-full shadow-xl hover:translate-y-0.5 hover:translate-x-0.5 duration-500 cursor-pointer"
                      onClick={() => handleCountChange("increment")}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      value={count}
                      onChange={() => {}}
                      className="border-2 border-darkerPrimary rounded-lg shadow-lg p-1 focus:border-darkerPrimary"
                      readOnly
                    />
                    {/* minus */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`w-6 h-6 hover:translate-y-0.5 hover:translate-x-0.5 duration-500 cursor-pointer ${
                        count === 1
                          ? "text-zinc-50"
                          : "text-red-500 rounded-full shadow-xl "
                      }`}
                      onClick={() => handleCountChange("decrement")}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>
                ) : (
                  ""
                )}
                <div className=" w-1/5 flex justify-end space-x-2 items-center p-1">
                  <div
                    onClick={() => handleBarcodePrint()}
                    className="flex flex-row justify-center border p-2 border-darkerPrimary rounded-lg text-white hover:translate-y-0.5 hover:translate-x-0.5 duration-500 cursor-pointer bg-gradient-to-b from-darkPrimary  to-softPrimary  "
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center  justify-center  p-5 overflow-auto">
                {[...Array(count)].map((_, index) => (
                  <div
                    key={index}
                    className="flex flex-col justify-center m-1 items-center border-2 rounded-md p-5"
                  >
                    <div className={isToggled === "BR" ? "" : "hidden"}>
                      <h1 className="font-bold text-center">{id}</h1>
                      <Barcode value={data} width={1} height={50} />
                    </div>
                    <div
                      className={
                        isToggled === "QR"
                          ? "flex flex-col justify-center items-center space-y-5"
                          : "hidden"
                      }
                    >
                      <h1 className="font-bold">{data}</h1>
                      <QRCode value={data} width={1} height={50} />
                      <h1 className="font-bold">{id}</h1>
                    </div>
                  </div>
                ))}
                <div className="w-full my-3">
                  <div className="flex flex-row justify-center w-full ">
                    {/* Button to print the barcodes */}
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

export default ModalBarcode;
