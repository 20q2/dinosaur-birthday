# Rare Paint Effects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four rare animated paint effects (rainbow, metallic, starry_night, prismatic) earned through specific achievements, stored per-region on the dino's `colors` field, and rendered with per-frame canvas animations.

**Architecture:** Rare paints extend the existing paint system by making the `colors` field polymorphic — regions hold either a hue number or `{ effect: "..." }`. A shared backend utility handles idempotent achievement grants. Frontend rendering splits on `hasEffects(colors)` to use uncached per-frame recoloring with overlay effects.

**Tech Stack:** Python 3.12 backend (moto for tests), Preact 10 frontend, DynamoDB, HTML5 Canvas 2D

**Spec:** `docs/superpowers/specs/2026-03-29-rare-paints-design.md`

---

## File Structure

**New files:**
- `frontend/src/dinoColors.js` — `regionHue`, `regionEffect`, `hasEffects`, `effectHue`, `resolveColors` helpers
- `backend/src/shared/rare_paints.py` — `grant_rare_paint(player_id, effect)` utility
- `backend/tests/test_rare_paints.py` — all backend tests for this feature

**Modified files:**
- `backend/src/handlers/scan_inspiration.py` — grant rainbow after blessing
- `backend/src/handlers/scan_note.py` — grant metallic at 5th note
- `backend/src/handlers/lobby.py` — track trivia partners, grant starry_night at 10
- `backend/src/handlers/scan_food.py` — grant prismatic after all 7 species tamed
- `backend/src/handlers/dino.py` — apply rare paint (effect field) in customize_handler
- `frontend/src/utils/spriteEngine.js` — add `getRecoloredUncached`
- `frontend/src/components/DinoSprite.jsx` — animated effects via requestAnimationFrame
- `frontend/src/components/DinoDetail.jsx` — rare paint inventory display and apply flow
- `frontend/src/components/PlazaCanvas.js` — per-frame effect rendering for plaza dinos
- `frontend/src/components/BossFightCanvas.js` — per-frame effect rendering for boss dinos

---

## Task 1: `frontend/src/dinoColors.js` — color region helpers

**Files:**
- Create: `frontend/src/dinoColors.js`

- [ ] **Step 1: Write `frontend/src/dinoColors.js`**

```js
/**
 * Helpers for handling polymorphic dino color regions.
 * A region value is either a hue number (normal paint) or { effect: "..." } (rare paint).
 */

/** Returns the hue number for a region, or null if the region has a rare effect. */
export function regionHue(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? null : (v ?? 0);
}

/** Returns the effect string ("rainbow" etc.) for a region, or null if it's a plain hue. */
export function regionEffect(colors, region) {
  const v = colors?.[region];
  return (v && typeof v === 'object') ? v.effect : null;
}

/** Returns true if any region in the colors object has a rare effect. */
export function hasEffects(colors) {
  return Object.values(colors || {}).some(v => v && typeof v === 'object');
}

/**
 * Returns a time-animated hue number for a rare effect.
 * Metallic and starry_night use fixed base hues — their visual distinction
 * comes from overlay effects drawn separately in canvas contexts.
 */
export function effectHue(effect, time) {
  switch (effect) {
    case 'rainbow':      return Math.floor((time / 20) % 360);
    case 'metallic':     return 210; // steel-blue base; shimmer overlay added separately
    case 'starry_night': return 240; // deep indigo base; star overlay added separately
    case 'prismatic':    return Math.floor((time / 35 + 180) % 360);
    default:             return 0;
  }
}

/**
 * Resolves a polymorphic colors object to plain hue numbers for getRecolored / getRecoloredUncached.
 * Effect regions are animated using the provided time (Date.now()).
 *
 * @param {object} colors - e.g. { body: { effect: 'rainbow' }, belly: 45 }
 * @param {number} time - Date.now() for animation
 * @returns {object} - e.g. { body: 120, belly: 45 }
 */
export function resolveColors(colors, time) {
  const out = {};
  for (const [region, value] of Object.entries(colors || {})) {
    out[region] = (value && typeof value === 'object')
      ? effectHue(value.effect, time)
      : value;
  }
  return out;
}
```

- [ ] **Step 2: Verify by opening the file and confirming it has no syntax errors**

Run: `node --input-type=module < frontend/src/dinoColors.js` from `a:\Coding\AlexBirthdayDinos`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/dinoColors.js
git commit -m "feat: add dinoColors.js helpers for polymorphic color regions"
```

---

## Task 2: `backend/src/shared/rare_paints.py` — grant utility

**Files:**
- Create: `backend/src/shared/rare_paints.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Write the failing tests for `grant_rare_paint`**

Create `backend/tests/test_rare_paints.py`:

```python
import json
import pytest
from src.shared.db import get_item, put_item, query_pk
from src.shared.rare_paints import grant_rare_paint


def _make_profile(player_id, name="Tester"):
    put_item({"PK": f"PLAYER#{player_id}", "SK": "PROFILE", "name": name, "photo_url": ""})


def test_grant_rare_paint_creates_item_and_claim():
    _make_profile("p1")
    item = grant_rare_paint("p1", "rainbow")
    assert item is not None
    assert item["details"]["effect"] == "rainbow"
    assert item["name"] == "Rainbow Paint"
    # Item in inventory
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    assert any(i.get("details", {}).get("effect") == "rainbow" for i in items)
    # Claim record written
    claim = get_item("PLAYER#p1", "RARE_PAINT_rainbow")
    assert claim is not None


def test_grant_rare_paint_idempotent():
    _make_profile("p1")
    first = grant_rare_paint("p1", "rainbow")
    second = grant_rare_paint("p1", "rainbow")
    assert first is not None
    assert second is None  # already claimed
    # Only one item in inventory
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    rainbow = [i for i in items if i.get("details", {}).get("effect") == "rainbow"]
    assert len(rainbow) == 1


def test_grant_different_effects_are_independent():
    _make_profile("p1")
    grant_rare_paint("p1", "rainbow")
    grant_rare_paint("p1", "metallic")
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    effects = {i.get("details", {}).get("effect") for i in items}
    assert "rainbow" in effects
    assert "metallic" in effects
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_grant_rare_paint_creates_item_and_claim -v`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Write `backend/src/shared/rare_paints.py`**

