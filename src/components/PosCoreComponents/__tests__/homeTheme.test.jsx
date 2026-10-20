import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../../../context/ThemeContext";
import PosHomeScreenComponent from "../PosHomeScreenComponent";

vi.mock("../../../hooks/useApiHost", () => ({ default: () => "http://pos.test" }));
vi.mock("../../../context/useZustandLoginCred", () => ({
  default: () => ({ userId: "42" }),
}));
vi.mock("../../../context/useZustandLayoutMode", () => ({
  default: () => ({ layoutMode: "Restaurant" }),
}));

const settings = {
  Light_Primary: "#1070d0",
  Light_Secondary: "#065ba8",
  Light_Background: "#fff8f0",
  Light_Surface: "#ffffff",
  Light_Text: "#1f2937",
  Dark_Primary: "#60a5fa",
  Dark_Secondary: "#3b82f6",
  Dark_Background: "#111827",
  Dark_Surface: "#1f2937",
  Dark_Text: "#f9fafb",
};

function ThemeScreen({ showHome }) {
  const { theme, toggleTheme } = useTheme();
  return <>
    <button onClick={toggleTheme}>Switch theme</button>
    <output aria-label="Active theme">{theme}</output>
    {showHome && <PosHomeScreenComponent />}
  </>;
}

function expectActiveColors(mode) {
  const root = document.documentElement;
  const prefix = mode === "dark" ? "Dark" : "Light";
  expect(root.getAttribute("data-theme")).toBe(mode);
  expect(root.style.colorScheme).toBe(mode);
  expect(document.body.getAttribute("data-theme")).toBe(mode);
  expect(root.style.getPropertyValue("--app-on-accent")).toBe(mode === "dark" ? "#0f172a" : "#ffffff");
  for (const [legacy, current, setting] of [
    ["darkerPrimary", "bg", "Background"],
    ["darkPrimary", "surface", "Surface"],
    ["lighter", "text", "Text"],
    ["brandPrimary", "accent", "Primary"],
    ["brandSecondary", "accent-secondary", "Secondary"],
  ]) {
    expect(root.style.getPropertyValue(`--color-${legacy}`)).toBe(settings[`${prefix}_${setting}`]);
    expect(root.style.getPropertyValue(`--app-${current}`)).toBe(settings[`${prefix}_${setting}`]);
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (String(url).endsWith("/api/theme_settings.php")) {
      return { json: async () => ({ success: true, data: settings }) };
    }
    if (String(url).includes("/api/get_shift_details.php")) {
      return { json: async () => ({ userName: "Test Cashier", Shift_Status: "Open" }) };
    }
    if (String(url).endsWith("/api/pos_version_label.php")) {
      return { json: async () => ({ data: {} }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete window.refreshShiftPanel;
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-theme");
  document.body.removeAttribute("style");
  document.body.removeAttribute("data-theme");
  document.body.classList.remove("theme-dark", "theme-light");
});

describe("POS Home theme ownership", () => {
  it.each(["light", "dark"])("preserves the active %s palette through Home visits and theme changes", async (initialMode) => {
    localStorage.setItem("app-theme-mode", initialMode);
    const view = (showHome) => <ThemeProvider><ThemeScreen showHome={showHome} /></ThemeProvider>;
    const { rerender } = render(view(false));
    await waitFor(() => expectActiveColors(initialMode));

    // Home mounts after the app theme is ready, as it does after login/navigation.
    rerender(view(true));
    await screen.findByText("Open");
    expect(localStorage.getItem("Cashier")).toBe("Test Cashier");
    expectActiveColors(initialMode);
    rerender(view(false));
    expectActiveColors(initialMode);

    rerender(view(true));
    await screen.findByText("Open");
    const nextMode = initialMode === "light" ? "dark" : "light";
    fireEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expectActiveColors(nextMode);
    expect(localStorage.getItem("app-theme-mode")).toBe(nextMode);
    fireEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expectActiveColors(initialMode);
    rerender(view(false));
    expectActiveColors(initialMode);
  });
});
