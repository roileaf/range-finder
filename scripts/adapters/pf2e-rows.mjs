/** Where PF2e sheets and pf2e-hud list items, attacks and spells. */
import { skillItem } from './pf2e-skills.mjs';

const itemOf = (actor, id) => (id ? actor?.items?.get(id) ?? null : null);

function strikeAt(actor, index, itemId) {
  const i = Number(index);
  const action = Number.isInteger(i) ? actor?.system?.actions?.[i] : null;
  if (action?.item && (!itemId || action.item.id === itemId)) return { item: action.item, actionIndex: i };
  return { item: itemOf(actor, itemId), actionIndex: null };
}

const hudActor = app => app?.actor ?? app?.parent?.actor ?? null;
// pf2e-hud panels to fade while a range shows: just the sidebar, plus the persistent bar when enabled.
const hudGhost = (row, { includeBar }) => {
  const byId = id => row.ownerDocument?.getElementById(id) ?? null;
  return [...new Set([byId('pf2e-hud-sidebar'), includeBar ? byId('pf2e-hud-persistent') : null])].filter(Boolean);
};
// Scroll, wand and staff spells live in their entry's collection, not in actor.items.
const spellOf = (actor, entryId, id) => (entryId && id ? actor?.spellcasting?.collections?.get(entryId)?.get(id) : null) ?? itemOf(actor, id);
// Sheet rows: prefer the row's controls strip, else its name heading.
const controlsHost = el => el.querySelector(':scope .item-controls, :scope .controls') ?? el.querySelector(':scope .item-name, :scope .name, :scope h4') ?? el;
// pf2e-hud sidebar rows: their `.controls` are ammo/variant strips, so use the name line.
const nameHost = el => el.querySelector(':scope .name') ?? el;

const SIDEBAR_ID = 'pf2e-hud-sidebar';

/**
 * Alt-previewing a pf2e-hud sidebar row while dragging a token closes the sidebar (it closes on any
 * board mousedown). Returns a function that reopens the sidebar that was open when the preview began.
 * `openSidebar` must be called on the class owning that static (private-static brand checks).
 */
export function hudSidebarRestore(row, app, registry = globalThis.foundry?.applications?.instances) {
  try {
    const instance = registry?.get?.(SIDEBAR_ID);
    if (!instance) return null;
    let Base = instance.constructor;
    while (Base && !Object.hasOwn(Base, 'openSidebar')) Base = Object.getPrototypeOf(Base);
    const name = instance.name;
    const parent = instance.parent;
    if (!Base || !name || !parent) return null;
    return () => {
      try {
        const open = instance.rendered && Base.current === name;
        if (!open && parent.rendered) Base.openSidebar(name, parent);
      } catch (error) {
        console.error('Range Finder |', error);
      }
    };
  } catch (error) {
    console.error('Range Finder |', error);
    return null;
  }
}

export const pf2eRows = [
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.strike[data-action-index]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, null) }),
    host: controlsHost
  },
  {
    hooks: ['renderNPCSheetPF2e'],
    selector: 'li.item.action[data-action-index][data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, el.dataset.itemId) }),
    host: controlsHost
  },
  {
    hooks: ['renderActorSheetPF2e'],
    // Also matches PF2e Unified Spellbook's list (same li.spell markup, with data-entry-id), which that module
    // inserts after the sheet renders — `observe` re-decorates when it appears. Includes `.virtual` rows: a
    // spontaneous caster's signature spell heightened to other ranks (same item, same range).
    selector: 'li.spell[data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, item: spellOf(app.actor, el.dataset.entryId, el.dataset.itemId), actionIndex: null }),
    host: controlsHost,
    observe: true
  },
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: '.tab.inventory li[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: controlsHost
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.attack[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), ...strikeAt(hudActor(app), el.dataset.index, el.dataset.itemId) }),
    host: nameHost,
    ghostTargets: hudGhost,
    onPreview: hudSidebarRestore
  },
  {
    hooks: ['renderSpellsSidebarPF2eHUD'],
    // Signature spells heightened to other ranks render as `.virtual` rows typed "spell-slot-group".
    selector: '.item:is([data-item-type="spell"], [data-item-type="spell-slot-group"])[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: spellOf(hudActor(app), el.dataset.entryId, el.dataset.itemId), actionIndex: null }),
    host: nameHost,
    ghostTargets: hudGhost,
    onPreview: hudSidebarRestore
  },
  {
    hooks: ['renderItemsSidebarPF2eHUD'],
    selector: '.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(hudActor(app), el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: controlsHost,
    ghostTargets: hudGhost,
    onPreview: hudSidebarRestore
  },
  {
    hooks: ['renderPersistentShortcutsPF2eHUD'],
    selector: '.item.shortcut[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: itemOf(hudActor(app), el.dataset.itemId), actionIndex: null }),
    persistentHud: true,
    ghostTargets: hudGhost
  },
  {
    // Character sheet Actions tab: owned action/feat items whose slug is a ranged skill action.
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.action.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item && (item.type === 'action' || item.type === 'feat') ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .button-group') ?? controlsHost(el)
  },
  {
    // NPC sheet abilities (strikes carry data-action-index and are handled above).
    hooks: ['renderNPCSheetPF2e'],
    selector: 'li.item.action[data-item-id]:not([data-action-index])',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item && (item.type === 'action' || item.type === 'feat') ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? controlsHost(el)
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.action[data-item-id]',
    resolve: (el, app) => {
      const actor = hudActor(app);
      const item = itemOf(actor, el.dataset.itemId) ?? skillItem(el.dataset.itemUuid);
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost,
    onPreview: hudSidebarRestore
  },
  {
    // Skills sidebar: rows carry the action's compendium uuid (avoids pf2e-hud's key mismatches, e.g. disable-device).
    hooks: ['renderSkillsSidebarPF2eHUD'],
    selector: '.item.statistic[data-item-uuid]',
    resolve: (el, app) => {
      const item = skillItem(el.dataset.itemUuid);
      return item ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost,
    onPreview: hudSidebarRestore
  }
];
