import { useEffect, useState, useCallback } from "react";

const DEFAULT_BUSINESS_INFO = {
  companyName: "",
  storeName: "",
  corpName: "",
  address: "",
  tin: "",
  machineNumber: "",
  serialNumber: "",
  posProviderName: "",
  posProviderAddress: "",
  posProviderTin: "",
  posProviderBirAccreNo: "",
  posProviderAccreDateIssued: "",
  posProviderPTUNo: "",
  posProviderPTUDateIssued: "",
};

export default function useBusinessInfo() {
  const [businessInfo, setBusinessInfo] = useState(DEFAULT_BUSINESS_INFO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const normalizeBusinessInfo = (data = {}) => ({
    companyName: String(data?.companyName || "").trim(),
    storeName: String(data?.storeName || "").trim(),
    corpName: String(data?.corpName || "").trim(),
    address: String(data?.address || "").trim(),
    tin: String(data?.tin || "").trim(),
    machineNumber: String(data?.machineNumber || "").trim(),
    serialNumber: String(data?.serialNumber || "").trim(),
    posProviderName: String(data?.posProviderName || "").trim(),
    posProviderAddress: String(data?.posProviderAddress || "").trim(),
    posProviderTin: String(data?.posProviderTin || "").trim(),
    posProviderBirAccreNo: String(data?.posProviderBirAccreNo || "").trim(),
    posProviderAccreDateIssued: String(
      data?.posProviderAccreDateIssued || "",
    ).trim(),
    posProviderPTUNo: String(data?.posProviderPTUNo || "").trim(),
    posProviderPTUDateIssued: String(
      data?.posProviderPTUDateIssued || "",
    ).trim(),
  });

  const fetchBusinessInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      if (window?.appConfig?.getBusinessInfo) {
        const data = await window.appConfig.getBusinessInfo();
        setBusinessInfo(normalizeBusinessInfo(data));
        return;
      }

      const response = await fetch("/businessInfo.json", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load business info: ${response.status}`);
      }

      const data = await response.json();
      setBusinessInfo(normalizeBusinessInfo(data));
    } catch (err) {
      setError(err?.message || "Failed to load business info");
      setBusinessInfo(DEFAULT_BUSINESS_INFO);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinessInfo();
  }, [fetchBusinessInfo]);

  return {
    businessInfo,
    isLoading,
    error,
    refetchBusinessInfo: fetchBusinessInfo,
  };
}
