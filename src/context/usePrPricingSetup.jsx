import { useEffect } from "react";
import useCustomQuery from "../hooks/useCustomQuery";
import useZustandPrPricing from "./useZustandPrPricing";

export default function usePrPricingSetup() {
  const setIsPrPricingSetup = useZustandPrPricing((s) => s.setIsPrPricingSetup);

  const { data, isLoading, isError, isSuccess, refetch } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_PR_PRICING_STATUS_ENDPOINT,
    "prpricingstatus"
  );

  useEffect(() => {
    if (data && data[0] && data[0].pr_pricing_status != null) {
      setIsPrPricingSetup(data[0].pr_pricing_status);
    }
  }, [data, setIsPrPricingSetup]);

  const isPrPricingSetup = useZustandPrPricing((s) => s.isPrPricingSetup);
  return {
    isPrPricingSetup,
    setIsPrPricingSetup,
    isLoading,
    isError,
    isSuccess,
    refetch,
  };
}
