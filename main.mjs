import { getAdapter, registerAdapter } from './scripts/adapters/index.mjs';
import { RangeOverlay } from './scripts/canvas/RangeOverlay.mjs';
import { TargetBadges } from './scripts/canvas/TargetBadges.mjs';
import { makeText, sceneGeometry, sceneUnits } from './scripts/canvas/geometry.mjs';
import { MODULE_ID, canShare, readSettings, registerSettings } from './scripts/settings.mjs';
import { ClearChip } from './scripts/ui/ClearChip.mjs';
import { Ghost } from './scripts/ui/Ghost.mjs';
import { headerButtonV1, headerControlV2 } from './scripts/ui/HeaderButton.mjs';
import { PinManager } from './scripts/ui/PinManager.mjs';
import { TokenHudList } from './scripts/ui/TokenHudList.mjs';
import { Triggers } from './scripts/ui/Triggers.mjs';

const SOCKET = `module.${MODULE_ID}`;
let adapter, pins, ghost, triggers, overlay, badges, hudList, chip;
let frame = null;
const dragging = new Map();
const report = error => console.error('Range Finder |', error);

/** Display name of the first key bound to one of this module's actions (e.g. "Alt", "Escape"), or null when unbound. */
function boundKey(action) {
  try {
    const binding = game.keybindings.get(MODULE_ID, action)?.[0];
    if (!binding?.key) return null;
    const KM = foundry.helpers?.interaction?.KeyboardManager;
    const keys = [...(binding.modifiers ?? []), String(KM?.getKeycodeDisplayString?.(binding.key) ?? binding.key).replace(/(Left|Right)$/, '')];
    return keys.join('+');
  } catch (error) {
    report(error);
    return null;
  }
}
const previewKey = () => boundKey('preview');

/** Chip while a pin keeps a window faded; the first time ever, also a notification naming the Clear key. */
function onGhostChange() {
  const faded = Boolean(ghost?.hasPinnedFade());
  chip?.update(faded);
  if (!faded) return;
  try {
    if (game.settings.get(MODULE_ID, 'fadeHintShown')) return;
    game.settings.set(MODULE_ID, 'fadeHintShown', true);
    const key = boundKey('clearAll');
    ui.notifications.info(key ? game.i18n.localize('RANGE_FINDER.Notify.FadeHint').replace('{key}', key) : game.i18n.localize('RANGE_FINDER.Notify.FadeHintNoKey'));
  } catch (error) { report(error); }
}

const userColor = id => {
  const color = game.users.get(id)?.color;
  return color === undefined || color === null ? null : Number(color);
};

function tokenFor(id) {
  return dragging.get(id) ?? canvas.tokens?.get(id) ?? null;
}

function resolveToken(actor) {
  if (!canvas?.ready || !actor) return null;
  const matches = token => token.actor === actor || (token.actor?.id === actor.id && !actor.isToken);
  return canvas.tokens.controlled.find(matches) ?? actor.getActiveTokens?.()?.[0] ?? null;
}

function appForElement(el) {
  return foundry.applications.instances?.get(el.id) ?? ui.windows?.[el.dataset?.appid] ?? null;
}

function build({ tokenId, itemUuid, actionIndex }) {
  try {
    const token = canvas.tokens?.get(tokenId);
    let item = null;
    if (itemUuid) {
      try { item = fromUuidSync(itemUuid); } catch { item = null; }
      item ??= adapter.resolveItem?.(token?.actor, itemUuid) ?? null;
    }
    if (!token?.actor || (!item && actionIndex == null)) return null;
    return adapter.specFor({ actor: token.actor, token, item, actionIndex, units: sceneUnits() });
  } catch (error) {
    report(error);
    return null;
  }
}

function schedule() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => { frame = null; redraw(); });
}

function redraw() {
  try {
    triggers?.refresh();
    if (!canvas?.ready || !overlay || !badges || !pins) return;
    const settings = readSettings();
    const entries = pins.all().map(pin => ({
      pin,
      token: tokenFor(pin.tokenId),
      adapter,
      tint: pin.shared ? userColor(pin.userId) : null,
      ownerName: pin.shared ? game.users.get(pin.userId)?.name ?? null : null
    })).filter(entry => entry.token);
    const geo = sceneGeometry(canvas);
    overlay.draw(entries, geo);
    const combatIds = settings.badgesCombatOnly ? new Set(game.combat?.combatants.map(c => c.tokenId) ?? []) : null;
    const targets = canvas.tokens.placeables.filter(token => token.visible && !token.isPreview && (!combatIds || combatIds.has(token.id)));
    badges.draw(entries, { targets, zoom: canvas.stage.scale.x, units: sceneUnits(), blockedFor: (entry, target) => geo.losFor(entry.token).point(target.center) });
  } catch (error) {
    report(error);
    ghost?.releaseAll();
  }
}

