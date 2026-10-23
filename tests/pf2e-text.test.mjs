import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { plainText, textRanges } from '../scripts/adapters/pf2e-text.mjs';
import { actionTextSpec, listItems, specFor } from '../scripts/adapters/pf2e.mjs';
import { pf2eRows } from '../scripts/adapters/pf2e-rows.mjs';

const labels = (description, traits = [], name = '') => textRanges({ description, traits, name }).map(rule => rule.label ?? rule.kind);

// Wordings below are taken from the pf2e 8.6 compendia.
test('within N feet (Magnetic Skink, Unsteadying Magnetism)', () => {
  const html = '<p>The skink amplifies its magnetic field and tries to pull the metal away from a creature within 20 feet. If that creature is wearing metal armor or holding a metal item, they must attempt a @Check[fortitude|dc:15] save.</p>';
  assert.deepEqual(labels(html), ['20 ft']);
});

test('auras: leading "N feet." / "N foot." with the aura trait; else the name', () => {
  assert.deepEqual(labels('<p>30 feet. A creature that begins its turn within the area…</p>', ['aura', 'mental']), ['Aura 30 ft']);
  assert.deepEqual(labels('<p>20 foot. DC equal to the siabrae\'s spell DC</p>', ['aura']), ['Aura 20 ft']);
  assert.deepEqual(labels('<p>@Localize[PF2E.NPC.Abilities.Glossary.Telepathy]</p>', ['aura'], 'Telepathy 100 feet'), ['Aura 100 ft']);
  assert.deepEqual(labels('<p>30 feet. Nothing special.</p>', []), [], 'no aura trait: a leading distance alone is not a range');
});

test('templates: emanation, cone, line; a burst aimed "within M feet"', () => {
  assert.deepEqual(labels('<p>The grimple spews a @Template[line|distance:30] of vomit.</p>'), ['Line 30 ft']);
  assert.deepEqual(labels('<p>erupts with magma in a @Template[type:cone|distance:30]{30-foot cone}, dealing</p>'), ['Cone 30 ft']);
  assert.deepEqual(labels('<p>allies in a @Template[emanation|distance:60] who can hear you</p>'), ['Emanation 60 ft']);
  assert.deepEqual(labels('<p>a @Template[type:burst|distance:15] within 200 feet that deals damage</p>'), ['200 ft · Burst 15 ft']);
  assert.deepEqual(labels('<p>bursts in a @Template[burst|distance:10] centered on itself</p>'), ['Burst 10 ft']);
  assert.deepEqual(labels('<p>The dragon breathes a 40-foot cone of fire.</p>'), ['Cone 40 ft']);
});

test('range of N feet; reach; targeted adjacent only', () => {
  assert.deepEqual(labels('<p>a ranged attack with a range of 60 feet</p>'), ['60 ft']);
  assert.deepEqual(labels('<p>Trigger A creature within its reach uses a manipulate action.</p>'), ['reach']);
  assert.deepEqual(labels('<p>Trigger An enemy within your reach would damage you</p>'), ['reach']);
  assert.deepEqual(labels('<p>Trigger An adjacent creature attempts to Escape.</p>'), ['adjacent']);
  assert.deepEqual(labels('<p>applies to all other enemies adjacent to you.</p>'), ['adjacent']);
  // Magnetic Skink, Launch Metal
  assert.deepEqual(labels('<p>dealing @Damage[2d6[bludgeoning]] damage (@Check[reflex|dc:15|basic] save) to all creatures adjacent to the skink.</p>'), ['adjacent']);
  assert.deepEqual(labels('<p>A creature adjacent to Tyrroicese is Grabbed.</p>'), ['adjacent']);
  assert.deepEqual(labels('<p>Any creature that is adjacent to the dragon takes damage.</p>'), ['adjacent']);
  assert.deepEqual(labels('<p>The skink moves to a space adjacent to the target.</p>'), []);
  assert.deepEqual(labels('<p>You Step, but must end your movement adjacent to the triggering ally.</p>'), []);
  assert.deepEqual(labels('<p>Trigger A creature within its reach… then Strike an adjacent creature</p>'), ['reach'], 'reach covers adjacent');
});