```python
import uuid
from .db import get_item, put_item

RARE_EFFECTS = frozenset({"rainbow", "metallic", "starry_night", "prismatic"})

EFFECT_NAMES = {
    "rainbow":      "Rainbow Paint",
    "metallic":     "Metallic Paint",
    "starry_night": "Starry Night Paint",
    "prismatic":    "Prismatic Paint",
}


def grant_rare_paint(player_id, effect):
    """
    Grant a one-time rare paint item to a player.
    Returns the item dict if newly granted, or None if the effect was already claimed.
    """
    claim_sk = f"RARE_PAINT_{effect}"
    if get_item(f"PLAYER#{player_id}", claim_sk):
        return None

    item_id = str(uuid.uuid4())
    item = {
        "PK": f"PLAYER#{player_id}",
        "SK": f"ITEM#{item_id}",
        "type": "paint",
        "name": EFFECT_NAMES[effect],
        "details": {"effect": effect},
    }
    put_item(item)
    put_item({"PK": f"PLAYER#{player_id}", "SK": claim_sk})
    return item
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py -v`
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/rare_paints.py backend/tests/test_rare_paints.py
git commit -m "feat: add grant_rare_paint shared utility with idempotency"
```

---

## Task 3: Backend — rainbow grant on Birthday Girl's Blessing

**Files:**
- Modify: `backend/src/handlers/scan_inspiration.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Add tests to `test_rare_paints.py`**

Append to `backend/tests/test_rare_paints.py`:

```python
from unittest.mock import patch
from src.handlers.scan_inspiration import handler as inspiration_handler


def _inspiration_event(body):
    return {"httpMethod": "POST", "body": json.dumps(body)}


def _make_partner_dino(player_id, species="trex"):
    put_item({
        "PK": f"PLAYER#{player_id}", "SK": f"DINO#{species}",
        "name": "", "colors": {}, "gender": "female", "nature": "Jolly",
        "hat": "", "xp": 0, "level": 1, "is_partner": True, "tamed": True, "shiny": False,
    })


def test_inspiration_grants_rainbow_paint():
    _make_profile("p1")
    _make_partner_dino("p1")
    with patch("src.handlers.scan_inspiration.broadcast"):
        resp = inspiration_handler(_inspiration_event({"player_id": "p1"}), None)
    assert resp["statusCode"] == 200
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    assert any(i.get("details", {}).get("effect") == "rainbow" for i in items)


def test_inspiration_rainbow_not_granted_twice():
    _make_profile("p1")
    _make_partner_dino("p1")
    with patch("src.handlers.scan_inspiration.broadcast"):
        inspiration_handler(_inspiration_event({"player_id": "p1"}), None)
        inspiration_handler(_inspiration_event({"player_id": "p1"}), None)  # already received
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    rainbow = [i for i in items if i.get("details", {}).get("effect") == "rainbow"]
    assert len(rainbow) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_inspiration_grants_rainbow_paint -v`
Expected: FAIL (no rainbow item granted yet)

- [ ] **Step 3: Modify `backend/src/handlers/scan_inspiration.py`**

Add import at the top (after existing imports):
```python
from ..shared.rare_paints import grant_rare_paint
```

Add `grant_rare_paint` call after the `put_item` that writes the `INSPIRATION` marker (line 54). The full block at that location becomes:

```python
    # Mark as received
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": "INSPIRATION",
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    # Grant rainbow rare paint (once per player, idempotent)
    grant_rare_paint(player_id, "rainbow")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py::test_inspiration_grants_rainbow_paint tests/test_rare_paints.py::test_inspiration_rainbow_not_granted_twice -v`
Expected: 2 PASSED

- [ ] **Step 5: Run the full existing inspiration test suite to confirm no regressions**

Run: `cd backend && pytest tests/test_scan_inspiration.py -v`
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/scan_inspiration.py backend/tests/test_rare_paints.py
git commit -m "feat: grant rainbow rare paint on Birthday Girl's Blessing"
```

---

## Task 4: Backend — metallic grant at 5th explorer note

**Files:**
- Modify: `backend/src/handlers/scan_note.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Add tests to `test_rare_paints.py`**

Append to `backend/tests/test_rare_paints.py`:

```python
from src.handlers.scan_note import handler as note_handler
from src.shared.game_data import EXPLORER_NOTES


def _note_event(note_id, body):
    return {"httpMethod": "POST", "pathParameters": {"note_id": note_id}, "body": json.dumps(body)}


def test_metallic_granted_on_5th_note():
    _make_profile("p1")
    note_ids = list(EXPLORER_NOTES.keys())  # 5 notes
    for i, note_id in enumerate(note_ids):
        resp = note_handler(_note_event(note_id, {"player_id": "p1"}), None)
        assert resp["statusCode"] == 200
        items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
        has_metallic = any(i.get("details", {}).get("effect") == "metallic" for i in items)
        if i < 4:
            assert not has_metallic, f"Should not have metallic after note {i+1}"
        else:
            assert has_metallic, "Should have metallic after 5th note"


def test_metallic_not_granted_twice():
    _make_profile("p1")
    note_ids = list(EXPLORER_NOTES.keys())
    for note_id in note_ids:
        note_handler(_note_event(note_id, {"player_id": "p1"}), None)
    # Collect all notes a second time (already_found path)
    for note_id in note_ids:
        note_handler(_note_event(note_id, {"player_id": "p1"}), None)
    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    metallic = [i for i in items if i.get("details", {}).get("effect") == "metallic"]
    assert len(metallic) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_metallic_granted_on_5th_note -v`
Expected: FAIL

- [ ] **Step 3: Modify `backend/src/handlers/scan_note.py`**

Add import at top (after existing imports):
```python
from ..shared.rare_paints import grant_rare_paint
```

After `put_item({...NOTE record...})` at line 43, and before `found_notes = query_pk(...)` at line 46, insert the grant check. The full new-note block becomes:

```python
    # Write the note to player's record
    put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"NOTE#{note_id}",
        "note_id": note_id,
    })

    # Count total notes found (including this one)
    found_notes = query_pk(f"PLAYER#{player_id}", "NOTE#")

    # Grant metallic rare paint on collecting all 5 notes
    if len(found_notes) == len(EXPLORER_NOTES):
        grant_rare_paint(player_id, "metallic")

    return success({
        "found": True,
        "note_id": note_id,
        "note_text": note_text,
        "notes_found": len(found_notes),
        "notes_total": len(EXPLORER_NOTES),
    })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py::test_metallic_granted_on_5th_note tests/test_rare_paints.py::test_metallic_not_granted_twice -v`
Expected: 2 PASSED

