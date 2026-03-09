import React, { useEffect } from "react";
import useCustomInfiniteQuery from "../../hooks/useCustomInfiniteQuery";

const InfiniteScroll = () => {
  const url = "https://Lightemph.com/api/paramsreadsaleshistory.php";
  const queryKey = ["myquery"];

  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useCustomInfiniteQuery(url, queryKey);

  // Your rendering logic here

  return (
    <div>
      <h1>Infinite Scrolling</h1>

      {data?.pages.map((page, index) => (
        <React.Fragment key={index}>
          {page.items.map((item) => (
            <div key={item.seq}>{item.gross_sales}</div>
          ))}
        </React.Fragment>
      ))}

      {true && (
        <button
          className="border"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
};

export default InfiniteScroll;
