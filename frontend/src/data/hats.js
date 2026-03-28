export const HATS = [
  { id: 'party_hat', name: 'Party Hat', rarity: 'common' },
  { id: 'cowboy_hat', name: 'Cowboy Hat', rarity: 'common' },
  { id: 'top_hat', name: 'Top Hat', rarity: 'common' },
  { id: 'flower_crown', name: 'Flower Crown', rarity: 'common' },
  { id: 'chef_hat', name: 'Chef Hat', rarity: 'common' },
  { id: 'viking_helmet', name: 'Viking Helmet', rarity: 'uncommon' },
  { id: 'wizard_hat', name: 'Wizard Hat', rarity: 'uncommon' },
  { id: 'pirate_hat', name: 'Pirate Hat', rarity: 'uncommon' },
  { id: 'crown', name: 'Crown', rarity: 'uncommon' },
  { id: 'halo', name: 'Halo', rarity: 'uncommon' },
  { id: 'headband', name: 'Headband', rarity: 'common' },
  { id: 'beanie', name: 'Beanie', rarity: 'common' },
  { id: 'bow', name: 'Bow', rarity: 'common' },
  { id: 'birthday_blessing', name: 'Birthday Balloons', rarity: 'legendary' },
  { id: 'kaiju_slayer', name: 'Kaiju Slayer', rarity: 'legendary' },
];

export const STARTER_HATS = HATS.filter(h => h.rarity === 'common').slice(0, 4);
export const HAT_MAP = Object.fromEntries(HATS.map(h => [h.id, h]));
