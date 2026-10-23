/**
 * PF2e/SF2e actions and feats without a curated entry: read the range from the description.
 * Wordings mined from every action/feat in the pf2e 8.6 compendia (≈29k unique descriptions):
 * auras ("30 feet." + aura trait), @Template enrichers and "N-foot cone" text, "within N feet",
 * "a range of N feet", "within its reach" and targeted "adjacent" phrasings. Speeds, bonuses,
 * penalties and push/pull distances never match. Pure: returns rules, no Foundry globals.
 */

const SHAPES = new Set(['emanation', 'cone', 'line', 'burst', 'cylinder', 'aura']);
const cap = word => word[0].toUpperCase() + word.slice(1);
const PRONOUN = '(?:its|your|their|his|her|the [\\w\'’-]+(?:\'s|’s))';

/** Description HTML → plain text with templates kept as `⟦shape N⟧`. */
export function plainText(html) {
  return String(html ?? '')
    .replace(/@Template\[([^\]]*)\](?:\{[^}]*\})?/g, (_, args) => {
      const shape = args.match(/(?:^|\|)(?:type:)?([a-z]+)(?=\||$)/)?.[1];
      const feet = Number(args.match(/distance:(\d+)/)?.[1]);
      return shape && feet ? ` ⟦${shape} ${feet}⟧ ` : ' ';
    })
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replace(/@\w+\[[^\]]*\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const shapeLabel = (shape, feet) => `${cap(shape)} ${feet} ft`;

/**
 * Ranges named in an action/feat description, in order of appearance:
 * `{ kind: 'feet', feet, label }` | `{ kind: 'reach' }` | `{ kind: 'adjacent' }`. Empty when none.
 */
export function textRanges({ description = '', traits = [], name = '' } = {}) {
  const text = plainText(description);
  const found = [];
  const add = rule => found.push(rule);

  // Auras: "30 feet. A creature that ends its turn in the aura…"
  const aura = traits.includes('aura') ? text.match(/^(\d+)[- ](?:feet|foot)\b/) ?? String(name).match(/\b(\d+) feet$/) : null;
  if (aura) add({ kind: 'feet', feet: Number(aura[1]), label: `Aura ${aura[1]} ft`, at: -1 });

  const consumed = [];
  // Templates and plain "30-foot cone" text; a burst "within M feet" is aimed up to M away.
  const shapeRe = /⟦([a-z]+) (\d+)⟧|\b(\d+)-foot (emanation|cone|line|burst|cylinder|aura)\b/g;
  for (const m of text.matchAll(shapeRe)) {
    const shape = m[1] ?? m[4], feet = Number(m[2] ?? m[3]);
    if (!SHAPES.has(shape) || !(feet > 0)) continue;
    if (shape === 'burst' || shape === 'cylinder') {
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
      const within = tail.match(/^[^.]*?\bwithin (\d+) feet/);
      if (within) {
        consumed.push(m.index + m[0].length + within.index);
        add({ kind: 'feet', feet: Number(within[1]), label: `${within[1]} ft · ${shapeLabel(shape, feet)}`, at: m.index });
        continue;
      }
    }
    add({ kind: 'feet', feet, label: shapeLabel(shape, feet), at: m.index });
  }

  for (const m of text.matchAll(/\bwithin (\d+) feet\b/g)) {
    if (consumed.some(at => Math.abs(at - m.index) < 60 && at <= m.index)) continue;
    add({ kind: 'feet', feet: Number(m[1]), label: `${m[1]} ft`, at: m.index });
  }
  for (const m of text.matchAll(/\ba range (?:increment )?of (?:up to )?(\d+) feet\b/g)) {
    add({ kind: 'feet', feet: Number(m[1]), label: `${m[1]} ft`, at: m.index });
  }
  for (const m of text.matchAll(new RegExp(`\\bwithin ${PRONOUN} reach\\b`, 'gi'))) add({ kind: 'reach', at: m.index });
  // "an adjacent creature"; "creatures adjacent to you / the skink / Tyrroicese" (not spaces, squares or movement).
  const adjacentBefore = /\b(?:an?|each|all|one|two|the|any) adjacent (?:creature|enemy|enemies|ally|allies|foe|foes|target|opponent)s?\b/gi;
  const adjacentAfter = /\b(?:[Cc]reatures?|[Ee]nem(?:y|ies)|[Aa]ll(?:y|ies)|[Ff]oes?|[Tt]argets?|[Oo]pponents?) (?:(?:that|who) (?:is|are) )?adjacent to (?:you|it|him|her|them|the [\w'’-]+|[A-Z][\w'’-]+)/g;
  for (const re of [adjacentBefore, adjacentAfter]) for (const m of text.matchAll(re)) add({ kind: 'adjacent', at: m.index });

  found.sort((a, b) => a.at - b.at);
  // "within its reach" already covers adjacent creatures.
  const seen = new Set(found.some(rule => rule.kind === 'reach') ? ['adjacent'] : []);
  return found.filter(rule => {
    const key = rule.kind === 'feet' ? `f${rule.feet}` : rule.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ at, ...rule }) => rule);
}

const cache = new Map();
/** Cached `textRanges` for an item (descriptions are re-read on every sheet render). */
export function itemTextRanges(item) {
  const description = item?.system?.description?.value ?? '';
  const traits = item?.system?.traits?.value ?? [];
  const key = `${item?.name ?? ''}\u0000${traits.join(',')}\u0000${description}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 2000) cache.clear();
    hit = textRanges({ description, traits, name: item?.name ?? '' });
    cache.set(key, hit);
  }
  return hit;
}
