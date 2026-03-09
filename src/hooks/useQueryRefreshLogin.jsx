import { useQuery } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

export const useQueryRefreshLogin = () => {
  const url =
    localStorage.getItem("apiendpoint") +
    import.meta.env.VITE_REFRESHLOGIN_ENDPOINT;

  const setJWT = async () => {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("refresh_token"),
      },
    });
    return res.json();
  };

  return useQuery({
    queryKey: ["jwt"],
    queryFn: setJWT,
    keepPreviousData: true,
    staleTime: 1000, // 1 sec
    cacheTime: 1000,
  });
};
