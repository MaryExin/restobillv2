import create from "zustand";

const useZustandPrPricing = create((set) => ({
  isPrPricingSetup: false, //Setup is by selected imsbusunitselected > if true then by Pricing Dropdown
  setIsPrPricingSetup: (status) => set({ isPrPricingSetup: status }),
}));

export default useZustandPrPricing;
