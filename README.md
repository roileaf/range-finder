# Range Finder

See an item's, attack's, spell's or skill action's range right on the canvas — in any system.

- **📏 on item rows** — PF2e/SF2e character and NPC sheets (strikes, weapons, spells, owned actions and feats), PF2e HUD sidebars (actions, spells, items, skills) and shortcuts, PF2e Unified Spellbook's unified spell list, D&D 5e character and NPC sheets (inventory, features, spells). Click to pin, click again (or press Esc) to clear.
- **📏 on the Token HUD** — every system: right-click your token, click 📏 and pick from its attacks, spells, skill actions and other items. Only items with a range or a note are listed (note-only rows are disabled, with the note as tooltip). Click a row to pin, Shift+click to share, hold Alt over a row to preview. The list follows the HUD when the token moves or the canvas pans. Turn the button off with *Token HUD button*.
- **📏 in item sheet headers** — every system: an owned item's sheet gets a 📏 control (in the header menu on V2 sheets) that pins it for the owner's token.
- **GM clear tool** — GMs get a *Range Finder — clear shared ranges* button in the Token scene controls (and an unbound keybinding) that removes every shared range for all players.
- **Shift+click** shares the range with everyone, tinted in your player color (needs the **Allow sharing** world setting; **Who can share** limits it to Trusted Players or Assistant GMs, and GMs can always share). Shift+click an already pinned range to share it.
- **Hold Alt** while hovering a row (or its 📏) to preview its range without pinning. Alt is also Foundry's "highlight objects" key; rebind either in Configure Controls.
- **Boost bands** (PF2e/SF2e): when you have a per-use range boost for the item, its range always shows an extra outer band, lightly filled, hatched and outlined in its own colour, for what you reach only with the boost: a spell's `Reach Spell · 60 ft` (+30 ft; touch spells out to 30 ft; also Grasping Spirits Spell, Wand of Reaching), a strike's `Extending · Reach 60 ft`, Giant's Lunge, Looming Gait, or a thrown boost such as `Galloping Launch · 150 ft` or Throw and Catch (also on melee weapons with thrown-N). Targets in that ring show the boost's name instead of ✓ (`45 ft · Reach Spell`). Several boosts each get a band when they reach further, ordered outward.
- **Bands**: PF2e range increments `60 ft · –2`, D&D 5e normal/long range (`600 ft · Disadv.`), reach (PF2e's 10 ft reach includes the double diagonal), volley zones. PF2e thrown melee weapons show both the reach band and the thrown bands. SF2e area and automatic weapons show their area: `30 ft · Auto-fire cone 15 ft`.
- **PF2e skill actions**: Demoralize 30 ft, Feint at your reach, Shove/Trip/Disarm/Grapple/Reposition at your best matching weapon's reach (ranged trip at –2), healing and thievery actions (Steal, Palm an Object) adjacent, 70+ feat actions (Bon Mot, Battle Medicine, Terrifying Howl…). Dimensional Pilfer (60 ft) and Thief of Moonlight (30 ft) are their own feat-action rows, not modifiers of Steal / Palm an Object. Owned feats that change ranges are applied (Legendary Laugh, Mage's Field Dressing, Hydraulic Maneuvers while toggled, Lunge with reach-N weapons…); ones PF2e already applies (Far Shot, Enlarge…) are read from the system, never doubled.
- **Target badges**: every visible token shows `45 ft · –2`, `✓`, the band's mark (`Disadv.`) or `✗`.
- **Any scene**: labels use the scene's units (`m` scenes show `7.5 m`); distances follow the scene's diagonal rule and measure edge to edge (PF2e/SF2e keep their own rules).
- **Gets out of the way**: the window you clicked from fades while the range is shown; from PF2e HUD only the open sidebar fades (the persistent bar too if you enable *Also hide PF2e HUD bar*, off by default); faded windows are click-through and come back when the range is cleared (Esc, unpin) or the preview key is released. If a PF2e HUD sidebar closes while you preview from it (e.g. you drag a token), it reopens on the same tab when you release the key. The Token HUD list never fades. In *Minimize* mode, windows that aren't a minimizable application (such as frameless PF2e HUD sidebars) are left as they are.
- Optional: hatch squares without line of effect, colorblind palette, outline-only bands.

Works on square grids (per-square bands) and hex/gridless scenes (rings). Area shapes (bursts, cones) are not drawn — ranges only.

## Supported systems

- **PF2e** — strikes, weapons, spells, skill actions and feat actions with range increments, reach, volley and per-use boosts; sheets, PF2e HUD, PF2e Unified Spellbook and Token HUD.
  Any other action or feat (NPC abilities included) gets its range from its description: auras, emanations, cones, lines and aimed bursts, "within N feet", "a range of N feet", "within its reach" and targeted "adjacent" wordings. Several distances show as nested bands.
- **SF2e** — as PF2e, plus area and automatic weapons' area labels.
- **D&D 5e (6.x)** — weapons, spells and feature activities: normal / long range (`Disadv.`), reach, touch and template ranges; character and NPC sheets.
- **Daggerheart** — weapon attacks, adversary attacks and domain card / feature actions as nested Melee → Very Far bands from the scene's range settings, measured like the system's own range check.
- **Draw Steel** — ability distances in squares (melee, ranged, melee-or-ranged, aura / burst, cube / wall / line "within"); ability rows on the sheet.
- **Crucible** — weapon ranges and actions (strikes, talents, spells) with minimum / maximum range, measured base to base; action, inventory, talent, spell and sidebar rows.

Any other system gets a generic fallback: the Token HUD list and the item sheet header 📏 button, reading `system.range` (see [Other systems](#other-systems)). Adapters for more systems are added on request, so open an issue to ask for yours.

## Keybindings

Rebindable in **Configure Controls**.

| Action | Default |
|---|---|
| Preview hovered range | Alt |
| Clear my ranges | Esc |
| Clear shared ranges (GM) | unbound |

## Settings

| Setting | Scope | Default |
|---|---|---|
| Band style | client | Fill and outline |
| Band opacity | client | 1 |
| Band labels | client | on |
| Badge size | client | 1 |
| Colors | client | Default |
| Dim behind walls | client | off |
| Hide windows while showing range | client | Fade |
| Also hide PF2e HUD bar | client | off |
| Token HUD button | client | on |
| Allow sharing | world | on |
| Who can share | world | Players |
| Badges only in combat | world | off |

## Other systems

Without a built-in adapter, Range Finder reads `system.range` on items: a number, `{ value, long }` (long range is marked `Long`) or `{ value, units }`, in the scene's units. Use the Token HUD 📏 or the item sheet 📏 to show it.

## For developers

Register an adapter for your system from the `rangeFinder.registerAdapters` hook. Range Finder calls it during `setup`, before it picks the adapter for the current system:

```js
Hooks.once('rangeFinder.registerAdapters', api => api.registerAdapter('my-system', adapter));
```

An adapter is `{ id, specFor(ctx), cellMeasure(spec, unit), distance(source, target, spec), rows, listItems(actor), rangeLabel?(spec, units), resolveItem?(actor, uuid) }`. `specFor` receives `{ actor, token, item, actionIndex, units }` and returns distances in scene units; `listItems` feeds the Token HUD list (`[{ item, actionIndex, group: 'attacks'|'spells'|'skills'|'other' }]`). See `scripts/adapters/generic.mjs` and `scripts/adapters/dnd5e.mjs`. `game.modules.get('range-finder').api` exposes the same `registerAdapter` and `clear` functions, but a registration made after `setup` is not picked up.

Run tests with `npm test`.
