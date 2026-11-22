import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { CHIP_ID, ClearChip } from '../scripts/ui/ClearChip.mjs';

const setup = (clearKey = () => 'Esc') => {
  const doc = new JSDOM('<body></body>').window.document;
  let cleared = 0;
  const chip = new ClearChip({ doc, onClear: () => { cleared++; }, clearKey, localize: key => ({ 'RANGE_FINDER.Chip.Label': 'Range shown · press {key} or click to clear', 'RANGE_FINDER.Chip.LabelNoKey': 'Range shown · click to clear' })[key] ?? key });
  return { doc, chip, cleared: () => cleared };
};

test('shows once while faded, hides when not; idempotent', () => {
  const { doc, chip } = setup();
  chip.update(true);
  chip.update(true);
  assert.equal(doc.querySelectorAll(`#${CHIP_ID}`).length, 1);
  const el = doc.getElementById(CHIP_ID);
  assert.equal(el.textContent, 'Range shown · press Esc or click to clear');
  assert.equal(el.querySelector('kbd').textContent, 'Esc', 'the key is a key cap');
  assert.ok(el.classList.contains('ui-control') && el.classList.contains('button'), 'styled as a Foundry control');
  assert.ok(el.classList.contains('is-floating'), 'no #ui-top: floats');
  chip.update(false);
  assert.equal(doc.getElementById(CHIP_ID), null);
  assert.equal(chip.visible, false);
});

test('clicking clears; the label drops the key when Clear is unbound', () => {
  const { doc, chip, cleared } = setup(() => null);
  chip.update(true);
  const el = doc.getElementById(CHIP_ID);
  assert.equal(el.tagName, 'BUTTON');
  assert.equal(el.getAttribute('aria-label'), 'Range shown · click to clear');
  el.click();
  assert.equal(cleared(), 1);
});

test('goes into Foundry #ui-top when present (follows UI scale), not floating', () => {
  const doc = new JSDOM('<body><div id="ui-top"></div></body>').window.document;
  const chip = new ClearChip({ doc, onClear() {}, clearKey: () => 'Esc', localize: () => 'Range shown · press {key} or click to clear' });
  chip.update(true);
  const el = doc.getElementById(CHIP_ID);
  assert.equal(el.parentElement.id, 'ui-top');
  assert.ok(!el.classList.contains('is-floating'));
});

test('a translation cannot inject HTML', () => {
  const doc = new JSDOM('<body></body>').window.document;
  const chip = new ClearChip({ doc, onClear() {}, clearKey: () => 'Esc', localize: () => '<img src=x onerror=alert(1)> {key}' });
  chip.update(true);
  assert.equal(doc.querySelector(`#${CHIP_ID} img`), null);
});
