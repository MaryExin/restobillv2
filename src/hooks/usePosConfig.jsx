import { useEffect, useState } from "react";

const DEFAULT_POS_CONFIG = {
  categoryCode: "",
  unitCode: "",
  businessUnitName: "",
  terminalNumber: "",
  corpName: "",
  machineNumber: "",
  serialNumber: "",
  ptuNumber: "",
  ptuDateIssued: "",
};

export default function usePosConfig() {
  const [posConfig, setPosConfig] = useState(DEFAULT_POS_CONFIG);
  const [isPosConfigLoading, setIsPosConfigLoading] = useState(true);
  const [posConfigError, setPosConfigError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        setIsPosConfigLoading(true);
        setPosConfigError("");

        const response = await fetch("/pos-config.json", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load POS config file.");
        }

        const data = await response.json();

        if (!isMounted) return;

        setPosConfig({
          categoryCode: String(data?.categoryCode ?? ""),
          unitCode: String(data?.unitCode ?? ""),
          businessUnitName: String(data?.businessUnitName ?? ""),
          terminalNumber: String(data?.terminalNumber ?? ""),
          corpName: String(data?.corpName ?? ""),
          machineNumber: String(data?.machineNumber ?? ""),
          serialNumber: String(data?.serialNumber ?? ""),
          ptuNumber: String(data?.ptuNumber ?? ""),
          ptuDateIssued: String(data?.ptuDateIssued ?? ""),
        });
      } catch (error) {
        if (!isMounted) return;
        setPosConfigError(error?.message || "Unable to load POS config.");
      } finally {
        if (isMounted) {
          setIsPosConfigLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    posConfig,
    isPosConfigLoading,
    posConfigError,
  };
}
