import { useMutation } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

export const useMutationRefreshToken = () => {
  const { endpoint } = useZustandAPIEndpoint(); // ✅ Use hook inside the function
  const url =
    localStorage.getItem("apiendpoint") +
    import.meta.env.VITE_REFRESHLOGIN_ENDPOINT;

  const refreshLogin = async (dataObj) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataObj),
    });
    return await response.json();
  };

  return useMutation(refreshLogin);
};
