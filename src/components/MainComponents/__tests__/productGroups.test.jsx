import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductGroupPicker from "../ProductGroupPicker";
import Orderlist from "../Orderlist";
import { createGroupCartItem, groupChoiceProduct, serializeOrderCartItems } from "../../../utils/productGroups";

const products = [
  { product_id: "A", selling_price: 400, group_size: "Large", group_variant: "Hawaiian" },
  { product_id: "B", selling_price: 500, group_size: "Large", group_variant: "Pepperoni" },
  { product_id: "C", selling_price: null, group_size: "Large", group_variant: "Missing price" },
  { product_id: "D", selling_price: 200, group_size: "Small", group_variant: "Hawaiian" },
].map((product) => groupChoiceProduct({ ...product, vatable: "Yes", unit_of_measure: "PC",
  product_group: { name: "Family choices", enabled: true, allow_half: true, allow_half_and_half: true } }));
afterEach(cleanup);

const observed = vi.hoisted(() => ({ panel: null, navigate: vi.fn(), fetch: vi.fn(), saved: null, details: [], mode: "Kiosk", sizes: false, aliases: false }));
vi.mock("../../../hooks/useApiHost", () => ({ default: () => "http://pos.test" }));
vi.mock("../../../hooks/useGetDefaultPrinter", () => ({ default: () => "" }));
vi.mock("../../../hooks/useBusinessInfo", () => ({ default: () => ({ businessInfo: {} }) }));
vi.mock("../../../hooks/useBillingEnabled", () => ({ default: () => false }));
vi.mock("../../../context/useZustandLayoutMode", () => ({ default: () => ({ layoutMode: observed.mode }) }));
vi.mock("../../../context/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => observed.navigate }));
vi.mock("../KioskRightPanel", () => ({ default: (props) => { observed.panel = props; return null; } }));
vi.mock("../ModalDiscountTransaction", () => ({ default: () => null }));
vi.mock("qrcode.react", () => ({ default: () => null }));
vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const motion = Object.fromEntries(["div", "button", "span", "p", "section", "aside"].map((tag) => [tag,
    ReactModule.forwardRef(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => ReactModule.createElement(tag, { ...props, ref }))]));
  return { motion, AnimatePresence: ({ children }) => children };
});

