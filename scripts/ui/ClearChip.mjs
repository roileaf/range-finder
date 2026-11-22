/**
 * While a pinned range keeps a window faded (and click-through), a small chip at the top of the screen says how to
 * get it back: click it, or press the Clear key (Esc by default). Without it, a faded sheet looks stuck.
 * Styled as one of Foundry's own canvas controls (`ui-control button`) and placed in `#ui-top`, so it follows the
 * UI theme and UI scale; outside Foundry's layout it floats at the top of the page.
 */
export const CHIP_ID = 'range-finder-clear-chip';

export class ClearChip {
  #el = null;

  constructor({ onClear, localize = key => key, clearKey = () => null, doc = globalThis.document }) {
    Object.assign(this, { onClear, localize, clearKey, doc });
  }

  get visible() { return Boolean(this.#el?.isConnected); }

  /** Show or hide; safe to call on every change. */
  update(show) {
    if (show && !this.visible) this.#show();
    else if (!show && this.visible) this.#hide();
  }

  #show() {
    const doc = this.doc;
    const el = doc.createElement('button');
    el.type = 'button';
    el.id = CHIP_ID;
    el.className = 'ui-control button range-finder-chip';
    const key = this.clearKey();
    const template = key ? this.localize('RANGE_FINDER.Chip.Label') : this.localize('RANGE_FINDER.Chip.LabelNoKey');

    const icon = doc.createElement('i');
    icon.className = 'fa-solid fa-ruler-combined range-finder-chip-icon';
    icon.setAttribute('aria-hidden', 'true');
    const text = doc.createElement('span');
    text.className = 'range-finder-chip-text';
    // "{key}" becomes a key cap; the rest stays plain text (never HTML from a translation).
    const [before, after = ''] = template.split('{key}');
    text.append(before);
    if (key) {
      const kbd = doc.createElement('kbd');
      kbd.textContent = key;
      text.append(kbd, after);
    }
    const close = doc.createElement('i');
    close.className = 'fa-solid fa-xmark range-finder-chip-close';
    close.setAttribute('aria-hidden', 'true');
    el.append(icon, text, close);
    el.setAttribute('aria-label', template.replace('{key}', key ?? ''));

    el.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      try { this.onClear(); } catch (error) { console.error('Range Finder |', error); }
    });
    const host = doc.getElementById('ui-top');
    if (!host) el.classList.add('is-floating');
    (host ?? doc.body).append(el);
    this.#el = el;
  }

  #hide() {
    this.#el?.remove();
    this.#el = null;
  }
}
