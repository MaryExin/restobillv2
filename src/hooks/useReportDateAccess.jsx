import { useEffect, useState } from "react";
import useApiHost from "./useApiHost";
import useZustandLoginCred from "../context/useZustandLoginCred";
import { hasPosSuperAdminAccess } from "../utils/posRoleAccess";

const todayDate = () => new Date().toISOString().split("T")[0];

/**
 * Admin and Cashier accounts must only see report data for the currently
 * open shift's business date -- they cannot browse an arbitrary date range.
 * Super Admin (and a Developer session, via hasPosSuperAdminAccess) keeps
 * the free date-range filter.
 */
export default function useReportDateAccess() {
  const apiHost = useApiHost();
  const { roles } = useZustandLoginCred();
  const isSuperAdmin = hasPosSuperAdminAccess(roles);

  const [shiftDate, setShiftDate] = useState("");
  const [isShiftDateLoading, setIsShiftDateLoading] = useState(!isSuperAdmin);

  useEffect(() => {
    if (isSuperAdmin) {
      setIsShiftDateLoading(false);
      return undefined;
    }
    if (!apiHost) return undefined;

    let isMounted = true;
    setIsShiftDateLoading(true);

    fetch(`${apiHost}/api/get_open_shift_date.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Category_Code: localStorage.getItem("posBusinessCategoryCode") || "",
        Unit_Code: localStorage.getItem("posBusinessUnitCode") || "",
        terminal_number: localStorage.getItem("posTerminalNumber") || "",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setShiftDate(data?.selectedDate || data?.shiftDate || todayDate());
      })
      .catch(() => {
        if (!isMounted) return;
        setShiftDate(todayDate());
      })
      .finally(() => {
        if (isMounted) setIsShiftDateLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiHost, isSuperAdmin]);

  return {
    isDateLocked: !isSuperAdmin,
    lockedDate: shiftDate,
    isShiftDateLoading,
  };
}
