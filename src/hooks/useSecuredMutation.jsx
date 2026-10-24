import { useMutation } from "@tanstack/react-query";
import { standaloneFetch } from "../utils/standaloneFetch";

const customMutation = async (url, dataObj, requestMethod) => {
  const response = await standaloneFetch(url, {
    method: requestMethod,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("access_token"),
    },
    body: JSON.stringify(dataObj),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Request failed");
  }

  return result;
};

export const useSecuredMutation = (
  url,
  requestMethod,
  { onSuccess, onError } = {}
) =>
  useMutation({
    mutationFn: (dataObj) => customMutation(url, dataObj, requestMethod),
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      }
      //  else {
      //   console.log("✅ Mutation success:", data);
      // }
    },
    onError: (err) => {
      if (onError) {
        onError(err);
      }
      // else {
      //   console.error("❌ Mutation error:", err.message);
      // }
    },
  });
