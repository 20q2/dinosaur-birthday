const KEY = 'dino_party_last_seen_levels';

export function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function seed(dinos) {
  const map = {};
  for (const d of dinos) {
    map[d.species] = d.level || 1;
  }
  write(map);
}

export function markSeen(species, level) {
  const existing = read() || {};
  existing[species] = level;
  write(existing);
}

export function getPendingLevelUps(dinos) {
  const stored = read();
  if (stored === null) {
    seed(dinos);
    return [];
  }
  const pending = [];
  let storedChanged = false;
  for (const d of dinos) {
    const newLevel = d.level || 1;
    if (!(d.species in stored)) {
      // New species first-seen — baseline silently, no celebration
      stored[d.species] = newLevel;
      storedChanged = true;
      continue;
    }
    const oldLevel = stored[d.species];
    if (newLevel > oldLevel) {
      pending.push({ species: d.species, oldLevel, newLevel });
    }
  }
  if (storedChanged) {
    write(stored);
  }
  return pending;
}
