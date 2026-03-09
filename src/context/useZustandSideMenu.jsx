import create from "zustand";

const useZustandSideMenu = create((set) => ({
  selectedMenu: "",
  setSelectedMenu: (menu) => set(() => ({ selectedMenu: menu })),
  isDekstopSideMenu: false,
  toggleIsDesktopSideMenu: () =>
    set((state) => ({ isDekstopSideMenu: !state.isDekstopSideMenu })),
}));

export default useZustandSideMenu;
