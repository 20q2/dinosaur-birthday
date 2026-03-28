import random

SPECIES = {
    "trex": {"name": "T-Rex", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "spinosaurus": {"name": "Spinosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "sail", "belly"]},
    "dilophosaurus": {"name": "Dilophosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "frill", "crest"]},
    "pachycephalosaurus": {"name": "Pachycephalosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "dome", "spots"]},
    "parasaurolophus": {"name": "Parasaurolophus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "crest", "belly"]},
    "triceratops": {"name": "Triceratops", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "frill", "horns"]},
    "ankylosaurus": {"name": "Ankylosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "armor", "club"]},
}

HATS = [
    {"id": "party_hat", "name": "Party Hat", "rarity": "common"},
    {"id": "cowboy_hat", "name": "Cowboy Hat", "rarity": "common"},
    {"id": "top_hat", "name": "Top Hat", "rarity": "common"},
    {"id": "flower_crown", "name": "Flower Crown", "rarity": "common"},
    {"id": "sunglasses", "name": "Sunglasses", "rarity": "common"},
    {"id": "chef_hat", "name": "Chef Hat", "rarity": "common"},
    {"id": "viking_helmet", "name": "Viking Helmet", "rarity": "uncommon"},
    {"id": "wizard_hat", "name": "Wizard Hat", "rarity": "uncommon"},
    {"id": "pirate_hat", "name": "Pirate Hat", "rarity": "uncommon"},
    {"id": "crown", "name": "Crown", "rarity": "uncommon"},
    {"id": "halo", "name": "Halo", "rarity": "uncommon"},
    {"id": "headband", "name": "Headband", "rarity": "common"},
    {"id": "beanie", "name": "Beanie", "rarity": "common"},
    {"id": "bow", "name": "Bow", "rarity": "common"},
    {"id": "birthday_blessing", "name": "Birthday Girl's Blessing", "rarity": "legendary"},
    {"id": "kaiju_slayer", "name": "Kaiju Slayer", "rarity": "legendary"},
]

# Only common/uncommon hats drop randomly. Legendary are special rewards.
DROPPABLE_HATS = [h for h in HATS if h["rarity"] in ("common", "uncommon")]

NATURES = [
    "Bold", "Jolly", "Timid", "Brave", "Gentle", "Quirky",
    "Hasty", "Calm", "Sassy", "Naive", "Lonely", "Adamant",
    "Naughty", "Relaxed", "Modest",
]

LOBBY_SYMBOLS = [
    "meat", "mejoberry", "party_hat", "cowboy_hat", "top_hat",
    "sunglasses", "paint", "bone", "egg",
]

TRIVIA = [
    {"question": "What period did the T-Rex live in?", "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"], "answer": 1},
    {"question": "How many horns does a Triceratops have?", "options": ["One", "Two", "Three", "Four"], "answer": 2},
    {"question": "What does 'Pachycephalosaurus' mean?", "options": ["Swift lizard", "Thick-headed lizard", "Armored lizard", "Horned lizard"], "answer": 1},
    {"question": "Which dinosaur had a sail on its back?", "options": ["T-Rex", "Ankylosaurus", "Spinosaurus", "Triceratops"], "answer": 2},
    {"question": "What did Ankylosaurus use its tail club for?", "options": ["Swimming", "Catching prey", "Defense", "Digging"], "answer": 2},
    {"question": "Were dinosaurs warm-blooded or cold-blooded?", "options": ["Warm-blooded", "Cold-blooded", "Likely somewhere in between", "It varied by species"], "answer": 2},
    {"question": "What does 'dinosaur' literally mean?", "options": ["Big lizard", "Ancient reptile", "Terrible lizard", "Dragon beast"], "answer": 2},
    {"question": "Which period came first?", "options": ["Jurassic", "Cretaceous", "Triassic", "Carboniferous"], "answer": 2},
    {"question": "What was the largest flying reptile?", "options": ["Pteranodon", "Quetzalcoatlus", "Archaeopteryx", "Dimorphodon"], "answer": 1},
    {"question": "How long ago did dinosaurs go extinct?", "options": ["50 million years", "66 million years", "100 million years", "200 million years"], "answer": 1},
    {"question": "What asteroid impact killed the dinosaurs?", "options": ["Tunguska", "Chicxulub", "Meteor Crater", "Vredefort"], "answer": 1},
    {"question": "Dilophosaurus was named for its...", "options": ["Two legs", "Two crests", "Two teeth", "Two tails"], "answer": 1},
    {"question": "What is a group of dinosaurs called?", "options": ["A pack", "A herd", "A flock", "All of the above"], "answer": 3},
    {"question": "Which dinosaur is the state fossil of Montana?", "options": ["T-Rex", "Triceratops", "Maiasaura", "Stegosaurus"], "answer": 2},
    {"question": "What did herbivore dinosaurs eat?", "options": ["Fish", "Insects", "Plants", "Other dinosaurs"], "answer": 2},
    {"question": "Parasaurolophus used its crest for...", "options": ["Fighting", "Making sounds", "Smelling", "Balance"], "answer": 1},
    {"question": "How many claws did a T-Rex have on each hand?", "options": ["One", "Two", "Three", "Five"], "answer": 1},
    {"question": "What came first: grass or T-Rex?", "options": ["Grass", "T-Rex", "They appeared at the same time", "Neither existed"], "answer": 0},
    {"question": "Which is NOT a real dinosaur?", "options": ["Dracorex", "Giganotosaurus", "Dracolich", "Nigersaurus"], "answer": 2},
    {"question": "Where were the first dinosaur fossils discovered?", "options": ["North America", "China", "England", "Argentina"], "answer": 2},
    {"question": "What was the smallest known dinosaur?", "options": ["Compsognathus", "Microraptor", "Bee Hummingbird ancestor", "Lesothosaurus"], "answer": 1},
    {"question": "Ankylosaurus belonged to which family?", "options": ["Theropod", "Sauropod", "Thyreophoran", "Ornithopod"], "answer": 2},
    {"question": "What modern animals are descendants of dinosaurs?", "options": ["Lizards", "Crocodiles", "Birds", "Turtles"], "answer": 2},
    {"question": "How fast could a T-Rex run?", "options": ["5 mph", "15-20 mph", "40 mph", "60 mph"], "answer": 1},
    {"question": "What's special about Spinosaurus compared to other large theropods?", "options": ["It could fly", "It was semi-aquatic", "It had armor", "It was venomous"], "answer": 1},
    {"question": "In what era did dinosaurs live?", "options": ["Paleozoic", "Mesozoic", "Cenozoic", "Precambrian"], "answer": 1},
    {"question": "What does 'Triceratops' mean?", "options": ["Three-horned face", "Triple crown", "Three-pointed head", "Triangle lizard"], "answer": 0},
    {"question": "Which dinosaur had the longest neck?", "options": ["Brachiosaurus", "Diplodocus", "Supersaurus", "Argentinosaurus"], "answer": 2},
    {"question": "What color were dinosaurs?", "options": ["Gray", "Green", "We're not entirely sure", "Brown"], "answer": 2},
    {"question": "How did Dilophosaurus actually kill prey? (Not like Jurassic Park)", "options": ["Venom spit", "Frill attack", "Biting and clawing", "Tail whip"], "answer": 2},
]

EXPLORER_NOTES = {
    "note1": "Day 1. Arrived at what the locals call 'Alex's Birthday.' The creatures here are... friendly? One tried to eat my hat.",
    "note2": "Day 3. The Mejoberry supply is running low. The herbivores have started eyeing the veggie platter with alarming intensity.",
    "note3": "Day 5. Befriended a Pachycephalosaurus today. It headbutted me affectionately. I now have a concussion and a best friend.",
    "note4": "Day 7. The Rex has claimed the grill as its territory. Nobody dares approach. We've been eating salad for two days.",
    "note5": "Day 10. There are rumors of something massive approaching from the east. The ground shakes at night. The dinos are restless.",
}


def random_colors(regions, shiny=False):
    """Generate hue shifts for each color region.

    Normal dinos get natural earthy tones (greens, browns, olive, grey-greens).
    Shiny dinos get vivid, unusual colors (pinks, purples, cyan, gold, etc.).
    """
    if shiny:
        # Shiny: pick from vivid hue ranges that look unnatural
        vivid_ranges = [
            (280, 330),  # pinks / magentas
            (180, 220),  # cyans / teals
            (250, 280),  # purples / lavenders
            (40, 55),    # golds / ambers
            (0, 15),     # reds / crimsons
            (320, 360),  # hot pinks
        ]
        colors = {}
        used = []
        for region in regions:
            # Pick a range different from previously used ones
            available = [r for r in vivid_ranges if r not in used] or vivid_ranges
            chosen = random.choice(available)
            used.append(chosen)
            colors[region] = random.randint(chosen[0], chosen[1])
        return colors
    else:
        # Normal: earthy natural tones
        earthy_ranges = [
            (75, 150),   # greens (forest, lime, olive)
            (25, 50),    # browns / tans
            (50, 80),    # olive / yellow-green
            (150, 170),  # muted teal-green
        ]
        colors = {}
        for region in regions:
            chosen = random.choice(earthy_ranges)
            colors[region] = random.randint(chosen[0], chosen[1])
        return colors


def random_nature():
    return random.choice(NATURES)


def random_gender():
    return random.choice(["male", "female"])


def is_shiny():
    return random.random() < 0.05


def random_hat():
    return random.choice(DROPPABLE_HATS)


def random_trivia():
    return random.choice(TRIVIA)


def generate_lobby_code():
    return random.sample(LOBBY_SYMBOLS, 3)
