import { useMutation } from "@tanstack/react-query";

// const queryClient = useQueryClient();

const postData = async (urls, dataObj) => {
  const response = await fetch(urls, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("access_token"),
    },
    body: JSON.stringify(dataObj),
  });
  return await response.json();
};

export const useCustomSecuredMutation = (urls) =>
  useMutation((dataObj) => postData(urls, dataObj));
