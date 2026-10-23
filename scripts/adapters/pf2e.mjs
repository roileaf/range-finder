/** PF2e/SF2e adapter: item → RangeSpec, PF2e measuring rules, token distance. */
import { alternatingDistance } from '../core/cells.mjs';
import { MAX_INCREMENTS, incrementBands, makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { adjustIncrement, adjustReach, adjustSpell, boostBands, grantedThrown, perUseBoosts } from './pf2e-modifiers.mjs';
import { pf2eRows } from './pf2e-rows.mjs';
import { skillActionItems, skillEntry, skillItem, skillSpec } from './pf2e-skills.mjs';
import { itemTextRanges } from './pf2e-text.mjs';
import { baseReach, sluggify, traitNumber, traitsOf } from './pf2e-util.mjs';
import { itemsOf } from './util.mjs';

/** SF2e area weapons: "Area burst 10 ft", "Auto-fire cone 15 ft". Mirrors CharacterPF2e#prepareAreaAttack. */
export function areaSuffix(item, fallback = 0) {
  const traits = traitsOf(item);
  const base = Number(item?.system?.range) || item?.range?.increment || fallback || 0;
  if (traits.includes('automatic')) {
    const half = Math.floor(base / 2);
    return `Auto-fire cone ${Math.max(5, half - (half % 5))} ft`;
  }
  let area = item?.system?.traits?.config?.area ?? null;
  if (!area?.type) {
    const match = traits.map(trait => String(trait).match(/^area-(burst|cone|line)(?:-(\d+))?$/)).find(Boolean);
    if (match) area = { type: match[1], value: match[2] ? Number(match[2]) : null };
  }
  if (!area?.type) return null;
  const value = Number(area.value) || (area.type === 'burst' ? 5 : base);
  return value > 0 ? `Area ${area.type} ${value} ft` : `Area ${area.type}`;
}

const withSuffix = (bands, suffix) => (suffix && bands.length ? [{ ...bands[0], label: `${bands[0].label} · ${suffix}` }, ...bands.slice(1)] : bands);

/** Outer bands for the actor's per-use boosts from `table`, past `from`; `measure(boost)` = { max, text } with that boost. */
const boosted = (actor, item, table, from, measure) => boostBands(perUseBoosts(actor, item, table).map(boost => ({ label: boost.label, ...measure(boost) })), from);

function weaponSpec(actor, item) {
  const name = item.name ?? '';
  const range = item.range ?? null;
  const overlays = [];
  const volley = traitNumber(item, 'volley');
  if (volley) overlays.push({ min: 0, max: volley, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2', badge: 'Volley' });
  const melee = item.isMelee ?? !range;
  const thrownBoosts = (increment, from) => boosted(actor, item, 'weapon', from, boost => {
    const max = adjustIncrement(increment, { actor, weapon: item, boost: boost.id }) * MAX_INCREMENTS;
    return { max, text: `${boost.label} · ${max} ft` };
  });
  if (melee) {
    const raw = actor?.getReach?.({ action: 'attack', weapon: item }) || 5;
    const reach = adjustReach(raw, { actor, weapon: item });
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ft` };
    const reachBoosts = boosted(actor, item, 'reach', reach, boost => {
      const max = adjustReach(raw, { actor, weapon: item, boost: boost.id });
      return { max, text: `${boost.label} · Reach ${max} ft` };
    });
    const suffix = areaSuffix(item, reach);
    // Real PF2e melee weapons have range null; a thrown melee weapon carries its increment in a thrown-N trait.
    const native = traitNumber(item, 'thrown') ?? (range?.increment || null);
    const thrown = native ? adjustIncrement(native, { actor, weapon: item }) : grantedThrown(actor, item) || null;
    if (thrown) {
      const bands = incrementBands(thrown, thrown * MAX_INCREMENTS);
      const extra = native ? thrownBoosts(native, bands.at(-1).max) : [];
      return makeSpec({ kind: 'increments', bands: [...withSuffix(bands, suffix), ...extra], overlays: [reachBand, ...reachBoosts, ...overlays], itemName: name });
    }
    return makeSpec({ kind: 'reach', bands: [...withSuffix([reachBand], suffix), ...reachBoosts], overlays, itemName: name });
  }
  const suffix = areaSuffix(item);
  if (range?.increment) {
    const increment = adjustIncrement(range.increment, { actor, weapon: item });
    const max = increment === range.increment ? range.max ?? increment * MAX_INCREMENTS : increment * MAX_INCREMENTS;
    const bands = incrementBands(increment, max);
    if (bands.length) return makeSpec({ kind: 'increments', bands: [...withSuffix(bands, suffix), ...thrownBoosts(range.increment, bands.at(-1).max)], overlays, itemName: name });
  }
  if (range?.max > 0) return makeSpec({ kind: 'radius', bands: withSuffix(singleBand(range.max), suffix), overlays, itemName: name });
  return noneSpec('Range: —', name);
}

function spellSpec(actor, spell) {
  const name = spell.name ?? '';
  const raw = String(spell.system?.range?.value ?? '').trim();
  const slug = sluggify(raw);
  const feet = slug.match(/^(\d+)-f(?:ee)?t\b/);
  const base = slug === 'touch' ? { kind: 'touch', feet: actor?.system?.attributes?.reach?.base ?? 5 }
    : feet ? { kind: 'feet', feet: Number(feet[1]) } : null;
  if (base) {
    const range = adjustSpell(base, { actor, spell });
    const overlays = range.overlay ? [range.overlay] : [];
    // Reach Spell and the like: an outer band for "only when cast with the boost".
    const extra = boosted(actor, spell, 'spell', range.feet, boost => {
      const max = adjustSpell(base, { actor, spell, boost: boost.id }).feet;
      return { max, text: `${boost.label} · ${max} ft` };
    });
    if (range.kind === 'touch') return makeSpec({ kind: 'reach', bands: [...singleBand(range.feet, 'reach', `Touch · ${range.feet} ft`), ...extra], overlays, itemName: name });
    return makeSpec({ kind: 'radius', bands: [...singleBand(range.feet, 'base'), ...extra], overlays, itemName: name });
  }
  const area = spell.system?.area;
  if (!raw && area?.type === 'emanation' && Number(area.value) > 0) {
    return makeSpec({ kind: 'radius', bands: singleBand(Number(area.value), 'base', `Emanation ${Number(area.value)} ft`), itemName: name });
  }
  return noneSpec(raw ? `Range: ${raw}` : null, name);
}

/**
 * The strike's item. The index alone identifies synthetic strikes (no item); for a real item the index
 * may be stale (actions reorder when weapons are added), so the item's own strike wins.
 */
function strikeItem(actor, actionIndex, item) {
  const actions = actor?.system?.actions ?? [];
  const atIndex = actions[actionIndex]?.item ?? null;
  if (!item) return atIndex;
  if (atIndex && atIndex.id === item.id) return atIndex;
  return actions.find(action => action?.item && action.item.id === item.id)?.item ?? item;
}

/** Most distances one action shows; extra mentions are usually side effects (a later burst, a jump). */
const MAX_TEXT_BANDS = 3;

/** Actions and feats without a curated entry: the ranges their description names, nearest first as bands. */
export function actionTextSpec(actor, item) {
  const name = item?.name ?? '';
  const bands = [];
  for (const rule of itemTextRanges(item).slice(0, MAX_TEXT_BANDS)) {
    if (rule.kind === 'feet') bands.push({ max: rule.feet, tone: 'base', label: rule.label });
    else if (rule.kind === 'adjacent') bands.push({ max: 5, tone: 'reach', label: 'Adjacent' });
    else if (rule.kind === 'reach') {
      const reach = actor?.getReach?.({ action: 'attack' }) || baseReach(actor);
      bands.push({ max: reach, tone: 'reach', label: `Reach ${reach} ft` });
    }
  }
  if (!bands.length) return noneSpec(null, name);
  bands.sort((a, b) => a.max - b.max);
  const distinct = bands.filter((band, i) => i === 0 || band.max !== bands[i - 1].max);
  const kind = distinct.every(band => band.tone === 'reach') ? 'reach' : 'radius';
  return makeSpec({ kind, bands: distinct.map((band, i) => ({ ...band, min: i ? distinct[i - 1].max : 0, penalty: 0 })), itemName: name });
}

export function specFor({ actor, item, actionIndex = null }) {
  if (actionIndex !== null && actionIndex !== undefined) item = strikeItem(actor, actionIndex, item);
  if (!item) return noneSpec();
  if (item.type === 'spell') return spellSpec(actor, item);
  if (item.type === 'weapon' || item.type === 'melee') return weaponSpec(actor, item);
  const entry = skillEntry(item);
  if (entry) return skillSpec(actor, entry, item.name ?? entry.name);
  if (item.type === 'action' || item.type === 'feat') return actionTextSpec(actor, item);
  return noneSpec(null, item.name ?? '');
}

/** A boost band ending at 10 ft is a boosted reach (Giant's Lunge…): it gets the double diagonal too. */
const isReach10 = band => (band?.tone === 'reach' || band?.tone === 'boost') && band.max === 10;

/** PF2e: alternating diagonals; reach exactly 10 (base or boosted) also covers the 15 ft double diagonal. */
export function cellMeasure(_spec, unit = 5) {
  const measure = (from, to, band) => {
    if (isReach10(band) && Math.abs(from.i - to.i) === 2 && Math.abs(from.j - to.j) === 2) return 10;
    return alternatingDistance(from, to, unit);
  };
  measure.bandSensitive = isReach10;
  return measure;
}

export function distance(source, target, spec) {
  if (typeof source?.distanceTo !== 'function') return NaN;
  const options = spec?.kind === 'reach' ? { reach: spec.bands[0].max } : {};
  return source.distanceTo(target, options);
}

/** Spells cast from scrolls, wands and staves aren't actor items, so their uuids don't resolve: find them in the spellcasting collections. */
export function resolveItem(actor, uuid) {
  for (const collection of actor?.spellcasting?.collections?.values?.() ?? []) {
    for (const spell of collection?.values?.() ?? []) if (spell?.uuid === uuid) return spell;
  }
  // Skill-action pins carry the action's compendium uuid; resolve it even when the pack isn't available.
  return skillItem(uuid);
}

/** Token HUD list: strikes, every spellcasting entry's spells (incl. scrolls/wands/staves), other weapons, actions/feats whose text names a range, skill actions. */
export function listItems(actor) {
  const out = [];
  const strikeIds = new Set();
  (actor?.system?.actions ?? []).forEach((action, index) => {
    if (!action?.item || action.visible === false) return;
    strikeIds.add(action.item.id);
    out.push({ item: action.item, actionIndex: index, group: 'attacks' });
  });
  const spellUuids = new Set();
  for (const collection of actor?.spellcasting?.collections?.values?.() ?? []) {
    for (const spell of collection?.values?.() ?? []) {
      if (!spell?.uuid || spellUuids.has(spell.uuid)) continue;
      spellUuids.add(spell.uuid);
      out.push({ item: spell, actionIndex: null, group: 'spells' });
    }
  }
  for (const item of itemsOf(actor)) {
    if ((item?.type === 'weapon' || item?.type === 'melee') && !strikeIds.has(item.id)) out.push({ item, actionIndex: null, group: 'other' });
  }
  const skills = skillActionItems(actor);
  const skillIds = new Set(skills.map(item => item?.id).filter(Boolean));
  for (const item of itemsOf(actor)) {
    if ((item?.type === 'action' || item?.type === 'feat') && !skillIds.has(item.id) && itemTextRanges(item).length) out.push({ item, actionIndex: null, group: 'actions' });
  }
  for (const item of skills) out.push({ item, actionIndex: null, group: 'skills' });
  return out;
}

export const pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, resolveItem, listItems, rows: pf2eRows };
