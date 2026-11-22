import assert from 'node:assert/strict';
import test from 'node:test';
import { GHOST_CLASS, GHOSTABLE_CLASS, Ghost } from '../scripts/ui/Ghost.mjs';

function element(rect = { left: 0, top: 0, right: 100, bottom: 100 }) {
  const classes = new Set();
  return {
    isConnected: true,
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
      contains: name => classes.has(name)
    },
    getBoundingClientRect: () => rect
  };
}
function doc() {
  const listeners = new Map();
  return { listeners, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
}

test('fade: hold adds classes, release removes ghost', () => {
  const d = doc(), el = element(), ghost = new Ghost({ doc: d });
  ghost.hold(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  assert.ok(el.classList.contains(GHOSTABLE_CLASS));
  ghost.release(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
});

test('counts holds per element', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!ghost.isGhosted(el));
});

test('no pointermove listener is registered', () => {
  const d = doc(), el = element(), ghost = new Ghost({ doc: d });
  ghost.hold(el, { sticky: true });
  assert.equal(d.listeners.size, 0);
  assert.equal(ghost.onMove, undefined);
});

test('minimize mode', () => {
  const calls = [];
  const app = { minimized: false, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, ['min', 'max']);
  assert.ok(!el.classList.contains(GHOST_CLASS));
});

test('minimize mode leaves an already minimized window alone', () => {
  const calls = [];
  const app = { minimized: true, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, []);
});

test('off mode and null elements are no-ops', () => {
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'off' });
  ghost.hold(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.hold(null, { sticky: true });
  ghost.release(null, { sticky: true });
});

test('releaseAll restores everything', () => {
  const d = doc(), a = element(), b = element(), ghost = new Ghost({ doc: d });
  ghost.hold(a, { sticky: true });
  ghost.hold(b, { sticky: true });
  ghost.releaseAll();
  assert.ok(!a.classList.contains(GHOST_CLASS) && !b.classList.contains(GHOST_CLASS));
  assert.ok(!ghost.isGhosted(a) && !ghost.isGhosted(b));
});

test('minimize mode never fades a window without an app', () => {
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => null });
  ghost.hold(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  assert.ok(!el.classList.contains(GHOSTABLE_CLASS));
  ghost.release(el, { sticky: true });
  assert.ok(!ghost.isGhosted(el));
});

test('releaseAll restores the rest when one maximize throws', () => {
  const original = console.error;
  console.error = () => {};
  try {
    const d = doc(), a = element(), b = element();
    let restoredB = false;
    const appA = { minimized: false, minimize() {}, maximize() { throw new Error('boom'); } };
    const appB = { minimized: false, minimize() {}, maximize() { restoredB = true; } };
    const ghost = new Ghost({ doc: d, mode: () => 'minimize', appFor: el => (el === a ? appA : appB) });
    ghost.hold(a, { sticky: true });
    ghost.hold(b, { sticky: true });
    ghost.releaseAll();
    assert.ok(restoredB);
    assert.ok(!ghost.isGhosted(b));
  } finally {
    console.error = original;
  }
});

test('rejected async maximize is caught, not left unhandled', async () => {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const app = { minimized: false, minimize() {}, maximize: () => Promise.reject(new Error('async')) };
    const ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
    const el = element();
    ghost.hold(el, { sticky: true });
    ghost.release(el, { sticky: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(logged.length, 1);
    assert.equal(logged[0][0], 'Range Finder |');
  } finally {
    console.error = original;
  }
});

test('hold/release accept a list of elements (HUD sidebar + bar)', () => {
  const a = element(), b = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold([a, b], { sticky: true });
  assert.ok(a.classList.contains(GHOST_CLASS) && b.classList.contains(GHOST_CLASS));
  ghost.release([a, b], { sticky: true });
  assert.ok(!a.classList.contains(GHOST_CLASS) && !b.classList.contains(GHOST_CLASS));
  assert.ok(!ghost.isGhosted(a) && !ghost.isGhosted(b));
});

test('onChange runs on hold/release; hasPinnedFade ignores previews and minimize mode', () => {
  let calls = 0;
  const el = element(), ghost = new Ghost({ doc: doc(), onChange: () => { calls++; } });
  ghost.hold(el, { sticky: false });
  assert.equal(ghost.hasPinnedFade(), false, 'an Alt preview alone shows no chip');
  ghost.hold(el, { sticky: true });
  assert.equal(ghost.hasPinnedFade(), true);
  ghost.release(el, { sticky: true });
  assert.equal(ghost.hasPinnedFade(), false);
  ghost.releaseAll();
  assert.equal(calls, 4);
  const min = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => ({ minimized: false, minimize() {}, maximize() {} }) });
  min.hold(element(), { sticky: true });
  assert.equal(min.hasPinnedFade(), false, 'a minimized window is not stuck faded');
});

test('a throwing onChange does not break holding', () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const el = element(), ghost = new Ghost({ doc: doc(), onChange: () => { throw new Error('boom'); } });
    ghost.hold(el, { sticky: true });
    assert.ok(el.classList.contains(GHOST_CLASS));
  } finally { console.error = quiet; }
});
