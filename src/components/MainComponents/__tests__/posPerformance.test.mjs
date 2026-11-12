import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as menuProductVariants from "../../../utils/menuProductVariants.js";
import * as menuPizzaCombination from "../../../utils/menuPizzaCombination.js";
import * as menuPlatterCombination from "../../../utils/menuPlatterCombination.js";
import * as menuChickenCombination from "../../../utils/menuChickenCombination.js";
import * as pizzaCombinationCart from "../../../utils/pizzaCombinationCart.js";
import * as orderItemDisplayName from "../../../utils/orderItemDisplayName.js";
import * as salesTypeCategories from "../../../utils/salesTypeCategories.js";
import * as billDocument from "../../../utils/billDocument.js";
import * as productOptions from "../../../utils/productOptions.js";
import * as guestInfo from "../../../utils/guestInfo.js";
import * as menuCoffeeAddons from "../../../utils/menuCoffeeAddons.js";
import * as coffeeAddonCart from "../../../utils/coffeeAddonCart.js";
import * as orderCombinationCart from "../../../utils/orderCombinationCart.js";

const projectRoot = new URL("../../../../", import.meta.url);
const noop = () => null;
const PlatterCombinationOptions = () => null;
const ChickenCombinationOptions = () => null;
const CoffeeAddonModal = () => null;

// Exercise component event handlers and asynchronous effects without adding a DOM
// test dependency. This checks React element output and request lifecycles; native
// browser layout, image scheduling and real-device memory still need UI testing.
function harness(file, supplied = {}, moduleOverrides = {}) {
  let states = [], setters = [], refs = [], memos = [], stateIndex, refIndex, memoIndex, idIndex, effects;
  const memoize = (factory, dependencies) => {
    const index = memoIndex++;
    const previous = memos[index];
    if (previous && Array.isArray(dependencies) && dependencies.length === previous.dependencies?.length
      && dependencies.every((value, dependencyIndex) => Object.is(value, previous.dependencies[dependencyIndex]))) {
      return previous.value;
    }
    const value = factory();
    memos[index] = { dependencies, value };
    return value;
  };
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      setters[index] ??= value => { states[index] = typeof value === 'function' ? value(states[index]) : value; };
      return [states[index], setters[index]];
    },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useId: () => `test-id-${idIndex++}`,
    useMemo: memoize,
    useCallback: (fn, dependencies) => memoize(() => fn, dependencies),
    useEffect: fn => effects.push(fn),
  };
  const modules = {
    react: hooks,
    'react-dom': { createPortal: children => children },
    'react-router-dom': { useNavigate: () => noop },
    '../../context/ThemeContext': { useTheme: () => ({ theme: 'light', isDark: false }) },
    '../../hooks/useApiHost': () => 'http://pos.test',
    '../../hooks/useGetDefaultPrinter': () => '',
    '../../hooks/useBusinessInfo': () => ({ businessInfo: {} }),
    '../../hooks/useBillingEnabled': () => false,
    '../../context/useZustandLayoutMode': () => ({ layoutMode: 'Restaurant' }),
    '../../utils/menuProductVariants': menuProductVariants,
    '../../utils/menuPizzaCombination': menuPizzaCombination,
    '../../utils/menuPlatterCombination': menuPlatterCombination,
    '../../utils/menuChickenCombination': menuChickenCombination,
    '../../utils/pizzaCombinationCart': pizzaCombinationCart,
    '../../utils/orderItemDisplayName': orderItemDisplayName,
    '../../utils/salesTypeCategories': salesTypeCategories,
    '../../utils/billDocument': billDocument,
    '../../utils/productOptions': productOptions,
    '../../utils/guestInfo': guestInfo,
    './Common/ProductOptionChips': () => null,
    '../../utils/menuCoffeeAddons': menuCoffeeAddons,
    '../../utils/coffeeAddonCart': coffeeAddonCart,
    '../../utils/orderCombinationCart': orderCombinationCart,
    './CoffeeAddonModal': CoffeeAddonModal,
    '../../hooks/useCoffeeAddonOptions': () => ({ product: null, addons: [], isLoading: false, error: '', retry: noop }),
    './PlatterCombinationOptions': PlatterCombinationOptions,
    './ChickenCombinationOptions': ChickenCombinationOptions,
    '../../hooks/useMenuPizzaHalves': () => ({ products: [], isLoading: false, error: '', retry: noop }),
    '../../hooks/useMenuProductVariants': ({ group }) => ({
      variants: group?.variants || [], isLoading: false, error: '', retry: noop,
    }),
    ...moduleOverrides,
  };
  const context = {
    exports: {}, console, AbortController, FormData, setTimeout,
    localStorage: { getItem: () => '' },
    sessionStorage: { getItem: () => '' },
    window: { setTimeout, clearTimeout },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    ...supplied,
    require: name => modules[name] || (name.startsWith('react-icons/') ? new Proxy({}, { get: (_, key) => key }) : noop),
  };
  context.module = { exports: context.exports };
  const source = fs.readFileSync(new URL(file, projectRoot), 'utf8');
  const transformed = transformSync(source, {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
    module: { type: "commonjs" },
  });
  vm.runInNewContext(transformed.code, context, { filename: file });
  const component = context.module.exports.default;
  return {
    render(props = {}) {
      stateIndex = refIndex = memoIndex = idIndex = 0;
      effects = [];
      const tree = (component.type || component)(props);
      return { tree, effects };
    },
  };
}
function all(tree, predicate, result = []) {
  if (Array.isArray(tree)) tree.forEach(node => all(node, predicate, result));
  else if (tree && typeof tree === 'object') {
    if (predicate(tree)) result.push(tree);
    all(tree.props?.children, predicate, result);
  }
  return result;
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props?.children);
}
const button = (tree, label) => all(tree, node => node.type === 'button' && text(node).trim() === label)[0];
const cards = tree => all(tree, node => node.type === 'div' && node.props.className?.startsWith('group relative rounded-'));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test("product pages cap mounted cards while searches and categories cover the full catalog", async () => {
  const products = Array.from({ length: 121 }, (_, index) => ({ product_id: `P${index + 1}`, item_name: `Product ${index + 1}`, item_category: index < 61 ? 'FOOD' : 'DRINKS', status: '1', isDiscountable: 'Yes', selling_price: 10 }));
  const updates = [];
  const master = harness('src/components/MainComponents/Productlist.jsx', {
    fetch: async (url, options) => {
      if (options?.method === 'POST') updates.push(JSON.parse(options.body));
      return { ok: true, json: async () => url.includes('get_product_masterlist') ? products : { status: 'success' } };
    },
  });
  let state = master.render();
  state.effects[0]();
  await flush();
  state = master.render();
  assert.equal(cards(state.tree).length, 60);
  assert.equal(cards(state.tree)[0].key, 'P1');
  assert.equal(button(state.tree, 'Previous').props.disabled, true);
  button(state.tree, 'Next').props.onClick();
  state = master.render();
  assert.equal(cards(state.tree).length, 60);
  assert.equal(cards(state.tree)[0].key, 'P61');
  button(state.tree, 'Next').props.onClick();
  state = master.render();
  assert.equal(cards(state.tree).length, 1);
  assert.equal(cards(state.tree)[0].key, 'P121');
  assert.equal(button(state.tree, 'Next').props.disabled, true);
  const search = all(state.tree, node => node.type === 'input' && node.props.placeholder === 'Search products...')[0];
  search.props.onChange({ target: { value: 'Product 1' } });
  state = master.render();
  assert.equal(cards(state.tree).length, 33);
  assert.equal(cards(state.tree)[0].key, 'P1');
  assert(cards(state.tree).some(node => node.key === 'P121'));
  all(state.tree, node => node.type === 'input' && node.props.placeholder === 'Search products...')[0].props.onChange({ target: { value: '' } });
  state = master.render();
  button(state.tree, 'Next').props.onClick();
  state = master.render();
  const food = all(state.tree, node => node.type === 'button' && text(node).trim() === 'FOOD61')[0];
  food.props.onClick();
  state = master.render();
  assert.equal(cards(state.tree).length, 60);
  assert.equal(cards(state.tree)[0].key, 'P1');
  all(state.tree, node => node.type === 'button' && /triggerBulkConfirm\("0"\)/.test(String(node.props.onClick)))[0].props.onClick();
  state = master.render();
  await button(state.tree, 'Confirm').props.onClick();
  assert.equal(updates[0].product_ids.length, 61, 'bulk update includes the category item on the second page');
  assert.equal(updates[0].product_ids.at(-1), 'P61');
  assert.equal(updates[0].item_category, 'FOOD');
});

test("product images use lazy loading with a finite fallback and an eager priority option", () => {
  const image = harness('src/components/common/ProductImage.jsx');
  let imageNode = all(image.render({ src: '/missing.jpg', fallbackSrc: '/default.jpg' }).tree, node => node.type === 'img')[0];
  const initialKey = imageNode.key;
  assert.equal(imageNode.props.loading, 'lazy');
  assert.equal(imageNode.props.decoding, 'async');
  let currentSrc = imageNode.props.src, assignments = 0;
  const domImage = { getAttribute: () => currentSrc, set src(value) { currentSrc = value; assignments++; } };
  imageNode.props.onError({ currentTarget: domImage });
  imageNode.props.onError({ currentTarget: domImage });
  assert.equal(currentSrc, '/default.jpg');
  assert.equal(assignments, 1);
  imageNode = all(image.render({ src: '', fallbackSrc: '/default.jpg', priority: true }).tree, node => node.type === 'img')[0];
  assert.equal(imageNode.props.src, '/default.jpg');
  assert.equal(imageNode.props.loading, 'eager');
  assert.notEqual(imageNode.key, initialKey, 'changing the source resets any previous fallback');
});

