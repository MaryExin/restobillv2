import { useInfiniteQuery } from "@tanstack/react-query";

const fetchData = async (url, page, search, pageData) => {
  const res = await fetch(
    url + "?page=" + page + "&search=" + search + "&pageData=" + pageData,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token"),
      },
    }
  );
  return res.json();
};

const useCustomInfiniteQuery = (url, qkey, search, pageData) =>
  useInfiniteQuery(
    [qkey],
    ({ pageParam = 1 }) => fetchData(url, pageParam, search, pageData),
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextPage || null,
      staleTime: 1000,
      cacheTime: 1000,
    }
  );

export default useCustomInfiniteQuery;
