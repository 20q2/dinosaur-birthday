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
