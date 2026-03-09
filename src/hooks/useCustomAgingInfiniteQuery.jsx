import { useInfiniteQuery } from "@tanstack/react-query";

const fetchData = async (
  url,
  page,
  search,
  min,
  max,
  busunitcode,
  pageData,
  supplierSlCode
) => {
  const res = await fetch(
    url +
      "?page=" +
      page +
      "&search=" +
      search +
      "&min=" +
      min +
      "&max=" +
      max +
      "&busunitcode=" +
      busunitcode +
      "&pageData=" +
      pageData +
      "&supplierSLcode=" +
      supplierSlCode,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token"),
      },
    }
  );
  return res.json();
};

const useCustomAgingInfiniteQuery = (
  url,
  qkey,
  search,
  min,
  max,
  busunitcode,
  pageData,
  supplierSlCode
) =>
  useInfiniteQuery(
    [qkey],
    ({ pageParam = 1 }) =>
      fetchData(
        url,
        pageParam,
        search,
        min,
        max,
        busunitcode,
        pageData,
        supplierSlCode
      ),
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextPage || null,
      staleTime: 1000,
      cacheTime: 1000,
    }
  );

export default useCustomAgingInfiniteQuery;
