import create from "zustand";

const useZustandMobile = create((set) => ({
  isMobile: false,
  toggleIsMobile: () => set((state) => ({ isMobile: !state.isMobile })),
}));

export default useZustandMobile;
