import { useQuery } from "@tanstack/react-query";

const fetchData = async (url) => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("access_token"),
    },
  });
  return res.json();
};

export const useCustomQueryOnClick = (url, qKey, enabled) =>
  useQuery({
    queryKey: [qKey],
    queryFn: () => fetchData(url),
    keepPreviousData: false,
    enabled: enabled,
    staleTime: 1 * 1000, // 1 second - the amount of time for refetch
    // cacheTime: 1000,
  });
