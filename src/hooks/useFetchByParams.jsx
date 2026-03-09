import { useState, useEffect } from "react";
import { useSecuredMutation } from "./useSecuredMutation";

/**
 * @param {object} params   — e.g. { busunitcode, areacode }
 * @param {string} endpoint — your POST URL or env var
 */
export function useFetchByParams(params, endpoint) {
  const [output, setOutput] = useState(null);

  const {
    data,
    isLoading,
    isError,
    isSuccess,
    mutate, // the function that actually fires the POST
  } = useSecuredMutation(endpoint, "POST");

  // whenever any value in params changes, fire the mutation
  useEffect(() => {
    if (params && Object.keys(params).length > 0) {
      mutate(params);
    }
    // watch each param value and the mutate fn itself
  }, [...Object.values(params || {}), mutate]);

  // copy data into output if you really need a separate state
  useEffect(() => {
    if (data !== undefined) {
      setOutput(data);
    }
  }, [data]);

  return {
    output, // your own copy of `data`
    data, // the raw data too, in case you prefer it
    isLoading,
    isError,
    isSuccess,
    refetch: () => mutate(params), // convenience if you want to re-fire
  };
}
