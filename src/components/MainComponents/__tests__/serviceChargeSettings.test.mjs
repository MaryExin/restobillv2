import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as serviceChargeMath from "../../../utils/serviceChargeMath.js";

// Exercise the real settings component's hooks, native controls and requests.
// Only the API boundary is replaced; no real settings or credentials are used.
const source = fs.readFileSync(new URL("../PosSettingsModal/PosServiceCharge.jsx", import.meta.url), "utf8");
const compiled = transformSync(source.replaceAll("import.meta.env", "TEST_ENV"), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;
const clone = value => JSON.parse(JSON.stringify(value));
const salesTypes = [
  { sales_type_id: "ST-DINE", description: "DINE IN" },
  { sales_type_id: "ST-TAKE", description: "TAKE OUT" },
];
const serviceCharge = {
  ID: 7, category: "POS", particulars: "SERVICE CHARGE", amount: 5,
  rate_type: "Percentage", is_enabled: 1,
  auto_sales_type_ids: [], auto_sales_types: [],
};

function mockApi({ charges = [serviceCharge], failSave = false } = {}) {
  const state = { charges: clone(charges), failSave, calls: [], settings: {
    service_charge_enabled: true,
    service_charge_basis: serviceChargeMath.DEFAULT_SERVICE_CHARGE_BASIS,
  } };
  const response = (data, ok = true) => ({ ok, json: async () => clone(data) });
  const mappingFields = ids => ({
    auto_sales_type_ids: ids,
    auto_sales_types: salesTypes.filter(type => ids.includes(type.sales_type_id)).map(type => type.description),
  });
  state.fetch = async (url, options = {}) => {
    const endpoint = new URL(url).pathname;
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ endpoint, method, body, headers: options.headers });
    if (endpoint === "/api/pos_service_charge.php") {
      if (method === "POST") state.settings = { ...state.settings, ...body };
      return response({ success: true, data: state.settings });
    }
    assert.equal(endpoint, "/api/pos_manage_other_charges.php", "only expected service settings APIs are used");
    if (method !== "GET" && state.failSave) {
      return response({ success: false, message: "Assignments could not be saved." }, false);
    }
    if (method === "POST") {
      state.charges.push({ ID: 8, category: "POS", is_enabled: 0, ...body,
        ...mappingFields(body.auto_sales_type_ids || []) });
    } else if (method === "PUT") {
      state.charges = state.charges.map(charge => {
        if (charge.ID !== Number(body.id)) return charge;
        const { id, ...updates } = body;
        return { ...charge, ...updates, ...(Object.hasOwn(body, "auto_sales_type_ids")
          ? mappingFields(body.auto_sales_type_ids) : {}) };
      });
    } else if (method === "DELETE") {
      state.charges = state.charges.filter(charge => charge.ID !== Number(body.id));
    }
    return response({ success: true, charges: state.charges, sales_types: salesTypes });
  };
  return state;
}

