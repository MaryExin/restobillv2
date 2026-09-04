import create from "zustand";

const useZustandSideMenu = create((set) => ({
  selectedMenu: "",
  setSelectedMenu: (menu) => set(() => ({ selectedMenu: menu })),
  isDekstopSideMenu: false,
  toggleIsDesktopSideMenu: () =>
    set((state) => ({ isDekstopSideMenu: !state.isDekstopSideMenu })),
  isSettingsOpen: false,
  settingsInitialTab: null,
  openSettings: (initialTab = null) =>
    set(() => ({ isSettingsOpen: true, settingsInitialTab: initialTab })),
  closeSettings: () =>
    set(() => ({ isSettingsOpen: false, settingsInitialTab: null })),
}));

export default useZustandSideMenu;
