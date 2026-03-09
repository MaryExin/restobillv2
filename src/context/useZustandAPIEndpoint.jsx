import create from "zustand";

const useZustandAPIEndpoint = create((set) => ({
  endpoint: "",
  setEndPoint: (endpoint) => set(() => ({ endpoint: endpoint })),
}));

export default useZustandAPIEndpoint;