test("pricing search coalesces typing, cancels stale requests and keeps immediate category loads", async () => {
  const timers = new Map();
  let nextTimer = 0, requests = [], errors = [];
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    console: { ...console, error: (...args) => errors.push(args) },
    window: {
      setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
      clearTimeout: id => timers.delete(id),
    },
    fetch: (url, options) => {
      if (url.includes('new_transactions.php')) return Promise.resolve({ json: async () => ({ status: 'success', business_info: { Category_Code: 'C', Unit_Code: 'U' }, sales_types: [{ sales_type_id: 'S', sales_type: 'DINE IN' }], item_categories: [{ item_category: 'FOOD' }, { item_category: 'DRINKS' }] }) });
      return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
    },
  });
  let state = orders.render();
  state.effects.find(effect => effect.toString().includes('new_transactions.php'))();
  await flush();
  state = orders.render();
  const pricingEffect = () => state.effects.find(effect => effect.toString().includes('get_pricing_selection.php') && effect.toString().includes('setIsPricingLoading'));
  let cleanup = pricingEffect()();
  assert.equal(requests.length, 1, 'initial category should request immediately');
  assert.equal(JSON.parse(requests[0].options.body).limit, 100);
  const searchInput = () => all(state.tree, node => node.type === 'input' && node.props.placeholder === 'Search delicious food...')[0];
  searchInput().props.onChange({ target: { value: 'c' } });
  state = orders.render();
  cleanup();
  cleanup = pricingEffect()();
  assert(requests[0].options.signal.aborted);
  assert.equal(requests.length, 1, 'first key waits for debounce');
  searchInput().props.onChange({ target: { value: 'co' } });
  state = orders.render();
  cleanup();
  cleanup = pricingEffect()();
  assert.equal(timers.size, 1, 'previous typing timer is canceled');
  for (const [id, fn] of timers) { timers.delete(id); fn(); }
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[1].options.body).search, 'co');
  requests[0].reject(Object.assign(new Error('canceled'), { name: 'AbortError' }));
  requests[1].resolve({ json: async () => ({ status: 'success', products: [{ product_id: 'coffee', item_name: 'Coffee', selling_price: 10 }] }) });
  await flush();
  assert.equal(errors.length, 0);
  state = orders.render();
  assert(text(state.tree).includes('Coffee'));
  searchInput().props.onChange({ target: { value: '' } });
  state = orders.render();
  cleanup();
  cleanup = pricingEffect()();
  assert.equal(requests.length, 3, 'clearing search requests category immediately');
  button(state.tree, 'DRINKS').props.onClick();
  state = orders.render();
  cleanup();
  cleanup = pricingEffect()();
  assert.equal(requests.length, 4, 'category changes request immediately');
  assert.equal(JSON.parse(requests[3].options.body).item_category, 'DRINKS');
  assert(requests[2].options.signal.aborted);
  requests[3].resolve({ json: async () => ({ status: 'success', products: [{ product_id: 'tea', item_name: 'Tea', selling_price: 20 }] }) });
  await flush();
  requests[2].resolve({ json: async () => ({ status: 'success', products: [{ product_id: 'stale', item_name: 'Stale item', selling_price: 30 }] }) });
  await flush();
  state = orders.render();
  assert(text(state.tree).includes('Tea'));
  assert(!text(state.tree).includes('Stale item'), 'a canceled response cannot replace newer products');
  cleanup();
});

const menuProducts = [
  {
    product_id: 'MENU-ALPHA', item_name: '5 Cheese', selling_price: 150,
    item_description: 'Creamy mozzarella blend', item_category: 'PIZZA',
    subcategory_item_category: 'House Specials', sku: 'PZ-005',
    bar_code: '4801234567890', unit_of_measure: 'SLICE', inventory_type: 'READY',
  },
  {
    product_id: 'MENU-BETA', item_name: 'Jasmine Tea', selling_price: 80,
    item_description: 'Floral drink', item_category: 'DRINKS',
    subcategory_item_category: 'Hot Beverages', sku: 'DR-010', bar_code: '9000100',
  },
  {
    product_id: 'MENU-GAMMA', item_name: 'Plain Bread', selling_price: 20,
    item_description: null, item_category: null, subcategory_item_category: null,
    sku: null, bar_code: null, unit_of_measure: null, inventory_type: null,
  },
];
const menuCards = tree => all(tree, node => node.type === 'button' && node.props.className?.startsWith('group relative flex w-full flex-col'));

async function loadedMenu({ retail = false, subcategories = false, products = menuProducts, onSave, variantOptions = {}, combinationOptions = {}, coffeeOptions = {}, categories = [{ item_category: 'PIZZA' }, { item_category: 'DRINKS' }], lookupProducts = products } = {}) {
  const requests = [], alerts = [];
  const renderProps = { setshoworderlist: noop };
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    alert: message => alerts.push(message),
    fetch: async (url, options) => {
      if (url.includes('/save_order.php') || url.includes('/update_order.php')) {
        onSave?.(JSON.parse(options.body.get('cart_items')));
        return { ok: true, json: async () => ({ status: 'success', transaction_id: 'TEST-SAVE' }) };
      }
      if (url.includes('new_transactions.php')) {
        return { json: async () => ({ status: 'success', business_info: { Category_Code: 'C', Unit_Code: 'U' }, sales_types: [{ sales_type_id: 'S', sales_type: 'DINE IN' }], item_categories: categories }) };
      }
      if (url.includes('pos_product_subcategories_settings.php')) {
        return { json: async () => ({ success: true, data: { enable_subcategories: subcategories } }) };
      }
      assert(url.includes('get_pricing_selection.php'), `unexpected request: ${url}`);
      const payload = JSON.parse(options.body);
      requests.push(payload);
      // Return the full fixture so the rendered results exercise the frontend
      // filter and response mapper independently of the server predicate.
      return { json: async () => ({ status: 'success', products: payload.limit === 20 ? lookupProducts : products }) };
    },
  }, {
    '../../context/useZustandLayoutMode': () => ({ layoutMode: retail ? 'Restaurant Version 2' : 'Restaurant' }),
    // Model a completed family fetch independently of the current menu filter.
    // The hook's paging, cancellation and request scope have separate coverage.
    '../../hooks/useMenuProductVariants': ({ group, mapProduct }) => ({
      variants: group ? products
        .filter(product => menuProductVariants.getMenuVariantDetails(product).familyKey === group.familyKey)
        .map(mapProduct || (product => product)) : [],
      isLoading: false, error: '', retry: noop, ...variantOptions,
    }),
    '../../hooks/useMenuPizzaHalves': ({ group, mapProduct }) => ({
      products: group ? products.map(mapProduct || (product => product)) : [],
      isLoading: false, error: '', retry: noop, ...combinationOptions,
    }),
    '../../hooks/useCoffeeAddonOptions': ({ product, mapProduct }) => ({
      product: product ? (mapProduct || (row => row))(products.find(row => row.product_id === product.product_id) || product, 0) : null,
      addons: product ? products.filter(menuCoffeeAddons.isCclAddon).map(mapProduct || (row => row)) : [],
      isLoading: false, error: '', retry: noop, ...coffeeOptions,
    }),
  });
  let state = orders.render(renderProps);
  state.effects.find(effect => effect.toString().includes('new_transactions.php'))();
  state.effects.find(effect => effect.toString().includes('pos_product_subcategories_settings.php'))();
  await flush();
  state = orders.render(renderProps);
  const cleanup = state.effects.find(effect => effect.toString().includes('get_pricing_selection.php') && effect.toString().includes('setIsPricingLoading'))();
  await flush();
  state = orders.render(renderProps);
  const searchInput = () => all(state.tree, node => node.type === 'input' && node.props.placeholder === (retail ? 'Scan Item Barcode or Type SKU...' : 'Search delicious food...'))[0];
  return {
    get state() { return state; },
    requests, alerts, cleanup, searchInput,
    render() { state = orders.render(renderProps); return state; },
    search(value) {
      searchInput().props.onChange({ target: { value } });
      state = orders.render(renderProps);
      return menuCards(state.tree).map(node => node.key);
    },
  };
}

test("digital menu searches partial words anywhere, in any order, across product fields", async () => {
  const menu = await loadedMenu();
  try {
    const cases = [
      ['cheese', ['MENU-ALPHA']],
      ['chee', ['MENU-ALPHA']],
      ['5 cheese', ['MENU-ALPHA']],
      ['cheese 5', ['MENU-ALPHA']],
      ['  ChEeSe   5  ', ['MENU-ALPHA']],
      ['cheese\t5', ['MENU-ALPHA']],
      ['pizza', ['MENU-ALPHA']],
      ['specials', ['MENU-ALPHA']],
      ['mozzarella', ['MENU-ALPHA']],
      ['4801234567890', ['MENU-ALPHA']],
      ['123456', ['MENU-ALPHA']],
      ['pz-005', ['MENU-ALPHA']],
      ['menu-alpha', ['MENU-ALPHA']],
      ['slice', ['MENU-ALPHA']],
      ['ready', ['MENU-ALPHA']],
      ['pizza blend 5', ['MENU-ALPHA']],
      ['specials mozzarella', ['MENU-ALPHA']],
      ['bread', ['MENU-GAMMA']],
      ['cheese tea', []],
      ['cheese missing', []],
      ['null', []],
      ['undefined', []],
    ];
    for (const [query, expected] of cases) {
      assert.deepEqual(menu.search(query), expected, `search ${JSON.stringify(query)}`);
    }
    assert.deepEqual(menu.search('   '), ['MENU-ALPHA', 'MENU-BETA', 'MENU-GAMMA'], 'blank search restores the loaded product list');
  } finally {
    menu.cleanup();
  }
});

test("digital menu search ignores an open subcategory and restores it when cleared", async () => {
  const menu = await loadedMenu({ subcategories: true });
  try {
    const folder = menuCards(menu.state.tree).find(node => node.key === 'folder-House Specials');
    assert(folder);
    folder.props.onClick();
    menu.render();
    assert.deepEqual(menuCards(menu.state.tree).map(node => node.key), ['MENU-ALPHA']);
    assert.deepEqual(menu.search('tea'), ['MENU-BETA'], 'search can find a product outside the selected subcategory');
    assert.deepEqual(menu.search(''), ['MENU-ALPHA'], 'clearing the search restores the open subcategory');
  } finally {
    menu.cleanup();
  }
});

test("retail Enter adds an exact SKU but does not auto-add partial text matches", async () => {
  const menu = await loadedMenu({ retail: true });
  const cartItems = () => all(menu.state.tree, node => Array.isArray(node.props?.items) && typeof node.props?.updateQuantity === 'function').flatMap(node => node.props.items);
  const enter = async () => {
    let prevented = false;
    menu.searchInput().props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented = true; } });
    assert(prevented);
    await flush();
    menu.render();
  };
  try {
    assert.deepEqual(menu.search('cheese'), ['MENU-ALPHA']);
    await enter();
    assert.equal(cartItems().length, 0);
    assert.equal(menu.alerts.at(-1), 'No item found for scanned code: cheese');

    assert.deepEqual(menu.search('pz-00'), ['MENU-ALPHA']);
    await enter();
    assert.equal(cartItems().length, 0);
    assert.equal(menu.alerts.at(-1), 'No item found for scanned code: pz-00');

    const requestCount = menu.requests.length;
    menu.search(' pz-005 ');
    await enter();
    assert(cartItems().some(item => item.code === 'MENU-ALPHA' && item.quantity === 1));
    assert.equal(menu.searchInput().props.value, '', 'an exact scan clears the input');
    assert.equal(menu.requests.length, requestCount, 'an exact SKU already loaded does not need another request');
  } finally {
    menu.cleanup();
  }
});

