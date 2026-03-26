// Placeholder sprite helpers — will be replaced with real pixel art later

export function getSpeciesEmoji(species) {
  const map = {
    trex: '🦖',
    spinosaurus: '🦖',
    dilophosaurus: '🦎',
    pachycephalosaurus: '🦕',
    parasaurolophus: '🦕',
    triceratops: '🦏',
    ankylosaurus: '🐢',
  };
  return map[species] || '🦕';
}

export function getSpeciesInitial(species) {
  const map = {
    trex: 'T',
    spinosaurus: 'S',
    dilophosaurus: 'D',
    pachycephalosaurus: 'P',
    parasaurolophus: 'Pa',
    triceratops: 'Tr',
    ankylosaurus: 'A',
  };
  return map[species] || '?';
}
