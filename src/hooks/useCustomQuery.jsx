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

const useCustomQuery = (urls, qkey) =>
  useQuery({
    queryKey: [qkey], // Remove unnecessary backticks
    queryFn: () => fetchData(urls),
    keepPreviousData: true,
    // enabled: enabled,
    staleTime: 1 * 1000, // Remove extra '* 1'
    cacheTime: 1000,
  });

export default useCustomQuery;