const cheeseVariants = [
  ['CHEESE-12', '5 CHEESE 12"', 700],
  ['CHEESE-12-HALF', '5 CHEESE 12" HALF', 475],
  ['CHEESE-16', '5 CHEESE 16"', 950],
  ['CHEESE-16-HALF', '5 CHEESE 16" HALF', 475],
  ['CHEESE-9', '5 CHEESE 9"', 420],
  ['CHEESE-9-HALF', '5 CHEESE 9" HALF', 335],
  ['ALOHA-12', 'ALOHA 5 CHEESE 12"', 725],
  ['ALOHA-12-HALF', 'ALOHA 5 CHEESE 12" HALF', 205],
].map(([product_id, item_name, selling_price]) => ({
  product_id, item_name, selling_price, sku: `SKU-${product_id}`,
  item_category: 'PIZZA', subcategory_item_category: 'House Specials',
  isDiscountable: 'Yes', vatable: 'Yes', unit_cost: 100,
}));
const familyCard = (tree, name) => menuCards(tree).find(node =>
  all(node, child => child.type === 'h4' && text(child) === name).length,
);
const variantModal = tree => all(tree, node => node.props?.group?._isVariantGroup && typeof node.props.onSelect === 'function')[0];
const cartItems = tree => all(tree, node => Array.isArray(node.props?.items) && typeof node.props?.updateQuantity === 'function').flatMap(node => node.props.items);
const physicalCartItems = tree => cartItems(tree).flatMap(item => item.combinationParts || [item]);
const labelledButton = (tree, label) => all(tree, node => node.type === 'button' && node.props['aria-label'] === label)[0];
const variantButtons = tree => all(tree, node => node.type === 'button' && node.props['data-product-id']);

const cclMenuProducts = [
  { product_id: 'BD-f8314f512c10', item_name: 'CCL ALMOND', item_category: 'ADD ONS',
    subcategory_item_category: 'CCL Flavors', sku: 'CCL-ALMOND', selling_price: 5 },
  { product_id: 'BD-c0130f294013', item_name: '  ccl HAZELNUT', item_category: ' add on ',
    subcategory_item_category: 'Syrups', sku: 'CCL-HAZELNUT', selling_price: 10 },
  { product_id: 'ADD-VANILLA', item_name: 'Vanilla Syrup', item_category: 'ADD ONS',
    subcategory_item_category: 'Syrups', sku: 'VANILLA', selling_price: 25 },
  { product_id: 'DRINK-CCL', item_name: 'CCL Coffee', item_category: 'DRINKS',
    sku: 'COFFEE', selling_price: 100 },
  { product_id: 'ADD-INNER-CCL', item_name: 'Vanilla CCL Blend', item_category: 'ADD ONS',
    sku: 'BLEND', selling_price: 30 },
  { product_id: 'ADD-CCLASSIC', item_name: 'CCLASSIC Syrup', item_category: 'ADD ONS',
    sku: 'CLASSIC', selling_price: 35 },
];

test("CCL add-ons stay hidden from menu and global search without hiding other products", async () => {
  const menu = await loadedMenu({ products: cclMenuProducts,
    categories: [{ item_category: 'ADD ONS' }, { item_category: 'DRINKS' }],
  });
  try {
    assert.equal(menu.requests[0].item_category, 'ADD ONS');
    assert(button(menu.state.tree, 'ADD ONS'), 'the category remains available for normal add-ons');
    assert.deepEqual(menuCards(menu.state.tree).map(node => node.key),
      ['ADD-VANILLA', 'DRINK-CCL', 'ADD-INNER-CCL', 'ADD-CCLASSIC']);
    assert.deepEqual(menu.search('almond'), []);
    assert.deepEqual(menu.search('hazelnut'), []);
    assert.deepEqual(menu.search('CCL-ALMOND'), [], 'searching the SKU cannot expose a hidden add-on');
    assert.deepEqual(menu.search('ccl'), ['DRINK-CCL', 'ADD-INNER-CCL', 'ADD-CCLASSIC'],
      'CCL is hidden only as the leading identifier of an add-on product');
    assert.deepEqual(menu.search('vanilla syrup'), ['ADD-VANILLA']);
    menuCards(menu.state.tree)[0].props.onClick();
    menu.render();
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'ADD-VANILLA').quantity, 1,
      'a normal add-on remains orderable');
  } finally { menu.cleanup(); }
});

test("CCL-only folders disappear and mixed folders count only visible add-ons", async () => {
  const menu = await loadedMenu({ products: cclMenuProducts, subcategories: true,
    categories: [{ item_category: 'ADD ONS' }, { item_category: 'DRINKS' }],
  });
  try {
    assert(!menuCards(menu.state.tree).some(node => node.key === 'folder-CCL Flavors'));
    assert.equal(button(menu.state.tree, 'CCL Flavors'), undefined);
    const syrupFolder = menuCards(menu.state.tree).find(node => node.key === 'folder-Syrups');
    assert(syrupFolder);
    assert(text(syrupFolder).includes('1 option'), 'hidden add-ons do not inflate folder counts');
    syrupFolder.props.onClick();
    menu.render();
    assert.deepEqual(menuCards(menu.state.tree).map(node => node.key), ['ADD-VANILLA']);
    assert.deepEqual(menu.search('ccl'), ['DRINK-CCL', 'ADD-INNER-CCL', 'ADD-CCLASSIC'],
      'global search outside an open folder still applies the add-on exclusion');
    assert.deepEqual(menu.search(''), ['ADD-VANILLA']);
  } finally { menu.cleanup(); }
});

test("CCL add-on scans cannot add cart rows through local matches or API lookup", async () => {
  for (const localMatch of [true, false]) {
    const products = localMatch ? cclMenuProducts : cclMenuProducts.slice(2);
    const menu = await loadedMenu({ retail: true, products, lookupProducts: cclMenuProducts.slice(0, 2) });
    try {
      menu.search('vanilla syrup');
      menuCards(menu.state.tree)[0].props.onClick();
      menu.render();
      const before = JSON.stringify(cartItems(menu.state.tree));
      for (const sku of ['CCL-ALMOND', 'CCL-HAZELNUT']) {
        const requestsBefore = menu.requests.length;
        menu.search(sku);
        menu.searchInput().props.onKeyDown({ key: 'Enter', preventDefault() {} });
        await flush();
        menu.render();
        assert.equal(JSON.stringify(cartItems(menu.state.tree)), before,
          `${localMatch ? 'local' : 'API'} scan of ${sku} leaves existing cart rows unchanged`);
        assert.equal(menu.alerts.at(-1), 'This add-on is not available for ordering.');
        assert.equal(menu.searchInput().props.value, '', 'rejected scans clear the input for the next item');
        assert.equal(menu.requests.length, requestsBefore + (localMatch ? 0 : 1));
        if (!localMatch) assert.equal(menu.requests.at(-1).limit, 20);
      }
    } finally { menu.cleanup(); }
  }
});

test("a 100-card menu reuses its grid during cart and dialog updates but refreshes search and category results", async () => {
  const products = Array.from({ length: 100 }, (_, index) => ({
    product_id: `PERF-${index + 1}`, item_name: `Menu item ${index + 1}`,
    item_category: 'PIZZA', selling_price: 10, isDiscountable: 'Yes', vatable: 'Yes',
  }));
  const menu = await loadedMenu({ products });
  const grid = () => all(menu.state.tree,
    node => node.props?.role === 'group' && node.props['aria-label'] === 'Available menu')[0];
  const list = () => all(menu.state.tree,
    node => Array.isArray(node.props?.items) && typeof node.props.updateQuantity === 'function'
      && node.props.items.some(item => item.code === 'PERF-1'))[0];
  let categoryCleanup;
  try {
    const initialGrid = grid();
    assert.equal(menuCards(initialGrid).length, 100);
    const firstCard = menuCards(initialGrid)[0];
    firstCard.props.onClick();
    menu.render();
    assert.equal(grid(), initialGrid, 'adding an item does not rebuild 100 menu cards');
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'PERF-1').quantity, 1);
    firstCard.props.onClick();
    menu.render();
    assert.equal(grid(), initialGrid);
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'PERF-1').quantity, 2,
      'the cached card callback uses the latest cart state');
    const item = list().props.items.find(item => item.code === 'PERF-1');
    list().props.updateQuantity(item.lineId, 1);
    menu.render();
    assert.equal(grid(), initialGrid);
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'PERF-1').quantity, 3);
    list().props.openItemInstructionModal(item);
    menu.render();
    assert(all(menu.state.tree, node => node.type === 'h3' && text(node) === 'Item Instruction').length);
    assert.equal(grid(), initialGrid, 'opening a cart dialog leaves the menu element tree intact');
    button(menu.state.tree, 'Cancel').props.onClick();
    menu.render();
    assert.equal(grid(), initialGrid);

    assert.deepEqual(menu.search('Menu item 100'), ['PERF-100']);
    const searchedGrid = grid();
    assert.notEqual(searchedGrid, initialGrid, 'search must invalidate the menu contents');
    menu.search('');
    assert.equal(menuCards(grid()).length, 100);
    assert.notEqual(grid(), searchedGrid);
    const previousCategoryGrid = grid();
    const drink = { product_id: 'PERF-TEA', item_name: 'Fresh tea', item_category: 'DRINKS', selling_price: 25 };
    products.splice(0, products.length, drink);
    button(menu.state.tree, 'DRINKS').props.onClick();
    menu.render();
    categoryCleanup = menu.state.effects.find(effect => effect.toString().includes('get_pricing_selection.php')
      && effect.toString().includes('setIsPricingLoading'))();
    await flush();
    menu.render();
    assert.equal(menu.requests.at(-1).item_category, 'DRINKS');
    assert.notEqual(grid(), previousCategoryGrid, 'a refreshed category response replaces cached cards');
    assert.deepEqual(menuCards(grid()).map(node => node.key), ['PERF-TEA']);
    menuCards(grid())[0].props.onClick();
    menu.render();
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'PERF-TEA').price, 25);
    assert.equal(cartItems(menu.state.tree).find(item => item.code === 'PERF-1').quantity, 3);
  } finally {
    categoryCleanup?.();
    menu.cleanup();
  }
});

test("category sidebar has one constrained scroller below its fixed service selector", async () => {
  const menu = await loadedMenu();
  try {
    const sidebar = all(menu.state.tree, node => node.type === 'aside' && node.props['aria-label'] === 'Menu categories')[0];
    assert(sidebar);
    const classes = node => String(node.props.className || '').split(/\s+/u);
    assert(classes(sidebar).includes('flex-col'));
    assert(classes(sidebar).includes('min-h-0'));
    assert(classes(sidebar).includes('overflow-hidden'));
    const scrollers = all(sidebar, node => classes(node).some(value => ['overflow-y-auto', 'overflow-auto'].includes(value)));
    assert.equal(scrollers.length, 1, 'the outer sidebar must not also scroll');
    assert(classes(scrollers[0]).includes('min-h-0'));
    assert(classes(scrollers[0]).includes('overscroll-contain'));
    assert.equal(all(scrollers[0], node => node.type === 'select').length, 0,
      'the service selector stays outside the scrolling category list');
    assert.equal(all(sidebar, node => node.type === 'select').length, 1);
    assert(button(scrollers[0], 'PIZZA'));
    assert(button(scrollers[0], 'DRINKS'));
  } finally { menu.cleanup(); }
});

