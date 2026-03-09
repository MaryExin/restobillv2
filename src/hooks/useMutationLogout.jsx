import { useMutation } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint"; // ✅ import the Zustand hook

export const useMutationLogout = () => {
  const { endpoint } = useZustandAPIEndpoint(); // ✅ use hook inside the function
  const url =
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGOUT_ENDPOINT;

  const logoutUser = async (dataObj) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataObj),
    });
    return await response.json();
  };

  return useMutation(logoutUser);
};
