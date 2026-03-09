import create from "zustand";

const useOtpAttempts = create((set) => ({
  otpattempts: 1,
  otpincrementAttempts: () =>
    set((state) => ({ otpattempts: state.otpattempts + 1 })),
  otpresetAttempts: () => set({ otpattempts: 1 }),
}));

export default useOtpAttempts;
