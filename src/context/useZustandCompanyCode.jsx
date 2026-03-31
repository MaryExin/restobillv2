import create from "zustand";

const useZustandCompanyCode = create((set) => ({
  companyGlobalCode: "",
  setGlobalCompanyCode: (code) => set({ companyGlobalCode: code }),
}));

export default useZustandCompanyCode;