function setupCanvas() {
  if (!pins) return;
  try {
    overlay?.destroy();
    badges?.destroy();
    // Fills/outlines under the tokens in the grid layer; labels and badges in canvas.interface at zIndex 1000
    // (interface is a sortable CanvasGroup) so neighbouring tokens' erase-blended void meshes can't cut them.
    overlay = new RangeOverlay({ parent: canvas.interface.grid, labelParent: canvas.interface, makeText, settings: readSettings });
    badges = new TargetBadges({ parent: canvas.interface, makeText, settings: readSettings });
    schedule();
  } catch (error) { report(error); }
}

function clearLocal() {
  const had = pins?.clearLocal() ?? false;
  ghost?.releaseAll();
  if (had) schedule();
  return had;
}

const api = { registerAdapter, clear: clearLocal };

/** Render hooks pass an HTMLElement (ApplicationV2) or a jQuery object (ApplicationV1). */
function rootOf(html, app) {
  if (html instanceof HTMLElement) return html;
  const element = html?.[0] ?? app?.element;
  return element instanceof HTMLElement ? element : element?.[0] ?? null;
}

Hooks.once('init', () => {
  registerSettings(() => { pins?.rebuild(); schedule(); });
  game.keybindings.register(MODULE_ID, 'preview', {
    name: 'RANGE_FINDER.Keys.Preview.Name', hint: 'RANGE_FINDER.Keys.Preview.Hint',
    editable: [{ key: 'AltLeft' }],
    onDown: () => { triggers?.keyDown(); return false; },
    onUp: () => { triggers?.keyUp(); return false; },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE_ID, 'clearAll', {
    name: 'RANGE_FINDER.Keys.Clear.Name', hint: 'RANGE_FINDER.Keys.Clear.Hint',
    editable: [{ key: 'Escape' }],
    onDown: () => clearLocal(),
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
  });
  game.modules.get(MODULE_ID).api = api;
  game.keybindings.register(MODULE_ID, 'clearShared', {
    name: 'RANGE_FINDER.Keys.ClearShared.Name', hint: 'RANGE_FINDER.Keys.ClearShared.Hint',
    editable: [], restricted: true,
    onDown: () => { pins?.clearShared(); return true; }
  });
});

Hooks.once('setup', () => {
  // Other modules register adapters here: Hooks.once('rangeFinder.registerAdapters', api => api.registerAdapter(...)).
  try {
    Hooks.callAll('rangeFinder.registerAdapters', api);
  } catch (error) { report(error); }
  adapter = getAdapter(game.system.id);
  for (const hook of new Set((adapter.rows ?? []).flatMap(row => row.hooks ?? []))) {
    Hooks.on(hook, (app, html) => {
      try {
        triggers?.decorate(rootOf(html, app), app, hook);
      } catch (error) { report(error); }
    });
  }
});

Hooks.once('ready', () => {
  chip = new ClearChip({ onClear: clearLocal, localize: key => game.i18n.localize(key), clearKey: () => boundKey('clearAll') });
  ghost = new Ghost({ mode: () => readSettings().ghostMode, appFor: appForElement, onChange: onGhostChange });
  pins = new PinManager({
    userId: game.user.id,
    build,
    onChange: schedule,
    broadcast: message => game.socket.emit(SOCKET, message),
    allowShare: () => canShare(game.user, readSettings()),
    ghost
  });
  triggers = new Triggers({
    adapter, pins, resolveToken,
    notify: message => ui.notifications.warn(message),
    localize: key => game.i18n.localize(key),
    settings: readSettings,
    previewKey
  });
  hudList = new TokenHudList({
    adapter, triggers,
    localize: key => game.i18n.localize(key),
    units: () => sceneUnits(),
    enabled: () => readSettings().tokenHudButton
  });
  document.documentElement.style.setProperty('--range-finder-user', game.user.color?.css ?? '#2ec4b6');
  // Foundry relays the sender's user id as the listener's second argument; trust it over message.userId.
  game.socket.on(SOCKET, (message, senderId) => {
    try {
      if (!message) return;
      if (senderId && message.userId !== senderId) return;
      const sender = game.users.get(senderId ?? message.userId);
      if (message.action === 'clearAll' && !sender?.isGM) return;
      // Ignore shares from users the GM hasn't allowed to share (a modified client could still broadcast).
      if (message.action === 'pin' && !canShare(sender, readSettings())) return;
      pins.receive(message);
    } catch (error) { report(error); }
  });
  window.addEventListener('blur', () => triggers?.keyUp());
  if (canvas?.ready) setupCanvas();
});

Hooks.on('canvasReady', setupCanvas);
Hooks.on('canvasTearDown', () => {
  hudList?.close();
  pins?.reset();
  ghost?.releaseAll();
  overlay?.destroy();
  badges?.destroy();
  overlay = badges = null;
  dragging.clear();
});

Hooks.on('renderTokenHUD', (app, html) => {
  try { hudList?.attach(app, rootOf(html, app)); } catch (error) { report(error); }
});
Hooks.on('closeTokenHUD', () => {
  try { hudList?.close(); } catch (error) { report(error); }
});
for (const hook of ['refreshToken', 'canvasPan']) {
  Hooks.on(hook, () => { try { hudList?.scheduleReposition(); } catch (error) { report(error); } });
}

const headerDeps = () => ({ adapter, triggers, localize: key => game.i18n.localize(key) });
// AppV2 item sheets (dnd5e's ItemSheet5e is a DocumentSheetV2, not an ItemSheetV2): the header controls menu.
Hooks.on('getHeaderControlsDocumentSheetV2', (app, controls) => {
  try {
    if (!triggers) return;
    const control = headerControlV2(app, headerDeps());
    if (control) controls.push(control);
  } catch (error) { report(error); }
});
// AppV1 item sheets (PF2e/SF2e): a header button.
Hooks.on('getItemSheetHeaderButtons', (app, buttons) => {
  try {
    if (!triggers) return;
    const button = headerButtonV1(app, headerDeps());
    if (button) buttons.unshift(button);
  } catch (error) { report(error); }
});

// Foundry v14: drag previews are Token clones; `isPreview` (PlaceableObject getter) is true and `_original`
// is the real token. The preview's document x/y is updated live while dragging.
Hooks.on('refreshToken', token => {
  if (!pins?.size) return;
  if (token.isPreview && token._original) dragging.set(token._original.id, token);
  schedule();
});
Hooks.on('destroyToken', token => {
  if (token.isPreview && token._original && dragging.get(token._original.id) === token) {
    dragging.delete(token._original.id);
    schedule();
  }
});
Hooks.on('deleteToken', document => pins?.dropToken(document.id));
// A sharer who disconnects (closed tab, crash) can't send unpin; drop their shared pins here.
Hooks.on('userConnected', (user, connected) => { if (!connected) pins?.dropUser(user.id); });
Hooks.on('deleteItem', item => { pins?.dropItem(item.uuid); pins?.rebuild(); });
for (const hook of ['updateItem', 'updateActor', 'createItem']) Hooks.on(hook, () => pins?.size && pins.rebuild());
for (const hook of ['createWall', 'updateWall', 'deleteWall', 'createToken', 'updateToken', 'canvasPan', 'controlToken', 'updateCombat', 'deleteCombat']) {
  Hooks.on(hook, () => { if (pins?.size) schedule(); });
}

Hooks.on('getSceneControlButtons', controls => {
  if (!game.user?.isGM) return;
  const tokens = Array.isArray(controls) ? controls.find(c => c.name === 'token') : controls.tokens;
  if (!tokens) return;
  const tool = {
    name: 'range-finder-clear', title: 'RANGE_FINDER.Controls.ClearShared', icon: 'fa-solid fa-ruler-combined',
    button: true, visible: true
  };
  if (Array.isArray(tokens.tools)) {
    tokens.tools.push({ ...tool, onClick: () => pins?.clearShared() });
  } else {
    tokens.tools ??= {};
    tokens.tools[tool.name] = { ...tool, order: Object.keys(tokens.tools).length, onChange: (_event, active) => { if (active) pins?.clearShared(); } };
  }
});
