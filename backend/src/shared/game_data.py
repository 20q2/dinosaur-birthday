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

# Hats excluded from random drops (legendary = special rewards only).
_EXCLUDED_FROM_DROPS = {"birthday_blessing", "kaiju_slayer"}
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
    {"question": "Which predator was larger than T-Rex?", "options": ["Allosaurus", "Carnotaurus", "Giganotosaurus", "Baryonyx"], "answer": 2, "explanation": "Giganotosaurus, found in South America, was slightly longer than T-Rex and one of the largest land predators ever."},
    {"question": "Therizinosaurus was famous for having enormous...", "options": ["Teeth", "Claws", "Horns", "Eyes"], "answer": 1, "explanation": "Therizinosaurus had claws up to a meter long — the longest of any known animal. Likely used for stripping leaves, not fighting."},
    {"question": "What does 'Carnotaurus' mean?", "options": ["Horned hunter", "Meat-eating bull", "Swift killer", "Red lizard"], "answer": 1, "explanation": "'Carnotaurus' means 'meat-eating bull' — named for the two prominent horns above its eyes, unusual for a theropod."},
    {"question": "How big was a real Velociraptor?", "options": ["Size of a horse", "Size of a human", "Size of a turkey", "Size of a lion"], "answer": 2, "explanation": "Real Velociraptors were turkey-sized and feathered. The 'raptors' in Jurassic Park were closer to Deinonychus or Utahraptor."},
    {"question": "What's the spiked tail of a Stegosaurus called?", "options": ["Clubber", "Thagomizer", "Spiker", "Tail-mace"], "answer": 1, "explanation": "The spikes are called a 'thagomizer' — a name coined by cartoonist Gary Larson in a Far Side comic, later adopted by paleontologists."},
    {"question": "Baryonyx was unusual among theropods because it mainly ate...", "options": ["Plants", "Fish", "Insects", "Eggs"], "answer": 1, "explanation": "Baryonyx had crocodile-like jaws and fish scales were found in its stomach — one of the first theropods confirmed to eat fish."},
    {"question": "Is a Mosasaurus actually a dinosaur?", "options": ["Yes", "No, it's a marine reptile", "No, it's a fish", "No, it's a whale ancestor"], "answer": 1, "explanation": "Mosasaurus was a giant marine reptile related to modern monitor lizards — not a dinosaur, though it lived alongside them."},
    {"question": "Gallimimus is famous for being...", "options": ["Very armored", "Very fast", "Very small", "Very colorful"], "answer": 1, "explanation": "Gallimimus ('chicken mimic') was an ostrich-like dinosaur — one of the fastest, estimated to run 30-40 mph."},
    {"question": "Oviraptor was named 'egg thief,' but what was it actually doing?", "options": ["Stealing eggs", "Brooding its own eggs", "Eating plants", "Hunting lizards"], "answer": 1, "explanation": "The first Oviraptor was found on a nest assumed to belong to another species. Later discoveries showed it was sitting on its OWN eggs."},
    {"question": "Allosaurus was the top predator of which famous fossil bed?", "options": ["Hell Creek Formation", "Morrison Formation", "Gobi Desert", "Dinosaur Cove"], "answer": 1, "explanation": "Allosaurus dominated the Jurassic Morrison Formation in western North America, hunting alongside Stegosaurus and Brachiosaurus."},
    {"question": "What was one of the largest dinosaurs ever discovered?", "options": ["Brachiosaurus", "Argentinosaurus", "Diplodocus", "Apatosaurus"], "answer": 1, "explanation": "Argentinosaurus, a titanosaur from South America, could reach over 30 meters long and weigh 70+ tons — among the largest land animals ever."},
    {"question": "Iguanodon had a distinctive spike on its...", "options": ["Tail", "Thumb", "Nose", "Back"], "answer": 1, "explanation": "Iguanodon had a conical spike where a thumb would be — likely used for defense or breaking open tough plants."},
    {"question": "Is Dimetrodon (the sail-backed creature) a dinosaur?", "options": ["Yes", "No, it lived BEFORE dinosaurs", "No, it lived AFTER dinosaurs", "Only the babies were"], "answer": 1, "explanation": "Dimetrodon was a synapsid (closer to mammals than reptiles) that lived ~295 mya — about 40 million years before the first dinosaurs."},
    {"question": "Sarcosuchus, the 'SuperCroc,' was about how long?", "options": ["6 feet", "15 feet", "40 feet", "100 feet"], "answer": 2, "explanation": "Sarcosuchus was a Cretaceous crocodile relative reaching ~40 feet — nearly twice as long as the largest modern saltwater croc."},
    {"question": "Archaeopteryx is famous for being a transitional fossil between...", "options": ["Fish and reptiles", "Dinosaurs and birds", "Reptiles and mammals", "Amphibians and reptiles"], "answer": 1, "explanation": "Archaeopteryx had feathers and wings like a bird but teeth and a bony tail like a dinosaur — prime evidence that birds evolved from theropods."},
    {"question": "Which dinosaur most likely inspired Jurassic Park's 'Velociraptors'?", "options": ["Utahraptor", "Deinonychus", "Dromaeosaurus", "Troodon"], "answer": 1, "explanation": "The novel's raptors were based on Deinonychus — paleontologist Gregory Paul had reclassified it under Velociraptor, a name the author preferred."},
    {"question": "Brachiosaurus was unusual among sauropods because its...", "options": ["Tail was longer than its neck", "Front legs were longer than its back legs", "It could stand on two legs", "It had no teeth"], "answer": 1, "explanation": "Unlike most sauropods, Brachiosaurus had longer front legs, giving it a giraffe-like posture and helping it reach high branches."},
    {"question": "Kentrosaurus is a close relative of which armored dinosaur?", "options": ["Ankylosaurus", "Triceratops", "Stegosaurus", "Euoplocephalus"], "answer": 2, "explanation": "Kentrosaurus ('spiked lizard') was a smaller African cousin of Stegosaurus, with plates on its back and long spikes down its tail and hips."},
    {"question": "Did the saber-toothed Smilodon live alongside dinosaurs?", "options": ["Yes", "No, it came millions of years later", "No, it came before dinosaurs", "Only the non-avian dinosaurs"], "answer": 1, "explanation": "Smilodon lived during the Ice Age (~2.5 mya to 10,000 years ago) — tens of millions of years AFTER the non-avian dinosaurs went extinct."},
    {"question": "Were pterosaurs (like Pteranodon) actually dinosaurs?", "options": ["Yes", "No, they were flying reptiles", "No, they were early birds", "Only some species"], "answer": 1, "explanation": "Pterosaurs were flying reptiles that lived alongside dinosaurs but belonged to a separate group — they're cousins, not dinosaurs themselves."},
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