function harness(api = mockApi()) {
  const slots = [];
  let cursor = 0, dirty = false, effects = [], tree;
  const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const localStorage = { getItem: key => key === "access_token" ? "test-access-token" : "" };
  const modules = {
    react: hooks,
    "../../../hooks/useApiHost": () => "http://pos.test",
    "../../../utils/serviceChargeMath": serviceChargeMath,
  };
  const context = {
    exports: {}, console, React, localStorage, window: { localStorage }, fetch: api.fetch,
    TEST_ENV: {
      VITE_POS_SERVICE_CHARGE_ENDPOINT: "/api/pos_service_charge.php",
      VITE_POS_MANAGE_OTHER_CHARGES_ENDPOINT: "/api/pos_manage_other_charges.php",
    },
    require(name) {
      if (name.startsWith("react-icons/")) return new Proxy({}, { get: (_, icon) => icon });
      assert(name in modules, `Unexpected settings import ${name}`);
      return modules[name];
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context, { filename: "PosServiceCharge.jsx" });
  const component = context.module.exports.default;
  return {
    api,
    get tree() { return tree; },
    async render() {
      for (let pass = 0; pass < 25; pass++) {
        cursor = 0; dirty = false; effects = [];
        tree = component({ isDark: false });
        effects.forEach(effect => effect());
        for (let tick = 0; tick < 30; tick++) await Promise.resolve();
        if (!dirty) return tree;
      }
      assert.fail("Settings effects did not settle");
    },
    async choose(chargeName, description, checked) {
      const picker = fieldset(tree, chargeName);
      const label = all(picker, node => node.type === "label" && text(node).trim() === description)[0];
      assert(label, `${description} has a checkbox label`);
      const input = all(label, node => node.type === "input" && node.props.type === "checkbox")[0];
      assert(input, `${description} checkbox exists`);
      assert(!input.props.disabled, `${description} checkbox is editable`);
      input.props.onChange({ target: { checked } });
      return this.render();
    },
    async click(label) {
      const button = action(tree, label);
      assert(button, `${label} button exists`);
      assert(!button.props.disabled, `${label} button is enabled`);
      await button.props.onClick();
      return this.render();
    },
  };
}

function all(tree, predicate, result = []) {
  if (Array.isArray(tree)) tree.forEach(node => all(node, predicate, result));
  else if (tree && typeof tree === "object") {
    if (predicate(tree)) result.push(tree);
    if (typeof tree.type === "function") all(tree.type(tree.props), predicate, result);
    else all(tree.props?.children, predicate, result);
  }
  return result;
}
const text = tree => tree == null || typeof tree === "boolean" ? ""
  : Array.isArray(tree) ? tree.map(text).join("")
  : typeof tree === "object" ? text(tree.props?.children) : String(tree);
const action = (tree, label) => all(tree, node => node.type === "button"
  && (node.props["aria-label"] || text(node).trim()) === label)[0];
function fieldset(tree, name = "SERVICE CHARGE") {
  const match = all(tree, node => node.type === "fieldset"
    && node.props["aria-label"] === `Automatically enable for ${name}`)[0];
  assert(match, `Automatic service type picker exists for ${name}`);
  return match;
}
const selection = (tree, name) => all(fieldset(tree, name), node => node.type === "label")
  .filter(label => all(label, node => node.type === "input" && node.props.checked).length)
  .map(label => text(label).trim());
const chargeWrites = api => api.calls.filter(call => call.endpoint === "/api/pos_manage_other_charges.php"
  && call.method !== "GET");

test("existing service assignments load, save with the charge rate, and survive reopening", async () => {
  const api = mockApi({ charges: [{ ...serviceCharge, auto_sales_type_ids: ["ST-DINE"], auto_sales_types: ["DINE IN"] }] });
  const app = harness(api);
  await app.render();
  assert.deepEqual(selection(app.tree), ["DINE IN"]);
  assert.equal(action(app.tree, "Save SERVICE CHARGE").props.disabled, true);
  await app.choose("SERVICE CHARGE", "TAKE OUT", true);
  await app.click("Save SERVICE CHARGE");
  assert.deepEqual(chargeWrites(api).at(-1).body, {
    id: 7, amount: 5, rate_type: "Percentage", auto_sales_type_ids: ["ST-DINE", "ST-TAKE"],
  });
  assert.equal(chargeWrites(api).at(-1).headers.Authorization, "Bearer test-access-token");
  assert.equal(action(app.tree, "Save SERVICE CHARGE").props.disabled, true);
  const reopened = harness(api);
  await reopened.render();
  assert.deepEqual(selection(reopened.tree), ["DINE IN", "TAKE OUT"]);
});

test("clearing every service type saves an explicit empty assignment list", async () => {
  const api = mockApi({ charges: [{ ...serviceCharge, auto_sales_type_ids: ["ST-DINE"], auto_sales_types: ["DINE IN"] }] });
  const app = harness(api);
  await app.render();
  await app.choose("SERVICE CHARGE", "DINE IN", false);
  await app.click("Save SERVICE CHARGE");
  assert.deepEqual(chargeWrites(api).at(-1).body.auto_sales_type_ids, []);
  const reopened = harness(api);
  await reopened.render();
  assert.deepEqual(selection(reopened.tree), []);
});

test("a failed assignment save keeps the selection available for retry without changing persisted settings", async () => {
  const api = mockApi({ failSave: true });
  const app = harness(api);
  await app.render();
  await app.choose("SERVICE CHARGE", "DINE IN", true);
  await app.click("Save SERVICE CHARGE");
  assert.match(text(app.tree), /Assignments could not be saved/);
  assert.deepEqual(selection(app.tree), ["DINE IN"]);
  assert.deepEqual(api.charges[0].auto_sales_type_ids, []);
  assert.equal(action(app.tree, "Save SERVICE CHARGE").props.disabled, false);
  api.failSave = false;
  await app.click("Save SERVICE CHARGE");
  assert.deepEqual(api.charges[0].auto_sales_type_ids, ["ST-DINE"]);
  assert.equal(action(app.tree, "Save SERVICE CHARGE").props.disabled, true);
});

test("charges without mapping fields remain manual until the user explicitly assigns a service type", async () => {
  const { auto_sales_type_ids, auto_sales_types, ...legacy } = serviceCharge;
  const api = mockApi({ charges: [legacy] });
  const app = harness(api);
  await app.render();
  assert.deepEqual(selection(app.tree), []);
  assert.equal(action(app.tree, "Save SERVICE CHARGE").props.disabled, true);
  assert.equal(chargeWrites(api).length, 0, "opening settings must not silently create an assignment");
  await app.choose("SERVICE CHARGE", "DINE IN", true);
  await app.click("Save SERVICE CHARGE");
  assert.deepEqual(api.charges[0].auto_sales_type_ids, ["ST-DINE"]);
  assert.equal(api.charges[0].is_enabled, 1);
});

test("the new-charge form submits selected service types and clears them after a successful add", async () => {
  const app = harness(mockApi({ charges: [] }));
  await app.render();
  const name = all(app.tree, node => node.type === "input" && node.props.placeholder === "e.g. Service Charge")[0];
  assert(name, "new charge name field exists");
  name.props.onChange({ target: { value: "Delivery service" } });
  await app.render();
  await app.choose("new charge", "TAKE OUT", true);
  await app.click("Add");
  const write = chargeWrites(app.api).at(-1);
  assert.equal(write.method, "POST");
  assert.equal(write.body.particulars, "Delivery service");
  assert.deepEqual(write.body.auto_sales_type_ids, ["ST-TAKE"]);
  assert.deepEqual(selection(app.tree, "new charge"), []);
  assert.deepEqual(selection(app.tree, "Delivery service"), ["TAKE OUT"]);
});