test("digital menu collapses six cheese variants, keeps ALOHA separate, and opens without adding", async () => {
  const menu = await loadedMenu({ products: cheeseVariants });
  try {
    assert.equal(menuCards(menu.state.tree).length, 2);
    assert(familyCard(menu.state.tree, '5 CHEESE'));
    assert(familyCard(menu.state.tree, 'ALOHA 5 CHEESE'));
    assert.equal(menu.search('cheese').length, 2);
    assert.equal(menu.search('12 cheese').length, 2, 'size search still finds the matching families');
    assert.equal(menu.search('cheese aloha').length, 1);
    assert(familyCard(menu.state.tree, 'ALOHA 5 CHEESE'));
    menu.search('cheese 12');
    familyCard(menu.state.tree, '5 CHEESE').props.onClick();
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'a family is never inserted as a sellable item');
    const modal = variantModal(menu.state.tree);
    assert(modal);
    assert.equal(modal.props.group.item_name, '5 CHEESE');
    assert.deepEqual(Array.from(modal.props.group.variants, item => item.product_id), cheeseVariants.slice(0, 6).map(item => item.product_id), 'the dialog uses the loaded family, including sizes excluded by the menu search');
    modal.props.onClose();
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    assert.equal(cartItems(menu.state.tree).length, 0, 'dismissing product options leaves the cart unchanged');
  } finally {
    menu.cleanup();
  }
});

test("whole-only modal choices retain their IDs/prices and reject stale Half callbacks", async () => {
  const menu = await loadedMenu({ products: cheeseVariants });
  try {
    familyCard(menu.state.tree, '5 CHEESE').props.onClick();
    menu.render();
    const props = variantModal(menu.state.tree).props;
    const modal = harness('src/components/MainComponents/ProductVariantModal.jsx', { document: { body: {} } });
    const state = modal.render(props);
    assert.equal(labelledButton(state.tree, 'Half'), undefined);
    assert.deepEqual(variantButtons(state.tree).map(node => node.props['data-product-id']), ['CHEESE-9', 'CHEESE-12', 'CHEESE-16']);
    props.onSelect(cheeseVariants[1]);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'an old or forged standalone callback cannot add a portion');
    assert(variantModal(menu.state.tree), 'rejected selection leaves options open');
    variantButtons(state.tree).find(node => node.props['data-product-id'] === 'CHEESE-12').props.onClick();
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    const [item] = cartItems(menu.state.tree);
    const expected = cheeseVariants[0];
    assert.equal(item.code, expected.product_id);
    assert.equal(item.name, expected.item_name);
    assert.equal(item.price, expected.selling_price);
    assert.equal(item.quantity, 1);
    assert.equal(item.unit_cost, expected.unit_cost);
    assert.equal(item.isDiscountable, expected.isDiscountable);
    assert.equal(item.vatable, expected.vatable);
    assert.equal(item.item_category, expected.item_category);
  } finally { menu.cleanup(); }
});

test("variant groups remain inside folders and portion scans open a whole combination instead of adding", async () => {
  const menu = await loadedMenu({ subcategories: true, products: [...cheeseVariants, menuProducts[1]] });
  try {
    assert(menuCards(menu.state.tree).every(node => node.key.startsWith('folder-')));
    menuCards(menu.state.tree).find(node => node.key === 'folder-House Specials').props.onClick();
    menu.render();
    assert.equal(menuCards(menu.state.tree).length, 2);
    assert(familyCard(menu.state.tree, '5 CHEESE'));
    assert.deepEqual(menu.search('tea'), ['MENU-BETA']);
    menu.search('');
    assert.equal(menuCards(menu.state.tree).length, 2, 'clearing search restores the grouped folder contents');
  } finally {
    menu.cleanup();
  }

  const retail = await loadedMenu({ retail: true, products: cheeseVariants });
  try {
    retail.search('SKU-CHEESE-12-HALF');
    retail.searchInput().props.onKeyDown({ key: 'Enter', preventDefault() {} });
    await flush();
    retail.render();
    assert.equal(cartItems(retail.state.tree).length, 0);
    const modal = variantModal(retail.state.tree);
    assert.equal(modal.props.combinationMode, true);
    assert.equal(modal.props.group.item_name, '5 CHEESE');
    assert(modal.props.group.variants.some(item => item.product_id === 'CHEESE-12-HALF'),
      'the combination picker still receives real portion SKUs');
  } finally {
    retail.cleanup();
  }
});

test("variant modal blocks selection during loading or failure and offers retry", () => {
  const group = menuProductVariants.groupMenuProductVariants(cheeseVariants)[0];
  let retries = 0, selections = 0;
  const modal = harness('src/components/MainComponents/ProductVariantModal.jsx', { document: { body: {} } });
  const props = { group, onSelect: () => { selections++; }, onRetry: () => { retries++; }, onClose: noop };
  let state = modal.render({ ...props, isLoading: true });
  assert.equal(variantButtons(state.tree).length, 0);
  assert.equal(labelledButton(state.tree, 'Whole'), undefined);
  assert.equal(labelledButton(state.tree, 'Half'), undefined);
  state = modal.render({ ...props, error: 'Options could not be loaded.' });
  assert.equal(variantButtons(state.tree).length, 0);
  assert.equal(all(state.tree, node => node.props?.role === 'alert').length, 1);
  button(state.tree, 'Try again').props.onClick();
  assert.equal(retries, 1);
  assert.equal(selections, 0);
});

test("half categories, search matches and ingredient-only folders are hidden without hiding ordinary product names", async () => {
  const products = cheeseVariants.map(product => product.item_name.endsWith(' HALF')
    ? { ...product, item_category: 'PIZZA HALF', subcategory_item_category: 'Combination Ingredients' }
    : product);
  products.push({ product_id: 'ORPHAN', item_name: 'ORPHAN 9" HALF', item_category: 'PIZZA HALF',
    subcategory_item_category: 'Combination Ingredients', selling_price: 100 });
  products.push({ product_id: 'FRIED-CHICKEN', item_name: 'HALF FRIED CHICKEN',
    item_category: 'MEATY ENTREE', selling_price: 250 });
  const menu = await loadedMenu({ products, subcategories: true,
    categories: [{ item_category: ' PIZZA HALF ' }, { item_category: 'PIZZA' }, { item_category: 'MEATY ENTREE' }],
  });
  try {
    assert.equal(menu.requests[0].item_category, 'PIZZA', 'a hidden first category is never selected');
    assert.equal(button(menu.state.tree, 'PIZZA HALF'), undefined);
    assert.equal(button(menu.state.tree, 'Combination Ingredients'), undefined);
    const folders = menuCards(menu.state.tree);
    assert(!folders.some(node => node.key === 'folder-Combination Ingredients'));
    assert(text(folders.find(node => node.key === 'folder-House Specials')).includes('4 options'));
    assert.deepEqual(menu.search('half'), ['FRIED-CHICKEN'], 'an ordinary product name is not a portion tag');
    assert.deepEqual(menu.search('orphan'), [], 'a portion without a whole option is never sold alone');
    assert.equal(menu.search('cheese').length, 2);
    familyCard(menu.state.tree, '5 CHEESE').props.onClick();
    menu.render();
    assert(variantModal(menu.state.tree).props.group.variants.some(item => item.product_id === 'CHEESE-12-HALF'),
      'the full family fetch still supplies combination ingredients');
  } finally { menu.cleanup(); }
});

test("a portion found by the barcode API opens the whole-order picker without creating a cart line", async () => {
  const menu = await loadedMenu({ retail: true,
    products: cheeseVariants.filter(product => !product.item_name.endsWith(' HALF')),
    lookupProducts: [cheeseVariants[1]],
  });
  try {
    menu.search('SKU-CHEESE-12-HALF');
    menu.searchInput().props.onKeyDown({ key: 'Enter', preventDefault() {} });
    await flush();
    menu.render();
    assert.equal(menu.requests.at(-1).limit, 20, 'exercise the server lookup, not the local SKU path');
    assert.equal(cartItems(menu.state.tree).length, 0);
    assert.equal(variantModal(menu.state.tree).props.combinationMode, true);
    assert.equal(variantModal(menu.state.tree).props.group.item_name, '5 CHEESE');
  } finally { menu.cleanup(); }
});

test("half-only families cannot fall back to standalone ordering, even at zero price", () => {
  const freeHalf = { ...cheeseVariants[5], selling_price: 0 };
  const missingPrice = { ...cheeseVariants[1], selling_price: null };
  const group = menuProductVariants.groupMenuProductVariants([freeHalf, missingPrice])[0];
  const selected = [];
  const modal = harness('src/components/MainComponents/ProductVariantModal.jsx', { document: { body: {} } });
  const state = modal.render({ group, onSelect: product => selected.push(product), onClose: noop });
  assert.equal(labelledButton(state.tree, 'Half'), undefined);
  assert.equal(variantButtons(state.tree).length, 0);
  assert(text(state.tree).includes('No whole-order options'));
  assert.equal(selected.length, 0);
});

test("whole combinations retain two real portions, stay separate from single-flavor wholes and edit together", async () => {
  const menu = await loadedMenu({ products: cheeseVariants });
  try {
    const open = () => {
      familyCard(menu.state.tree, '5 CHEESE').props.onClick();
      menu.render();
      return variantModal(menu.state.tree).props;
    };
    open().onSelect(cheeseVariants[0]);
    menu.render();
    let props = open();
    props.onCombinationModeChange(true);
    menu.render();
    props = variantModal(menu.state.tree).props;
    props.onSelectCombination(cheeseVariants[1], cheeseVariants[7]);
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    assert.equal(cartItems(menu.state.tree).length, 2, 'one whole combination plus one single-flavor whole');
    const row = cartItems(menu.state.tree).find(item => item._isPizzaCombination);
    assert.equal(row.name, '5 CHEESE + ALOHA 5 CHEESE · 12"');
    assert.equal(row.price, 680);
    assert.equal(row.quantity, 1);
    let items = physicalCartItems(menu.state.tree);
    assert.equal(items.length, 3);
    const loose = items.find(item => !item.itemInstruction);
    const halves = items.filter(item => item.itemInstruction);
    assert.deepEqual(halves.map(item => item.code), ['CHEESE-12-HALF', 'ALOHA-12-HALF']);
    assert.equal(halves.reduce((total, item) => total + item.price, 0), 680);
    assert(halves.every(item => item.quantity === 1 && item.itemInstruction === '2-flavor pizza 12": 5 CHEESE + ALOHA 5 CHEESE'));
    assert.equal(loose.quantity, 1);
    const list = () => all(menu.state.tree, node => Array.isArray(node.props?.items) && node.props.items.some(item => item.lineId === halves[0].lineId) && typeof node.props.updateQuantity === 'function')[0];
    list().props.updateQuantity(halves[0].lineId, 1);
    menu.render();
    assert(physicalCartItems(menu.state.tree).filter(item => item.itemInstruction).every(item => item.quantity === 2));
    assert.equal(cartItems(menu.state.tree).find(item => !item.itemInstruction).quantity, 1);
    list().props.updateQuantityByInput(row.lineId, '3');
    menu.render();
    assert(physicalCartItems(menu.state.tree).filter(item => item.itemInstruction).every(item => item.quantity === 3));

    // A rejected portion cannot alter either order; another whole stays separate.
    open().onSelect(cheeseVariants[1]);
    menu.render();
    assert.equal(physicalCartItems(menu.state.tree).find(item => !item.itemInstruction).quantity, 1);
    variantModal(menu.state.tree).props.onSelect(cheeseVariants[0]);
    menu.render();
    items = physicalCartItems(menu.state.tree);
    assert.equal(items.find(item => !item.itemInstruction).quantity, 2);
    assert(items.filter(item => item.itemInstruction).every(item => item.quantity === 3));
  } finally { menu.cleanup(); }
});

