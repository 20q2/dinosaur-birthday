export const PAINTS = [
  { id: 'crimson', name: 'Crimson', hue: 0 },
  { id: 'orange', name: 'Orange', hue: 30 },
  { id: 'gold', name: 'Gold', hue: 50 },
  { id: 'forest', name: 'Forest', hue: 130 },
  { id: 'emerald', name: 'Emerald', hue: 155 },
  { id: 'cyan', name: 'Cyan', hue: 180 },
  { id: 'sky', name: 'Sky', hue: 200 },
  { id: 'navy', name: 'Navy', hue: 230 },
  { id: 'violet', name: 'Violet', hue: 270 },
  { id: 'rose', name: 'Rose', hue: 340 },
];

export const PAINT_MAP = Object.fromEntries(PAINTS.map(p => [p.id, p]));
