# Backdrop Unlock System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backdrops in the DinoDetail picker progression-based — discovered species show locked, tamed species unlock their backdrop for selection.

**Architecture:** Add a `backdrop` field to each species in `species.js` mapping it to a backdrop ID. In DinoDetail, derive unlock state from `player.dinos` and filter/style the picker accordingly. Import the new volcanic asset and update `WILD_BG` to match the new 1:1 species-backdrop mapping.

**Tech Stack:** Preact, inline styles, existing `api.customizeDino` endpoint.

---

### Task 1: Add `backdrop` field to species data

**Files:**
- Modify: `frontend/src/data/species.js`

- [ ] **Step 1: Add `backdrop` field to each species**

Each species gets a `backdrop` string matching a backdrop ID. Update `frontend/src/data/species.js`:

```js
export const SPECIES = {
  trex: {
    id: 'trex', name: 'T-Rex', diet: 'carnivore', food: 'meat',
    regions: ['body', 'belly', 'stripes'],
    flavor: "The apex predator of the party.",
    backdrop: 'volcanic',
  },
  spinosaurus: {
    id: 'spinosaurus', name: 'Spinosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'sail', 'belly'],
    flavor: "Semi-aquatic and fully dramatic.",
    backdrop: 'swamp',
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'frill', 'crest'],
    flavor: "Will absolutely spit on you if you don't bring it meat.",
    backdrop: 'grass',
  },
  pachycephalosaurus: {
    id: 'pachycephalosaurus', name: 'Pachycephalosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'dome', 'spots'],
    flavor: "Known for headbutting the snack table.",
    backdrop: 'canyon',
  },
  parasaurolophus: {
    id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'crest', 'belly'],
    flavor: "Plays its crest like a trombone at 2am.",
    backdrop: 'river',
  },
  triceratops: {
    id: 'triceratops', name: 'Triceratops', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'frill', 'horns'],
    flavor: "Three horns are better than one.",
    backdrop: 'cave',
  },
  ankylosaurus: {
    id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'armor', 'club'],
    flavor: "Built like a tank.",
    backdrop: 'rocks',
  },
  godzilla: {
    id: 'godzilla', name: 'Godzilla', diet: 'carnivore', food: 'meat',
    regions: ['body', 'spines', 'belly'],
    flavor: "Former city destroyer, now party guest.",
    secret: true,
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
```

Note: godzilla has no `backdrop` — secret species don't participate in the unlock system.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/data/species.js
git commit -m "feat: add backdrop field to species data for unlock system"
```

---

### Task 2: Import volcanic asset and update BG_OPTIONS and WILD_BG

**Files:**
- Modify: `frontend/src/components/DinoDetail.jsx:32-59`

- [ ] **Step 1: Add volcanic import**

After the existing background imports (line 37), add:

```js
import bgVolcanic from '../assets/backgrounds/dino_find_volcanic.png';
```

- [ ] **Step 2: Update `BG_OPTIONS` to include volcanic**

Replace the `BG_OPTIONS` array (lines 51-59) with:

```js
const BG_OPTIONS = [
  { id: '', label: 'Default', color: '#0a0a0a', img: null },
  { id: 'rocks', label: 'Rocks', color: null, img: bgRocks },
  { id: 'swamp', label: 'Swamp', color: null, img: bgSwamp },
  { id: 'river', label: 'River', color: null, img: bgRiver },
  { id: 'grass', label: 'Tall Grass', color: null, img: bgGrass },
  { id: 'cave', label: 'Cave', color: null, img: bgCave },
  { id: 'canyon', label: 'Canyon', color: null, img: bgCanyon },
  { id: 'volcanic', label: 'Volcanic', color: null, img: bgVolcanic },
];
```

- [ ] **Step 3: Derive `WILD_BG` from species data instead of hardcoding**

Replace the hardcoded `WILD_BG` map (lines 41-49) with a derived version. This uses each species' `backdrop` field to look up the image from `BG_OPTIONS`, keeping the mapping in one place (species.js):

```js
const BG_IMG_MAP = Object.fromEntries(BG_OPTIONS.filter(b => b.img).map(b => [b.id, b.img]));

const WILD_BG = Object.fromEntries(
  Object.values(SPECIES)
    .filter(s => s.backdrop)
    .map(s => [s.id, BG_IMG_MAP[s.backdrop]])
);
```

Note: `BG_OPTIONS` must be defined before `WILD_BG` now. Move the `WILD_BG` declaration to after `BG_OPTIONS`. The final order of constants should be: imports, `BG_OPTIONS`, `BG_IMG_MAP`, `WILD_BG`.

- [ ] **Step 4: Verify the page still renders**

Run: `cd frontend && npm run dev`

Open a DinoDetail page in the browser and confirm the background still displays correctly for untamed dinos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DinoDetail.jsx
git commit -m "feat: add volcanic backdrop, derive WILD_BG from species data"
```

---

### Task 3: Implement unlock-based backdrop picker

**Files:**
- Modify: `frontend/src/components/DinoDetail.jsx:518-557` (backdrop picker section)

