import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useApiHost from "./useApiHost";
import { useCustomSecuredMutation } from "./useCustomSecuredMutation";
import { posAuthenticatedFetch } from "../utils/posAuthenticatedFetch";

const endpointPath = import.meta.env.VITE_POS_QR_ORDERING_ENDPOINT || "/api/qr-ordering.php";

export default function useQrOrders() {
  const apiHost = useApiHost();
  const categoryCode = localStorage.getItem("posBusinessCategoryCode") || "";
  const unitCode = localStorage.getItem("posBusinessUnitCode") || "";
  const terminalNumber = localStorage.getItem("posTerminalNumber") || "1";
  const token = localStorage.getItem("access_token") || "";
  const endpoint = `${apiHost}${endpointPath}`;
  const [host, setHost] = useState(null);
  const [hostError, setHostError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { mutateAsync, isLoading: isMutating } = useCustomSecuredMutation(endpoint);
  const ready = Boolean(apiHost && categoryCode && unitCode && token);

  const query = useQuery({
    queryKey: ["qr-orders", apiHost, categoryCode, unitCode, token],
    enabled: ready,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ action: "pending", category_code: categoryCode, unit_code: unitCode });
      const response = await posAuthenticatedFetch(`${endpoint}?${params}`, { signal });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load QR orders.");
      return result.data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const connectHost = useCallback(async () => {
    if (!ready || !window.qrOrdering) return;
    setIsConnecting(true);
    setHostError("");
    try {
      const result = await mutateAsync({ action: "setup", category_code: categoryCode, unit_code: unitCode });
      if (!result.success) throw new Error(result.message || "Unable to set up QR ordering.");
      const nextHost = await window.qrOrdering.configure({
        apiUrl: endpoint,
        hostToken: result.data.host_token,
        categoryCode: result.data.category_code,
        unitCode: result.data.unit_code,
        businessName: result.data.business_name,
      });
      setHost(nextHost);
      if (nextHost.error) setHostError(nextHost.error);
    } catch (error) {
      setHostError(error.message || "Unable to start the QR ordering server.");
    } finally {
      setIsConnecting(false);
    }
  }, [ready, mutateAsync, categoryCode, unitCode, endpoint]);

  useEffect(() => { connectHost(); }, [connectHost]);

  useEffect(() => {
    if (!window.qrOrdering) return;
    let active = true;
    const refresh = () => window.qrOrdering.status().then((value) => {
      if (active) setHost(value);
    }).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const decide = async (action, orderId, reason = "") => {
    const result = await mutateAsync({
      action,
      order_id: orderId,
      category_code: categoryCode,
      unit_code: unitCode,
      terminal_number: terminalNumber,
      rejection_reason: reason,
    });
    if (!result.success) throw new Error(result.message || "Unable to update the order.");
    await query.refetch();
    return result.data;
  };

  return { ...query, ready, host, hostError, connectHost, isConnecting, isMutating, decide };
}
