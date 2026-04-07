# Backdrop Unlock System

Backdrops in the DinoDetail page picker are earned through gameplay progression rather than all being available from the start. Each species maps to a unique backdrop location. Discovering a species reveals the backdrop (locked); taming it unlocks it for selection.

## Species-to-Backdrop Mapping

| Species            | Backdrop ID | Label     | Asset                       |
|--------------------|-------------|-----------|-----------------------------|
| T-Rex              | volcanic    | Volcanic  | dino_find_volcanic.png      |
| Spinosaurus        | swamp       | Swamp     | dino_find_swamp.png         |
| Dilophosaurus      | grass       | Tall Grass| dino_find_tall_grass.png    |
| Pachycephalosaurus | canyon      | Canyon    | dino_find_canyon.png        |
| Parasaurolophus    | river       | River     | dino_find_river.png         |
| Triceratops        | cave        | Cave      | dino_find_cave.png          |
| Ankylosaurus       | rocks       | Rocks     | dino_find_rocks.png         |

## Picker States

Each backdrop thumbnail in the picker has one of three states:

- **Available (always):** Default (black) swatch. Always first in the row.
- **Unlocked:** Species is tamed. Selectable, shown with green border when active (existing behavior).
- **Locked:** Species is discovered but not tamed. Shown at ~40% opacity with a lock icon overlay. Not clickable.
- **Hidden:** Species not yet discovered. Not rendered in the picker at all.

## Auto-Default on First Tame

When a dino's `background` field is empty/unset and the player has at least one tamed dino, the system does NOT auto-write a value to the backend. Instead, the first tamed dino's backdrop is used as a visual default when rendering the DinoDetail page. The stored value remains `''` until the player explicitly picks a backdrop.

## Deriving Unlock State

No new backend state. Unlock status is derived client-side from `player.dinos`:

```
tamedSpecies  = player.dinos.filter(d => d.tamed).map(d => d.species)
discoveredSpecies = player.dinos.map(d => d.species)

For each backdrop:
  - species tamed     -> unlocked (selectable)
  - species discovered -> locked (visible, dimmed, not selectable)
  - species unknown    -> hidden
```

## WILD_BG Update

The `WILD_BG` map in DinoDetail.jsx (used for untamed dino backgrounds) must be updated to match the new species-to-backdrop mapping. This is the same data — the backdrop a species unlocks is the same environment shown when viewing that untamed dino.

## Files Changed

1. **`frontend/src/data/species.js`** — Add `backdrop` field to each species entry linking to a backdrop ID (e.g., `backdrop: 'volcanic'` for T-Rex).
2. **`frontend/src/components/DinoDetail.jsx`**:
   - Import new volcanic asset.
   - Add volcanic to `BG_OPTIONS`.
   - Update `WILD_BG` to match new mapping (using species `backdrop` field).
   - Modify backdrop picker to filter/dim based on player's tamed/discovered species.
   - Add lock icon overlay styling for locked backdrops.
   - Implement auto-default logic for first tame.
3. **No backend changes.**