test("combination callback rejects same flavor, different sizes and unknown product IDs", async () => {
  const menu = await loadedMenu({ products: cheeseVariants });
  try {
    familyCard(menu.state.tree, '5 CHEESE').props.onClick();
    menu.render();
    variantModal(menu.state.tree).props.onCombinationModeChange(true);
    menu.render();
    const props = variantModal(menu.state.tree).props;
    for (const [first, second] of [
      [cheeseVariants[1], cheeseVariants[1]],
      [cheeseVariants[5], cheeseVariants[7]],
      [cheeseVariants[0], cheeseVariants[7]],
      [cheeseVariants[1], { ...cheeseVariants[7], product_id: 'MISSING' }],
    ]) props.onSelectCombination(first, second);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    assert(variantModal(menu.state.tree));
    props.onSelectCombination({ ...cheeseVariants[1], selling_price: 1 }, { ...cheeseVariants[7], selling_price: 1 });
    menu.render();
    assert.equal(cartItems(menu.state.tree).reduce((sum, item) => sum + item.price, 0), 680, 'current scoped catalog prices are used, not callback values');
  } finally { menu.cleanup(); }
});

test("saved HALF rows recover combination pairing on reopen and stay linked when reduced or removed", async () => {
  const instruction = '2-flavor pizza 12": 5 CHEESE + ALOHA 5 CHEESE';
  const saved = [cheeseVariants[1], cheeseVariants[7]].map((product, index) => ({
    ...product, ID: index + 1, sales_quantity: 2, item_instruction: instruction,
  }));
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    fetch: async url => {
      assert(url.includes('view_table_transaction.php'));
      return { ok: true, json: async () => ({ summary: { order_type: 'DINE IN' }, order_details: saved }) };
    },
  });
  const props = { transactionId: 'SAVED', tableselected: 'TEST' };
  let state = orders.render(props);
  state.effects.find(effect => effect.toString().includes('view_table_transaction.php'))();
  await flush();
  state = orders.render(props);
  const list = () => all(state.tree, node => Array.isArray(node.props?.items) && node.props.items.length === 1 && typeof node.props.updateQuantity === 'function')[0];
  assert(list().props.items.every(item => item.itemInstruction === instruction && item.quantity === 2));
  let item = list().props.items[0];
  list().props.updateQuantity(item.lineId, -1, item);
  state = orders.render(props);
  assert(list().props.items.every(item => item.quantity === 1));
  item = list().props.items[0];
  list().props.removeItem(item.lineId, item);
  state = orders.render(props);
  button(state.tree, 'Yes').props.onClick();
  state = orders.render(props);
  assert.equal(cartItems(state.tree).length, 0);
});

test("one combination UI row saves two inventory codes with their own prices and quantities", async () => {
  let savedItems;
  const menu = await loadedMenu({ retail: true, products: cheeseVariants, onSave: items => { savedItems = items; } });
  try {
    menu.search('cheese');
    familyCard(menu.state.tree, '5 CHEESE').props.onClick();
    menu.render();
    variantModal(menu.state.tree).props.onCombinationModeChange(true);
    menu.render();
    variantModal(menu.state.tree).props.onSelectCombination(cheeseVariants[1], cheeseVariants[7]);
    menu.render();
    const rows = cartItems(menu.state.tree);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].price, 680);
    assert.equal(rows[0].quantity, 1);
    const list = all(menu.state.tree, node => node.props?.items?.[0]?._isPizzaCombination && typeof node.props.updateQuantity === 'function')[0];
    const cardTree = list.type(list.props);
    assert.equal(all(cardTree, node => node.type === 'input' && node.props.type === 'number').length, 1);
    assert(text(cardTree).includes('Combine flavor · Whole pizza'));
    assert(text(cardTree).includes('₱680'));
    list.props.updateQuantity(rows[0].lineId, 1, rows[0]);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 1);
    assert.equal(cartItems(menu.state.tree)[0].quantity, 2);
    await button(menu.state.tree, 'Proceed to Payment (F12)').props.onClick();
    assert.deepEqual(savedItems.map(item => [item.product_id, item.selling_price, item.sales_quantity]), [
      ['CHEESE-12-HALF', 475, 2], ['ALOHA-12-HALF', 205, 2],
    ]);
    assert(savedItems.every(item => !('_isPizzaCombination' in item) && !('combinationParts' in item)));
    assert.equal(savedItems.reduce((sum, item) => sum + item.selling_price * item.sales_quantity, 0), 1360);
  } finally { menu.cleanup(); }
});

test("increasing a reopened grouped row copies individual HALF prices into new and saved data", async () => {
  const instruction = '2-flavor pizza 12": 5 CHEESE + ALOHA 5 CHEESE';
  // The read endpoint does not return master-list category on persisted rows.
  const saved = [cheeseVariants[1], cheeseVariants[7]].map((product, index) => ({
    ...product, item_category: undefined, ID: index + 1, sales_quantity: 1, item_instruction: instruction,
  }));
  let savedItems;
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    fetch: async (url, options) => {
      if (url.includes('/update_order.php')) {
        savedItems = JSON.parse(options.body.get('cart_items'));
        return { ok: true, json: async () => ({ status: 'success', transaction_id: 'SAVED' }) };
      }
      assert(url.includes('view_table_transaction.php'));
      return { ok: true, json: async () => ({ summary: { order_type: 'DINE IN' }, order_details: saved }) };
    },
  }, { '../../context/useZustandLayoutMode': () => ({ layoutMode: 'Restaurant Version 2' }) });
  const props = { transactionId: 'SAVED', tableselected: 'TEST', setshoworderlist: noop };
  let state = orders.render(props);
  state.effects.find(effect => effect.toString().includes('view_table_transaction.php'))();
  await flush();
  state = orders.render(props);
  const list = all(state.tree, node => node.props?.items?.[0]?._isPizzaCombination && typeof node.props.updateQuantity === 'function')[0];
  const row = list.props.items[0];
  assert.equal(row.price, 680);
  list.props.updateQuantity(row.lineId, 1, row);
  state = orders.render(props);
  const newRow = cartItems(state.tree).find(item => !item.isLoadedFromDB);
  assert(newRow?._isPizzaCombination, 'new additions copied from a saved pair remain one display row');
  assert.equal(newRow.price, 680);
  assert.deepEqual(Array.from(newRow.combinationParts, item => [item.code, item.price]).sort(), [['ALOHA-12-HALF', 205], ['CHEESE-12-HALF', 475]]);
  await button(state.tree, 'Proceed to Payment (F12)').props.onClick();
  assert.deepEqual(savedItems.map(item => [item.product_id, item.selling_price, item.sales_quantity]), [
    ['CHEESE-12-HALF', 475, 2], ['ALOHA-12-HALF', 205, 2],
  ]);
});

const platterProducts = [
  ['ALARM', '5 ALARM', 535],
  ['ALARM-HALF', '5 ALARM HALF', 267.5],
  ['JERK', 'JAMAICAN JERK', 550],
  ['JERK-HALF', 'JAMAICAN JERK HALF', 275],
  ['PARMESAN', 'BAKED PARMESAN', 535],
  ['PARMESAN-HALF', 'BAKED PARMESAN HALF', 267.5],
].map(([product_id, item_name, selling_price]) => ({
  product_id, item_name, selling_price, sku: `SKU-${product_id}`,
  item_category: 'CHICKEN WINGS PLATTER', isDiscountable: 'Yes', vatable: 'Yes', unit_cost: 100,
}));
const platterInstruction = '2-flavor chicken wings platter: 5 ALARM + JAMAICAN JERK';
const cartList = tree => all(tree, node => node.props?.items?.some(orderCombinationCart.isGroupedOrderItem)
  && typeof node.props.updateQuantity === 'function')[0];
function openPlatterCombination(menu, family = '5 ALARM') {
  familyCard(menu.state.tree, family).props.onClick();
  menu.render();
  variantModal(menu.state.tree).props.onCombinationModeChange(true);
  menu.render();
  return variantModal(menu.state.tree).props;
}

test("whole platter selection uses two real HALF prices and edits quantity, notes and removal together", async () => {
  const menu = await loadedMenu({ products: platterProducts });
  try {
    const props = openPlatterCombination(menu);
    const modal = harness('src/components/MainComponents/ProductVariantModal.jsx', { document: { body: {} } });
    const optionsTree = modal.render(props).tree;
    assert(text(optionsTree).includes('Combine two different flavors in one whole chicken wings platter.'));
    const options = all(optionsTree, node => node.type === PlatterCombinationOptions)[0];
    assert(options, 'the whole platter opens its platter selection component');
    assert.equal(options.props.products.length, platterProducts.length, 'the completed half-catalog hook serves platter data');
    options.props.onSelect(platterProducts[1], platterProducts[3]);
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    let row = cartItems(menu.state.tree)[0];
    assert.equal(cartItems(menu.state.tree).length, 1);
    assert.equal(row.name, '5 ALARM + JAMAICAN JERK · Whole');
    assert.equal(row.combinationLabel, 'Combine flavor · Whole platter');
    assert.equal(row.price, 542.5);
    assert.equal(row.quantity, 1);
    assert.deepEqual(physicalCartItems(menu.state.tree).map(item => [item.code, item.price, item.quantity]), [
      ['ALARM-HALF', 267.5, 1], ['JERK-HALF', 275, 1],
    ]);
    assert(physicalCartItems(menu.state.tree).every(item => item.itemInstruction === platterInstruction));
    cartList(menu.state.tree).props.updateQuantity(row.lineId, 1, row);
    menu.render();
    assert(physicalCartItems(menu.state.tree).every(item => item.quantity === 2));
    row = cartItems(menu.state.tree)[0];
    cartList(menu.state.tree).props.updateQuantityByInput(row.lineId, '3', row);
    menu.render();
    assert(physicalCartItems(menu.state.tree).every(item => item.quantity === 3));

    row = cartItems(menu.state.tree)[0];
    cartList(menu.state.tree).props.openItemInstructionModal(row);
    menu.render();
    const note = all(menu.state.tree, node => node.type === 'textarea'
      && node.props.placeholder === 'Example: no onions, extra spicy, less ice...')[0];
    assert.equal(note.props.value, '', 'the protected pairing header is not editable as a kitchen note');
    note.props.onChange({ target: { value: 'Extra crispy\nSauce on side' } });
    menu.render();
    const noteDialog = all(menu.state.tree, node => node.type === 'div'
      && node.props.className?.startsWith('rounded-3xl p-6 max-w-md')
      && all(node, child => child.type === 'textarea').length)[0];
    button(noteDialog, 'Save').props.onClick();
    menu.render();
    assert.deepEqual(physicalCartItems(menu.state.tree).map(item => item.itemInstruction), [
      `${platterInstruction}\nExtra crispy\nSauce on side`, `${platterInstruction}\nExtra crispy\nSauce on side`,
    ]);
    assert.equal(cartItems(menu.state.tree)[0].displayInstruction, 'Extra crispy\nSauce on side');
    row = cartItems(menu.state.tree)[0];
    cartList(menu.state.tree).props.removeItem(row.lineId, row);
    menu.render();
    const confirm = button(menu.state.tree, 'Yes');
    if (confirm) { confirm.props.onClick(); menu.render(); }
    assert.equal(physicalCartItems(menu.state.tree).length, 0, 'removing the display row removes both inventory halves');
  } finally { menu.cleanup(); }
});

