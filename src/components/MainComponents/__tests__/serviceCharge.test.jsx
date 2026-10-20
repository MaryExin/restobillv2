import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PosServiceCharge from "../PosSettingsModal/PosServiceCharge";
import ModalDiscountTransaction from "../ModalDiscountTransaction";

vi.mock("../../../hooks/useApiHost", () => ({ default: () => "http://pos.test" }));
vi.mock("../../../hooks/useGetDefaultPrinter", () => ({ default: () => "Test printer" }));
vi.mock("../../../hooks/useBusinessInfo", () => ({
  default: () => ({ businessInfo: { business_name: "Test restaurant" }, isBusInfoLoading: false }),
}));
vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const motion = Object.fromEntries(["div", "button", "span", "p", "section", "aside"].map((tag) => [tag,
    ReactModule.forwardRef(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) =>
      ReactModule.createElement(tag, { ...props, ref }))]));
  return { motion, AnimatePresence: ({ children }) => children };
});

const LEGACY_BASIS = "net_after_deductions";
const RECEIPT_BASIS = "vat_exclusive_less_discount";
const receiptItems = [
  ["Iced Ube Latte", 175],
  ["Honey Garlic with Blue Cheese Dip", 535],
  ["Grumpy Joe Fried Chicken RM", 350],
  ["Fish Tempura RM", 345],
  ["Buffalo Wings RM", 355],
].map(([item_name, selling_price], index) => ({
  ID: index + 1,
  item_name,
  product_id: `TEST-${index + 1}`,
  selling_price,
  sales_quantity: 1,
  vatable: "Yes",
  isDiscountable: "Yes",
}));

const transaction = {
  transaction_id: "TEST-SERVICE-CHARGE",
  Category_Code: "TEST",
  Unit_Code: "TEST-BRANCH",
  customer_head_count: 4,
  order_type: "Dine In",
  cashier: "Test cashier",
};
const response = (data, ok = true) => Promise.resolve({ ok, json: async () => data });
const charge = { ID: 1, particulars: "SERVICE CHARGE", amount: 5, rate_type: "Percentage", is_enabled: 1 };

