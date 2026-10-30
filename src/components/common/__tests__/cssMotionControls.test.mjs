import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { transformSync } from '@swc/core';

function harness(file, supplied = {}) {
  const states = [], refs = [], callbacks = [], effectStates = [];
  let stateIndex, refIndex, callbackIndex, effectIndex, effects;
  const sameDependencies = (first, second) => Array.isArray(first) && Array.isArray(second)
    && first.length === second.length && first.every((value, index) => Object.is(value, second[index]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
    useCallback(callback, dependencies) {
      const index = callbackIndex++;
      if (!callbacks[index] || !sameDependencies(callbacks[index].dependencies, dependencies)) {
        callbacks[index] = { callback, dependencies };
      }
      return callbacks[index].callback;
    },
    useEffect(callback, dependencies) {
      const index = effectIndex++;
      const previous = effectStates[index];
      if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
        effects.push(() => {
          previous?.cleanup?.();
          const cleanup = callback();
          effectStates[index] = { dependencies, cleanup };
          return cleanup;
        });
      }
    },
  };
  const context = {
    exports: {}, React: hooks,
    window: { innerWidth: 1200, addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {} },
    setTimeout, clearTimeout,
    ...supplied,
    require(name) {
      if (name === 'react') return hooks;
      if (name.startsWith('react-icons/')) return new Proxy({}, { get: (_, key) => key });
      if (name === '../Dropdown/Dropdown') return () => null;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = transformSync(source, {
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020' },
    module: { type: 'commonjs' },
  }).code;
  vm.runInNewContext(compiled, context);
  const Component = context.module.exports.default || context.module.exports.FilterFormCmp;
  return props => {
    stateIndex = refIndex = callbackIndex = effectIndex = 0;
    effects = [];
    return { tree: Component(props), effects };
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
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const labeledButton = (tree, label) => all(tree, node => node.type === 'button' && node.props['aria-label'] === label)[0];
const assertNativeAnimationProps = tree => {
  const motionProps = ['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap'];
  assert.equal(all(tree, node => typeof node.type === 'string' && motionProps.some(prop => prop in node.props)).length, 0);
};

test('native form modal retains conditional visibility and both close callbacks', () => {
  const render = harness('../FormModal.jsx');
  let closes = 0;
  const props = { isOpen: true, title: 'Edit item', onClose: () => closes++, children: 'Form content' };
  let { tree } = render(props);
  assert(text(tree).includes('Form content'));
  assertNativeAnimationProps(tree);
  labeledButton(tree, 'Close modal').props.onClick();
  all(tree, node => node.type === 'div' && typeof node.props.onClick === 'function')[0].props.onClick();
  assert.equal(closes, 2);
  ({ tree } = render({ ...props, isOpen: false }));
  assert.equal(text(tree), '');
});

test('radial menu preserves desktop/mobile button positions and closes after the chosen action', () => {
  for (const width of [1200, 600]) {
    const render = harness('../FloatingRainbowMenu.jsx', {
      window: { innerWidth: width, addEventListener() {}, removeEventListener() {} },
    });
    let invoked = 0;
    const props = { radius: 100, onSalesSummary: () => invoked++, onCreditClearing() {}, onPettyCash() {}, onReports() {}, onCashClosing() {} };
    let { tree } = render(props);
    assert.equal(labeledButton(tree, 'Sales Summary'), undefined);
    labeledButton(tree, 'Toggle menu').props.onClick();
    ({ tree } = render(props));
    assertNativeAnimationProps(tree);
    const choices = all(tree, node => node.type === 'button' && node.props['aria-label'] !== 'Toggle menu');
    assert.equal(choices.length, 5);
    assert.equal(new Set(choices.map(node => node.props.style.transform)).size, 5,
      'every menu item retains its own position after removing animation transforms');
    if (width < 1024) assert.equal(choices[0].props.style.transform, 'translate(-50%, -50%) translate(0px, -60px)');
    else assert(choices[0].props.style.transform.includes('-81.915'), 'desktop buttons keep the computed arc offset');
    labeledButton(tree, 'Sales Summary').props.onClick();
    ({ tree } = render(props));
    assert.equal(invoked, 1);
    assert.equal(labeledButton(tree, 'Sales Summary'), undefined);
  }
});

test('filter dropdown keeps its final offset and forwards form changes', () => {
  const render = harness('../FilterFormCmp.jsx');
  let changed = '';
  const props = { title: 'Filter orders', options: [
    { key: 'search', label: 'Search', type: 'text', value: '', handleChange: event => { changed = event.target.value; } },
  ] };
  let { tree } = render(props);
  all(tree, node => node.type === 'button' && text(node) === 'Filter')[0].props.onClick();
  ({ tree } = render(props));
  const dropdown = all(tree, node => node.type === 'div' && node.props.className?.includes('filter-dropdown'))[0];
  assert.equal(dropdown.props.style.transform, 'translateY(8px)');
  assertNativeAnimationProps(tree);
  all(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'Pizza' } });
  assert.equal(changed, 'Pizza');
});

test('toast CSS progress keeps its duration and timed/manual dismissal calls onClose once', () => {
  for (const manual of [true, false]) {
    let scheduled, closed = 0;
    const render = harness('../../Toasts/Toast.jsx', {
      setTimeout(callback, delay) { scheduled = { callback, delay }; return 1; },
      clearTimeout() {},
    });
    const props = { message: 'Saved', duration: 2750, onClose: () => closed++ };
    let { tree, effects } = render(props);
    effects[0]();
    assert.equal(scheduled.delay, 2750);
    const progress = all(tree, node => node.props.className?.includes('ui-toast-progress'))[0];
    assert.equal(progress.props.style['--ui-toast-duration'], '2750ms');
    assert(progress.props.className.includes('w-full'));
    assertNativeAnimationProps(tree);
    if (manual) labeledButton(tree, 'Close notification').props.onClick();
    scheduled.callback();
    ({ tree } = render(props));
    assert.equal(closed, 1, 'manual close and a pending timer cannot duplicate the callback');
    assert.equal(all(tree, node => node.props.role === 'alert').length, 0);
  }
});

test('a new toast close callback does not restart its timer and the original timer calls the latest callback', () => {
  const scheduled = [], cleared = [];
  const render = harness('../../Toasts/Toast.jsx', {
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length; },
    clearTimeout(timer) { cleared.push(timer); },
  });
  let originalCloses = 0, latestCloses = 0;
  const props = { message: 'Saved', duration: 4000, onClose: () => originalCloses++ };
  let state = render(props);
  state.effects.forEach(effect => effect());
  assert.equal(scheduled.length, 1);
  state = render({ ...props, onClose: () => latestCloses++ });
  state.effects.forEach(effect => effect());
  assert.equal(scheduled.length, 1, 'an unrelated provider rerender must not extend this toast duration');
  assert.deepEqual(cleared, [], 'the original timeout remains active');
  const progress = all(state.tree, node => node.props.className?.includes('ui-toast-progress'))[0];
  assert.equal(progress.props.style['--ui-toast-duration'], '4000ms');
  scheduled[0].callback();
  assert.equal(originalCloses, 0);
  assert.equal(latestCloses, 1, 'the timer uses the latest callback without restarting');
  state = render({ ...props, onClose: () => latestCloses++ });
  state.effects.forEach(effect => effect());
  assert.equal(scheduled.length, 1);
  assert.equal(all(state.tree, node => node.props.role === 'alert').length, 0);
});
