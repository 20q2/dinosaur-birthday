export const SPECIES = {
  trex: {
    id: 'trex', name: 'T-Rex', diet: 'carnivore', food: 'meat',
    regions: ['body', 'belly', 'stripes'],
    flavor: "The apex predator of the party. Will fight you for the last chicken wing.",
  },
  spinosaurus: {
    id: 'spinosaurus', name: 'Spinosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'sail', 'belly'],
    flavor: "Semi-aquatic and fully dramatic. Will splash in any puddle it finds.",
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', diet: 'carnivore', food: 'meat',
    regions: ['body', 'frill', 'crest'],
    flavor: "Will absolutely spit on you if you don't bring it meat. Just like Alex's cat.",
  },
  pachycephalosaurus: {
    id: 'pachycephalosaurus', name: 'Pachycephalosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'dome', 'spots'],
    flavor: "Known for headbutting the snack table. Approach from behind.",
  },
  parasaurolophus: {
    id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'crest', 'belly'],
    flavor: "Plays its crest like a trombone at 2am. Neighbors love it.",
  },
  triceratops: {
    id: 'triceratops', name: 'Triceratops', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'frill', 'horns'],
    flavor: "Three horns are better than one. Will charge the piñata on sight.",
  },
  ankylosaurus: {
    id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'herbivore', food: 'mejoberries',
    regions: ['body', 'armor', 'club'],
    flavor: "Built like a tank. Immune to peer pressure and spicy food.",
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
