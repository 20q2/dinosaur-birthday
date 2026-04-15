import random

SPECIES = {
    "trex": {"name": "T-Rex", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "spinosaurus": {"name": "Spinosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "dilophosaurus": {"name": "Dilophosaurus", "diet": "carnivore", "food": "meat", "regions": ["body", "belly", "stripes"]},
    "pachycephalosaurus": {"name": "Pachycephalosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "belly", "stripes"]},
    "parasaurolophus": {"name": "Parasaurolophus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "belly", "stripes"]},
    "triceratops": {"name": "Triceratops", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "belly", "stripes"]},
    "ankylosaurus": {"name": "Ankylosaurus", "diet": "herbivore", "food": "mejoberries", "regions": ["body", "belly", "stripes"]},
    "godzilla": {"name": "Godzilla", "diet": "carnivore", "food": "meat", "regions": ["body", "spines", "spines_dark"]},
}

# The 7 base species — godzilla is a bonus and excluded from completionist checks
BASE_SPECIES_COUNT = 7

HATS = [
    {"id": "party_hat", "name": "Party Hat", "rarity": "common"},
    {"id": "cowboy_hat", "name": "Cowboy Hat", "rarity": "common"},
    {"id": "top_hat", "name": "Top Hat", "rarity": "common"},
    {"id": "flower_crown", "name": "Flower Crown", "rarity": "common"},
    {"id": "chef_hat", "name": "Chef Hat", "rarity": "common"},
    {"id": "viking_helmet", "name": "Viking Helmet", "rarity": "uncommon"},
    {"id": "wizard_hat", "name": "Wizard Hat", "rarity": "uncommon"},
    {"id": "pirate_hat", "name": "Pirate Hat", "rarity": "uncommon"},
    {"id": "crown", "name": "Crown", "rarity": "uncommon"},
    {"id": "halo", "name": "Halo", "rarity": "uncommon"},
    {"id": "headband", "name": "Headband", "rarity": "common"},
    {"id": "beanie", "name": "Beanie", "rarity": "common"},
    {"id": "bow", "name": "Bow", "rarity": "common"},
    {"id": "birthday_blessing", "name": "Birthday Balloons", "rarity": "legendary"},
    {"id": "kaiju_slayer", "name": "Kaiju Slayer", "rarity": "legendary"},
]

# Hats excluded from random drops (legendary = special rewards, chef_hat = Grill Master event).
_EXCLUDED_FROM_DROPS = {"birthday_blessing", "kaiju_slayer", "chef_hat"}
DROPPABLE_HATS = [h for h in HATS if h["id"] not in _EXCLUDED_FROM_DROPS]

PAINTS = [
    {"id": "crimson", "name": "Crimson", "hue": 0},
    {"id": "orange", "name": "Orange", "hue": 30},
    {"id": "gold", "name": "Gold", "hue": 50},
    {"id": "forest", "name": "Forest", "hue": 130},
    {"id": "emerald", "name": "Emerald", "hue": 155},
    {"id": "cyan", "name": "Cyan", "hue": 180},
    {"id": "sky", "name": "Sky", "hue": 200},
    {"id": "navy", "name": "Navy", "hue": 230},
    {"id": "violet", "name": "Violet", "hue": 270},
    {"id": "rose", "name": "Rose", "hue": 340},
]

PAINT_MAP = {p["id"]: p for p in PAINTS}

NATURES = [
    "Bold", "Jolly", "Timid", "Brave", "Gentle", "Quirky",
    "Hasty", "Calm", "Sassy", "Naive", "Lonely", "Adamant",
    "Naughty", "Relaxed", "Modest",
]

LOBBY_SYMBOLS = ["meat", "berry", "paint", "cooked_meat"]

TRIVIA = [
    {"question": "What period did the T-Rex live in?", "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"], "answer": 1, "explanation": "T-Rex lived during the late Cretaceous period, about 68-66 million years ago."},
    {"question": "How many horns does a Triceratops have?", "options": ["One", "Two", "Three", "Four"], "answer": 2, "explanation": "Triceratops had three horns: one short horn on its nose and two long horns above its eyes."},
    {"question": "What does 'Pachycephalosaurus' mean?", "options": ["Swift lizard", "Thick-headed lizard", "Armored lizard", "Horned lizard"], "answer": 1, "explanation": "'Pachycephalosaurus' is Greek for 'thick-headed lizard' — its skull dome was up to 25 cm thick."},
    {"question": "Which dinosaur had a sail on its back?", "options": ["T-Rex", "Ankylosaurus", "Spinosaurus", "Triceratops"], "answer": 2, "explanation": "Spinosaurus had a tall sail formed by elongated spines on its back, possibly used for display or temperature regulation."},
    {"question": "What did Ankylosaurus use its tail club for?", "options": ["Swimming", "Catching prey", "Defense", "Digging"], "answer": 2, "explanation": "Ankylosaurus's bony tail club was a defensive weapon capable of breaking bones of attacking predators."},
    {"question": "Were dinosaurs warm-blooded or cold-blooded?", "options": ["Warm-blooded", "Cold-blooded", "Likely somewhere in between", "It varied by species"], "answer": 2, "explanation": "Evidence suggests dinosaurs were mesothermic — between warm and cold-blooded, with faster metabolisms than modern reptiles."},
    {"question": "What does 'dinosaur' literally mean?", "options": ["Big lizard", "Ancient reptile", "Terrible lizard", "Dragon beast"], "answer": 2, "explanation": "'Dinosaur' comes from the Greek 'deinos' (terrible) and 'sauros' (lizard), coined by Richard Owen in 1842."},
    {"question": "Which period came first?", "options": ["Jurassic", "Cretaceous", "Triassic", "Carboniferous"], "answer": 2, "explanation": "The Triassic (~252-201 mya) came before the Jurassic and Cretaceous. It's when the first dinosaurs appeared."},
    {"question": "What was the largest flying reptile?", "options": ["Pteranodon", "Quetzalcoatlus", "Archaeopteryx", "Dimorphodon"], "answer": 1, "explanation": "Quetzalcoatlus had a wingspan of up to 11 meters — roughly the size of a small plane."},
    {"question": "How long ago did dinosaurs go extinct?", "options": ["50 million years", "66 million years", "100 million years", "200 million years"], "answer": 1, "explanation": "The non-avian dinosaurs went extinct about 66 million years ago at the end of the Cretaceous period."},
    {"question": "What asteroid impact killed the dinosaurs?", "options": ["Tunguska", "Chicxulub", "Meteor Crater", "Vredefort"], "answer": 1, "explanation": "The Chicxulub impactor struck what is now Mexico's Yucatan Peninsula, triggering the K-Pg extinction event."},
    {"question": "Dilophosaurus was named for its...", "options": ["Two legs", "Two crests", "Two teeth", "Two tails"], "answer": 1, "explanation": "'Dilophosaurus' means 'two-crested lizard' — it had a pair of thin bony crests on top of its head."},
    {"question": "What is a group of dinosaurs called?", "options": ["A pack", "A herd", "A flock", "All of the above"], "answer": 3, "explanation": "Different dinosaur species likely formed packs, herds, and flocks depending on their behavior and diet."},
    {"question": "Which dinosaur is the state fossil of Montana?", "options": ["T-Rex", "Triceratops", "Maiasaura", "Stegosaurus"], "answer": 2, "explanation": "Maiasaura ('good mother lizard') was named Montana's state fossil in 1985 after nests were found there."},
    {"question": "What did herbivore dinosaurs eat?", "options": ["Fish", "Insects", "Plants", "Other dinosaurs"], "answer": 2, "explanation": "Herbivorous dinosaurs ate plants — ferns, conifers, cycads, and (later) flowering plants."},
    {"question": "Parasaurolophus used its crest for...", "options": ["Fighting", "Making sounds", "Smelling", "Balance"], "answer": 1, "explanation": "The hollow crest of Parasaurolophus worked like a resonating chamber, producing low, trumpet-like calls."},
    {"question": "How many claws did a T-Rex have on each hand?", "options": ["One", "Two", "Three", "Five"], "answer": 1, "explanation": "T-Rex had just two clawed fingers on each of its famously tiny arms."},
    {"question": "What came first: grass or T-Rex?", "options": ["Grass", "T-Rex", "They appeared at the same time", "Neither existed"], "answer": 0, "explanation": "Early grasses appeared in the Cretaceous before T-Rex lived, so T-Rex may have walked through grass."},
    {"question": "Which is NOT a real dinosaur?", "options": ["Dracorex", "Giganotosaurus", "Dracolich", "Nigersaurus"], "answer": 2, "explanation": "Dracolich is a Dungeons & Dragons undead dragon — not a real dinosaur. The other three are all genuine species."},
    {"question": "Where were the first dinosaur fossils discovered?", "options": ["North America", "China", "England", "Argentina"], "answer": 2, "explanation": "The first scientifically described dinosaur fossils (Megalosaurus, Iguanodon) were found in England in the 1820s."},
    {"question": "What was the smallest known dinosaur?", "options": ["Compsognathus", "Microraptor", "Bee Hummingbird ancestor", "Lesothosaurus"], "answer": 1, "explanation": "Microraptor was about the size of a crow — one of the smallest known non-avian dinosaurs."},
    {"question": "Ankylosaurus belonged to which family?", "options": ["Theropod", "Sauropod", "Thyreophoran", "Ornithopod"], "answer": 2, "explanation": "Ankylosaurus is a thyreophoran ('shield-bearer') — the armored dinosaur group that also includes Stegosaurus."},
    {"question": "What modern animals are descendants of dinosaurs?", "options": ["Lizards", "Crocodiles", "Birds", "Turtles"], "answer": 2, "explanation": "Birds are living theropod dinosaurs — they evolved from small feathered dinosaurs in the Jurassic."},
    {"question": "How fast could a T-Rex run?", "options": ["5 mph", "15-20 mph", "40 mph", "60 mph"], "answer": 1, "explanation": "Recent biomechanical studies suggest T-Rex topped out at a brisk 15-20 mph — faster than a jog, but no sprinter."},
    {"question": "What's special about Spinosaurus compared to other large theropods?", "options": ["It could fly", "It was semi-aquatic", "It had armor", "It was venomous"], "answer": 1, "explanation": "Spinosaurus is the only known semi-aquatic theropod — it had a paddle-like tail and likely hunted fish."},
    {"question": "In what era did dinosaurs live?", "options": ["Paleozoic", "Mesozoic", "Cenozoic", "Precambrian"], "answer": 1, "explanation": "Dinosaurs ruled the Mesozoic era (~252-66 mya), which spans the Triassic, Jurassic, and Cretaceous periods."},
    {"question": "What does 'Triceratops' mean?", "options": ["Three-horned face", "Triple crown", "Three-pointed head", "Triangle lizard"], "answer": 0, "explanation": "'Triceratops' is Greek for 'three-horned face' — a direct nod to its distinctive horned skull."},
    {"question": "Which dinosaur had the longest neck?", "options": ["Brachiosaurus", "Diplodocus", "Supersaurus", "Argentinosaurus"], "answer": 2, "explanation": "Supersaurus had one of the longest necks of any known animal — estimated at up to 15 meters."},
    {"question": "What color were dinosaurs?", "options": ["Gray", "Green", "We're not entirely sure", "Brown"], "answer": 2, "explanation": "Color is rarely preserved, though some feathered dinosaurs' colors have been inferred from fossilized melanosomes."},
    {"question": "How did Dilophosaurus actually kill prey? (Not like Jurassic Park)", "options": ["Venom spit", "Frill attack", "Biting and clawing", "Tail whip"], "answer": 2, "explanation": "No evidence supports the Jurassic Park venom or frill — Dilophosaurus was a normal predator using teeth and claws."},
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
        # Natural colors per region role:
        # Body: greens, browns, grey-greens — typical lizard/reptile body
        primary_ranges = [
            (80, 135),   # greens (forest, olive, lime)
            (80, 135),   # greens (double weight — most common)
            (30, 55),    # browns / warm earth
            (140, 160),  # muted teal-green
        ]
        # Belly: yellowish to brownish underbelly tones
        belly_ranges = [
            (30, 55),    # tan / sandy brown
            (40, 60),    # golden / warm yellow
            (25, 45),    # warm brown / khaki
        ]
        # Stripes: varied but natural
        accent_ranges = [
            (75, 140),   # greens
            (30, 60),    # browns / olive
            (140, 160),  # teal-green
        ]
        pool = [primary_ranges, belly_ranges, accent_ranges]
        colors = {}
        for i, region in enumerate(regions):
            ranges = pool[min(i, len(pool) - 1)]
            chosen = random.choice(ranges)
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


def random_paint():
    return random.choice(PAINTS)


def random_trivia():
    return random.choice(TRIVIA)


def generate_lobby_code():
    return random.sample(LOBBY_SYMBOLS, 3)