- [ ] **Step 5: Run existing note tests for regressions**

Run: `cd backend && pytest tests/test_scan_note.py -v`
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/scan_note.py backend/tests/test_rare_paints.py
git commit -m "feat: grant metallic rare paint on collecting all 5 explorer notes"
```

---

## Task 5: Backend — starry_night grant at 10 unique trivia partners

**Files:**
- Modify: `backend/src/handlers/lobby.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Add tests to `test_rare_paints.py`**

Append to `backend/tests/test_rare_paints.py`:

```python
from src.handlers.lobby import answer_lobby_handler


def _answer_event(code, body):
    return {"httpMethod": "POST", "pathParameters": {"code": code}, "body": json.dumps(body)}


def _make_lobby(code, host_id, guest_id, status="active"):
    from src.shared.game_data import random_trivia
    q = random_trivia()
    put_item({
        "PK": f"LOBBY#{code}",
        "SK": "META",
        "host_id": host_id,
        "guest_id": guest_id,
        "status": status,
        "trivia_question": q,
        "xp_awarded": False,
    })


def test_starry_night_granted_on_10th_unique_partner():
    _make_profile("host")
    _make_profile("guest")
    _make_partner_dino("host")
    _make_partner_dino("guest", "spinosaurus")

    # Play with 10 different guests
    for i in range(10):
        guest_id = f"guest{i}"
        _make_profile(guest_id, f"Guest{i}")
        _make_partner_dino(guest_id, "spinosaurus")
        code = f"code{i}"
        _make_lobby(code, "host", guest_id)
        with patch("src.handlers.lobby.broadcast"):
            answer_lobby_handler(_answer_event(code, {"player_id": "host", "answer": 0}), None)

        items = query_pk("PLAYER#host", sk_prefix="ITEM#")
        has_starry = any(i.get("details", {}).get("effect") == "starry_night" for i in items)
        if i < 9:
            assert not has_starry, f"Should not have starry_night after {i+1} partners"
        else:
            assert has_starry, "Should have starry_night after 10th unique partner"


def test_starry_night_same_partner_not_double_counted():
    _make_profile("host")
    _make_profile("guest")
    _make_partner_dino("host")
    _make_partner_dino("guest", "spinosaurus")

    # Play with the same partner 10 times — should NOT grant
    for i in range(10):
        code = f"repeat{i}"
        _make_lobby(code, "host", "guest")
        with patch("src.handlers.lobby.broadcast"):
            answer_lobby_handler(_answer_event(code, {"player_id": "host", "answer": 0}), None)

    items = query_pk("PLAYER#host", sk_prefix="ITEM#")
    assert not any(i.get("details", {}).get("effect") == "starry_night" for i in items)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_starry_night_granted_on_10th_unique_partner -v`
Expected: FAIL

- [ ] **Step 3: Modify `backend/src/handlers/lobby.py`**

Add import at top (after existing imports):
```python
from ..shared.rare_paints import grant_rare_paint
```

Add the `_track_trivia_partner` helper function after `_give_reward` (before `create_lobby_handler`):

```python
def _track_trivia_partner(player_id, other_id):
    """
    Record that player_id played trivia with other_id.
    Unique per pair (idempotent). Grants starry_night at 10 unique partners.
    """
    sk = f"PARTNER#{other_id}"
    if get_item(f"EVENT#{player_id}", sk):
        return
    put_item({"PK": f"EVENT#{player_id}", "SK": sk})
    partners = query_pk(f"EVENT#{player_id}", sk_prefix="PARTNER#")
    if len(partners) == 10:
        grant_rare_paint(player_id, "starry_night")
```

In `answer_lobby_handler`, add partner tracking in the `if not xp_already_awarded:` block, after the cooldown `put_item` and before the feed broadcast (after line 219, inside the `if not xp_already_awarded:` block):

```python
        # Track unique trivia partners for starry_night achievement
        if guest_id:
            _track_trivia_partner(host_id, guest_id)
            _track_trivia_partner(guest_id, host_id)
```

Place this block right after the `put_item` for the cooldown record (line ~219) and before the `update_item` call that sets `xp_awarded: True`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py::test_starry_night_granted_on_10th_unique_partner tests/test_rare_paints.py::test_starry_night_same_partner_not_double_counted -v`
Expected: 2 PASSED

- [ ] **Step 5: Run existing lobby tests for regressions**

Run: `cd backend && pytest tests/test_lobby.py -v`
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/lobby.py backend/tests/test_rare_paints.py
git commit -m "feat: track trivia partners and grant starry_night at 10 unique"
```

---

## Task 6: Backend — prismatic grant on taming all 7 species

**Files:**
- Modify: `backend/src/handlers/scan_food.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Add tests to `test_rare_paints.py`**

Append to `backend/tests/test_rare_paints.py`:

```python
from src.handlers.scan_food import handler as food_handler
from src.shared.game_data import SPECIES as ALL_SPECIES


def _food_event(food_type, body):
    return {"httpMethod": "POST", "pathParameters": {"type": food_type}, "body": json.dumps(body)}


def test_prismatic_granted_on_taming_all_7():
    _make_profile("p1")
    species_list = list(ALL_SPECIES.keys())  # 7 species

    for i, sp in enumerate(species_list):
        food = ALL_SPECIES[sp]["food"]
        # Create the dino record (untamed)
        put_item({
            "PK": "PLAYER#p1", "SK": f"DINO#{sp}",
            "name": "", "colors": {}, "gender": "female", "nature": "Jolly",
            "hat": "", "xp": 0, "level": 1, "is_partner": False, "tamed": False, "shiny": False,
        })
        with patch("src.handlers.scan_food.broadcast"):
            resp = food_handler(_food_event(food, {"player_id": "p1", "species": sp}), None)
        assert resp["statusCode"] == 200

        items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
        has_prismatic = any(i.get("details", {}).get("effect") == "prismatic" for i in items)
        if i < len(species_list) - 1:
            assert not has_prismatic, f"Should not have prismatic after taming {i+1} species"
        else:
            assert has_prismatic, "Should have prismatic after taming all 7"


