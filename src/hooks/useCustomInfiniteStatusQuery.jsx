import { useInfiniteQuery } from "@tanstack/react-query";

const fetchData = async (url, page, search, pageData,status) => {
  const res = await fetch(
    url + "?page=" + page + "&search=" + search + "&pageData=" + pageData +"&status=" + status,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token"),
      },
    }
  );
  return res.json();
};

const useCustomInfiniteStatusQuery = (url, qkey, search ,pageData,status) =>
  useInfiniteQuery(
    [qkey],
    ({ pageParam = 1 }) => fetchData(url, pageParam, search,pageData,status),
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextPage || null,
      staleTime: 1000,
      cacheTime: 1000,
    }
  );

export default useCustomInfiniteStatusQuery;
