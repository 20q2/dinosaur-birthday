from src.shared.game_data import (
    SPECIES, HATS, DROPPABLE_HATS, NATURES, TRIVIA, EXPLORER_NOTES,
    LOBBY_SYMBOLS, random_colors, random_nature, random_gender,
    is_shiny, random_hat, random_trivia, generate_lobby_code,
)


def test_all_species_have_required_fields():
    for key, species in SPECIES.items():
        assert "name" in species
        assert "diet" in species
        assert species["diet"] in ("carnivore", "herbivore")
        assert "food" in species
        assert "regions" in species
        assert len(species["regions"]) >= 2


def test_species_count():
    assert len(SPECIES) == 7


def test_droppable_hats_excludes_legendary():
    for hat in DROPPABLE_HATS:
        assert hat["rarity"] != "legendary"


def test_random_colors_covers_all_regions():
    regions = ["body", "crest", "belly"]
    colors = random_colors(regions)
    assert set(colors.keys()) == set(regions)
    for hue in colors.values():
        assert 0 <= hue <= 359


def test_random_nature_is_valid():
    for _ in range(20):
        assert random_nature() in NATURES


def test_random_gender_is_valid():
    for _ in range(20):
        assert random_gender() in ("male", "female")


def test_lobby_code_has_three_unique_symbols():
    code = generate_lobby_code()
    assert len(code) == 3
    assert len(set(code)) == 3
    for symbol in code:
        assert symbol in LOBBY_SYMBOLS


def test_trivia_has_enough_questions():
    assert len(TRIVIA) >= 25


def test_trivia_format():
    for q in TRIVIA:
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) == 4
        assert "answer" in q
        assert 0 <= q["answer"] <= 3


def test_explorer_notes_count():
    assert len(EXPLORER_NOTES) == 5