def test_prismatic_not_granted_twice():
    _make_profile("p1")
    species_list = list(ALL_SPECIES.keys())
    for sp in species_list:
        food = ALL_SPECIES[sp]["food"]
        put_item({
            "PK": "PLAYER#p1", "SK": f"DINO#{sp}",
            "name": "", "colors": {}, "gender": "female", "nature": "Jolly",
            "hat": "", "xp": 0, "level": 1, "is_partner": False, "tamed": False, "shiny": False,
        })
        with patch("src.handlers.scan_food.broadcast"):
            food_handler(_food_event(food, {"player_id": "p1", "species": sp}), None)
    # Re-tame all (already_tamed path) — should not grant again
    for sp in species_list:
        food = ALL_SPECIES[sp]["food"]
        with patch("src.handlers.scan_food.broadcast"):
            food_handler(_food_event(food, {"player_id": "p1", "species": sp}), None)

    items = query_pk("PLAYER#p1", sk_prefix="ITEM#")
    prismatic = [i for i in items if i.get("details", {}).get("effect") == "prismatic"]
    assert len(prismatic) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_prismatic_granted_on_taming_all_7 -v`
Expected: FAIL

- [ ] **Step 3: Modify `backend/src/handlers/scan_food.py`**

Add import at top (after existing imports):
```python
from ..shared.rare_paints import grant_rare_paint
```

Add `_check_prismatic_grant` helper function after `_auto_set_partner` (before `handler`):

```python
def _check_prismatic_grant(player_id):
    """Grant prismatic rare paint if all 7 species are now tamed."""
    all_dinos = query_pk(f"PLAYER#{player_id}", sk_prefix="DINO#")
    tamed_species = {d["SK"].replace("DINO#", "") for d in all_dinos if d.get("tamed")}
    if tamed_species >= set(SPECIES.keys()):
        grant_rare_paint(player_id, "prismatic")
```

Call `_check_prismatic_grant(player_id)` in two places inside `handler` — after **both** `update_item(...{"tamed": True})` calls (there are two taming paths: direct species and auto-select). Each place immediately after the `update_item` that sets `tamed: True`:

**Path 1** (direct species, ~line 99):
```python
        update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})
        _check_prismatic_grant(player_id)   # ← add this line
        first_partner = _auto_set_partner(player_id, species, profile)
```

**Path 2** (auto-select, ~line 156):
```python
    update_item(f"PLAYER#{player_id}", f"DINO#{species}", {"tamed": True})
    _check_prismatic_grant(player_id)   # ← add this line
    first_partner = _auto_set_partner(player_id, species, profile)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py::test_prismatic_granted_on_taming_all_7 tests/test_rare_paints.py::test_prismatic_not_granted_twice -v`
Expected: 2 PASSED

- [ ] **Step 5: Run full rare paints test suite and existing scan_food tests**

Run: `cd backend && pytest tests/test_rare_paints.py tests/test_scan_food.py -v`
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/scan_food.py backend/tests/test_rare_paints.py
git commit -m "feat: grant prismatic rare paint on taming all 7 species"
```

---

## Task 7: Backend — apply rare paint in customize handler

**Files:**
- Modify: `backend/src/handlers/dino.py`
- Test: `backend/tests/test_rare_paints.py`

- [ ] **Step 1: Add tests to `test_rare_paints.py`**

Append to `backend/tests/test_rare_paints.py`:

```python
from src.handlers.dino import customize_handler


def _customize_event(species, body):
    return {
        "httpMethod": "PUT",
        "resource": f"/dino/{species}/customize",
        "pathParameters": {"species": species},
        "body": json.dumps(body),
    }


def _make_dino(player_id, species, tamed=True, is_partner=False):
    put_item({
        "PK": f"PLAYER#{player_id}", "SK": f"DINO#{species}",
        "name": "", "colors": {"body": 120, "belly": 60, "stripes": 200},
        "gender": "female", "nature": "Jolly", "hat": "", "xp": 0,
        "level": 1, "is_partner": is_partner, "tamed": tamed, "shiny": False,
    })


def _make_rare_paint_item(player_id, effect, item_sk="ITEM#rp1"):
    put_item({
        "PK": f"PLAYER#{player_id}", "SK": item_sk,
        "type": "paint", "name": f"{effect} paint",
        "details": {"effect": effect},
    })


def test_apply_rare_paint_updates_colors_and_consumes_item():
    _make_profile("p1")
    _make_dino("p1", "trex")
    _make_rare_paint_item("p1", "rainbow", "ITEM#rp1")

    with patch("src.handlers.dino.broadcast"):
        resp = customize_handler(
            _customize_event("trex", {"player_id": "p1", "paint": {"region": "body", "effect": "rainbow"}}),
            None,
        )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["colors"]["body"] == {"effect": "rainbow"}
    assert body["colors"]["belly"] == 60  # unchanged

    # Item consumed
    assert get_item("PLAYER#p1", "ITEM#rp1") is None


def test_apply_rare_paint_fails_without_item():
    _make_profile("p1")
    _make_dino("p1", "trex")

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p1", "paint": {"region": "body", "effect": "rainbow"}}),
        None,
    )
    assert resp["statusCode"] == 400


def test_apply_rare_paint_invalid_region_rejected():
    _make_profile("p1")
    _make_dino("p1", "trex")
    _make_rare_paint_item("p1", "rainbow", "ITEM#rp2")

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p1", "paint": {"region": "sail", "effect": "rainbow"}}),
        None,
    )
    assert resp["statusCode"] == 400


def test_apply_rare_paint_unknown_effect_rejected():
    _make_profile("p1")
    _make_dino("p1", "trex")
    _make_rare_paint_item("p1", "dragon_fire", "ITEM#rp3")

    resp = customize_handler(
        _customize_event("trex", {"player_id": "p1", "paint": {"region": "body", "effect": "dragon_fire"}}),
        None,
    )
    assert resp["statusCode"] == 400


def test_normal_paint_still_works_after_changes():
    """Regression: applying a normal paint by paint_id must still work."""
    _make_profile("p1")
    _make_dino("p1", "trex")
    put_item({
        "PK": "PLAYER#p1", "SK": "ITEM#normal1",
        "type": "paint", "name": "Crimson Paint",
        "details": {"paint_id": "crimson", "hue": 0},
    })

    with patch("src.handlers.dino.broadcast"):
        resp = customize_handler(
            _customize_event("trex", {"player_id": "p1", "paint": {"region": "body", "paint_id": "crimson"}}),
            None,
        )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["colors"]["body"] == 0  # crimson hue
    assert get_item("PLAYER#p1", "ITEM#normal1") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_rare_paints.py::test_apply_rare_paint_updates_colors_and_consumes_item -v`
Expected: FAIL

- [ ] **Step 3: Modify `backend/src/handlers/dino.py`**