test("one whole platter display row saves both original IDs, prices, quantities and kitchen instructions", async () => {
  let savedItems;
  const menu = await loadedMenu({ retail: true, products: platterProducts, onSave: items => { savedItems = items; } });
  try {
    menu.search('alarm');
    openPlatterCombination(menu).onSelectCombination(platterProducts[1], platterProducts[3]);
    menu.render();
    const row = cartItems(menu.state.tree)[0];
    assert.equal(row.price, 542.5);
    const list = cartList(menu.state.tree);
    const card = list.type(list.props);
    assert.equal(all(card, node => node.type === 'input' && node.props.type === 'number').length, 1);
    assert(text(card).includes('Combine flavor · Whole platter'));
    list.props.updateQuantity(row.lineId, 1, row);
    menu.render();
    await button(menu.state.tree, 'Proceed to Payment (F12)').props.onClick();
    assert.deepEqual(savedItems.map(item => [item.product_id, item.selling_price, item.sales_quantity, item.item_instruction]), [
      ['ALARM-HALF', 267.5, 2, platterInstruction], ['JERK-HALF', 275, 2, platterInstruction],
    ]);
    assert(savedItems.every(item => !('_isPizzaCombination' in item) && !('combinationParts' in item)));
    assert.equal(savedItems.reduce((sum, item) => sum + item.selling_price * item.sales_quantity, 0), 1085);
  } finally { menu.cleanup(); }
});

test("platter callbacks reject same flavors, whole portions and unknown IDs and use current catalog prices", async () => {
  const menu = await loadedMenu({ products: platterProducts });
  try {
    const props = openPlatterCombination(menu);
    for (const [first, second] of [
      [platterProducts[1], platterProducts[1]],
      [platterProducts[0], platterProducts[3]],
      [platterProducts[1], platterProducts[2]],
      [platterProducts[1], { ...platterProducts[3], product_id: 'MISSING' }],
      [{ ...platterProducts[1], product_id: 'MISSING' }, platterProducts[3]],
    ]) props.onSelectCombination(first, second);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    assert(variantModal(menu.state.tree));
    props.onSelectCombination({ ...platterProducts[1], selling_price: 1 }, { ...platterProducts[3], selling_price: 1 });
    menu.render();
    assert.equal(cartItems(menu.state.tree)[0].price, 542.5, 'submitted callback prices cannot replace the scoped catalog prices');
  } finally { menu.cleanup(); }
});

test("platter selection cannot add while either catalog is loading, failed, or combination mode is disabled", async () => {
  const variantOptions = {}, combinationOptions = {};
  const menu = await loadedMenu({ products: platterProducts, variantOptions, combinationOptions });
  try {
    openPlatterCombination(menu);
    for (const [state, property, value] of [
      [variantOptions, 'isLoading', true], [variantOptions, 'error', 'Family unavailable'],
      [combinationOptions, 'isLoading', true], [combinationOptions, 'error', 'Flavors unavailable'],
    ]) {
      state[property] = value;
      menu.render();
      variantModal(menu.state.tree).props.onSelectCombination(platterProducts[1], platterProducts[3]);
      menu.render();
      assert.equal(cartItems(menu.state.tree).length, 0, `${property} prevents adding from an incomplete catalog`);
      delete state[property];
    }
    menu.render();
    variantModal(menu.state.tree).props.onCombinationModeChange(false);
    menu.render();
    variantModal(menu.state.tree).props.onSelectCombination(platterProducts[1], platterProducts[3]);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
  } finally { menu.cleanup(); }
});

test("a stale platter callback cannot add after its modal closes or another family opens", async () => {
  const menu = await loadedMenu({ products: platterProducts });
  try {
    const staleProps = openPlatterCombination(menu);
    staleProps.onClose();
    menu.render();
    staleProps.onSelectCombination(platterProducts[1], platterProducts[3]);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'a closed modal must not add through an old callback');
    openPlatterCombination(menu, 'BAKED PARMESAN');
    staleProps.onSelectCombination(platterProducts[1], platterProducts[3]);
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'a callback from another family must not change the current order');
  } finally { menu.cleanup(); }
});

const gelatoProducts = [
    ['GELATO-CHOC-6', 'CHOCOLATE 6OZ', 110],
    ['GELATO-CHOC-8', 'CHOCOLATE 8OZ', 145],
    ['GELATO-CHOC-SCOOP', 'CHOCOLATE SCOOP', 65],
    ['GELATO-STRAWBERRY-6', 'STRAWBERRY 6OZ', 110],
    ['GELATO-STRAWBERRY-8', 'STRAWBERRY 8OZ', 145],
    ['GELATO-STRAWBERRY-SCOOP', 'STRAWBERRY SCOOP', 65],
  ].map(([product_id, item_name, selling_price]) => ({
    product_id, item_name, selling_price, item_category: 'GELATO',
    isDiscountable: 'Yes', vatable: 'Yes', unit_cost: 50,
  }));

test("gelato Scoop and ounce sizes share one flavor card while other flavors remain separate", async () => {
  const menu = await loadedMenu({ products: gelatoProducts });
  try {
    assert.equal(menuCards(menu.state.tree).length, 2);
    assert(familyCard(menu.state.tree, 'CHOCOLATE'));
    assert(familyCard(menu.state.tree, 'STRAWBERRY'));
    assert(!menuCards(menu.state.tree).some(node => node.key === 'GELATO-CHOC-SCOOP'));
    assert(text(familyCard(menu.state.tree, 'CHOCOLATE')).includes('Choose size'));
    assert(!text(familyCard(menu.state.tree, 'CHOCOLATE')).includes('portion'));
    familyCard(menu.state.tree, 'CHOCOLATE').props.onClick();
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'opening an ounce family does not add a synthetic item');
    const modal = variantModal(menu.state.tree);
    assert.equal(modal.props.group.sizeKind, 'oz');
    assert.deepEqual(Array.from(modal.props.group.variants, product => product.product_id), ['GELATO-CHOC-6', 'GELATO-CHOC-8', 'GELATO-CHOC-SCOOP']);
    modal.props.onSelect(gelatoProducts[1]);
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    const items = cartItems(menu.state.tree);
    assert.equal(items.length, 1);
    assert.equal(items[0].code, 'GELATO-CHOC-8');
    assert.equal(items[0].name, 'CHOCOLATE 8OZ');
    assert.equal(items[0].price, 145);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].item_category, 'GELATO');
  } finally { menu.cleanup(); }
});

test("a Scoop-first gelato family opens all its sizes and selects the original Scoop SKU and price", async () => {
  const scoop = gelatoProducts[2];
  const menu = await loadedMenu({ products: [scoop, ...gelatoProducts.filter(product => product !== scoop)] });
  try {
    assert.equal(menuCards(menu.state.tree).length, 2);
    const card = familyCard(menu.state.tree, 'CHOCOLATE');
    assert(text(card).includes('Choose size'));
    assert(!text(card).includes('portion'));
    card.props.onClick();
    menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    const modal = variantModal(menu.state.tree);
    assert.equal(modal.props.group.sizeKind, 'scoop');
    assert.deepEqual(Array.from(modal.props.group.variants, product => product.product_id), ['GELATO-CHOC-SCOOP', 'GELATO-CHOC-6', 'GELATO-CHOC-8']);
    modal.props.onSelect(scoop);
    menu.render();
    assert.equal(variantModal(menu.state.tree), undefined);
    const items = cartItems(menu.state.tree);
    assert.equal(items.length, 1);
    assert.equal(items[0].code, 'GELATO-CHOC-SCOOP');
    assert.equal(items[0].name, 'CHOCOLATE SCOOP');
    assert.equal(items[0].price, 65);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].item_category, 'GELATO');
  } finally { menu.cleanup(); }
});

const coffeeProducts = [
  { product_id: 'COFFEE-CAP', sku: 'CAP-SCAN', item_name: 'CAPPUCINO', item_category: 'DRINKS', selling_price: 170, unit_cost: 60, isDiscountable: 'Yes' },
  { product_id: 'COFFEE-LATTE', sku: 'LATTE-SCAN', item_name: 'CAFE LATTE', item_category: 'DRINKS', selling_price: 175, unit_cost: 65, isDiscountable: 'Yes' },
  { product_id: 'COFFEE-ICED', item_name: 'ICED CAFE LATTE', item_category: 'DRINKS', selling_price: 170 },
  { product_id: 'GREEN-TEA', item_name: 'ICED GREEN TEA LATTE', item_category: 'DRINKS', selling_price: 165 },
  { product_id: 'CCL-ALMOND', sku: 'ALMOND-SCAN', item_name: 'CCL ALMOND', item_category: 'ADD ONS', selling_price: 25, unit_cost: 8, isDiscountable: 'No' },
  { product_id: 'CCL-HAZELNUT', item_name: 'CCL HAZELNUT', item_category: 'ADD ONS', selling_price: 35, unit_cost: 9, isDiscountable: 'No' },
];
const coffeeModal = tree => all(tree, node => node.type === CoffeeAddonModal)[0];
function openCoffee(menu, name = 'CAPPUCINO') {
  menu.search(name);
  const card = menuCards(menu.state.tree).find(node => text(node).includes(name));
  assert(card, `coffee menu card ${name}`);
  card.props.onClick();
  menu.render();
  assert(coffeeModal(menu.state.tree));
  return coffeeModal(menu.state.tree).props;
}

test('Cappucino and Cafe Latte names open options; Regular saves only the refreshed drink price', async () => {
  let savedItems;
  const menu = await loadedMenu({ retail: true, products: coffeeProducts, onSave: items => { savedItems = items; } });
  try {
    for (const name of ['CAPPUCINO', 'CAFE LATTE', 'ICED CAFE LATTE']) {
      const before = cartItems(menu.state.tree).length;
      const props = openCoffee(menu, name);
      if (before === 0) assert.equal(cartItems(menu.state.tree).length, 0, 'opening options never adds a drink');
      assert.equal(props.addons.length, 2);
      props.onSelect(null);
      props.onSelect(null);
      menu.render();
      assert(!coffeeModal(menu.state.tree));
    }
    assert.equal(cartItems(menu.state.tree).length, 3);
    assert(cartItems(menu.state.tree).every(row => row.quantity === 1 && !row._isCoffeeAddon));
    menu.search('ICED GREEN TEA LATTE');
    menuCards(menu.state.tree)[0].props.onClick();
    menu.render();
    assert(!coffeeModal(menu.state.tree), 'other latte products retain normal ordering');
    await button(menu.state.tree, 'Proceed to Payment (F12)').props.onClick();
    assert.deepEqual(savedItems.map(item => [item.product_id, item.sales_quantity, item.selling_price]), [
      ['COFFEE-CAP', 1, 170], ['COFFEE-LATTE', 1, 175], ['COFFEE-ICED', 1, 170], ['GREEN-TEA', 1, 165],
    ]);
    assert(savedItems.every(item => item.item_instruction === ''));
  } finally { menu.cleanup(); }
});

