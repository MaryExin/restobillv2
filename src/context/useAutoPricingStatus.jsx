import { useEffect } from "react";
import useCustomQuery from "../hooks/useCustomQuery";
import useZustandAutoPricing from "./useZustandAutoPricing";
import useZustandAPIEndpoint from "./useZustandAPIEndpoint";

export default function useAutoPricingStatus() {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const setIsAutoPricing = useZustandAutoPricing((s) => s.setIsAutoPricing);

  const { data, isLoading, isError, isSuccess, refetch } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_AUTOPRICING_STATUS_ENDPOINT,
    "autopricingstatus"
  );

  useEffect(() => {
    if (data && data[0] && data[0].auto_pricing_status != null) {
      setIsAutoPricing(data[0].auto_pricing_status);
    }
  }, [data, setIsAutoPricing]);

  const isAutoPricing = useZustandAutoPricing((s) => s.isAutoPricing);
  return {
    isAutoPricing,
    setIsAutoPricing,
    isLoading,
    isError,
    isSuccess,
    refetch,
  };
}
