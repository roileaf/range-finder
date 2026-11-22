/** Fade (or minimize) the window a range was shown from, so the canvas underneath is visible. */
export const GHOST_CLASS = 'range-finder-ghost';
export const GHOSTABLE_CLASS = 'range-finder-ghostable';

const log = (...args) => console.error('Range Finder |', ...args);

export class Ghost {
  #held = new Map();

  /** `onChange()` runs after every hold / release, e.g. to show the clear chip while a pin fades a window. */
  constructor({ mode = () => 'fade', doc = globalThis.document, appFor = () => null, onChange = () => {} } = {}) {
    Object.assign(this, { mode, doc, appFor, onChange });
  }

  /** `el` may be one element or a list (e.g. a HUD sidebar together with its bar). */
  hold(el, { sticky = false } = {}) {
    if (Array.isArray(el)) { for (const one of el) this.hold(one, { sticky }); return; }
    if (!el) return;
    try {
      let entry = this.#held.get(el);
      if (!entry) {
        const mode = this.mode();
        if (mode === 'off') return;
        entry = { mode: mode === 'minimize' ? 'minimize' : 'fade', pins: 0, previews: 0, app: null };
        if (entry.mode === 'minimize') {
          const app = this.appFor(el);
          if (app && !app.minimized) { entry.app = app; this.#call(app, 'minimize'); }
        } else {
          el.classList.add(GHOSTABLE_CLASS, GHOST_CLASS);
        }
        this.#held.set(el, entry);
      }
      if (sticky) entry.pins++;
      else entry.previews++;
      this.#setFaded(true);
    } catch (error) {
      log(error);
    }
    this.#changed();
  }

  release(el, { sticky = false } = {}) {
    if (Array.isArray(el)) { for (const one of el) this.release(one, { sticky }); return; }
    const entry = el ? this.#held.get(el) : null;
    if (!entry) return;
    if (sticky) entry.pins = Math.max(0, entry.pins - 1);
    else entry.previews = Math.max(0, entry.previews - 1);
    if (entry.pins + entry.previews > 0) return this.#changed();
    this.#restore(el, entry);
    this.#held.delete(el);
    this.#changed();
  }

  releaseAll() {
    for (const [el, entry] of this.#held) this.#restore(el, entry);
    this.#held.clear();
    this.#changed();
  }

  isGhosted(el) { return this.#held.has(el); }

  /** A pinned range (not just an Alt preview) is keeping a window faded. */
  hasPinnedFade() {
    for (const entry of this.#held.values()) if (entry.mode === 'fade' && entry.pins > 0) return true;
    return false;
  }

  #changed() {
    try {
      this.onChange();
    } catch (error) {
      log(error);
    }
  }

  #setFaded(faded) {
    for (const [el, entry] of this.#held) {
      if (entry.mode !== 'fade') continue;
      try {
        el.classList.toggle(GHOST_CLASS, faded);
      } catch (error) {
        log(error);
      }
    }
  }

  #call(app, method) {
    try {
      // AppV2 minimize/maximize return promises; a rejection must not go unhandled.
      const result = app[method]?.();
      result?.catch?.(error => log(error));
    } catch (error) {
      log(error);
    }
  }

  #restore(el, entry) {
    try {
      el.classList.remove(GHOST_CLASS);
    } catch (error) {
      log(error);
    }
    if (entry.app) this.#call(entry.app, 'maximize');
  }
}