test('CCL choice charges the current addon price and saves two linked original SKUs', async () => {
  let savedItems;
  const menu = await loadedMenu({ retail: true, products: coffeeProducts, onSave: items => { savedItems = items; } });
  try {
    const props = openCoffee(menu);
    props.onSelect({ ...coffeeProducts[4], selling_price: 0 });
    menu.render();
    let rows = cartItems(menu.state.tree);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]._isCoffeeAddon, true);
    assert.equal(rows[0].price, 195, 'current scoped prices win over callback prices');
    assert.equal(rows[0].quantity, 1);
    const list = cartList(menu.state.tree);
    assert(text(list.type(list.props)).includes('ALMOND'));
    assert(!text(list.type(list.props)).includes('CCL ALMOND'));
    list.props.updateQuantity(rows[0].lineId, 1, rows[0]);
    menu.render();
    rows = cartItems(menu.state.tree);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantity, 2);
    await button(menu.state.tree, 'Proceed to Payment (F12)').props.onClick();
    assert.deepEqual(savedItems.map(item => [item.product_id, item.sales_quantity, item.selling_price, item.isDiscountable]), [
      ['COFFEE-CAP', 2, 170, 'Yes'], ['CCL-ALMOND', 2, 25, 'No'],
    ]);
    assert(savedItems.every(item => item.item_instruction === 'Coffee add-on: CAPPUCINO + CCL ALMOND'));
    assert.equal(savedItems.reduce((sum, item) => sum + item.sales_quantity * item.selling_price, 0), 390);
    assert(savedItems.every(item => !('_isCoffeeAddon' in item) && !('combinationParts' in item)));
  } finally { menu.cleanup(); }
});

test('Regular and different CCL choices remain separate and a removed drink removes only its linked addon', async () => {
  const menu = await loadedMenu({ products: coffeeProducts });
  try {
    openCoffee(menu).onSelect(null); menu.render();
    openCoffee(menu).onSelect(coffeeProducts[4]); menu.render();
    openCoffee(menu).onSelect(coffeeProducts[5]); menu.render();
    assert.deepEqual(cartItems(menu.state.tree).map(row => row.price), [170, 195, 205]);
    const almond = cartItems(menu.state.tree).find(row => row.name.includes('ALMOND'));
    cartList(menu.state.tree).props.removeItem(almond.lineId, almond);
    menu.render();
    button(menu.state.tree, 'Yes').props.onClick(); menu.render();
    assert.deepEqual(cartItems(menu.state.tree).map(row => row.price), [170, 205]);
  } finally { menu.cleanup(); }
});

test('coffee barcode opens options and stale, invalid, or failed options cannot charge an addon', async () => {
  const coffeeOptions = {};
  const menu = await loadedMenu({ retail: true, products: coffeeProducts, coffeeOptions });
  try {
    menu.search('CAP-SCAN');
    await menu.searchInput().props.onKeyDown({ key: 'Enter', preventDefault() {} }); menu.render();
    assert(coffeeModal(menu.state.tree));
    assert.equal(cartItems(menu.state.tree).length, 0);
    for (const patch of [{ isLoading: true }, { error: 'Failed request' }, { product: null }]) {
      Object.assign(coffeeOptions, patch); menu.render();
      coffeeModal(menu.state.tree).props.onSelect(coffeeProducts[4]);
      coffeeModal(menu.state.tree).props.onSelect(null);
      assert.equal(cartItems(menu.state.tree).length, 0);
      for (const key of Object.keys(patch)) delete coffeeOptions[key];
    }
    menu.render();
    const old = coffeeModal(menu.state.tree).props;
    old.onSelect({ product_id: 'UNKNOWN', selling_price: 0 }); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    old.onClose();
    old.onSelect(coffeeProducts[4]); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    const newer = openCoffee(menu, 'CAFE LATTE');
    old.onSelect(coffeeProducts[4]); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'another drink opening invalidates the old callback');
    newer.onSelect(coffeeProducts[5]); menu.render();
    assert.equal(cartItems(menu.state.tree)[0].price, 210);
  } finally { menu.cleanup(); }
});

test('saved coffee reopens without categories, changes both quantities, and saves original SKU prices', async () => {
  const instruction = 'Coffee add-on: CAPPUCINO + CCL ALMOND\nLess ice';
  // Saved order rows may omit catalog categories or return the addon first.
  const saved = [coffeeProducts[4], coffeeProducts[0]].map((product, index) => ({
    ...product, item_category: undefined, ID: index + 1, sales_quantity: 2, item_instruction: instruction,
  }));
  let savedItems;
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    fetch: async (url, options) => {
      if (url.includes('/update_order.php')) {
        savedItems = JSON.parse(options.body.get('cart_items'));
        return { ok: true, json: async () => ({ status: 'success', transaction_id: 'SAVED-COFFEE' }) };
      }
      assert(url.includes('view_table_transaction.php'));
      return { ok: true, json: async () => ({ summary: { order_type: 'DINE IN' }, order_details: saved }) };
    },
  }, { '../../context/useZustandLayoutMode': () => ({ layoutMode: 'Restaurant Version 2' }) });
  const props = { transactionId: 'SAVED-COFFEE', tableselected: 'TEST', setshoworderlist: noop };
  let state = orders.render(props);
  state.effects.find(effect => effect.toString().includes('view_table_transaction.php'))();
  await flush();
  state = orders.render(props);
  const recentList = () => all(state.tree, node => node.props?.items?.some(item => item._isCoffeeAddon && item.isLoadedFromDB)
    && typeof node.props.updateQuantity === 'function')[0];
  const changeQuantity = delta => {
    const list = recentList();
    const row = list.props.items[0];
    list.props.updateQuantity(row.lineId, delta, row);
    state = orders.render(props);
  };
  let rows = cartItems(state.tree);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]._isCoffeeAddon, true);
  assert.equal(rows[0].name, 'CAPPUCINO · ALMOND');
  assert.equal(rows[0].displayInstruction, 'Less ice');
  assert.equal(rows[0].price, 195);
  assert.equal(rows[0].quantity, 2);
  assert.deepEqual(physicalCartItems(state.tree).map(item => [item.code, item.price, item.quantity]), [
    ['COFFEE-CAP', 170, 2], ['CCL-ALMOND', 25, 2],
  ]);

  changeQuantity(-1);
  assert(physicalCartItems(state.tree).every(item => item.quantity === 1));
  changeQuantity(1);
  assert.equal(cartItems(state.tree).length, 1, 'restoring saved quantities does not create additional rows');
  assert(physicalCartItems(state.tree).every(item => item.quantity === 2));
  changeQuantity(1);
  rows = cartItems(state.tree);
  assert.equal(rows.length, 2, 'a further increase creates a separate linked addition');
  const added = rows.find(item => !item.isLoadedFromDB);
  assert.equal(added._isCoffeeAddon, true);
  assert.equal(added.price, 195);
  assert.deepEqual(Array.from(added.combinationParts, item => [item.code, item.price, item.quantity]), [
    ['COFFEE-CAP', 170, 1], ['CCL-ALMOND', 25, 1],
  ]);
  changeQuantity(-1);
  assert.equal(cartItems(state.tree).length, 1, 'decreasing consumes both additional rows before the saved rows');
  assert(physicalCartItems(state.tree).every(item => item.quantity === 2));
  changeQuantity(1);

  await button(state.tree, 'Proceed to Payment (F12)').props.onClick();
  assert.deepEqual(savedItems.map(item => [item.product_id, item.selling_price, item.sales_quantity]).sort(), [
    ['CCL-ALMOND', 25, 3], ['COFFEE-CAP', 170, 3],
  ]);
  assert(savedItems.every(item => item.item_instruction === instruction));
  assert(savedItems.every(item => !('_isCoffeeAddon' in item) && !('combinationParts' in item)));
  assert.equal(savedItems.reduce((sum, item) => sum + item.selling_price * item.sales_quantity, 0), 585);
});

test('recent quantity decrement is repeatable for both synchronized carts and React updater replay', () => {
  const source = fs.readFileSync(new URL('src/components/MainComponents/Orderlist.jsx', projectRoot), 'utf8');
  const start = source.indexOf('  const updateRecentDisplayQuantity =');
  const end = source.indexOf('  const updateRecentDisplayQuantityByInput =', start);
  assert(start >= 0 && end > start);
  let updater;
  const item = Object.freeze({ code: 'COFFEE-CAP', quantity: 2, isLoadedFromDB: true });
  const rows = Object.freeze([item]);
  vm.runInNewContext(`${source.slice(start, end)}\nupdateRecentDisplayQuantity('saved', -1, item, false);`, {
    item,
    getOrderCombinationSourceItem: value => value,
    isCartFromDB: false,
    buildCartMergeKey: value => value.code,
    syncCartState: callback => { updater = callback; },
  });
  assert.equal(typeof updater, 'function');
  const firstCart = updater(rows);
  const secondCart = updater(rows);
  const replay = updater(rows);
  assert.deepEqual([firstCart[0].quantity, secondCart[0].quantity, replay[0].quantity], [1, 1, 1]);
  assert.equal(item.quantity, 2, 'updater leaves the original saved row untouched');
});

const chickenProducts = ['SOLO', 'DOUBLE', 'GROUP'].flatMap((size, index) => [
  [`WINGS-${size}`, `BUFALLO WINGS ${size}`, 'BUFALLO WINGS', [525, 970, 1410][index]],
  [`SPICY-${size}`, `BUFALLO WINGS ${size} SPICY`, 'BUFALLO WINGS', [525, 970, 1410][index]],
  [`GJ-${size}`, `GJ FRIED CHICKEN ${size}`, 'GJ FRIED CHICKEN', [495, 935, 1360][index]],
  [`WINGS-${size}-HALF`, `BUFFALO WINGS ${size} HALF`, 'BUFALLO WINGS', [262.5, 485, 710][index]],
  [`SPICY-${size}-HALF`, `BUFFALO WINGS ${size} SPICY HALF`, 'BUFALLO WINGS', [262.5, 485, 710][index]],
  [`GJ-${size}-HALF`, `GJ FRIED CHICKEN ${size} HALF`, 'GJ FRIED CHICKEN', [247.5, 935, 1360][index]],
]).map(([product_id, item_name, item_category, selling_price]) => ({
  product_id, item_name, item_category, selling_price, sku: `SKU-${product_id}`,
  unit_cost: 100, isDiscountable: 'Yes', vatable: 'Yes',
}));
const chickenProduct = id => chickenProducts.find(product => product.product_id === id);
function openChickenCombination(menu, family = 'GJ FRIED CHICKEN') {
  menu.search(family);
  const card = familyCard(menu.state.tree, family);
  assert(card, `${family} card must be present`);
  card.props.onClick(); menu.render();
  variantModal(menu.state.tree).props.onCombinationModeChange(true); menu.render();
  return variantModal(menu.state.tree).props;
}

