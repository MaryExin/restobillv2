import create from "zustand";

const useZustandSalesQueueId = create((set) => ({
  salesQueueId: "",
  setSalesQueueId: (id) => set({ salesQueueId: id }),
}));

export default useZustandSalesQueueId;
