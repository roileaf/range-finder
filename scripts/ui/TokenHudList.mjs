/** Token HUD 📏 control and its popover: the token's ranged items, grouped. Never ghosted. */
import { rangeLabel as deriveLabel, showsButton } from '../core/spec.mjs';

export const HUD_HOOK = 'rangeFinderTokenHud';
export const GROUPS = ['attacks', 'spells', 'actions', 'skills', 'other'];
const LIST_ID = 'range-finder-hud-list';

export class TokenHudList {
  #entries = new Map();
  #el = null;
  #button = null;
  #token = null;
  #pending = null;

  constructor({ adapter, triggers, localize = key => key, units = () => 'ft', enabled = () => true, doc = globalThis.document, raf = globalThis.requestAnimationFrame?.bind(globalThis) }) {
    Object.assign(this, { adapter, triggers, localize, units, enabled, doc });
    this.raf = raf ?? (callback => setTimeout(callback, 16));
    triggers.addRows([{
      hooks: [HUD_HOOK],
      selector: '.range-finder-hud-row[data-key]',
      resolve: el => this.#entries.get(el.dataset.key) ?? null,
      wholeRow: true,
      ghostTargets: () => []
    }]);
    doc.addEventListener('keydown', event => {
      try { if (event.key === 'Escape') this.close(); } catch (error) { console.error('Range Finder |', error); }
    });
  }

  get isOpen() { return Boolean(this.#el?.isConnected); }

  /** `renderTokenHUD`: add the 📏 control to the right column for tokens this user owns. */
  attach(hud, root) {
    const token = hud?.object ?? null;
    if (this.#token && this.#token !== token) this.close();
    if (!this.enabled() || !root?.querySelector || !token) return;
    const actor = hud.actor ?? token.actor;
    if (!actor || !(token.isOwner ?? hud.document?.isOwner)) return;
    const column = root.querySelector('.col.right');
    if (!column || column.querySelector('.range-finder-hud-btn')) return;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.className = 'control-icon range-finder-hud-btn';
    const label = this.localize('RANGE_FINDER.Hud.Button');
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    const open = this.isOpen && this.#token === token;
    button.setAttribute('aria-expanded', String(open));
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    button.addEventListener('click', event => {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (this.isOpen && this.#token === token) this.close();
        else this.open(hud, button);
      } catch (error) {
        console.error('Range Finder |', error);
      }
    });
    column.append(button);
    if (open) this.#button = button; // the HUD re-rendered for the same token
  }

  open(hud, anchor = null) {
    this.close();
    const token = hud?.object ?? null;
    const actor = hud?.actor ?? token?.actor;
    if (!token || !actor) return;
    const el = this.doc.createElement('section');
    el.id = LIST_ID;
    el.className = 'range-finder-hud-list';
    el.setAttribute('aria-label', this.localize('RANGE_FINDER.Hud.Button'));
    const rows = this.#collect(actor, token);
    if (!rows.length) {
      const empty = this.doc.createElement('p');
      empty.className = 'range-finder-hud-empty';
      empty.textContent = this.localize('RANGE_FINDER.Hud.Empty');
      el.append(empty);
    }
    for (const group of GROUPS) {
      const list = rows.filter(row => row.group === group);
      if (!list.length) continue;
      const header = this.doc.createElement('h4');
      header.textContent = this.localize(`RANGE_FINDER.Hud.Groups.${group}`);
      const ol = this.doc.createElement('ol');
      for (const row of list) ol.append(this.#row(row));
      el.append(header, ol);
    }
    this.doc.body.append(el);
    this.#el = el;
    this.#token = token;
    this.#button = anchor;
    anchor?.setAttribute?.('aria-expanded', 'true');
    this.#position(el, anchor);
    this.triggers.decorate(el, hud, HUD_HOOK);
  }

  /** Follow the HUD when it moves (token drag / canvas pan). */
  reposition() {
    if (this.isOpen && this.#button?.isConnected) this.#position(this.#el, this.#button);
  }

  /**
   * v14 fires `canvasPan` before `hud.align()`, so the HUD still has its old position. Reposition on the next
   * frame instead, coalescing bursts of pan/refresh events into one.
   */
  scheduleReposition() {
    if (this.#pending !== null || !this.isOpen) return;
    this.#pending = this.raf(() => {
      this.#pending = null;
      try { this.reposition(); } catch (error) { console.error('Range Finder |', error); }
    });
  }

  close() {
    this.#el?.remove();
    this.#button?.setAttribute?.('aria-expanded', 'false');
    this.#el = this.#button = this.#token = null;
    this.#entries.clear();
  }

  #collect(actor, token) {
    const units = this.units();
    const rows = [];
    for (const entry of this.adapter.listItems?.(actor) ?? []) {
      try {
        const ctx = { actor, token, item: entry.item, actionIndex: entry.actionIndex ?? null };
        const spec = this.adapter.specFor(ctx);
        if (!showsButton(spec)) continue;
        const label = this.adapter.rangeLabel?.(spec, units) ?? deriveLabel(spec, units);
        rows.push({ group: GROUPS.includes(entry.group) ? entry.group : 'other', ctx, label });
      } catch (error) {
        console.error('Range Finder |', error);
      }
    }
    return rows;
  }

  #row({ ctx, label }) {
    const key = String(this.#entries.size);
    this.#entries.set(key, ctx);
    const li = this.doc.createElement('li');
    li.className = 'range-finder-hud-row';
    li.dataset.key = key;
    li.dataset.itemUuid = ctx.item.uuid ?? '';
    li.dataset.actionIndex = ctx.actionIndex ?? '';
    if (ctx.item.img) {
      const img = this.doc.createElement('img');
      img.src = ctx.item.img;
      img.alt = '';
      li.append(img);
    }
    const name = this.doc.createElement('span');
    name.className = 'name';
    name.textContent = ctx.item.name ?? '';
    const range = this.doc.createElement('span');
    range.className = 'range';
    range.textContent = label;
    li.append(name, range);
    return li;
  }

  /** Next to the HUD; flips to its left near the screen edge. */
  #position(el, anchor) {
    const box = (anchor?.closest?.('#token-hud') ?? anchor)?.getBoundingClientRect?.();
    if (!box) return;
    const width = el.offsetWidth || 260;
    const viewport = this.doc.defaultView?.innerWidth ?? Infinity;
    const left = box.right + 8 + width > viewport ? Math.max(8, box.left - width - 8) : box.right + 8;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(8, box.top))}px`;
  }
}
