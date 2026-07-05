import create from "zustand";

const STORAGE_KEY = "pos-layout-mode";
const VALID_MODES = ["Restaurant", "Kiosk", "Restaurant Version 2"];

const modeToContext = (mode) => {
  if (mode === "Kiosk") return "kiosk";
  if (mode === "Restaurant Version 2") return "resto_v2";
  return "resto";
};
const contextToMode = (context) => {
  const normalized = String(context || "").trim().toLowerCase();
  if (normalized === "kiosk") return "Kiosk";
  if (normalized === "resto" || normalized === "restaurant") return "Restaurant";
  if (normalized === "resto_v2" || normalized === "restaurant_v2" || normalized === "restaurant version 2") return "Restaurant Version 2";
  return "";
};

const broadcastLayoutModeChanged = (mode) => {
  const token = String(new Date().getTime());
  window.dispatchEvent(
    new CustomEvent("pos-layout-mode-changed", {
      detail: { mode, layout_context: modeToContext(mode), token },
    }),
  );
  localStorage.setItem("pos-layout-mode-bust", token);

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("pos-second-screen");
    channel.postMessage({
      type: "layout-mode-changed",
      mode,
      layout_context: modeToContext(mode),
      token,
    });
    channel.close();
  }
};

const useZustandLayoutMode = create((set, get) => ({
  layoutMode: localStorage.getItem(STORAGE_KEY) || "Restaurant",
  isLoaded: false,
  _apiHost: null,

  initLayoutMode: async (apiHost) => {
    if (!apiHost || get().isLoaded) return;
    set({ _apiHost: apiHost });
    try {
      const res = await fetch(`${apiHost}/pos_layout_mode.php`, { cache: "no-store" });
      if (!res.ok) { set({ isLoaded: true }); return; }
      const json = await res.json();
      const mode =
        json?.data?.layout_mode ||
        contextToMode(json?.data?.layout_context || json?.data?.value);
      if (VALID_MODES.includes(mode)) {
        localStorage.setItem(STORAGE_KEY, mode);
        set({ layoutMode: mode, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setLayoutMode: (mode) => {
    if (!VALID_MODES.includes(mode)) return;
    localStorage.setItem(STORAGE_KEY, mode);
    set({ layoutMode: mode });
    broadcastLayoutModeChanged(mode);
    const apiHost = get()._apiHost;
    if (apiHost) {
      fetch(`${apiHost}/pos_layout_mode.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout_context: modeToContext(mode),
          layout_mode: mode,
        }),
      }).catch(() => {});
    }
  },
}));

export default useZustandLayoutMode;