test('sized chicken halves stay hidden while both whole families expose the combination picker', async () => {
  const menu = await loadedMenu({ products: chickenProducts });
  try {
    assert.equal(menuCards(menu.state.tree).length, 2);
    for (const family of ['BUFALLO WINGS', 'GJ FRIED CHICKEN']) {
      const props = openChickenCombination(menu, family);
      const modal = harness('src/components/MainComponents/ProductVariantModal.jsx', { document: { body: {} } });
      const optionsTree = modal.render(props).tree;
      assert(all(optionsTree, node => node.type === ChickenCombinationOptions).length,
        `${family} must support combinations with named serving sizes`);
      assert(props.group.variants.some(product => menuProductVariants.getMenuVariantDetails(product).portion === 'half'));
      props.onClose(); menu.render();
    }
    menu.search('HALF');
    assert.equal(menuCards(menu.state.tree).length, 0, 'half products cannot be sold as standalone menu cards');
  } finally { menu.cleanup(); }
});

test('GJ combines with Buffalo Original or Spicy in both directions using real same-size half prices', async () => {
  for (const size of ['SOLO', 'DOUBLE', 'GROUP']) {
    for (const [family, firstId, secondId] of [
      ['GJ FRIED CHICKEN', `GJ-${size}-HALF`, `WINGS-${size}-HALF`],
      ['GJ FRIED CHICKEN', `GJ-${size}-HALF`, `SPICY-${size}-HALF`],
      ['BUFALLO WINGS', `WINGS-${size}-HALF`, `GJ-${size}-HALF`],
      ['BUFALLO WINGS', `SPICY-${size}-HALF`, `GJ-${size}-HALF`],
    ]) {
      let savedItems;
      const menu = await loadedMenu({ retail: true, products: chickenProducts, onSave: items => { savedItems = items; } });
      try {
        const first = chickenProduct(firstId), second = chickenProduct(secondId);
        openChickenCombination(menu, family).onSelectCombination(
          { ...first, selling_price: 0 }, { ...second, selling_price: 0 });
        menu.render();
        const rows = cartItems(menu.state.tree);
        assert.equal(rows.length, 1);
        assert.equal(rows[0]._isChickenCombination, true);
        assert.equal(rows[0].price, first.selling_price + second.selling_price,
          'use the configured half prices, including prices that are not whole price divided by two');
        assert(!rows[0].name.includes('HALF'));
        cartList(menu.state.tree).props.updateQuantity(rows[0].lineId, 1, rows[0]); menu.render();
        assert(physicalCartItems(menu.state.tree).every(row => row.quantity === 2));
        await button(menu.state.tree, 'Proceed to Payment (F12)').props.onClick();
        assert.deepEqual(savedItems.map(row => [row.product_id, row.selling_price, row.sales_quantity]), [
          [first.product_id, first.selling_price, 2], [second.product_id, second.selling_price, 2],
        ]);
        assert(savedItems.every(row => row.item_instruction === menuChickenCombination.getChickenCombinationInstruction(first, second)));
        assert(savedItems.every(row => !('_isChickenCombination' in row) && !('combinationParts' in row)));
      } finally { menu.cleanup(); }
    }
  }
});

test('chicken combination notes and removal operate on both original products', async () => {
  const menu = await loadedMenu({ products: chickenProducts });
  try {
    const first = chickenProduct('GJ-SOLO-HALF'), second = chickenProduct('WINGS-SOLO-HALF');
    openChickenCombination(menu).onSelectCombination(first, second); menu.render();
    let row = cartItems(menu.state.tree)[0];
    cartList(menu.state.tree).props.updateQuantityByInput(row.lineId, '3', row); menu.render();
    assert(physicalCartItems(menu.state.tree).every(item => item.quantity === 3));
    row = cartItems(menu.state.tree)[0];
    cartList(menu.state.tree).props.openItemInstructionModal(row); menu.render();
    const note = all(menu.state.tree, node => node.type === 'textarea'
      && node.props.placeholder === 'Example: no onions, extra spicy, less ice...')[0];
    assert.equal(note.props.value, '');
    note.props.onChange({ target: { value: 'Sauce on side' } }); menu.render();
    const dialog = all(menu.state.tree, node => node.type === 'div'
      && node.props.className?.startsWith('rounded-3xl p-6 max-w-md')
      && all(node, child => child.type === 'textarea').length)[0];
    button(dialog, 'Save').props.onClick(); menu.render();
    const instruction = `${menuChickenCombination.getChickenCombinationInstruction(first, second)}\nSauce on side`;
    assert(physicalCartItems(menu.state.tree).every(item => item.itemInstruction === instruction));
    row = cartItems(menu.state.tree)[0];
    assert.equal(row.displayInstruction, 'Sauce on side');
    cartList(menu.state.tree).props.removeItem(row.lineId, row); menu.render();
    button(menu.state.tree, 'Yes').props.onClick(); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
  } finally { menu.cleanup(); }
});

test('chicken picker rejects invalid, cross-size, stale and unavailable selections', async () => {
  const variantOptions = {}, combinationOptions = {};
  const menu = await loadedMenu({ products: chickenProducts, variantOptions, combinationOptions });
  try {
    let props = openChickenCombination(menu);
    const first = chickenProduct('GJ-SOLO-HALF'), second = chickenProduct('WINGS-SOLO-HALF');
    for (const [a, b] of [
      [first, first], [first, chickenProduct('WINGS-DOUBLE-HALF')],
      [first, chickenProduct('WINGS-SOLO')], [chickenProduct('GJ-SOLO'), second],
      [{ ...first, product_id: 'UNKNOWN' }, second], [first, { ...second, product_id: 'UNKNOWN' }],
      [chickenProduct('WINGS-SOLO-HALF'), chickenProduct('SPICY-SOLO-HALF')],
    ]) {
      props.onSelectCombination(a, b); menu.render();
      assert.equal(cartItems(menu.state.tree).length, 0, 'first half must belong to the opened family and both must be compatible current rows');
    }
    for (const [state, key, value] of [[variantOptions, 'isLoading', true], [variantOptions, 'error', 'Unavailable'],
      [combinationOptions, 'isLoading', true], [combinationOptions, 'error', 'Unavailable']]) {
      state[key] = value; menu.render();
      variantModal(menu.state.tree).props.onSelectCombination(first, second); menu.render();
      assert.equal(cartItems(menu.state.tree).length, 0);
      delete state[key];
    }
    menu.render(); props = variantModal(menu.state.tree).props;
    props.onClose(); props.onSelectCombination(first, second); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0);
    openChickenCombination(menu, 'BUFALLO WINGS');
    props.onSelectCombination(first, second); menu.render();
    assert.equal(cartItems(menu.state.tree).length, 0, 'old GJ modal cannot submit after Buffalo opens');
    for (const [a, b] of [
      [chickenProduct('SPICY-SOLO-HALF'), second],
      [second, chickenProduct('SPICY-SOLO-HALF')],
    ]) {
      variantModal(menu.state.tree).props.onSelectCombination(a, b); menu.render();
      assert.equal(cartItems(menu.state.tree).length, 0, 'Buffalo second flavor must be GJ, not another Buffalo flavor');
    }
  } finally { menu.cleanup(); }
});

test('a new chicken half barcode opens combination mode and never adds a loose half', async () => {
  const menu = await loadedMenu({ retail: true, products: chickenProducts });
  try {
    menu.search('SKU-SPICY-SOLO-HALF');
    await menu.searchInput().props.onKeyDown({ key: 'Enter', preventDefault() {} }); menu.render();
    const modal = variantModal(menu.state.tree);
    assert(modal?.props.combinationMode);
    assert.equal(cartItems(menu.state.tree).length, 0);
    assert(modal.props.group.variants.some(row => row.product_id === 'WINGS-SOLO'), 'spelling differences still load the whole family');
  } finally { menu.cleanup(); }
});

test('previously saved spicy chicken pairs reopen and keep separate inventory rows after quantity changes', async () => {
  const first = chickenProduct('GJ-SOLO-HALF'), second = chickenProduct('SPICY-SOLO-HALF');
  const instruction = `${menuChickenCombination.getChickenCombinationInstruction(first, second)}\nExtra crispy`;
  const saved = [second, first].map((product, index) => ({
    ...product, item_category: undefined, ID: index + 1, sales_quantity: 2, item_instruction: instruction,
  }));
  let savedItems;
  const orders = harness('src/components/MainComponents/Orderlist.jsx', {
    fetch: async (url, options) => {
      if (url.includes('/update_order.php')) {
        savedItems = JSON.parse(options.body.get('cart_items'));
        return { ok: true, json: async () => ({ status: 'success', transaction_id: 'SAVED-CHICKEN' }) };
      }
      assert(url.includes('view_table_transaction.php'));
      return { ok: true, json: async () => ({ summary: { order_type: 'DINE IN' }, order_details: saved }) };
    },
  }, { '../../context/useZustandLayoutMode': () => ({ layoutMode: 'Restaurant Version 2' }) });
  const props = { transactionId: 'SAVED-CHICKEN', tableselected: 'TEST', setshoworderlist: noop };
  let state = orders.render(props);
  state.effects.find(effect => effect.toString().includes('view_table_transaction.php'))();
  await flush(); state = orders.render(props);
  assert.equal(cartItems(state.tree).length, 1);
  let row = cartItems(state.tree)[0];
  assert.equal(row._isChickenCombination, true);
  assert.equal(row.price, 510);
  assert.equal(row.displayInstruction, 'Extra crispy');
  cartList(state.tree).props.updateQuantity(row.lineId, -1, row); state = orders.render(props);
  assert(physicalCartItems(state.tree).every(item => item.quantity === 1));
  row = cartItems(state.tree)[0];
  cartList(state.tree).props.updateQuantity(row.lineId, 1, row); state = orders.render(props);
  assert(physicalCartItems(state.tree).every(item => item.quantity === 2));
  row = cartItems(state.tree)[0];
  cartList(state.tree).props.updateQuantity(row.lineId, 1, row); state = orders.render(props);
  assert(cartItems(state.tree).some(item => !item.isLoadedFromDB && item._isChickenCombination));
  await button(state.tree, 'Proceed to Payment (F12)').props.onClick();
  assert.deepEqual(savedItems.map(row => [row.product_id, row.selling_price, row.sales_quantity]).sort(), [
    ['GJ-SOLO-HALF', 247.5, 3], ['SPICY-SOLO-HALF', 262.5, 3],
  ]);
  assert(savedItems.every(item => item.item_instruction === instruction));
});
