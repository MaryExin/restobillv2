import { useMutation } from "@tanstack/react-query";

const customMutation = async (url, dataObj, requestMethod) => {
  const response = await fetch(url, {
    method: requestMethod,
    headers: {
      Authorization: "Bearer " + localStorage.getItem("access_token"),
      "Content-Type": "multipart/form-data",
    },
    body: JSON.stringify(dataObj),
  });
  return await response.json();
};

export const useSecuredCustomMutation = (url, requestMethod) =>
  useMutation((dataObj) => customMutation(url, dataObj, requestMethod));
