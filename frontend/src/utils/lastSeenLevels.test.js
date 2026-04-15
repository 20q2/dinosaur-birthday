import { describe, it, expect, beforeEach } from 'vitest';

// Minimal localStorage polyfill for Vitest's default node environment.
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    _data: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; },
  };
}

import { read, seed, markSeen, getPendingLevelUps } from './lastSeenLevels.js';

const KEY = 'dino_party_last_seen_levels';

describe('lastSeenLevels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds with current levels on first-ever load and returns no pending', () => {
    const dinos = [
      { species: 'trex', level: 3 },
      { species: 'triceratops', level: 2 },
    ];
    const pending = getPendingLevelUps(dinos);
    expect(pending).toEqual([]);
    expect(read()).toEqual({ trex: 3, triceratops: 2 });
  });

  it('returns pending level-ups when current > last seen', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    const dinos = [{ species: 'trex', level: 4 }];
    const pending = getPendingLevelUps(dinos);
    expect(pending).toEqual([{ species: 'trex', oldLevel: 2, newLevel: 4 }]);
  });

  it('returns empty when all current levels equal stored', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 3 }));
    const dinos = [{ species: 'trex', level: 3 }];
    expect(getPendingLevelUps(dinos)).toEqual([]);
  });

  it('baselines new species silently without celebrating', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    const dinos = [
      { species: 'trex', level: 2 },
      { species: 'spinosaurus', level: 1 },
    ];
    expect(getPendingLevelUps(dinos)).toEqual([]);
    expect(read()).toEqual({ trex: 2, spinosaurus: 1 });
  });

  it('celebrates level-ups on a newly-baselined species the next time it levels', () => {
    // First visit: sees trex at 2, spinosaurus at 1 (new — baselined silently)
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    getPendingLevelUps([{ species: 'trex', level: 2 }, { species: 'spinosaurus', level: 1 }]);
    // Second visit: spinosaurus has leveled up
    const pending = getPendingLevelUps([
      { species: 'trex', level: 2 },
      { species: 'spinosaurus', level: 2 },
    ]);
    expect(pending).toEqual([{ species: 'spinosaurus', oldLevel: 1, newLevel: 2 }]);
  });

  it('markSeen updates stored value for a species', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 2 }));
    markSeen('trex', 4);
    expect(read()).toEqual({ trex: 4 });
  });

  it('markSeen creates storage if none exists', () => {
    markSeen('trex', 3);
    expect(read()).toEqual({ trex: 3 });
  });

  it('seed writes current levels for all provided dinos', () => {
    seed([{ species: 'trex', level: 3 }, { species: 'ankylosaurus', level: 1 }]);
    expect(read()).toEqual({ trex: 3, ankylosaurus: 1 });
  });

  it('read returns null when nothing stored', () => {
    expect(read()).toBeNull();
  });

  it('handles dinos with missing level field as level 1', () => {
    const dinos = [{ species: 'trex' }];
    getPendingLevelUps(dinos);
    expect(read()).toEqual({ trex: 1 });
  });

  it('detects multi-level jumps correctly', () => {
    localStorage.setItem(KEY, JSON.stringify({ trex: 1 }));
    const pending = getPendingLevelUps([{ species: 'trex', level: 4 }]);
    expect(pending).toEqual([{ species: 'trex', oldLevel: 1, newLevel: 4 }]);
  });
});