function mockApi({ basis = LEGACY_BASIS, enabled = true, charges = [], loadError = false, saveError = false } = {}) {
  let settings = { service_charge_enabled: enabled };
  if (basis !== null) settings.service_charge_basis = basis;
  const fetch = vi.fn((url, options = {}) => {
    const endpoint = new URL(url).pathname;
    if (endpoint === "/api/pos_service_charge.php") {
      if (options.method === "POST") {
        if (saveError) return response({ success: false, message: "Settings were not saved." }, false);
        settings = { ...settings, ...JSON.parse(options.body) };
        return response({ success: true, data: { ...settings } });
      }
      if (loadError) return Promise.reject(new Error("Settings unavailable."));
      return response({ success: true, data: { ...settings } });
    }
    if (endpoint === "/api/pos_manage_other_charges.php") return response({ success: true, charges });
    if (endpoint === "/api/transaction_discount_items.php") return response({
      success: true,
      items: receiptItems,
      transaction_summary: { customer_head_count: 4 },
      discount_counts: { senior: 1, pwd: 0, naac: 0, soloParent: 0, manual: 0 },
      discount_rows: [],
    });
    if (endpoint === "/api/pos_discount_types.php") return response({ success: true, data: { discount_types: [] } });
    if (endpoint === "/api/pos_discount_ceiling.php") return response({ success: true, data: { discount_ceiling: 0 } });
    if (endpoint === "/api/pos_discount_mode.php") return response({ success: true, data: { discount_mode: "PerCustomer" } });
    if (endpoint === "/api/pos_customer_info_settings.php") return response({ success: true, data: { customer_info_enabled: false } });
    if (endpoint === "/api/billing.php") return response({ status: "success", billing_no: "TEST-BILL" });
    if (endpoint === "/api/pos_save_transaction_charges.php") return response({ success: true });
    throw new Error(`Unexpected test API call: ${options.method || "GET"} ${endpoint}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function requestBody(fetch, endpoint) {
  const call = fetch.mock.calls.find(([url, options]) =>
    new URL(url).pathname === `/api/${endpoint}` && options?.method === "POST");
  expect(call, `POST /api/${endpoint}`).toBeTruthy();
  return JSON.parse(call[1].body);
}

const summaryRow = (name) => screen.getByText(name, { exact: true }).parentElement;
const chargeRow = () => screen.getByText("SERVICE CHARGE (5%)").parentElement.parentElement;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  window.electronAPI = {
    getPrinters: vi.fn().mockResolvedValue([{ name: "Test printer", isDefault: true }]),
    printEscposDiscount: vi.fn().mockResolvedValue({ success: true }),
  };
  vi.stubGlobal("alert", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.electronAPI;
});

describe("Settings > Service Charge calculation basis", () => {
  it.each([null, "unknown-mode"])("keeps the current calculation for missing or unrecognized settings (%s)", async (basis) => {
    mockApi({ basis });
    render(<PosServiceCharge isDark={false} />);
    const select = screen.getByRole("combobox", { name: "Calculation basis" });
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(select.value).toBe(LEGACY_BASIS);
    expect(screen.getByRole("button", { name: "Save service charge settings" }).disabled).toBe(true);
  });

  it("saves a changed basis with the existing master switch and loads it on reopening", async () => {
    const fetch = mockApi({ basis: LEGACY_BASIS, enabled: true });
    localStorage.setItem("access_token", "test-token");
    const view = render(<PosServiceCharge isDark />);
    const select = screen.getByRole("combobox", { name: "Calculation basis" });
    const save = screen.getByRole("button", { name: "Save service charge settings" });
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(save.disabled).toBe(true);
    fireEvent.change(select, { target: { value: RECEIPT_BASIS } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await screen.findByText("Service charge settings saved.");
    expect(save.disabled).toBe(true);
    expect(requestBody(fetch, "pos_service_charge.php")).toMatchObject({
      service_charge_enabled: true,
      service_charge_basis: RECEIPT_BASIS,
    });
    const saveCall = fetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(saveCall[1].headers.Authorization).toBe("Bearer test-token");
    view.unmount();
    render(<PosServiceCharge isDark={false} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Calculation basis" }).value).toBe(RECEIPT_BASIS));
    expect(screen.getByRole("button", { name: "Save service charge settings" }).disabled).toBe(true);
  });

  it("retains the selected basis when saving the master switch", async () => {
    const fetch = mockApi({ basis: RECEIPT_BASIS, enabled: true });
    render(<PosServiceCharge isDark={false} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Calculation basis" }).value).toBe(RECEIPT_BASIS));
    fireEvent.click(screen.getByRole("button", { name: "Enabled", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save service charge settings" }));
    await screen.findByText("Service charge settings saved.");
    expect(requestBody(fetch, "pos_service_charge.php")).toMatchObject({
      service_charge_enabled: false, service_charge_basis: RECEIPT_BASIS,
    });
  });

  it("keeps unsaved changes available for retry when saving fails", async () => {
    mockApi({ saveError: true });
    render(<PosServiceCharge isDark={false} />);
    const select = screen.getByRole("combobox", { name: "Calculation basis" });
    await waitFor(() => expect(select.disabled).toBe(false));
    fireEvent.change(select, { target: { value: RECEIPT_BASIS } });
    fireEvent.click(screen.getByRole("button", { name: "Save service charge settings" }));
    await screen.findByText("Settings were not saved.");
    expect(select.value).toBe(RECEIPT_BASIS);
    expect(screen.getByRole("button", { name: "Save service charge settings" }).disabled).toBe(false);
  });

  it("shows a load failure and retains the default calculation", async () => {
    mockApi({ loadError: true });
    render(<PosServiceCharge isDark={false} />);
    await screen.findByText("Settings unavailable.");
    expect(screen.getByRole("combobox", { name: "Calculation basis" }).value).toBe(LEGACY_BASIS);
    expect(screen.getByRole("button", { name: "Save service charge settings" }).disabled).toBe(true);
  });
});

describe("Billing calculation and saved charges", () => {
  it.each([
    [RECEIPT_BASIS, 74.64, 1708.93],
    [LEGACY_BASIS, 72.96, 1707.25],
    [null, 72.96, 1707.25],
  ])("uses %s consistently in the summary, billing, printer and charge rows", async (basis, serviceAmount, amountDue) => {
    const fetch = mockApi({ basis, charges: [charge] });
    render(<ModalDiscountTransaction isOpen onClose={vi.fn()} transaction={transaction}
      dateFrom="2026-10-20" apiHost="http://pos.test" isDark={false} />);
    await waitFor(() => expect(summaryRow("Total Discount").textContent).toContain("78.57"));
    expect(summaryRow("Total VAT Exemption").textContent).toContain("47.14");
    await waitFor(() => expect(within(chargeRow()).getByRole("button", { name: "OFF" })).toBeTruthy());
    expect(summaryRow("Amount Due").textContent).toContain("1,634.29");
    fireEvent.click(within(chargeRow()).getByRole("button", { name: "OFF" }));
    expect(chargeRow().textContent).toContain(serviceAmount.toFixed(2));
    expect(summaryRow("Amount Due").textContent).toContain(amountDue.toLocaleString("en-PH", { minimumFractionDigits: 2 }));
    fireEvent.click(screen.getByRole("button", { name: "Print Billing" }));
    await waitFor(() => expect(window.electronAPI.printEscposDiscount).toHaveBeenCalledOnce());
    const billing = requestBody(fetch, "billing.php");
    expect(billing).toMatchObject({
      TotalSales: 1760, Discount: 78.57, VATExemptSales_VAT: 47.14,
      OtherCharges: serviceAmount,
    });
    expect(billing.TotalAmountDue).toBeCloseTo(amountDue, 2);
    expect(billing.discount_breakdown).toEqual([expect.objectContaining({
      key: "senior", qualified_count: 1, discount_amount: 78.57, vat_exemption: 47.14,
    })]);
    const { computed, dateFrom } = window.electronAPI.printEscposDiscount.mock.calls[0][0];
    expect(dateFrom).toBe("2026-10-20");
    expect(computed.totalOtherCharges).toBe(serviceAmount);
    expect(computed.totalAmountDue).toBeCloseTo(amountDue, 2);
    expect(computed.appliedCharges).toEqual([expect.objectContaining({
      id: 1, particulars: "SERVICE CHARGE", computedAmount: serviceAmount,
    })]);
    await waitFor(() => expect(requestBody(fetch, "pos_save_transaction_charges.php")).toEqual({
      transaction_id: transaction.transaction_id,
      Category_Code: "TEST", Unit_Code: "TEST-BRANCH",
      charges: [{ particulars: "SERVICE CHARGE", amount: serviceAmount }],
    }));
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("keeps fixed charges independent of the selected calculation basis", async () => {
    const fixed = { ...charge, particulars: "Fixed packaging", amount: 20, rate_type: "Fixed" };
    mockApi({ basis: RECEIPT_BASIS, charges: [fixed] });
    render(<ModalDiscountTransaction isOpen onClose={vi.fn()} transaction={transaction}
      dateFrom="2026-10-20" apiHost="http://pos.test" isDark />);
    await waitFor(() => expect(summaryRow("Total Discount").textContent).toContain("78.57"));
    const row = screen.getByText("Fixed packaging").parentElement.parentElement;
    fireEvent.click(within(row).getByRole("button", { name: "OFF" }));
    expect(row.textContent).toContain("20.00");
    expect(summaryRow("Amount Due").textContent).toContain("1,654.29");
  });
});
