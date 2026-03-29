# Rare Paint Effects — Design Spec

**Date:** 2026-03-29

## Overview

Four rare paint effects that can be applied to individual dino color regions, earned through specific in-game achievements. Rare paints animate over time and are visually distinct from normal hue-based paints. They use the same apply flow as normal paint and are consumed on use.

---

## Data Model

### Rare paint item (inventory)

Same DB slot as a normal paint item. No `hue` field; instead has `effect`.

```
PK: PLAYER#{id}   SK: ITEM#{uuid}
{ item_type: "paint", effect: "rainbow" }   // rainbow | metallic | starry_night | prismatic
```

### Dino colors field (after applying)

The `colors` field on a dino record becomes **polymorphic**: region values are either a hue number (normal) or an effect object (rare).

```json
{ "body": { "effect": "rainbow" }, "belly": 45, "stripes": 200 }
```

- One value per region — a rare effect replaces whatever was there before.
- Applying any normal paint to a region overwrites a rare effect (no separate remove action).
- Rare paint items are consumed on apply, same as normal paint.

### The four effects

| Effect key | Visual | Achievement |
|---|---|---|
| `rainbow` | Hue cycles continuously over the region | Birthday Girl's Blessing |
| `metallic` | Desaturated base + animated diagonal shine sweep | All 5 explorer notes collected |
| `starry_night` | Dark-tinted region + twinkling white dot particles | Played trivia with 10 distinct partners |
| `prismatic` | Slow multi-stop gradient cycling across the region | All 7 species tamed |

---

## Achievement Grants

Each grant is **idempotent**: before writing an item, check `EVENT#{player_id}` / `RARE_PAINT_{effect}`. If it exists, skip. On grant, write both the item and the event claim.

### Rainbow — Birthday Girl's Blessing

- **Trigger:** `POST /inspiration` handler, after writing the `INSPIRATION` record.
- **Check:** `EVENT#{player_id}` / `RARE_PAINT_rainbow` present? Skip.
- **Grant:** write `ITEM#{uuid}` with `effect: "rainbow"` + write event claim.

### Metallic — All 5 Explorer Notes

- **Trigger:** note collection handler, after writing the `NOTE#{note_id}` record.
- **Check:** query `PLAYER#{id}` for all `NOTE#` items. If count < 5, skip. If event claim already present, skip.
- **Grant:** write item + event claim.

### Starry Night — 10 Unique Trivia Partners

- **Tracking:** after each trivia game resolves, write `EVENT#{player_id}` / `PARTNER#{other_player_id}` if not already present (one record per unique opponent, these persist).
- **Trigger:** after writing the PARTNER event, count all `PARTNER#` events for the player. If count hits 10 and `RARE_PAINT_starry_night` not present, grant.
- **"Playing with"** = completing a trivia lobby game with another player, win or lose.

### Prismatic — All 7 Species Tamed

- **Trigger:** tame handler, after writing the tamed dino record.
- **Check:** query all `PLAYER#{id}` / `DINO#{species}` items. If fewer than 7 have `tamed: true`, skip. If event claim present, skip.
- **Grant:** write item + event claim.
- **Species list:** trex, spinosaurus, dilophosaurus, pachycephalosaurus, parasaurolophus, triceratops, ankylosaurus.

---

## Applying Effects (Backend)

**Endpoint:** `POST /dino/paint` — no new endpoint needed.

**Request:** `{ species, region, item_id }`

**Change to existing logic:**
- Currently: reads `item.hue`, writes `colors.{region} = hue` (number).
- New: if `item.effect` is set, write `colors.{region} = { effect: item.effect }` instead of a number.
- Item deleted after apply in both cases.

No changes to the apply UI — DinoTaming/DinoDetail treat rare paint items identically to normal ones except for the inventory display (see rendering section).

---

## Rendering

### Shared helper — `frontend/src/dinoColors.js` (new file)

```js
// Returns hue number (0-359) or null if region has a rare effect
export function regionHue(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? null : (v ?? 0);
}

// Returns effect string ("rainbow" etc.) or null
export function regionEffect(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? v.effect : null;
}
```

All three rendering contexts import from this helper.

### DinoSprite (static display)

- If `regionEffect` returns non-null, apply a CSS animation class (`effect-rainbow`, `effect-metallic`, etc.) to the region element instead of an `hsl()` fill color.
- CSS `@keyframes` handle the visual loop — no JS per-frame needed for static display.

### PlazaCanvas.js

Per-frame check per dino per region:
- If effect present: draw region with effect pass.
  - **Rainbow:** `ctx.filter = \`hue-rotate(${(Date.now()/20) % 360}deg)\`` on the region draw, then reset.
  - **Metallic:** draw region with desaturated base, then overlay a translucent white diagonal gradient that shifts position over time.
  - **Starry Night:** draw region with dark tint overlay, then scatter small white dots with opacity varying by `Math.sin(Date.now()/500 + seed)` per dot.
  - **Prismatic:** fill region with a linear gradient cycling through hue stops, phase offset by `Date.now()`.

### BossFightCanvas.js

Same approach as PlazaCanvas. Acceptable cost since ≤7 "my dinos" are rendered.

### Inventory display (DinoTaming / DinoDetail)

Rare paint items in the inventory panel render a small animated swatch (CSS animation) instead of a solid color circle, so the player can see what they'll get before applying.

---

## Out of Scope

- Removing a rare effect without replacing it (overwrite with normal paint instead).
- Stacking multiple effects on one region.
- Rare paints on plaza dinos owned by other players affecting their display for those players (they see their own colors from their own data; plaza rendering is best-effort visual only).
- Transferring or trading rare paint items between players.