Add import at top (after existing imports):
```python
from ..shared.rare_paints import RARE_EFFECTS
```

Replace the entire paint block in `customize_handler` (lines 76–111) with:

```python
    # Handle paint: consumes a paint item from inventory, updates color region
    paint = body.get("paint")
    if paint is not None:
        region = paint.get("region")
        paint_id = paint.get("paint_id")
        effect = paint.get("effect")

        if region is None or (paint_id is None and effect is None):
            return error("paint requires 'region' and either 'paint_id' or 'effect'")

        species_regions = SPECIES[species]["regions"]
        if region not in species_regions:
            return error(f"Invalid region '{region}' for {species}. Valid: {species_regions}")

        if effect is not None:
            # Rare paint application
            if effect not in RARE_EFFECTS:
                return error(f"Unknown effect: {effect}")

            items = query_pk(f"PLAYER#{player_id}", sk_prefix="ITEM#")
            paint_item = None
            for item in items:
                if item.get("type") == "paint":
                    details = item.get("details") or {}
                    if details.get("effect") == effect:
                        paint_item = item
                        break

            if not paint_item:
                return error(f"No {effect} paint in inventory")

            delete_item(f"PLAYER#{player_id}", paint_item["SK"])
            existing_colors = dict(dino.get("colors", {}))
            existing_colors[region] = {"effect": effect}
            updates["colors"] = existing_colors

        else:
            # Normal paint application
            if paint_id not in PAINT_MAP:
                return error(f"Unknown paint: {paint_id}")

            items = query_pk(f"PLAYER#{player_id}", sk_prefix="ITEM#")
            paint_item = None
            for item in items:
                if item.get("type") == "paint":
                    details = item.get("details") or {}
                    if details.get("paint_id") == paint_id:
                        paint_item = item
                        break

            if not paint_item:
                return error(f"No {paint_id} paint in inventory")

            delete_item(f"PLAYER#{player_id}", paint_item["SK"])
            hue = PAINT_MAP[paint_id]["hue"]
            existing_colors = dict(dino.get("colors", {}))
            existing_colors[region] = hue
            updates["colors"] = existing_colors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_rare_paints.py -v`
Expected: all PASSED (12+ tests)

- [ ] **Step 5: Run existing dino tests for regressions**

Run: `cd backend && pytest tests/test_dino.py -v`
Expected: all PASSED

- [ ] **Step 6: Run the full backend test suite**

Run: `cd backend && pytest -v`
Expected: all PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/src/handlers/dino.py backend/tests/test_rare_paints.py
git commit -m "feat: apply rare paint effect to dino region in customize handler"
```

---

## Task 8: `frontend/src/utils/spriteEngine.js` — uncached recolor for animation

**Files:**
- Modify: `frontend/src/utils/spriteEngine.js`

- [ ] **Step 1: Add `getRecoloredUncached` to `spriteEngine.js`**

After the `getRecolored` function (after line 212), add:

```js
/**
 * Recolor a sprite without using or writing to the cache.
 * Use this for animated effects where the hue changes every animation frame.
 * @param {string} species
 * @param {object} colors - Plain hue numbers (use resolveColors from dinoColors.js first)
 * @param {string[]} regions
 * @returns {HTMLCanvasElement|null}
 */
