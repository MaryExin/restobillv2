import React from "react";
import { MdWarning } from "react-icons/md";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalFailure = ({
  header,
  message,
  button,
  closeModal,
  setIsModalOpen,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="ui-enter bg-white rounded-md shadow-lg border-t-8 border-red-500 w-11/12 max-w-md overflow-hidden"
      >
        {/* Icon Header */}
        <div className="p-6 flex flex-col items-center">
          <div
            className="ui-scale-in w-16 h-16 flex items-center justify-center bg-[#fee2e2] rounded-md mb-4"
          >
            <MdWarning className="w-8 h-8 text-red-500" />
          </div>

          {/* Text Content */}
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            {header}
          </h2>
          <p className="text-gray-600 text-center mb-6">{message}</p>

          {/* Action Button */}
          <button
            onClick={() => setIsModalOpen(false)}
            className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 px-6 py-2 bg-red-500 text-white rounded-md shadow-md hover:bg-red-600 transition"
          >
            {button}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalFailure;
