import { useMemo } from "react";
import useZustandLoginCred from "../context/useZustandLoginCred";
import useCustomQuery from "./useCustomQuery";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

/**
 * Hook to fetch bus units and filter them by roles.
 * Returns only the bus-unit OBJECTS whose codes match user roles.
 */
export function useBusunitsFromRoles() {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const {
    data: busunitsData = [],
    isLoading: isLoadingBusunits,
    isError: isErrorBusunits,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
    "busunits"
  );

  const { roles = [] } = useZustandLoginCred();

  const filteredBusunits = useMemo(() => {
    // Flatten nested roles if necessary
    const flatRoles = Array.isArray(roles[0]) ? roles.flat() : roles;
    const roleSet = new Set(flatRoles.map((r) => r.rolename));
    return busunitsData.filter((bu) => roleSet.has(bu.busunitcode));
  }, [busunitsData, roles]);

  return {
    data: filteredBusunits,
    isLoading: isLoadingBusunits,
    isError: isErrorBusunits,
  };
}

/**
 * Hook to fetch BUSUNITS CODE and return only matching role names.
 */
export function useBusunitRoleNames() {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const {
    data: busunitsData = [],
    isLoading: isLoadingBusunits,
    isError: isErrorBusunits,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
    "busunits"
  );

  const { roles = [] } = useZustandLoginCred();

  const roleNames = useMemo(() => {
    const flatRoles = Array.isArray(roles[0]) ? roles.flat() : roles;
    const busunitCodes = new Set(busunitsData.map((bu) => bu.busunitcode));
    return flatRoles
      .map((r) => r.rolename)
      .filter((name) => busunitCodes.has(name));
  }, [busunitsData, roles]);

  return {
    data: roleNames,
    isLoading: isLoadingBusunits,
    isError: isErrorBusunits,
  };
}
