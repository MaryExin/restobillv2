export const posAuthenticatedFetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("access_token") || "";
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};
