import { useQuery } from "@tanstack/react-query";

const fetchData = async (token, ipaddress) => {
  const res = await fetch(
    `https://ipgeolocation.abstractapi.com/v1/?api_key=${token}&ip_address=${ipaddress}`,
    {
      method: "GET",
      // headers: {
      //   Authorization: "Bearer " + localStorage.getItem("access_token"),
      // },
    }
  );
  return res.json();
};

const useCustomGeoQuery = (qkey, token, ipaddress) =>
  useQuery({
    queryKey: [qkey], // Remove unnecessary backticks
    queryFn: () => fetchData(token, ipaddress),
    keepPreviousData: true,
    // enabled: enabled,
    staleTime: 1 * 1000, // Remove extra '* 1'
    cacheTime: 1000,
  });

export default useCustomGeoQuery;
