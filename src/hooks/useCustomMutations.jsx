import { useMutation } from "@tanstack/react-query";

// const queryClient = useQueryClient();

const postData = async (urls, dataObj, requestMethod) => {
  const response = await fetch(urls, {
    method: requestMethod,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataObj),
  });
  return await response.json();
};

// export const useCorporation = (urls) => useMutation(corporation(urls));
export const useCustomMutation = (urls, requestMethod) =>
  useMutation((dataObj) => postData(urls, dataObj, requestMethod));
