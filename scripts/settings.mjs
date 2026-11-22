export const MODULE_ID = 'range-finder';

const choices = (key, values) => Object.fromEntries(values.map(value => [value, `RANGE_FINDER.Settings.${key}.Choices.${value}`]));

export const SETTINGS = {
  bandStyle: { scope: 'client', type: String, default: 'both', choices: choices('bandStyle', ['fill', 'outline', 'both']) },
  bandOpacity: { scope: 'client', type: Number, default: 1, range: { min: 0.3, max: 1.5, step: 0.1 } },
  showLabels: { scope: 'client', type: Boolean, default: true },
  badgeScale: { scope: 'client', type: Number, default: 1, range: { min: 0.6, max: 1.6, step: 0.1 } },
  palette: { scope: 'client', type: String, default: 'default', choices: choices('palette', ['default', 'colorblind']) },
  dimBehindWalls: { scope: 'client', type: Boolean, default: false },
  ghostMode: { scope: 'client', type: String, default: 'fade', choices: choices('ghostMode', ['fade', 'minimize', 'off']) },
  ghostPersistentHud: { scope: 'client', type: Boolean, default: false },
  allowSharing: { scope: 'world', type: Boolean, default: true },
  // Foundry user roles: 1 Player, 2 Trusted Player, 3 Assistant GM.
  shareRole: { scope: 'world', type: Number, default: 1, choices: choices('shareRole', [1, 2, 3]) },
  badgesCombatOnly: { scope: 'world', type: Boolean, default: false },
  tokenHudButton: { scope: 'client', type: Boolean, default: true },
  // Hidden: the one-time "press Esc to bring the window back" notification has been shown on this client.
  fadeHintShown: { scope: 'client', type: Boolean, default: false, config: false }
};

// Foundry localizes setting names, hints and choices itself, so the default localize is the identity.

export function registerSettings(onChange, settings = game.settings, localize = key => key) {
  for (const [key, data] of Object.entries(SETTINGS)) {
    const localized = data.choices
      ? { ...data, choices: Object.fromEntries(Object.entries(data.choices).map(([value, label]) => [value, localize(label)])) }
      : data;
    settings.register(MODULE_ID, key, {
      name: localize(`RANGE_FINDER.Settings.${key}.Name`),
      hint: localize(`RANGE_FINDER.Settings.${key}.Hint`),
      config: true,
      ...localized,
      onChange
    });
  }
}

export function readSettings(settings = game.settings) {
  return Object.fromEntries(Object.keys(SETTINGS).map(key => [key, settings.get(MODULE_ID, key)]));
}

/** Shift+click sharing: GMs always; others when sharing is on and their role is at least `shareRole`. */
export function canShare(user, { allowSharing = true, shareRole = 1 } = {}) {
  if (!user) return false;
  if (user.isGM) return true;
  return Boolean(allowSharing) && (Number(user.role) || 0) >= (Number(shareRole) || 1);
}
