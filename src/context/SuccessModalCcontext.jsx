import React, { createContext, useContext, useState } from "react";

const SuccessModalContext = createContext();

export const SuccessModalProvider = ({ children }) => {
  const [showhidesuccess, setShowhidesuccess] = useState(false);
  const [returnMessage, setReturnMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(null);

  const showSuccessModal = (message, success = true) => {
    setReturnMessage(message);
    setShowhidesuccess(true);
    setIsSuccess(success);
  };

  return (
    <SuccessModalContext.Provider
      value={{
        showhidesuccess,
        setShowhidesuccess,
        returnMessage,
        setReturnMessage,
        showSuccessModal,
        isSuccess,
      }}
    >
      {children}
    </SuccessModalContext.Provider>
  );
};

export const useSuccessModal = () => useContext(SuccessModalContext);
