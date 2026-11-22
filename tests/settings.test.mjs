import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULE_ID, SETTINGS, canShare, readSettings, registerSettings } from '../scripts/settings.mjs';

function fakeSettings() {
  const registered = new Map(), values = new Map();
  return {
    registered,
    register: (module, key, data) => { assert.equal(module, MODULE_ID); registered.set(key, data); values.set(key, data.default); },
    get: (module, key) => values.get(key)
  };
}

test('registers every setting with the spec defaults and scopes', () => {
  const settings = fakeSettings();
  const onChange = () => {};
  registerSettings(onChange, settings);
  const expected = {
    bandStyle: ['client', 'both'], bandOpacity: ['client', 1], showLabels: ['client', true], badgeScale: ['client', 1],
    palette: ['client', 'default'], dimBehindWalls: ['client', false], ghostMode: ['client', 'fade'],
    ghostPersistentHud: ['client', false], allowSharing: ['world', true], shareRole: ['world', 1], badgesCombatOnly: ['world', false], tokenHudButton: ['client', true], fadeHintShown: ['client', false]
  };
  assert.deepEqual([...settings.registered.keys()].sort(), Object.keys(expected).sort());
  for (const [key, [scope, value]] of Object.entries(expected)) {
    const data = settings.registered.get(key);
    assert.equal(data.scope, scope, key);
    assert.equal(data.default, value, key);
    assert.equal(data.config, key !== 'fadeHintShown', key);
    assert.equal(data.onChange, onChange, key);
    assert.equal(data.name, `RANGE_FINDER.Settings.${key}.Name`);
  }
  assert.deepEqual(Object.keys(settings.registered.get('ghostMode').choices), ['fade', 'minimize', 'off']);
  assert.equal(settings.registered.get('ghostMode').choices.fade, 'RANGE_FINDER.Settings.ghostMode.Choices.fade');
  assert.deepEqual(settings.registered.get('bandOpacity').range, { min: 0.3, max: 1.5, step: 0.1 });
});

test('readSettings returns every key', () => {
  const settings = fakeSettings();
  registerSettings(() => {}, settings);
  const values = readSettings(settings);
  assert.deepEqual(Object.keys(values).sort(), Object.keys(SETTINGS).sort());
  assert.equal(values.ghostMode, 'fade');
});

test('a custom localize is applied to name, hint and choice labels', () => {
  const settings = fakeSettings();
  registerSettings(() => {}, settings, key => `L:${key}`);
  const data = settings.registered.get('ghostMode');
  assert.equal(data.name, 'L:RANGE_FINDER.Settings.ghostMode.Name');
  assert.equal(data.hint, 'L:RANGE_FINDER.Settings.ghostMode.Hint');
  assert.equal(data.choices.fade, 'L:RANGE_FINDER.Settings.ghostMode.Choices.fade');
});

test('canShare: GMs always; others need sharing on and a high enough role', () => {
  const player = { role: 1 }, trusted = { role: 2 }, assistant = { role: 3, isGM: false }, gm = { role: 4, isGM: true };
  assert.equal(canShare(player, { allowSharing: true, shareRole: 1 }), true);
  assert.equal(canShare(player, { allowSharing: true, shareRole: 2 }), false);
  assert.equal(canShare(trusted, { allowSharing: true, shareRole: 2 }), true);
  assert.equal(canShare(trusted, { allowSharing: true, shareRole: 3 }), false);
  assert.equal(canShare(assistant, { allowSharing: true, shareRole: 3 }), true);
  assert.equal(canShare(assistant, { allowSharing: false, shareRole: 1 }), false);
  assert.equal(canShare(gm, { allowSharing: false, shareRole: 3 }), true);
  assert.equal(canShare(null, {}), false);
  assert.equal(canShare(player), true, 'defaults: sharing on, players and up');
});
