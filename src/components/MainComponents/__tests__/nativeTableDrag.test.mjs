import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { parseSync } from "@swc/core";

const source = fs.readFileSync(new URL("../ViewOrdering.jsx", import.meta.url), "utf8");
const bytes = Buffer.from(source);
const ast = parseSync(source, { syntax: "ecmascript", jsx: true });
const snippet = node => bytes.subarray(node.span.start - 1, node.span.end - 1).toString();
const names = ["handleFloorPointerDown", "handleFloorPointerMove", "handleFloorPointerUp", "handleFloorPointerCancel"];
const handlers = new Map();
let saveEffect, floorCard;
function visit(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "VariableDeclaration") {
    for (const declaration of node.declarations) {
      if (names.includes(declaration.id.value)) handlers.set(declaration.id.value, snippet(node));
    }
  }
  if (node.type === "CallExpression" && node.callee?.value === "useEffect"
    && snippet(node).includes("floorLayoutSaveTimerRef")) saveEffect = snippet(node.arguments[0].expression);
  if (node.type === "JSXOpeningElement"
    && node.attributes.some(attribute => attribute.name?.value === "onPointerCancel")) floorCard = node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") visit(value);
  }
}
visit(ast);

// Execute the actual component's native handlers and persistence effect with
// state setters and I/O isolated. No database, browser, or printer is contacted.
function mountDrag() {
  assert.equal(handlers.size, names.length);
  assert(saveEffect);
  const captured = [], released = [], selected = [], merged = [], requests = [];
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    floorDrag: null,
    floorLayout: { positions: {}, groups: [{ id: "existing-group", tableNames: ["3", "4"] }] },
    dropTarget: "",
    mergeTarget: null,
    isDragging: false,
    apiHost: "http://pos.test",
    isTableLayoutEnabled: true,
    floorLayoutLoadedRef: { current: true },
    floorLayoutSaveTimerRef: { current: null },
    layoutScope: { category_code: "TEST", unit_code: "UNIT" },
    activeLayoutScope: { layout_key: "main-room" },
    setFloorDrag(value) { context.floorDrag = typeof value === "function" ? value(context.floorDrag) : value; },
    setFloorLayout(value) { context.floorLayout = typeof value === "function" ? value(context.floorLayout) : value; },
    setDropTargetTable(value) { context.dropTarget = value; },
    getMergeTargetItem() { return context.mergeTarget; },
    mergeFloorItems(first, second) { merged.push([first.id, second.id]); },
    handleTableSelect(item) { selected.push(item.id); },
    setTimeout(callback, delay) {
      assert.equal(delay, 450);
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; },
    console: { error: (...args) => assert.fail(args.join(" ")) },
  };
  vm.createContext(context);
  vm.runInContext(`${[...handlers.values()].join("\n")}\nthis.handlers = {${names.join(",")}}; this.saveEffect = (${saveEffect});`, context);
  const event = (x = 100, y = 100, overrides = {}) => ({
    button: 0, pointerId: 7, clientX: x, clientY: y,
    target: { closest: () => false },
    currentTarget: {
      setPointerCapture: id => captured.push(id),
      releasePointerCapture: id => released.push(id),
    },
    preventDefault() {},
    ...overrides,
  });
  return { context, event, captured, released, selected, merged, requests, timers, handlers: context.handlers };
}

const table = { id: "table:1", position: { x: 50, y: 60 }, size: { width: 280, height: 245 } };

test("native table movement retains pointer capture and saves only the latest position in its room", () => {
  const drag = mountDrag();
  const { context, handlers, event } = drag;
  assert.equal(floorCard.name.value, "div");
  for (const name of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) {
    assert(floorCard.attributes.some(attribute => attribute.name?.value === name));
  }
  handlers.handleFloorPointerDown(event(), table);
  assert.deepEqual(drag.captured, [7]);
  handlers.handleFloorPointerMove(event(120, 130), table);
  assert.equal(context.floorLayout.positions[table.id].x, 70);
  assert.equal(context.floorLayout.positions[table.id].y, 90);
  let cleanup = context.saveEffect();
  handlers.handleFloorPointerMove(event(150, 145), table);
  cleanup();
  cleanup = context.saveEffect();
  assert.equal(drag.requests.length, 0);
  assert.equal(drag.timers.size, 1, "repeated movement coalesces persistence");
  handlers.handleFloorPointerUp(event(150, 145), table);
  assert.equal(context.floorDrag, null);
  assert.deepEqual(drag.released, [7]);
  assert.equal(drag.selected.length, 0, "dragging does not open the order");
  [...drag.timers.values()][0]();
  assert.equal(drag.requests.length, 1);
  const request = drag.requests[0];
  assert.equal(request.url, "http://pos.test/api/pos_table_layout.php");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), {
    category_code: "TEST", unit_code: "UNIT", layout_key: "main-room",
    positions: { "table:1": { x: 100, y: 105 } },
    groups: [{ id: "existing-group", tableNames: ["3", "4"] }],
  });
  cleanup();
  assert.equal(drag.timers.size, 0);
});

test("native cards preserve tap and keyboard opening while excluding child actions and secondary buttons", () => {
  const drag = mountDrag();
  const { handlers, event, context } = drag;
  handlers.handleFloorPointerDown(event(100, 100, { button: 2 }), table);
  handlers.handleFloorPointerDown(event(100, 100, { target: { closest: () => ({}) } }), table);
  assert.equal(context.floorDrag, null);
  assert.equal(drag.captured.length, 0);
  handlers.handleFloorPointerDown(event(), table);
  handlers.handleFloorPointerUp(event(), table);
  assert.deepEqual(drag.selected, [table.id]);
  const keyDown = floorCard.attributes.find(attribute => attribute.name?.value === "onKeyDown");
  context.item = table;
  vm.runInContext(`this.keyDown = (${snippet(keyDown.value.expression)});`, context);
  let prevented = 0;
  for (const key of ["Enter", " ", "Escape"]) context.keyDown({ key, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
  assert.deepEqual(drag.selected, [table.id, table.id, table.id]);
});

test("native drag clamps negative coordinates, merges on a valid drop and clears canceled drag state", () => {
  const drag = mountDrag();
  const { context, handlers, event } = drag;
  handlers.handleFloorPointerDown(event(), table);
  handlers.handleFloorPointerMove(event(-100, -100), table);
  assert.equal(context.floorLayout.positions[table.id].x, 0);
  assert.equal(context.floorLayout.positions[table.id].y, 0);
  context.mergeTarget = { id: "table:2" };
  handlers.handleFloorPointerMove(event(150, 150), table);
  assert.equal(context.dropTarget, "table:2");
  handlers.handleFloorPointerUp(event(150, 150), table);
  assert.deepEqual(drag.merged, [[table.id, "table:2"]]);
  assert.equal(drag.selected.length, 0);
  handlers.handleFloorPointerDown(event(), table);
  handlers.handleFloorPointerCancel();
  assert.equal(context.floorDrag, null);
  assert.equal(context.dropTarget, "");
  assert.equal(drag.merged.length, 1);
});
