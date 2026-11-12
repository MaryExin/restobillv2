/**
 * Every role (Cashier, Admin, Super Admin) gets the free date-range filter
 * on reports. Reports are no longer locked to the open shift's business
 * date. The return shape is kept so the report modals don't need changes:
 * with isDateLocked false they show their From/To date inputs.
 */
export default function useReportDateAccess() {
  return {
    isDateLocked: false,
    lockedDate: "",
    isShiftDateLoading: false,
  };
}
