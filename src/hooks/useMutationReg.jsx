import { useMutation } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

export const useMutationReg = () => {
  const { endpoint } = useZustandAPIEndpoint(); // ✅ use hook inside function
  const url =
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_USERREG_ENDPOINT;

  const registerUser = async (dataObj) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataObj),
    });
    return await response.json();
  };

  return useMutation(registerUser);
};
