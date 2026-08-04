/**
 * Reads the logged-in user's classification (e.g. "cashier", "superadmin")
 * from localStorage ("user_classification"), set by PosLoginComponent /
 * SwitchUser from tbl_users_global_assignment.classification via login.php.
 *
 * Note: localStorage "user_role" holds a different, unrelated value (a
 * nested route-permission list used elsewhere) -- not the account
 * classification, so it can't be used to tell cashier from superadmin.
 */
export function getCurrentUserRole() {
  return (localStorage.getItem("user_classification") || "").trim().toLowerCase();
}
