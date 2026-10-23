# Changelog

## 1.0.2

- **Ranges for every action (PF2e / SF2e):** actions and feats without a built-in range, NPC abilities included, now read it from their description: auras, emanations, cones, lines, bursts, "within 20 feet", "a range of 60 feet", "within its reach" (Attack of Opportunity) and adjacent creatures ("an adjacent creature", "all creatures adjacent to the skink"). The 📏 shows on NPC sheet abilities, the character Actions tab and the PF2e HUD actions sidebar, and the Token HUD list has a new **Actions** group.

## 1.0.1

- **Who can share:** a new world setting limits Shift+click sharing to Trusted Players or Assistant GMs (default: all players). GMs can always share, and shares from users who aren't allowed are ignored by everyone else.
- PF2e HUD is no longer listed as a recommended module, so Foundry doesn't offer it on install. It's still supported when installed.

## 1.0.0

First stable release, published to foundryvtt.com. Everything from the 0.x prereleases below, unchanged.

## 0.2.2 (prerelease)

- **Fix:** the 📏 now appears on heightened rows of signature spells (2nd rank and up) in the PF2e HUD spells sidebar and on the actor sheet.

## 0.2.1 (prerelease)

- **Fix:** after a Shift+click, the 📏 no longer keeps a teal focus ring once the range is turned off (PF2e HUD shortcuts and elsewhere).

## 0.2.0 (prerelease)

- **Volley on the targets:** a token inside a volley zone now shows the total penalty on its own badge, e.g. "10 ft · –2 Volley", on a red plate.
- **PF2e Unified Spellbook:** the 📏 now appears on its unified spell list (including scroll, wand and staff spells).

## 0.1.0 (prerelease)

First release.

- **Show any range on the canvas:** a 📏 button on strikes, weapons, spells and skill actions draws the range around the token as penalty bands (range increments, reach, volley zones), with distance and penalty badges on every visible token.
- **Pin, preview, share:** click to pin, hold Alt over a row to preview, Shift+click to show everyone in your player color, Esc to clear.
- **Gets out of the way:** the sheet or PF2e HUD sidebar you used fades and becomes click-through while a range is shown; the PF2e HUD sidebar reopens after an Alt preview.
- **PF2e / SF2e:** range increments, reach (incl. the 10 ft reach diagonal), thrown, volley, spells (incl. scrolls, wands, staves), skill actions (Demoralize, Athletics maneuvers, Treat Wounds, …), feat actions, and range modifiers the system doesn't apply itself (Reach Spell and other per-use boosts shown as an outer "only with the boost" band). pf2e-hud sidebars and shortcuts supported.
- **D&D 5e:** normal and long range (Disadv.), reach, thrown, touch and self-area spells, unit conversion; buttons styled like the sheet's own row controls.
- **Daggerheart:** Melee → Very Far bands from the scene/world range settings, measured like the system (Very Far unlimited); weapon, action and adversary attacks; badges sit below tokens so they don't cover Daggerheart's own range labels.
- **Draw Steel:** ability distances (melee, ranged, melee-or-ranged, burst, aura, cube/line/wall "within") in squares, converted to scene units, including kit bonuses.
- **Crucible:** weapon ranges and action minimum–maximum ranges, measured base-to-base like the system; buttons on actions, inventory, talents, spells and the sidebar.
- **Every system:** Token HUD 📏 list, item-sheet header button, scene units and Foundry's diagonal rule; band labels and badges stay readable at any zoom. Other systems get a basic fallback — adapters on request.
- Optional: dim squares behind walls, colorblind palette, outline-only bands, badges only in combat.
