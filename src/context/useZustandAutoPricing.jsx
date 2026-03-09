import create from "zustand";

const useZustandAutoPricing = create((set) => ({
  isAutoPricing: false,
  setIsAutoPricing: (status) => set({ isAutoPricing: status }),
}));

export default useZustandAutoPricing;
