import React, { useRef, useState, useEffect } from "react";

const InfiniteScrollComponent = ({
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  data,
  children, // Pass in the content you want to render
  threshold = 1.0,
  root = null,
  rootMargin = "0px",
}) => {
  const loadMoreRef = useRef(null);
  const [isFetchingOnScroll, setIsFetchingOnScroll] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isFetchingNextPage &&
          hasNextPage &&
          !isFetchingOnScroll &&
          data.pages[data.pages.length - 1]?.items.length > 0 // Ensure last page has items
        ) {
          setIsFetchingOnScroll(true);
          fetchNextPage().finally(() => setIsFetchingOnScroll(false));
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );
    if (loadMoreRef.current && hasNextPage) {
      observer.observe(loadMoreRef.current);
    }
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [
    isFetchingNextPage,
    fetchNextPage,
    isFetchingOnScroll,
    hasNextPage,
    data,
  ]);
  return (
    <div>
      {children}
      {/* Place this ref at the end of your content */}
      <div ref={loadMoreRef} />
    </div>
  );
};

export default InfiniteScrollComponent;