describe("actual POS product group picker", () => {
  it("shows size, portion and flavor together while requiring an explicit choice for each", () => {
    const onAdd = vi.fn();
    const sized = [12, 16, 9].map((size) => ({ ...products[0], group_size: `${size} inch`,
      group_size_id: `PGS-A${size}`, group_recipe_configured: true, srp: size * 25 }));
    render(<ProductGroupPicker products={sized} onClose={vi.fn()} onAdd={onAdd} />);
    expect(screen.getByRole("heading", { name: "1. Choose a size" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2. Whole or half?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3. Choose your flavor" })).toBeTruthy();
    const sizeChoices = within(screen.getByRole("group", { name: "Size" })).getAllByRole("button");
    expect(sizeChoices.map((button) => button.getAttribute("aria-label"))).toEqual(["9 inch", "12 inch", "16 inch"]);
    expect(sizeChoices.every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("button", { name: "Whole item" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Half item" }).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: /Hawaiian/ }).every((button) => button.disabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "12 inch" }));
    expect(screen.getByRole("button", { name: "Whole item" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Half item" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: /Hawaiian/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Half item" }));
    expect(screen.queryByRole("button", { name: /Two flavors/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Hawaiian ₱150.00 half" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Hawaiian/ }));
    expect(screen.getByText("₱150.00 each")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
    const item = createGroupCartItem({ ...onAdd.mock.calls[0][0], selectionId: "selection-sized", lineId: "line-sized", pricingCategory: "DINING" });
    expect(serializeOrderCartItems([item])[0]).toMatchObject({ product_id: "A", selling_price: 150,
      group_selection: { schema_version: 2, size: "12 inch", portion: "half", variant_options: [{ product_id: "A", size_id: "PGS-A12" }] } });
  });

  it("prices each whole flavor for the selected size and requires a flavor choice", () => {
    const onAdd = vi.fn();
    render(<ProductGroupPicker products={products} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    expect(screen.getByRole("button", { name: "Hawaiian ₱400.00 whole" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pepperoni ₱500.00 whole" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Missing price/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Pepperoni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ products: [{ build_code: "B", srp: 500 }], portion: "whole", count: 1 });
  });

  it("offers two flavors only within a whole item and sends their averaged price", () => {
    const onAdd = vi.fn();
    render(<ProductGroupPicker products={products} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(screen.queryByRole("button", { name: /Two flavors/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    const first = within(screen.getByRole("group", { name: "First half flavor / variant" }));
    const second = within(screen.getByRole("group", { name: "Second half flavor / variant" }));
    fireEvent.click(first.getByRole("button", { name: "Hawaiian ₱200.00 half" }));
    expect(second.getByRole("button", { name: /Hawaiian/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    fireEvent.click(second.getByRole("button", { name: "Pepperoni ₱250.00 half" }));
    expect(screen.getByText("₱450.00 each")).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
    expect(screen.getByText("₱900.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
    const cart = createGroupCartItem({ ...onAdd.mock.calls[0][0], selectionId: "selection-123", lineId: "line-1", pricingCategory: "DINE-IN" });
    expect(serializeOrderCartItems([cart])[0]).toMatchObject({ product_id: "A", sales_quantity: 2, selling_price: 450,
      group_selection: { variants: ["A", "B"], portion: "half_and_half", unit_count: 2, pricing_category: "DINE-IN" } });
  });

  it("keeps selections visible and clears dependent flavors when changing portion or size directly", () => {
    const onClose = vi.fn();
    render(<ProductGroupPicker products={products} onClose={onClose} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Hawaiian/ }));
    expect(screen.getByText("₱400.00 each")).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Order summary" });
    expect(summary.textContent).toContain("Large");
    expect(summary.textContent).toContain("Whole");
    expect(summary.textContent).toContain("Hawaiian");
    fireEvent.click(screen.getByRole("button", { name: "Half item" }));
    expect(screen.getByRole("button", { name: /Hawaiian/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Hawaiian/ }));
    expect(screen.getByText("₱200.00 each")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    expect(screen.getByRole("button", { name: "Half item" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Hawaiian/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    expect(screen.getByRole("button", { name: "Hawaiian ₱200.00 whole" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("retains a completed choice when the selected size, portion or flavor mode is clicked again", () => {
    render(<ProductGroupPicker products={products} onClose={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: /Hawaiian/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "Second half flavor / variant" })).getByRole("button", { name: /Pepperoni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(false);
    expect(screen.getByText("₱450.00 each")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: /Hawaiian/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("group", { name: "Second half flavor / variant" })).getByRole("button", { name: /Pepperoni/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("blocks mixed flavors with incompatible units and allows a matching replacement", () => {
    const onAdd = vi.fn();
    const choices = [products[0], { ...products[1], unit_of_measure: "BOX" },
      { ...products[1], product_id: "E", build_code: "E", group_variant: "Cheese", unit_of_measure: "PC" }];
    render(<ProductGroupPicker products={choices} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: /Hawaiian/ }));
    const second = within(screen.getByRole("group", { name: "Second half flavor / variant" }));
    fireEvent.click(second.getByRole("button", { name: /Pepperoni/ }));
    expect(screen.getByRole("alert").textContent).toContain("different units of measure");
    const add = screen.getByRole("button", { name: "Add item to cart" });
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(second.getByRole("button", { name: /Cheese/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ portion: "half_and_half", products: [
      expect.objectContaining({ build_code: "A", unit_of_measure: "PC" }),
      expect.objectContaining({ build_code: "E", unit_of_measure: "PC" }),
    ] }));
  });

  it("validates quantity before adding and updates the price with its quantity controls", () => {
    const onAdd = vi.fn();
    render(<ProductGroupPicker products={products} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Hawaiian/ }));
    const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
    const add = screen.getByRole("button", { name: "Add item to cart" });
    for (const value of ["", "0", "-1", "1.5", "10001"]) {
      fireEvent.change(quantity, { target: { value } });
      expect(add.disabled).toBe(true);
      fireEvent.click(add);
    }
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(quantity, { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Decrease quantity" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(quantity.value).toBe("2");
    expect(screen.getByText("₱800.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(quantity.value).toBe("1");
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  it("contains keyboard focus and restores page scrolling and opener focus when closed", () => {
    const opener = document.createElement("button");
    const initialOverflow = document.body.style.overflow;
    document.body.append(opener);
    document.body.style.overflow = "scroll";
    opener.focus();
    const onClose = vi.fn();
    const view = render(<ProductGroupPicker products={products} onClose={onClose} onAdd={vi.fn()} />);
    try {
      const dialog = screen.getByRole("dialog", { name: "Customize Family choices" });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");
      const controls = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
      controls.at(-1).focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(document.activeElement).toBe(controls[0]);
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(controls.at(-1));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
      view.unmount();
      expect(document.body.style.overflow).toBe("scroll");
      expect(document.activeElement).toBe(opener);
    } finally {
      view.unmount();
      opener.remove();
      document.body.style.overflow = initialOverflow;
    }
  });

  it("keeps displayed half prices equal to the combined total for odd-cent whole prices", () => {
    render(<ProductGroupPicker products={[{ ...products[0], srp: 4.27 }, { ...products[1], srp: 3.27 }]} onClose={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: "Hawaiian ₱2.14 half" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Second half flavor / variant" })).getByRole("button", { name: "Pepperoni ₱1.63 half" }));
    expect(screen.getByText("₱3.77 each")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "One flavor" }));
    expect(screen.getByRole("button", { name: "Add item to cart" }).disabled).toBe(true);
    expect(screen.queryByRole("group", { name: "Second half flavor / variant" })).toBeNull();
  });
});

describe("actual /ordering cart integration", () => {
  const catalog = products.filter((p) => p.build_code !== "C").map((p) => ({ ...p, item_category: "MEALS", sku: p.product_id, item_name: p.group_variant }));
  beforeEach(() => {
    observed.panel = null; observed.saved = null; observed.details = []; observed.mode = "Kiosk"; observed.sizes = false; observed.aliases = false;
    localStorage.setItem("posBusinessUnitCode", "BU-1");
    localStorage.setItem("posBusinessCategoryCode", "CAT-1");
    vi.stubGlobal("alert", vi.fn());
    observed.fetch.mockImplementation(async (url, options) => {
      let body = {};
      if (url.endsWith("/new_transactions.php")) body = { status: "success", business_info: { Category_Code: "CAT-1", Unit_Code: "BU-1" },
        sales_types: [{ sales_type_id: "DINE-IN", sales_type: "DINE IN" }, { sales_type_id: "TAKEOUT", sales_type: "TAKE OUT" }], item_categories: [{ item_category: "MEALS" }] };
      else if (url.endsWith("/get_pricing_selection.php")) {
        const takeout = JSON.parse(options.body).sales_type === "TAKE OUT";
        const list = takeout ? catalog.map((p) => ({ ...p, selling_price: p.selling_price + 100 })) : catalog;
        const sizeList = catalog.filter((p) => ["A", "B"].includes(p.product_id)).flatMap((p) =>
          (p.product_id === "A" ? [9, 12, 16] : [12]).map((size) => ({ ...p, group_size: `${size} inch`,
            group_size_id: `PGS-${p.product_id}${size}`, group_recipe_configured: true,
            selling_price: (p.product_id === "A" ? { 9: 200, 12: 400, 16: 600 }[size] : 500) + (takeout ? 100 : 0) })));
        body = { status: "success", pricing_category: takeout ? "TAKEOUT" : "DINING", sales_type_id: takeout ? "TAKEOUT" : "DINE-IN",
          products: observed.aliases ? [...list, { product_id: "OLD-A12-HALF", sku: "OLD-A12-HALF", item_name: "Old Hawaiian half", item_category: "MEALS", selling_price: 200,
            group_alias: { canonical_build_code: "A", size_id: observed.sizes ? "PGS-A12" : "", enabled: true } }] : observed.sizes ? [] : list, group_products: observed.sizes ? sizeList : list };
      }
      else if (url.includes("/view_table_transaction.php")) body = { summary: { order_type: "DINE IN" }, order_details: observed.details };
      else if (url.endsWith("/save_order.php") || url.endsWith("/update_order.php")) {
        observed.saved = { items: JSON.parse(options.body.get("cart_items")), pricing: options.body.get("pricing_category"), salesType: options.body.get("sales_type_id") };
        body = { status: "success", transaction_id: "TX-1" };
      }
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", observed.fetch);
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  const chooseMixed = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Family choices.*Choose size/ }));
    expect(screen.getByRole("group", { name: "Portion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Whole item" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: /Hawaiian/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "Second half flavor / variant" })).getByRole("button", { name: /Pepperoni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
  };

  it("shows a sized product without a legacy base price and saves the chosen size for both real variants", async () => {
    observed.sizes = true;
    render(<Orderlist tableselected="Table 1" dateSelected="2026-10-19" setshoworderlist={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Family choices.*Choose size/ }));
    fireEvent.click(screen.getByRole("button", { name: "12 inch" }));
    fireEvent.click(screen.getByRole("button", { name: "Whole item" }));
    fireEvent.click(screen.getByRole("button", { name: /Two flavors/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "First half flavor / variant" })).getByRole("button", { name: /Hawaiian/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "Second half flavor / variant" })).getByRole("button", { name: /Pepperoni/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
    expect(observed.panel.cartItems).toHaveLength(1);
    expect(observed.panel.totalPrice).toBe(450);
    await act(async () => observed.panel.onCharge());
    await waitFor(() => expect(observed.saved).not.toBeNull());
    expect(observed.saved.items[0]).toMatchObject({ product_id: "A", sales_quantity: 1, selling_price: 450,
      group_selection: { schema_version: 2, size: "12 inch", variants: ["A", "B"],
        variant_options: [{ product_id: "A", size_id: "PGS-A12" }, { product_id: "B", size_id: "PGS-B12" }] } });
  });

  it("adds one combined line, edits its quantity and saves selection metadata through the real save handler", async () => {
    render(<Orderlist tableselected="Table 1" dateSelected="2026-10-19" setshoworderlist={vi.fn()} />);
    await chooseMixed();
    expect(observed.panel.cartItems).toHaveLength(1);
    expect(observed.panel.totalPrice).toBe(450);
    const id = observed.panel.cartItems[0].lineId;
    act(() => observed.panel.updateQuantity(id, 1));
    expect(observed.panel.totalPrice).toBe(900);
    act(() => observed.panel.updateQuantityByInput(id, "3"));
    expect(observed.panel.cartItems[0].group_selection.unit_count).toBe(3);
    await act(async () => observed.panel.onCharge());
    expect(observed.saved).toMatchObject({ pricing: "DINING", salesType: "DINE-IN", items: [{ sales_quantity: 3, selling_price: 450,
      group_selection: { variants: ["A", "B"], unit_count: 3 } }] });
  });

  it("scanning opens the picker and saved physical halves recall as one editable group", async () => {
    const selection = createGroupCartItem({ products: products.slice(0, 2), portion: "half_and_half", count: 1,
      selectionId: "saved-selection", lineId: "saved", pricingCategory: "DINING" }).group_selection;
    observed.details = products.slice(0, 2).map((p, i) => ({ ID: i + 1, product_id: p.product_id, item_name: p.group_variant,
      selling_price: p.srp, sales_quantity: .5, vatable: "Yes", group_selection: { ...selection, part_index: i } }));
    const element = <Orderlist transactionId="TX-OLD" tableselected="Table 1" dateSelected="2026-10-19" setshoworderlist={vi.fn()} />;
    const view = render(element);
    await waitFor(() => expect(observed.panel?.cartItems).toHaveLength(1));
    expect(observed.panel.cartItems[0].quantity).toBe(1);
    expect(observed.panel.cartItems[0].price).toBe(450);
    observed.mode = "Restaurant Version 2";
    view.rerender(React.cloneElement(element));
    const input = screen.getByPlaceholderText("Scan Item Barcode or Type SKU...");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Customize Family choices" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1. Choose a size" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Portion" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Size" })).getAllByRole("button", { pressed: false })).toHaveLength(2);
    expect(observed.panel.cartItems).toHaveLength(1);
  });

  it("hides a ready duplicate from the menu and redirects its barcode without altering a recalled original line", async () => {
    observed.aliases = true;
    observed.sizes = true;
    observed.details = [{ ID: 20, product_id: "OLD-A12-HALF", item_name: "Old Hawaiian half", selling_price: 200, sales_quantity: 1, vatable: "Yes" }];
    const element = <Orderlist transactionId="TX-OLD" tableselected="Table 1" dateSelected="2026-10-19" setshoworderlist={vi.fn()} />;
    const view = render(element);
    await screen.findByRole("button", { name: /Family choices.*Choose size/ });
    await waitFor(() => expect(observed.panel?.cartItems).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /Old Hawaiian half/ })).toBeNull();
    expect(observed.panel.cartItems[0]).toMatchObject({ code: "OLD-A12-HALF", quantity: 1, price: 200 });
    observed.mode = "Restaurant Version 2";
    view.rerender(React.cloneElement(element));
    const input = screen.getByPlaceholderText("Scan Item Barcode or Type SKU...");
    fireEvent.change(input, { target: { value: "OLD-A12-HALF" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Customize Family choices" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1. Choose a size" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "12 inch" }));
    fireEvent.click(screen.getByRole("button", { name: "Half item" }));
    expect(screen.getByRole("button", { name: /Hawaiian/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Hawaiian/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add item to cart" }));
    observed.mode = "Kiosk";
    await act(async () => view.rerender(React.cloneElement(element)));
    expect(observed.panel.cartItems).toHaveLength(2);
    expect(observed.panel.cartItems[0]).toMatchObject({ code: "OLD-A12-HALF", quantity: 1, price: 200 });
    expect(observed.panel.cartItems[1]).toMatchObject({ code: "A", group_selection: { portion: "half", variants: ["A"] } });
  });

  it("preserves the saved group price on recall and reprices all variants when service type is explicitly changed", async () => {
    const selection = createGroupCartItem({ products: products.slice(0, 2), portion: "half_and_half", count: 1,
      selectionId: "saved-price-selection", lineId: "saved", pricingCategory: "DINING" }).group_selection;
    observed.details = products.slice(0, 2).map((p, i) => ({ ID: i + 1, product_id: p.product_id, item_name: p.group_variant,
      selling_price: p.srp, sales_quantity: .5, vatable: "Yes", group_selection: { ...selection, part_index: i } }));
    const element = <Orderlist transactionId="TX-OLD" tableselected="Table 1" dateSelected="2026-10-19" setshoworderlist={vi.fn()} />;
    const view = render(element);
    await waitFor(() => expect(observed.panel?.cartItems).toHaveLength(1));
    expect(observed.panel.cartItems[0].price).toBe(450);
    observed.mode = "Restaurant";
    view.rerender(React.cloneElement(element));
    const serviceType = screen.getAllByRole("combobox").find((select) => select.value === "DINE-IN");
    fireEvent.change(serviceType, { target: { value: "TAKEOUT" } });
    await screen.findByText("₱550 each");
    observed.mode = "Kiosk";
    view.rerender(React.cloneElement(element));
    expect(observed.panel.cartItems[0]).toMatchObject({ price: 550, isLoadedFromDB: true,
      group_selection: { selection_id: "saved-price-selection", pricing_category: "TAKEOUT" } });
  });
});
