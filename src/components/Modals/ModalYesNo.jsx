import React from "react";
import { useNavigate } from "react-router-dom";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import { FaQuestionCircle } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalYesNo = ({
  header,
  message,
  setModalOpen,
  memberId,
  approveOrRejectMember,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const navigate = useNavigate();
  const { isDesktopSideMenu } = useZustandSideMenu();

  const handleYes = () => {
    approveOrRejectMember(memberId);
    setModalOpen(false);
  };

  const handleNo = () => {
    setModalOpen(false);
  };

  return (
    <>
      <div
        className="ui-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      >
        {/* Gradient border wrapper */}
        <div
          className="ui-scale-in bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-1 rounded-2xl shadow-2xl"
        >
          <div className="bg-white rounded-2xl overflow-hidden w-11/12 max-w-lg">
            {/* Header with geometric shapes */}
            <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary h-32">
              <div className="absolute -top-8 -left-8 w-24 h-24 bg-colorBrandLighter rounded-full opacity-50 mix-blend-multiply animate-pulse" />
              <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-colorBrandLighter rounded-full opacity-40 mix-blend-multiply" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="ui-scale-in bg-white rounded-full p-4 shadow-lg"
                >
                  <FaQuestionCircle className="w-16 h-16 text-colorBrand" />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="pt-20 pb-6 px-6 text-center space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">{header}</h2>
              <p className="text-gray-600">{message}</p>

              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={handleYes}
                  className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 inline-flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-full shadow-lg transition"
                >
                  Yes
                </button>
                <button
                  onClick={handleNo}
                  className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 inline-flex items-center px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-full shadow-lg transition"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalYesNo;