- [ ] **Step 1: Build unlock state from player data**

Inside the `DinoDetail` component function (after the `hasPaints` line, around line 147), add:

```js
// Backdrop unlock state: tamed = unlocked, discovered = locked, unknown = hidden
const allDinos = player?.dinos || [];
const tamedSpeciesSet = new Set(allDinos.filter(d => d.tamed).map(d => d.species));
const discoveredSpeciesSet = new Set(allDinos.map(d => d.species));

// Map backdrop IDs to their unlock state
const backdropState = {}; // backdrop_id -> 'unlocked' | 'locked'
for (const sp of Object.values(SPECIES)) {
  if (!sp.backdrop) continue;
  if (tamedSpeciesSet.has(sp.id)) {
    backdropState[sp.backdrop] = 'unlocked';
  } else if (discoveredSpeciesSet.has(sp.id)) {
    backdropState[sp.backdrop] = 'locked';
  }
  // else: hidden (not in map)
}

// Filter BG_OPTIONS to only show default + discovered backdrops
const visibleBgOptions = BG_OPTIONS.filter(bg => {
  if (bg.id === '') return true; // Default always visible
  return backdropState[bg.id] != null; // discovered or tamed
});
```

- [ ] **Step 2: Implement auto-default logic for first tame**

Below the backdrop state code, add logic so that when a dino has no background set but the player has tamed dinos, use the first tamed dino's backdrop as a visual fallback:

```js
// Auto-default: if no bg set and player has tamed dinos, use first tamed dino's backdrop
const autoDefaultBg = (() => {
  if (dino.background) return null; // explicit choice exists
  const firstTamed = allDinos.find(d => d.tamed && SPECIES[d.species]?.backdrop);
  return firstTamed ? SPECIES[firstTamed.species].backdrop : null;
})();
```

- [ ] **Step 3: Update the bgImg computation to use auto-default**

Replace the existing `bgImg` computation (lines 224-232) with:

```js
// Compute backdrop for full page background
const bgImg = (() => {
  if (!dino.tamed && WILD_BG[species]) return WILD_BG[species];
  if (dino.tamed) {
    const bgId = dino.background || autoDefaultBg || '';
    const bg = BG_OPTIONS.find(b => b.id === bgId);
    if (bg?.img) return bg.img;
  }
  return null;
})();
```

- [ ] **Step 4: Update the expanded backdrop picker to show lock state**

Replace the expanded backdrop picker section (lines 519-547, the `showBg` truthy branch) with:

```jsx
{dino.tamed && (showBg ? (
  <div style={styles.card}>
    <div style={styles.sectionTitle}>Backdrop</div>
    <div style={styles.bgRow}>
      {visibleBgOptions.map(bg => {
        const effectiveBg = dino.background || autoDefaultBg || '';
        const isSelected = effectiveBg === bg.id;
        const isLocked = bg.id !== '' && backdropState[bg.id] === 'locked';
        return (
          <button
            key={bg.id || '_default'}
            onClick={() => {
              if (isLocked) return;
              if (isSelected) { setShowBg(false); return; }
              doAction(() => api.customizeDino(store.playerId, species, { background: bg.id }));
              setShowBg(false);
            }}
            disabled={busy || isLocked}
            style={{
              ...styles.bgThumb,
              background: bg.img ? `url(${bg.img}) center/cover` : bg.color,
              borderColor: isSelected ? '#4ade80' : isLocked ? '#222' : '#333',
              opacity: isLocked ? 0.4 : 1,
              cursor: isLocked ? 'not-allowed' : 'pointer',
            }}
          >
            {isSelected && <span style={styles.bgCheck}>{'\u2713'}</span>}
            {isLocked && <span style={styles.bgLock}>{'\uD83D\uDD12'}</span>}
          </button>
        );
      })}
    </div>
    <button onClick={() => setShowBg(false)} style={styles.ghostBtn}>Cancel</button>
  </div>
) : (
  <div style={{ ...styles.card, cursor: 'pointer' }} onClick={() => setShowBg(true)}>
    <div style={styles.statRow}>
      <span style={styles.statLabel}>Backdrop</span>
      <span style={styles.statValue}>
        {BG_OPTIONS.find(b => b.id === (dino.background || autoDefaultBg || ''))?.label || 'Default'} <span style={{ fontSize: '11px', color: '#666' }}>{'\u25B8'}</span>
      </span>
    </div>
  </div>
))}
```

- [ ] **Step 5: Add `bgLock` style**

Add a new style entry for the lock icon in the `styles` object, after `bgCheck` (line 720):

```js
bgLock: {
  fontSize: '16px',
  filter: 'grayscale(1)',
},
```

- [ ] **Step 6: Verify in browser**

Run dev server and test:
1. View a tamed dino's detail page — backdrop picker should show only Default + discovered backdrops
2. Locked backdrops appear dimmed with a lock icon and can't be clicked
3. Unlocked backdrops are selectable as before
4. If no backdrop is set, the first tamed dino's backdrop auto-applies as background

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DinoDetail.jsx
git commit -m "feat: progression-based backdrop picker with lock states and auto-default"
```
