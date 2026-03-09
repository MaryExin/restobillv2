import create from "zustand";

const useZustandLoginCred = create((set) => ({
  isAuthenticated: false,
  firstName: "",
  roles: [],
  userId: "",
  email: "",
  ipAddress: "",
  profilePic: "",
  toggleAuthentication: () =>
    set((state) => ({ isAuthenticated: !state.isAuthenticated })),
  toggleAuthToTrue: () => {
    set(() => ({ isAuthenticated: true }));
  },
  toggleAuthToFalse: () => {
    set(() => ({ isAuthenticated: false }));
  },
  toggleFirstName: (firstName) => set(() => ({ firstName: firstName })),
  toggleEmail: (email) => set(() => ({ email: email })),
  updateUserRole: (role) => {
    set(() => ({ roles: [role] }));
  },
  setUserId: (userId) => set(() => ({ userId: userId })),
  setIpAddress: (ipAddress) => set(() => ({ ipAddress: ipAddress })),
  setProfilePic: (profilePic) => set(() => ({ profilePic: profilePic })),
}));

export default useZustandLoginCred;