test('speeds, bonuses and push distances are not ranges', () => {
  assert.deepEqual(labels('<p>gains a +10-foot status bonus to Speed and a fly Speed of 30 feet</p>'), []);
  assert.deepEqual(labels('<p>Success The creature is pushed back 10 feet.</p>'), []);
  assert.deepEqual(labels('<p>You leap up to 15 feet vertically.</p>'), []);
});

test('several distances are listed in order of appearance, without duplicates', () => {
  const html = '<p>Trigger A living creature within 30 feet is reduced to 0 HP. Effect all enemies within 60 feet and within 30 feet are targeted</p>';
  assert.deepEqual(labels(html), ['30 ft', '60 ft']);
});

test('plainText keeps templates, unwraps labelled enrichers, drops the rest', () => {
  assert.equal(plainText('<p>a @Template[cone|distance:15] and @UUID[x]{Off-Guard} @Check[will|dc:20]</p>'), 'a ⟦cone 15⟧ and Off-Guard');
});

const action = (description, extra = {}) => ({ type: 'action', name: 'Test', uuid: 'Actor.a.Item.t', system: { description: { value: description }, traits: { value: [] } }, ...extra });

test('actionTextSpec: nearest first, contiguous bands; reach uses the actor', () => {
  const spec = actionTextSpec({ system: { attributes: { reach: { base: 5 } } } }, action('<p>an enemy within 60 feet, then a creature within 30 feet</p>'));
  assert.equal(spec.kind, 'radius');
  assert.deepEqual(spec.bands.map(band => [band.min, band.max, band.label]), [[0, 30, '30 ft'], [30, 60, '60 ft']]);
  const reach = actionTextSpec({ getReach: () => 10 }, action('<p>Trigger A creature within its reach uses a move action</p>'));
  assert.equal(reach.kind, 'reach');
  assert.deepEqual(reach.bands.map(band => band.label), ['Reach 10 ft']);
  assert.equal(actionTextSpec({}, action('<p>You gain a +1 bonus.</p>')).kind, 'none');
});

test('specFor: curated entries still win; other actions and feats read their text', () => {
  const demoralize = { type: 'action', slug: 'demoralize', name: 'Demoralize', system: { slug: 'demoralize', description: { value: '<p>within 120 feet</p>' } } };
  assert.equal(specFor({ actor: {}, item: demoralize }).bands[0].max, 30);
  assert.equal(specFor({ actor: {}, item: action('<p>a creature within 20 feet</p>', { type: 'feat' }) }).bands[0].max, 20);
});

test('NPC sheet: ability rows get a button; strike rows are left to the strike row', () => {
  const row = pf2eRows.find(r => r.hooks.includes('renderNPCSheetPF2e') && r.selector.includes(':not([data-action-index])'));
  const doc = new JSDOM(`<ol>
    <li class="item action" data-action-index="0" data-item-type="melee" data-item-id="claw"></li>
    <li class="item action flexrow" data-item-id="skink"><h4></h4><div class="controls"></div></li>
  </ol>`).window.document;
  const els = [...doc.querySelectorAll(row.selector)];
  assert.deepEqual(els.map(el => el.dataset.itemId), ['skink']);
  const item = action('<p>a creature within 20 feet</p>', { id: 'skink' });
  const ctx = row.resolve(els[0], { actor: { items: new Map([['skink', item]]) } });
  assert.equal(ctx.item, item);
  assert.equal(row.host(els[0]).className, 'controls');
});

test('Token HUD list: owned actions with a text range go under Actions', () => {
  const skink = action('<p>a creature within 20 feet</p>', { id: 'skink' });
  const plain = action('<p>You gain a +1 bonus.</p>', { id: 'plain' });
  const out = listItems({ items: new Map([['skink', skink], ['plain', plain]]), type: 'npc' });
  assert.deepEqual(out.filter(entry => entry.group === 'actions').map(entry => entry.item.id), ['skink']);
});
