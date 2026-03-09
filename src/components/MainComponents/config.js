// config.js - helper to load config
export const loadConfig = async () => {
  const response = await fetch("/config.json");
  return await response.json();
};
