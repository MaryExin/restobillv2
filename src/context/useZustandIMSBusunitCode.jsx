import create from "zustand";

const useZustandIMSBusunitCode = create((set) => ({
  imsBusunitCodeSelected: "",
  setIMSBusunitCodeSelected: (busunitcode) =>
    set(() => ({ imsBusunitCodeSelected: busunitcode })),
  imsBusunitName: "",
  setIMSBusunitName: (name) => set(() => ({ imsBusunitName: name })),
  imsBusunitClass: "",
  setIMSBusunitClass: (busunitclass) =>
    set(() => ({ imsBusunitClass: busunitclass })),
  // isDekstopSideMenu: false,
  // toggleIsDesktopSideMenu: () =>
  //   set((state) => ({ isDekstopSideMenu: !state.isDekstopSideMenu })),
}));

export default useZustandIMSBusunitCode;
