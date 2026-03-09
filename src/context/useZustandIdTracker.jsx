import create from "zustand";

const useZustandIdTracker = create((set) => ({
  id: "",
  setId: (id) => set(() => ({ id: id })),
}));

export default useZustandIdTracker;
