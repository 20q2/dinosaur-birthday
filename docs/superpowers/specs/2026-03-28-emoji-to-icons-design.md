# Design: Replace Emoji with Icon Library

**Date:** 2026-03-28
**Status:** Approved

## Summary

Replace all Unicode emoji usage in the frontend UI with `lucide-preact` icons. Lobby code symbols are migrated from 9 emoji-based tokens to 4 item artwork images (paint, meat, berry, cooked_meat), requiring a matching backend change.

---

## 1. Dependencies

Install `lucide-preact` as a production dependency:

```
npm install lucide-preact
```

No CSS or config changes needed. Lucide exports tree-shakeable ESM components handled natively by Vite.

---

## 2. New Shared Files

### `frontend/src/data/icons.js` (new)

Centralizes the two repeated lookup patterns currently duplicated across `Plaza.jsx` and `FeedScreen.jsx`.

```js
import {
  Footprints, PartyPopper, Handshake, TrendingUp, Swords, Sparkles, Leaf,
  UtensilsCrossed, Music2, Camera, Cake, Gift,
} from 'lucide-preact';

export const FEED_ICONS = {
  encounter:   Footprints,
  tamed:       PartyPopper,
  play:        Handshake,
  levelup:     TrendingUp,
  boss:        Swords,
  inspiration: Sparkles,
  // fallback: Leaf
};

export const EVENT_ICONS = {
  cooking_pot:   UtensilsCrossed,
  dance_floor:   Music2,
  photo_booth:   Camera,
  cake_table:    Cake,
  mystery_chest: Gift,
  // fallback: Leaf
};
```

### `frontend/src/data/lobbySymbols.js` (new)

Consolidates the three separate symbol definitions currently spread across `PlayTogether.jsx`, `PlayMenu.jsx`, and `PlayLobby.jsx`.

```js
import meatImg      from '../assets/items/meat.png';
import berryImg     from '../assets/items/berry.png';
import paintImg     from '../assets/items/paint.png';
import cookedMeatImg from '../assets/items/cooked_meat.png';

export const LOBBY_SYMBOLS = [
  { id: 'meat',        img: meatImg,        label: 'Meat' },
  { id: 'berry',       img: berryImg,       label: 'Berry' },
  { id: 'paint',       img: paintImg,       label: 'Paint' },
  { id: 'cooked_meat', img: cookedMeatImg,  label: 'Cooked Meat' },
];
```

---

## 3. Backend Changes

### `backend/src/shared/game_data.py`

Change `LOBBY_SYMBOLS` from 9 tokens to 4:

```python
# Before
LOBBY_SYMBOLS = [
    "meat", "mejoberry", "party_hat", "cowboy_hat", "top_hat",
    "sunglasses", "paint", "bone", "egg",
]

# After
LOBBY_SYMBOLS = ["meat", "berry", "paint", "cooked_meat"]
```

Note: `mejoberry` → `berry` to match the asset filename convention.

### Backend tests

Update hardcoded symbol names in test files that reference old symbol IDs (`mejoberry`, `bone`, `egg`, `leaf`):
- `backend/tests/test_lobby.py` — fix any hardcoded codes like `meat_bone_egg`
- `backend/tests/test_game_data.py` — verify `test_lobby_code_has_three_unique_symbols` still passes

---

## 4. Icon Mapping Reference

| Emoji | Context | Lucide Icon |
|-------|---------|-------------|
| 🌿 | Plaza nav tab | `Leaf` |
| 🦕 | My Dinos nav / loading / empty states | `Footprints` |
| 🤝 | Play Together nav / feed type | `Handshake` |
| 🎒 | Inventory nav | `Backpack` |
| 👤 | Profile nav | `User` |
| ⚙️ | Admin nav | `Settings` |
| ✅ | Trivia correct answer | `CheckCircle2` |
| ❌ | Trivia wrong answer | `XCircle` |
| ⚡ | XP reward | `Zap` |
| 🎩 | Hat reward | `Crown` |
| 💡 | Hint / warning | `Lightbulb` |
| 🎮 | Host a Lobby button | `Gamepad2` |
| 📰 | Feed screen header | `Newspaper` |
| 🏆 | Boss victory | `Trophy` |
| 💀 | Boss defeated indicator | `Skull` |
| 💥 | Boss tremor explosion effect | `Flame` |
| 🦎 | Living boss | `Zap` |
| 🎉 | Tamed feed entry / celebration | `PartyPopper` |
| ⬆️ | Level up feed entry | `TrendingUp` |
| ⚔️ | Boss feed entry | `Swords` |
| ✨ | Inspiration / sparkle effect | `Sparkles` |
| 👑 | Alex / blessing | `Crown` |
| 🍲 | Cooking pot event | `UtensilsCrossed` |
| 💃 | Dance floor event | `Music2` |
| 📸 | Photo booth event | `Camera` |
| 🎂 | Cake table event | `Cake` |
| 🎁 | Mystery chest event | `Gift` |

**Icon sizing conventions:**
- `24` — navigation bar icons
- `20` — inline body icons (feed entries, status, rewards)
- `28`+ — decorative / hero usage (boss screen, victory screen)

---

## 5. Per-Component Changes

All 13 files with emoji usage are modified. Local `SYMBOL_EMOJI` / `SYMBOL_IMG` / `SYMBOLS` definitions in lobby components are deleted and replaced with imports from `lobbySymbols.js`. Feed/event lookup emoji strings are replaced with icon component references from `icons.js`.

| File | Change type |
|------|-------------|
| `BottomNav.jsx` | Import 6 Lucide icons, replace emoji literals in nav items |
| `PlayMenu.jsx` | Delete local SYMBOL_EMOJI/SYMBOL_IMG/ALL_SYMBOLS, import LOBBY_SYMBOLS; replace 🎮🤝💡 |
| `PlayLobby.jsx` | Delete local symbol defs, import LOBBY_SYMBOLS; replace 🎉 |
| `PlayTogether.jsx` | Delete local SYMBOLS array, import LOBBY_SYMBOLS |
| `PlayTrivia.jsx` | Replace dino placeholders (Footprints), ✅❌⚡🎩 |
| `Plaza.jsx` | Import FEED_ICONS, replace feed-type emoji map, replace 🦕 empty state |
| `FeedScreen.jsx` | Import FEED_ICONS, replace feed-type emoji map, replace 📰🦕 |
| `EventScan.jsx` | Import EVENT_ICONS, replace event-type emoji map, replace 🎩 |
| `BossBanner.jsx` | Replace 💥 with `<Flame />` |
| `BossFight.jsx` | Replace 💀 / 🦎 |
| `BossVictory.jsx` | Replace 🏆🎩 with `<Trophy />` / `<Crown />` |
| `InspirationScan.jsx` | Replace ✨👑🎩 |
| `DinoTaming.jsx` | Replace 🎩 hat button icon |

---

## 6. Out of Scope

- Dino sprite images and hat images (already `<img>` elements, not emoji)
- Food images in `DinoEncounter.jsx`, `DinoTaming.jsx`, `DinoDetail.jsx` (already `<img>`)
- Any emoji in data strings stored in DynamoDB (feed text content uses player names, not emoji icons)
