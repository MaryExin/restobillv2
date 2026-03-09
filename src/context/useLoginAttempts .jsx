import create from "zustand";

const useLoginAttempts = create((set) => ({
  attempts: 1,
  incrementAttempts: () => set((state) => ({ attempts: state.attempts + 1 })),
  resetAttempts: () => set({ attempts: 1 }),
}));

export default useLoginAttempts;
