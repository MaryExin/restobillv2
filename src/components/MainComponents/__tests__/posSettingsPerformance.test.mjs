import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";

// Use the project's existing Node/SWC harness approach. Element type and key
// stability check React's reconciliation contract; this is not a GPU benchmark
// or a replacement for checking real browser focus and rendering performance.
function settingsHarness() {
  const fixture = { theme: "light", developerMode: true, denied: [], roles: [] };
  const slots = [];
  let cursor = 0, effects = [], dirty = false;
  const sameDeps = (first, second) => first && second && first.length === second.length
    && first.every((value, index) => Object.is(value, second[index]));
  const hooks = {
    ...React,
    lazy(loader) {
      const Tab = () => null;
      Tab.lazyTab = String(loader).match(/PosSettingsModal\/([^"']+)/)?.[1];
      assert(Tab.lazyTab, "lazy module must identify its settings tab");
      return Tab;
    },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) {
          slots[index].value = value;
          dirty = true;
        }
      }];
    },
    useMemo(create, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, value: create() };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) {
        effects.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const modules = {
    react: hooks,
    "react-router-dom": { useNavigate: () => () => {} },
    "../../context/ThemeContext": { useTheme: () => ({ theme: fixture.theme, setTheme: () => {} }) },
    "../../context/useZustandLoginCred": (selector = state => state) => selector({ roles: fixture.roles }),
    "../../hooks/usePosRoleAccessConfig": {
      usePosDeveloperSession: () => fixture.developerMode,
      usePosRoleAccessVersion: () => 0,
    },
    "../../utils/posRoleAccess": {
      hasPosSettingsAccess: (_roles, tab) => !fixture.denied.includes(tab),
    },
  };
  const context = { exports: {}, React, console, localStorage: { getItem: () => "" },
    require: name => modules[name] || (name.startsWith("react-icons/")
      ? new Proxy({}, { get: (_, icon) => icon })
      : assert.fail(`Unexpected module: ${name}`)),
  };
  context.module = { exports: context.exports };
  const source = fs.readFileSync(new URL("../PosSettings.jsx", import.meta.url), "utf8");
  const transformed = transformSync(source, {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
    module: { type: "commonjs" },
  });
  vm.runInNewContext(transformed.code, context, { filename: "PosSettings.jsx" });
  return {
    fixture,
    render(props = {}) {
      let tree;
      for (let attempt = 0; attempt < 10; attempt++) {
        cursor = 0;
        dirty = false;
        effects = [];
        tree = context.module.exports.default({ isOpen: true, onClose: () => {}, ...props });
        effects.forEach(effect => effect());
        if (!dirty) return tree;
      }
      assert.fail("Settings did not settle after effects");
    },
  };
}

function all(tree, predicate, { expand = false } = {}, result = []) {
  if (Array.isArray(tree)) tree.forEach(node => all(node, predicate, { expand }, result));
  else if (tree && typeof tree === "object") {
    if (predicate(tree)) result.push(tree);
    if (expand && typeof tree.type === "function" && !tree.type.lazyTab) {
      all(tree.type(tree.props), predicate, { expand }, result);
    } else all(tree.props?.children, predicate, { expand }, result);
  }
  return result;
}
const text = tree => tree == null || typeof tree === "boolean" ? ""
  : Array.isArray(tree) ? tree.map(text).join("")
  : typeof tree === "object" ? text(tree.props?.children) : String(tree);
const button = (tree, label) => all(tree, node => node.type === "button"
  && text(node).trim() === label, { expand: true })[0];
const activeTabs = tree => all(tree, node => Boolean(node.type?.lazyTab));
const activeWrapper = tree => all(tree, node => node.key !== null && activeTabs(node).length === 1)[0];
const navEntry = (tree, label) => all(tree, node => node.props?.nav?.id === label)[0];

test("theme updates reuse the active form's reconciliation identity and stable navigation types", () => {
  const settings = settingsHarness();
  const light = settings.render();
  const lightTab = activeTabs(light)[0];
  const lightWrapper = activeWrapper(light);
  const lightNavigation = navEntry(light, "Service Charge");
  settings.fixture.theme = "dark";
  const dark = settings.render();
  const darkTab = activeTabs(dark)[0];
  const darkWrapper = activeWrapper(dark);
  assert.equal(lightTab.type.lazyTab, "PosMyAccount");
  assert.equal(darkTab.type, lightTab.type);
  assert.equal(darkTab.props.isDark, true);
  assert.equal(darkWrapper.type, lightWrapper.type);
  assert.equal(darkWrapper.key, lightWrapper.key, "theme must not remount the active form and its fetch effects");
  assert.equal(navEntry(dark, "Service Charge").type, lightNavigation.type,
    "navigation component identity must survive parent renders");
});

test("navigation renders only the selected lazy tab and retains the selection after reopening", () => {
  const settings = settingsHarness();
  let tree = settings.render();
  assert.deepEqual(activeTabs(tree).map(node => node.type.lazyTab), ["PosMyAccount"]);
  button(tree, "Service Charge").props.onClick();
  tree = settings.render();
  assert.deepEqual(activeTabs(tree).map(node => node.type.lazyTab), ["PosServiceCharge"]);
  assert.equal(settings.render({ isOpen: false }), null);
  tree = settings.render();
  assert.deepEqual(activeTabs(tree).map(node => node.type.lazyTab), ["PosServiceCharge"]);
  tree = settings.render({ initialTab: "My Account" });
  assert.deepEqual(activeTabs(tree).map(node => node.type.lazyTab), ["PosMyAccount"]);
});

test("access filtering and the password gate retain the active form identity", () => {
  const settings = settingsHarness();
  settings.fixture.developerMode = false;
  settings.fixture.denied = ["Service Charge"];
  let tree = settings.render();
  const wrapper = activeWrapper(tree);
  assert.equal(button(tree, "Service Charge"), undefined);
  assert.equal(button(tree, "User Roles"), undefined);
  button(tree, "Mode of Payment").props.onClick();
  tree = settings.render();
  assert(text(tree).includes("Password Required"));
  const password = all(tree, node => node.type === "input" && node.props.type === "password")[0];
  password.props.onChange({ target: { value: "invalid-test-password" } });
  tree = settings.render();
  button(tree, "Unlock").props.onClick();
  tree = settings.render();
  assert(text(tree).includes("Oops!"));
  button(tree, "Take Me Home").props.onClick();
  tree = settings.render();
  assert.equal(activeWrapper(tree).key, wrapper.key);
  assert.deepEqual(activeTabs(tree).map(node => node.type.lazyTab), ["PosMyAccount"]);
});
