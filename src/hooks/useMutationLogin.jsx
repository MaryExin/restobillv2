import { useMutation } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

export const useMutationLogin = () => {
  const { endpoint } = useZustandAPIEndpoint(); // ⬅️ Moved here
  const url =
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGIN_ENDPOINT;

  const loginUser = async (dataObj) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataObj),
    });
    return await response.json();
  };

  return useMutation(loginUser);
};
