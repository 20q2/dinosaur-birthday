# Play Together: Live Dino Scene

## Overview

Transform the Play Together experience from a static menu into a seamless split-screen view where the top portion shows your dino hopping around in a 2D canvas scene, and when you join a lobby, your partner's dino walks in from the side. Both dinos hop around together while the bottom portion transitions through the game phases (menu → lobby → trivia → results).

## Architecture

### Single Unified Component

Replace the current three separate route components (PlayMenu, PlayLobby, PlayTrivia) with one `PlayTogether.jsx` component that manages all phases via internal state machine.

**Phases**: `menu` → `lobby` → `countdown` → `trivia` → `results`

**State**:
- `phase`: Current phase string
- `lobbyCode`: 3-symbol lobby code
- `role`: 'host' | 'guest'
- `trivia`: `{ question, options }` from server
- `answer` / `result`: User's selection and server response
- `partnerDino`: `{ species, colors, hat, name }` — received via WebSocket

**Routing**: `/play` renders PlayTogether. Current sub-routes (`/play/lobby/{code}`, `/play/trivia/{code}`) are removed — state is internal.

## Components

### DinoPlayScene.jsx (new)

A lightweight `<canvas>` component rendering 1-2 dinos on a clean gradient background.

**Scene specs**:
- Full width, ~200px tall (~1/3 of mobile viewport)
- Background: dark gradient matching the page (no scenery)
- Dino scale: 3x
- Drop shadows below each dino

**Movement AI — "Gentle Drift"**:
- Each dino has a home position (center-left for player, center-right for partner)
- Drifts ±40px from home with slow, random waypoints
- Smooth heading lerp — sprite flips to face movement direction
- Continuous sine-wave hop while drifting, subtle breathing when idle
- Small dust particle puffs behind dinos while moving (simplified from PlazaCanvas)

**Sprite rendering**: Reuses `spriteEngine.getRecolored()` for species+colors and `hatImages.js` for hat overlay. Same pipeline as PlazaCanvas — pixel-perfect rendering with `imageSmoothingEnabled: false`.

**API**:
- `setMyDino({ species, colors, hat })` — renders your partner dino immediately
- `setPartnerDino({ species, colors, hat })` — partner dino walks in from right edge to their home position
- `clearPartnerDino()` — partner walks off-screen (for error/disconnect cases)

**Lifecycle**: Canvas is mounted once and persists across all phases. Uses `requestAnimationFrame` loop. Cleanup on unmount.

### PlayTogether.jsx (new, replaces PlayMenu + PlayLobby + PlayTrivia)

**Layout**:
```
┌─────────────────────────────┐
│     DinoPlayScene canvas    │  ~200px, fixed
│   (your dino + partner)     │
├─────────────────────────────┤
│                             │
│     Phase-specific UI       │  Rest of screen, scrollable
│     (menu/lobby/trivia/     │
│      results)               │
│                             │
└─────────────────────────────┘
```

**Phase UI**:

1. **Menu**: Host/Join buttons (gradient cards with icons), How It Works steps, recent plays/cooldowns. Same content as current PlayMenu but without the page header (TitleBar remains).

2. **Lobby (Host)**: 3-symbol code card displayed prominently + "Waiting for a friend..." animated text. Cancel button to go back to menu.

3. **Lobby (Guest)**: Symbol picker UI — 9 symbol buttons in a grid, 3 selected slots. Submit button. Same UX as current PlayLobby guest view.

4. **Countdown**: Brief 3-second overlay. "Get ready!" text with countdown number. Partner dino starts walking into the scene during this.

5. **Trivia**: Question text + 4 answer buttons (A/B/C/D). Clean layout in the bottom zone. Dinos keep hopping above — they're oblivious to the quiz.

6. **Results**: Correct/incorrect banner, XP awarded, reward drop (hat/paint), partner dino info. "Back to Play" button returns to menu phase. Dinos still hopping.

**Phase transitions**:
- Menu → Lobby: User clicks Host (creates lobby via API) or starts entering Join code
- Lobby → Countdown: WebSocket `trivia_start` fires → `setPartnerDino()` on canvas → 3s countdown
- Countdown → Trivia: Timer expires → show question + options
- Trivia → Results: User submits → API responds → show rewards
- Results → Menu: User clicks back → `clearPartnerDino()` → reset state

## Backend Changes

### lobby.py — Include partner dino data in trivia_start

**Current**: `trivia_start` broadcast only sends `{ question, options }`.

**New**: Also include both players' partner dino data:

```python
# In join_lobby_handler, after updating lobby status:

# Fetch host's partner dino
host_dinos = query_pk(f"PLAYER#{host_id}", "DINO#")
host_partner = next((d for d in host_dinos if d.get("is_partner") and d.get("tamed")), None)

# Fetch guest's partner dino
guest_dinos = query_pk(f"PLAYER#{guest_id}", "DINO#")
guest_partner = next((d for d in guest_dinos if d.get("is_partner") and d.get("tamed")), None)

# Broadcast includes:
{
    "question": ...,
    "options": [...],
    "host_dino": {
        "species": host_partner["SK"].replace("DINO#", ""),
        "colors": host_partner.get("colors", {}),
        "hat": host_partner.get("hat", ""),
        "name": host_partner.get("name", ""),
    },
    "guest_dino": { ... same shape ... }
}
```

Each client knows its role (host/guest) so it can determine which dino object is "mine" vs "partner".

**No other backend changes** — trivia answering, XP, rewards, cooldowns all stay the same.

## Files to Create/Modify

### New files:
- `frontend/src/components/DinoPlayScene.jsx` — Canvas dino scene
- `frontend/src/components/PlayTogether.jsx` — Unified play component

### Modified files:
- `frontend/src/app.jsx` — Replace PlayMenu/PlayLobby/PlayTrivia routes with single PlayTogether route
- `backend/src/handlers/lobby.py` — Add partner dino data to `trivia_start` broadcast

### Removed/deprecated:
- `frontend/src/components/PlayMenu.jsx` — Absorbed into PlayTogether
- `frontend/src/components/PlayLobby.jsx` — Absorbed into PlayTogether
- `frontend/src/components/PlayTrivia.jsx` — Absorbed into PlayTogether

## Key Design Decisions

1. **Canvas over CSS animation**: Canvas gives smooth 60fps sprite rendering with dust particles, consistent with the plaza look. CSS animating DinoSprite would be jankier.

2. **Single component over route children**: Keeps the canvas mounted across all phases. Route-based approach would remount on navigation.

3. **Gentle drift over full wander**: Dinos stay roughly centered so they're always visible in the small scene area. More active wandering would have them disappearing off-screen.

4. **Partner walks in from edge**: Natural entrance that signals "someone joined your lobby" visually before the countdown begins.

5. **Backend sends dino data at join time**: Each client needs the other player's dino for rendering. Sending it in `trivia_start` is the minimal touch point — no new endpoints needed.