export function getRecoloredUncached(species, colors, regions) {
  const img = rawImages[species];
  if (!img) return null;
  const hues = regions.map(r => colors[r] ?? 120);
  return recolorImage(img, hues);
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd frontend && npm run build 2>&1 | head -20`
Expected: build succeeds (or only pre-existing warnings)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/spriteEngine.js
git commit -m "feat: add getRecoloredUncached for per-frame effect rendering"
```

---

## Task 9: `frontend/src/components/DinoSprite.jsx` — animated effect rendering

**Files:**
- Modify: `frontend/src/components/DinoSprite.jsx`

The strategy: if any region has a rare effect, use `requestAnimationFrame` to redraw each frame with animated hues and overlay effects (metallic shimmer, starry night sparkles). Rainbow and prismatic are handled purely by hue cycling.

- [ ] **Step 1: Replace `frontend/src/components/DinoSprite.jsx` with the new version**

```jsx
import { useRef, useEffect, useState } from 'preact/hooks';
import { getRecolored, getRecoloredUncached, getRawImage } from '../utils/spriteEngine.js';
import { hasEffects, resolveColors, regionEffect } from '../dinoColors.js';
import { SPECIES } from '../data/species.js';
import { getHatImage, getHatAnchor } from '../data/hatImages.js';

/**
 * Renders a recolored dino sprite on a <canvas> element with pixelated scaling.
 * Supports rare paint effects (rainbow, metallic, starry_night, prismatic) with animation.
 *
 * @param {string} species - Species ID (e.g. 'trex')
 * @param {object} colors - Region→hue or Region→{effect} map
 * @param {number} scale - Pixel scale multiplier (default 3)
 * @param {string} hat - Hat ID to render, or null
 */
export function DinoSprite({ species, colors = {}, scale = 3, style = {}, hat = null }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const [hatVersion, setHatVersion] = useState(0);

  useEffect(() => {
    // Cancel any running animation loop before setting up a new one
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const speciesData = SPECIES[species];
    if (!speciesData) return;
    const regions = speciesData.regions;

    const hatInfo = hat ? getHatImage(hat) : null;
    const anchor  = hat ? getHatAnchor(species) : null;

    function drawFrame(time) {
      const resolvedColors = hasEffects(colors)
        ? resolveColors(colors, time)
        : colors;

      const recolored = hasEffects(colors)
        ? getRecoloredUncached(species, resolvedColors, regions)
        : (getRecolored(species, colors, regions) || getRawImage(species));

      if (!recolored) return;

      const sw = recolored.width  || recolored.naturalWidth;
      const sh = recolored.height || recolored.naturalHeight;

      let hatRise = 0;
      if (hatInfo?.loaded && anchor) {
        const hatH = hatInfo.img.naturalHeight;
        const hatTopInSprite = anchor.y + hatInfo.offsetY - hatH;
        if (hatTopInSprite < 0) hatRise = Math.ceil(-hatTopInSprite);
      }

      const w = sw * scale;
      const h = (sh + hatRise) * scale;

      // Only resize canvas when dimensions change (avoids redundant context resets)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      ctx.drawImage(recolored, 0, hatRise * scale, sw * scale, sh * scale);

      // Draw effect overlays (metallic shimmer, starry night sparkles)
      if (hasEffects(colors)) {
        _drawEffectOverlays(ctx, colors, w, sh * scale, hatRise * scale, time, scale);
      }

      if (hatInfo?.loaded && anchor) {
        const hatW = hatInfo.img.naturalWidth  * scale;
        const hatH = hatInfo.img.naturalHeight * scale;
        const hatX = (anchor.x + (hatInfo.offsetX || 0)) * scale - hatW / 2;
        const hatY = (anchor.y + hatRise + hatInfo.offsetY) * scale - hatH;
        ctx.drawImage(hatInfo.img, hatX, hatY, hatW, hatH);
      }
    }

    if (hasEffects(colors)) {
      function loop() {
        drawFrame(Date.now());
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    } else {
      drawFrame(0);
    }
  }, [species, colors, scale, hat, hatVersion]);

  // Watch for hat image load to trigger canvas redraw
  useEffect(() => {
    if (!hat) return;
    const hatInfo = getHatImage(hat);
    if (!hatInfo || hatInfo.loaded) return;
    const onLoad = () => setHatVersion(v => v + 1);
    hatInfo.img.addEventListener('load', onLoad);
    return () => hatInfo.img.removeEventListener('load', onLoad);
  }, [hat]);

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated', display: 'block', ...style }}
    />
  );
}

// ── Effect overlay helpers ────────────────────────────────────────────────────

function _drawEffectOverlays(ctx, colors, w, spriteH, spriteOffsetY, time, scale) {
  for (const value of Object.values(colors)) {
    if (!value || typeof value !== 'object') continue;
    if (value.effect === 'metallic')     _drawMetallicShimmer(ctx, w, spriteH, spriteOffsetY, time);
    if (value.effect === 'starry_night') _drawStarryNight(ctx, w, spriteH, spriteOffsetY, time, scale);
  }
}

function _drawMetallicShimmer(ctx, w, h, offsetY, time) {
  // Diagonal highlight sweep from left to right over 1.5s
  const progress = ((time / 1500) % 1);
  const shimmerX = progress * (w + w * 0.4) - w * 0.2;
  const grad = ctx.createLinearGradient(shimmerX, offsetY, shimmerX + w * 0.35, offsetY + h);
  grad.addColorStop(0,   'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.30)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = grad;
  ctx.fillRect(0, offsetY, w, h);
  ctx.restore();
}

function _drawStarryNight(ctx, w, h, offsetY, time, scale) {
  // 10 pseudo-random twinkling dots clipped to sprite shape
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const count = 10;
  for (let i = 0; i < count; i++) {
    const px     = ((i * 97 + 13) % 100) / 100 * w;
    const py     = offsetY + ((i * 67 + 7) % 100) / 100 * h;
    const alpha  = 0.25 + 0.75 * Math.abs(Math.sin(time / 600 + i * 2.3));
    const radius = (0.8 + (i % 3) * 0.4) * scale;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,235,255,${alpha.toFixed(2)})`;
    ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DinoSprite.jsx
git commit -m "feat: animate rare paint effects in DinoSprite with requestAnimationFrame"
```

---

## Task 10: `frontend/src/components/DinoDetail.jsx` — rare paint inventory and apply flow

**Files:**
- Modify: `frontend/src/components/DinoDetail.jsx`

Changes needed:
1. Include rare paint items in the paint inventory (`paintItems` filter)
2. Add `selectedEffect` state alongside `selectedPaint` for rare paints
3. Show rare paints in the picker with an animated swatch
4. Update `handleApplyPaint` to send `{ region, effect }` for rare paints
5. Show current region color correctly when region has an effect
6. Update the paint preview to handle effect objects

- [ ] **Step 1: Add `dinoColors.js` import and update `DinoDetail.jsx`**

At the top of `DinoDetail.jsx`, add to the import block (after the existing imports):
```jsx
import { regionHue, hasEffects } from '../dinoColors.js';
```

**Change 1** — Include rare paint items in `paintItems` (line 112):
```jsx
// Old:
const paintItems = (player?.items || []).filter(i => i.type === 'paint' && i.details?.paint_id);

// New:
const paintItems = (player?.items || []).filter(
  i => i.type === 'paint' && (i.details?.paint_id || i.details?.effect)
);
```

**Change 2** — Add `selectedEffect` state (after `selectedPaint` state at line 79):
```jsx
const [selectedEffect, setSelectedEffect] = useState(null); // effect string for rare paints
```

**Change 3** — Update `paintCounts` grouping to handle rare paints (replace lines 113–118):
```jsx
const paintCounts = {};
const rarePaintItems = [];
paintItems.forEach(i => {
  if (i.details?.paint_id) {
    const pid = i.details.paint_id;
    paintCounts[pid] = (paintCounts[pid] || 0) + 1;
  } else if (i.details?.effect) {
    // Rare paints: one per effect, not counted
    const eff = i.details.effect;
    if (!rarePaintItems.find(r => r === eff)) rarePaintItems.push(eff);
  }
});
const hasPaints = Object.keys(paintCounts).length > 0 || rarePaintItems.length > 0;
```

**Change 4** — Update `previewColors` (replace lines 123–126):
```jsx
const previewColors = selectedEffect && paintRegion
  ? { ...colors, [paintRegion]: { effect: selectedEffect } }
  : (selectedPaint && paintRegion)
  ? { ...colors, [paintRegion]: PAINT_MAP[selectedPaint]?.hue ?? 120 }
  : colors;
```

**Change 5** — Update `handleSelectPaint` and add `handleSelectEffect` (after line 173):
```jsx
function handleSelectPaint(paintId) {
  setSelectedPaint(paintId);
  setSelectedEffect(null);
  setPaintRegion(null);
  setShowPaints(false);
}

function handleSelectEffect(effect) {
  setSelectedEffect(effect);
  setSelectedPaint(null);
  setPaintRegion(null);
  setShowPaints(false);
}
```

**Change 6** — Update `handleApplyPaint` (replace lines 175–184):
```jsx
function handleApplyPaint() {
  if (!paintRegion) return;
  doAction(async () => {
    if (selectedEffect) {
      await api.customizeDino(store.playerId, species, {
        paint: { region: paintRegion, effect: selectedEffect },
      });
      setSelectedEffect(null);
    } else if (selectedPaint) {
      await api.customizeDino(store.playerId, species, {
        paint: { region: paintRegion, paint_id: selectedPaint },
      });
      setSelectedPaint(null);
    }
    setPaintRegion(null);
  });
}

function handleCancelPaint() {
  setSelectedPaint(null);
  setSelectedEffect(null);
  setPaintRegion(null);
}
```

**Change 7** — Update region button condition to include `selectedEffect` (line 292):
```jsx
{dino.tamed && !selectedPaint && !selectedEffect && (
```

**Change 8** — In the paint picker (lines 366–386), after the normal paints grid, add rare paints. Replace the paint picker grid block entirely:

```jsx
{dino.tamed && showPaints && !selectedPaint && !selectedEffect && (
  <div style={styles.card}>
    <div style={styles.sectionTitle}>Choose a Paint</div>
    <div style={styles.paintGrid}>
      {Object.entries(paintCounts).map(([paintId, count]) => {
        const paintData = PAINT_MAP[paintId];
        if (!paintData) return null;
        return (
          <button key={paintId} onClick={() => handleSelectPaint(paintId)} disabled={busy} style={styles.paintItem}>
            <PaintSprite hue={paintData.hue} scale={1} style={{ maxWidth: '36px', maxHeight: '36px' }} />
            <span style={styles.paintItemName}>{paintData.name}</span>
            {count > 1 && <span style={styles.paintItemCount}>x{count}</span>}
          </button>
        );
      })}
      {rarePaintItems.map(eff => (
        <button key={eff} onClick={() => handleSelectEffect(eff)} disabled={busy} style={styles.paintItem}>
          <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: RARE_EFFECT_GRADIENTS[eff], flexShrink: 0 }} />
          <span style={styles.paintItemName}>{RARE_EFFECT_NAMES[eff]}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

**Change 9** — Update paint apply flow condition to also show for rare paints (line 390):
```jsx
{dino.tamed && (selectedPaint || selectedEffect) && (
```

And update the title and swatch inside the apply flow:
```jsx
<div style={styles.sectionTitle}>
  Apply {selectedEffect ? RARE_EFFECT_NAMES[selectedEffect] : (PAINT_MAP[selectedPaint]?.name + ' Paint')}
</div>
<div style={{ display: 'flex', justifyContent: 'center' }}>
  {selectedEffect
    ? <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: RARE_EFFECT_GRADIENTS[selectedEffect] }} />
    : <PaintSprite hue={PAINT_MAP[selectedPaint]?.hue ?? 120} scale={1} style={{ maxWidth: '48px', maxHeight: '48px' }} />}
</div>
```

**Change 10** — Fix the region color swatch in the apply flow to handle effect objects (line 413):
```jsx
// Old:
background: colors[r] != null ? `hsl(${colors[r]}, 70%, 50%)` : '#555',

// New:
background: regionHue(colors, r) !== null
  ? `hsl(${regionHue(colors, r)}, 70%, 50%)`
  : (colors[r]?.effect ? '#c571ff' : '#555'),
```

**Change 11** — Update apply button disabled check (line 424):
```jsx
disabled={busy || !paintRegion || (!selectedPaint && !selectedEffect)}
```

**Change 12** — Add the constants before `DinoDetail` component:
```jsx
const RARE_EFFECT_NAMES = {
  rainbow:      'Rainbow',
  metallic:     'Metallic',
  starry_night: 'Starry Night',
  prismatic:    'Prismatic',
};

const RARE_EFFECT_GRADIENTS = {
  rainbow:      'linear-gradient(135deg, #ff0000, #ff7700, #ffff00, #00cc44, #0066ff, #cc00ff)',
  metallic:     'linear-gradient(135deg, #8a9bb0, #c8d8e8, #6a7f94, #d4e4f4)',
  starry_night: 'linear-gradient(135deg, #0d1b4b, #1a2870, #0d1535)',
  prismatic:    'linear-gradient(135deg, #ff6b6b, #ffa500, #ffee00, #00ee88, #00aaff, #cc44ff)',
};
```

- [ ] **Step 2: Verify build passes**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DinoDetail.jsx
git commit -m "feat: show rare paint items in DinoDetail and support effect apply flow"
```

---

## Task 11: `frontend/src/components/PlazaCanvas.js` — per-frame effect rendering

**Files:**
- Modify: `frontend/src/components/PlazaCanvas.js`

- [ ] **Step 1: Update imports in `PlazaCanvas.js`**

Replace the first line:
```js
// Old:
import { getRecolored, getPlazaBackground } from '../utils/spriteEngine.js';

// New:
import { getRecolored, getRecoloredUncached, getPlazaBackground } from '../utils/spriteEngine.js';
import { hasEffects, resolveColors } from '../dinoColors.js';
```

- [ ] **Step 2: Update `_buildDinoData` to tag animated dinos**

In `_buildDinoData`, after `const colors = partner.colors || {};` (line 77), add:
```js
    const animatedColors = hasEffects(colors) ? colors : null;
```

Update the return object to include `animatedColors` and keep the initial `spriteCanvas` for sizing:
```js
    return {
      ...anim,
      partner,
      scale,
      isChampion,
      spriteCanvas,       // used for sizing even when animated
      animatedColors,     // non-null means re-render each frame
      ownerPhoto,
    };
```

- [ ] **Step 3: Update `_drawDino` to use per-frame recolor for effect dinos**

In `_drawDino`, replace the `ctx.drawImage` calls for the sprite (the two `drawImage` calls with `d.spriteCanvas`) with an approach that resolves the sprite per frame when effects are present.

Find the section in `_drawDino` that starts with `if (!d.facingLeft) {` (around line 600) and reads `d.spriteCanvas`. Before the `const drawScale = BASE_SPRITE_SCALE * d.scale;` line, add:

```js
    // Resolve sprite: use uncached per-frame recolor if dino has effect regions
    let spriteCanvas = d.spriteCanvas;
    if (d.animatedColors) {
      const speciesData = SPECIES[d.partner.species];
      const regions = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
      const resolved = resolveColors(d.animatedColors, Date.now());
      spriteCanvas = getRecoloredUncached(d.partner.species, resolved, regions) || d.spriteCanvas;
    }
```

Then replace all references to `d.spriteCanvas` within `_drawDino` (for drawing and sizing) with the local `spriteCanvas` variable. The key replacements are:
- `const spriteW = d.spriteCanvas.width * drawScale;` → `const spriteW = spriteCanvas.width * drawScale;`
- `const spriteH = d.spriteCanvas.height * drawScale;` → `const spriteH = spriteCanvas.height * drawScale;`
- `ctx.drawImage(d.spriteCanvas, ...)` → `ctx.drawImage(spriteCanvas, ...)`

After `ctx.restore()` at line 608 (end of the sprite save/restore block), add effect overlays. In PlazaCanvas `_drawDino`, the sprite is drawn at `(x - halfW, y - halfH + hopY)` where `x = d.worldX`, `y = d.worldY`, and `hopY` is the hop/idle offset already computed above:

```js
    // Effect overlays — drawn after sprite restore, in world coordinates
    if (d.animatedColors) {
      const t = Date.now();
      for (const value of Object.values(d.animatedColors)) {
        if (!value || typeof value !== 'object') continue;
        if (value.effect === 'metallic') {
          const progress = ((t / 1500) % 1);
          const shimX = x - halfW + progress * (spriteW + spriteW * 0.4) - spriteW * 0.2;
          const grad = ctx.createLinearGradient(shimX, y - halfH + hopY, shimX + spriteW * 0.35, y + halfH + hopY);
          grad.addColorStop(0,   'rgba(255,255,255,0)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          grad.addColorStop(1,   'rgba(255,255,255,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = grad;
          ctx.fillRect(x - halfW, y - halfH + hopY, spriteW, spriteH);
          ctx.restore();
        }
        if (value.effect === 'starry_night') {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          for (let i = 0; i < 8; i++) {
            const px = x - halfW + ((i * 97 + 13) % 100) / 100 * spriteW;
            const py = y - halfH + hopY + ((i * 67 + 7) % 100) / 100 * spriteH;
            const alpha = 0.2 + 0.8 * Math.abs(Math.sin(t / 600 + i * 2.3));
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220,235,255,${alpha.toFixed(2)})`;
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlazaCanvas.js
git commit -m "feat: render rare paint effects per-frame in PlazaCanvas"
```

---

## Task 12: `frontend/src/components/BossFightCanvas.js` — per-frame effect rendering

**Files:**
- Modify: `frontend/src/components/BossFightCanvas.js`

Same pattern as PlazaCanvas, applied to the boss fight canvas.

- [ ] **Step 1: Update imports in `BossFightCanvas.js`**

Replace the first import line:
```js
// Old:
import { getRecolored } from '../utils/spriteEngine.js';

// New:
import { getRecolored, getRecoloredUncached } from '../utils/spriteEngine.js';
import { hasEffects, resolveColors } from '../dinoColors.js';
```

- [ ] **Step 2: Update `_makeSlot` to tag animated slots**

In `_makeSlot`, after `const spriteCanvas = getRecolored(partner.species, partner.colors || {}, regions);` (line 143), add:
```js
    const animatedColors = hasEffects(partner.colors || {}) ? (partner.colors || {}) : null;
```

Update the return object to include `animatedColors`:
```js
    return {
      partner,
      slotAngle,
      isMyDino,
      spriteCanvas,
      animatedColors,
      ownerPhoto,
      radiusFactor: isMyDino ? 1 : 0.82 + Math.random() * 0.36,
      // ... rest of existing fields unchanged ...
    };
```

(Keep all existing fields in the return object — only add `animatedColors` to the list.)

- [ ] **Step 3: Update `_drawDino` for per-frame effect rendering**

In `_drawDino`, before `const sc = slot.drawScale;` (around line 511), add:

```js
    // Resolve sprite per frame if dino has rare effect regions
    let spriteCanvas = slot.spriteCanvas;
    if (slot.animatedColors) {
      const speciesData = SPECIES[slot.partner.species];
      const regions = speciesData ? speciesData.regions : ['body', 'belly', 'stripes'];
      const resolved = resolveColors(slot.animatedColors, Date.now());
      spriteCanvas = getRecoloredUncached(slot.partner.species, resolved, regions) || slot.spriteCanvas;
    }
```

Replace `slot.spriteCanvas` references for sizing and drawing (within `_drawDino` only) with local `spriteCanvas`:
- `const spriteW = slot.spriteCanvas.width * sc;` → `const spriteW = spriteCanvas.width * sc;`
- `const spriteH = slot.spriteCanvas.height * sc;` → `const spriteH = spriteCanvas.height * sc;`
- `ctx.drawImage(slot.spriteCanvas, ...)` → `ctx.drawImage(spriteCanvas, ...)`

**Do NOT change `slot.spriteCanvas` references in `_spawnPoof`** — those are for particle sizing and should stay as `slot.spriteCanvas`.

After `ctx.restore()` at line 537 (end of the sprite save/restore block), add effect overlays. `drawX` and `drawY` are already defined above as `slot.sx + dx` and `slot.sy + dy - arcY - idleHop`:

```js
    // Effect overlays — drawn after sprite restore, in canvas coordinates
    if (slot.animatedColors) {
      const t = Date.now();
      for (const value of Object.values(slot.animatedColors)) {
        if (!value || typeof value !== 'object') continue;
        if (value.effect === 'metallic') {
          const progress = ((t / 1500) % 1);
          const shimX = drawX - halfW + progress * (spriteW + spriteW * 0.4) - spriteW * 0.2;
          const grad = ctx.createLinearGradient(shimX, drawY - halfH, shimX + spriteW * 0.35, drawY + halfH);
          grad.addColorStop(0,   'rgba(255,255,255,0)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          grad.addColorStop(1,   'rgba(255,255,255,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = grad;
          ctx.fillRect(drawX - halfW, drawY - halfH, spriteW, spriteH);
          ctx.restore();
        }
        if (value.effect === 'starry_night') {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          for (let i = 0; i < 8; i++) {
            const px = drawX - halfW + ((i * 97 + 13) % 100) / 100 * spriteW;
            const py = drawY - halfH  + ((i * 67 + 7) % 100) / 100 * spriteH;
            const alpha = 0.2 + 0.8 * Math.abs(Math.sin(t / 600 + i * 2.3));
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220,235,255,${alpha.toFixed(2)})`;
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: build succeeds

- [ ] **Step 5: Run full backend test suite one final time**

Run: `cd backend && pytest -v`
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/BossFightCanvas.js
git commit -m "feat: render rare paint effects per-frame in BossFightCanvas"
```

---

## Final Verification

- [ ] **Run full backend tests**: `cd backend && pytest -v` — all PASSED
- [ ] **Run frontend build**: `cd frontend && npm run build` — no errors
- [ ] **Manual smoke test**: Start dev server (`cd frontend && npm run dev`), open a dino detail page, verify paint picker shows both normal and rare paints (may need to add test data via DynamoDB or admin panel)
