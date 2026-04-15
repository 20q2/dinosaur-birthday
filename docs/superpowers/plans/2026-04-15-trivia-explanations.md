# Trivia Answer Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a one-sentence explanation of the correct answer on the trivia results screen after a player answers, for both correct and incorrect answers.

**Architecture:** Add an `explanation` field to each entry in the `TRIVIA` list in `game_data.py`. The `answer_lobby_handler` already reads the trivia dict from the lobby item in DynamoDB and returns selected fields to the client — we extend the response to include `explanation`. The frontend's `PlayTrivia` results view renders the explanation inside the existing result banner.

**Tech Stack:** Python 3.12 (backend, pytest), Preact + Vite (frontend, inline styles).

**Spec:** [docs/superpowers/specs/2026-04-15-trivia-explanations-design.md](../specs/2026-04-15-trivia-explanations-design.md)

---

## Task 1: Add explanations to trivia data + schema test

Add an `"explanation"` string to each of the 30 entries in `TRIVIA`, then extend the schema test to enforce the field. This is pure data + test — no handler code changes yet.

**Files:**
- Modify: `backend/src/shared/game_data.py` (the `TRIVIA` list, lines 63-94)
- Modify: `backend/tests/test_game_data.py` (the `test_trivia_format` test, lines 57-63)

- [ ] **Step 1: Extend the schema test to require a non-empty explanation**

Edit `backend/tests/test_game_data.py`, replacing the `test_trivia_format` function with:

```python
def test_trivia_format():
    for q in TRIVIA:
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) == 4
        assert "answer" in q
        assert 0 <= q["answer"] <= 3
        assert "explanation" in q
        assert isinstance(q["explanation"], str)
        assert len(q["explanation"]) > 0
```

- [ ] **Step 2: Run the test to verify it fails**

Run from the `backend/` directory:
```bash
pytest tests/test_game_data.py::test_trivia_format -v
```
Expected: FAIL. Error: `AssertionError` on `"explanation" in q` — none of the 30 entries has the field yet.

- [ ] **Step 3: Add explanations to all 30 trivia entries**

Replace the entire `TRIVIA = [...]` list in `backend/src/shared/game_data.py` (lines 63-94) with:

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run from the `backend/` directory:
```bash
pytest tests/test_game_data.py::test_trivia_format -v
```
Expected: PASS.

- [ ] **Step 5: Run the full game_data test file to confirm nothing else broke**

Run from the `backend/` directory:
```bash
pytest tests/test_game_data.py -v
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/game_data.py backend/tests/test_game_data.py
git commit -m "feat(trivia): add explanation field to trivia questions"
```

---

## Task 2: Return explanation in answer response

Extend the `answer_lobby_handler` return payload to include `explanation`, and add a test that verifies it comes through correctly for both correct and incorrect answers.

**Files:**
- Modify: `backend/src/handlers/lobby.py` (the `return success({...})` at lines 281-289)
- Modify: `backend/tests/test_lobby.py` (the `_make_lobby` helper at lines 69-87, plus add a new test after `test_answer_incorrect_awards_30xp_no_hat`)

- [ ] **Step 1: Write a failing test that asserts explanation is returned**

Add this test to `backend/tests/test_lobby.py` immediately after `test_answer_incorrect_awards_30xp_no_hat` (the function that ends at line 299). Place it before the `# ── Test 5: Cooldown enforcement ──` section:

```python
# ── Test 4b: Answer response includes explanation ────────────────────────────

def test_answer_response_includes_explanation_when_correct():
    _make_profile("hostE1", "Expl1")
    _make_profile("guestE1", "Expl2")
    _make_partner_dino("hostE1", "trex", xp=0, level=1)
    _make_partner_dino("guestE1", "spinosaurus", xp=0, level=1)

    _make_lobby("paint_berry_meat", "hostE1", status="active", guest_id="guestE1")

    with patch("src.handlers.lobby.broadcast"):
        resp = answer_lobby_handler(
            _answer_event("paint_berry_meat", {"player_id": "hostE1", "answer": 1}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["correct"] is True
    assert "explanation" in body
    assert body["explanation"] == "T-Rex lived during the late Cretaceous period, about 68-66 million years ago."


def test_answer_response_includes_explanation_when_incorrect():
    _make_profile("hostE2", "Expl3")
    _make_profile("guestE2", "Expl4")
    _make_partner_dino("hostE2", "triceratops", xp=0, level=1)
    _make_partner_dino("guestE2", "ankylosaurus", xp=0, level=1)

    _make_lobby("cooked_meat_paint_berry", "hostE2", status="active", guest_id="guestE2")

    with patch("src.handlers.lobby.broadcast"):
        resp = answer_lobby_handler(
            _answer_event("cooked_meat_paint_berry", {"player_id": "hostE2", "answer": 0}),
            None,
        )

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["correct"] is False
    assert "explanation" in body
    assert body["explanation"] == "T-Rex lived during the late Cretaceous period, about 68-66 million years ago."
```

Note: the `_make_lobby` helper uses the T-Rex/Cretaceous question, so the expected explanation matches that entry in Task 1.

- [ ] **Step 2: Update `_make_lobby` helper to include explanation in the stored trivia dict**

This makes the test fixtures realistic (they now mirror what `create_lobby_handler` actually writes). Edit `backend/tests/test_lobby.py`, replacing the `trivia_question` dict inside `_make_lobby` (lines 77-81):

```python
        "trivia_question": {
            "question": "What period did the T-Rex live in?",
            "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"],
            "answer": 1,
            "explanation": "T-Rex lived during the late Cretaceous period, about 68-66 million years ago.",
        },
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run from the `backend/` directory:
```bash
pytest tests/test_lobby.py::test_answer_response_includes_explanation_when_correct tests/test_lobby.py::test_answer_response_includes_explanation_when_incorrect -v
```
Expected: both FAIL with `KeyError: 'explanation'` or `AssertionError: assert 'explanation' in body`.

- [ ] **Step 4: Update `answer_lobby_handler` to return the explanation**

Edit `backend/src/handlers/lobby.py`. Replace the `return success({...})` block at the end of `answer_lobby_handler` (lines 281-289) with:

```python
    return success({
        "correct": is_correct,
        "correct_index": correct_index,
        "explanation": trivia.get("explanation", ""),
        "xp_awarded": xp_amount,
        "reward": item_reward if item_reward else None,
        "my_dino": my_dino,
        "partner_id": partner_id,
        "partner_name": partner_name,
    })
```

The `.get("explanation", "")` gracefully handles any lobby created before this change (TTL is 2 minutes so the in-flight window at deploy time is trivially small).

- [ ] **Step 5: Run the new tests to verify they pass**

Run from the `backend/` directory:
```bash
pytest tests/test_lobby.py::test_answer_response_includes_explanation_when_correct tests/test_lobby.py::test_answer_response_includes_explanation_when_incorrect -v
```
Expected: both PASS.

- [ ] **Step 6: Run the full lobby test file to confirm nothing else broke**

Run from the `backend/` directory:
```bash
pytest tests/test_lobby.py -v
```
Expected: all tests PASS.

- [ ] **Step 7: Run the full backend test suite**

Run from the `backend/` directory:
```bash
pytest
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/handlers/lobby.py backend/tests/test_lobby.py
git commit -m "feat(trivia): return answer explanation in lobby answer response"
```

---

## Task 3: Display explanation on trivia results screen

Render `result.explanation` inside the existing result banner in `PlayTrivia`, below the "Correct!"/"Incorrect!" label and (when shown) below the "Answer: X" line.

**Files:**
- Modify: `frontend/src/components/PlayTrivia.jsx` (result banner JSX around lines 153-176, styles object around line 312)

- [ ] **Step 1: Add an `explanationText` style entry**

In `frontend/src/components/PlayTrivia.jsx`, inside the `styles = {...}` object, add a new entry immediately after `correctAnswerText` (currently at line 312):

```javascript
  correctAnswerText: { color: '#9ca3af', fontSize: '13px', marginTop: '4px' },
  explanationText: {
    color: '#9ca3af', fontSize: '13px', lineHeight: 1.5,
    marginTop: '10px', fontStyle: 'italic',
  },
```

The italic + small top margin visually separates it from the answer text and signals it as supplementary info.

- [ ] **Step 2: Render the explanation inside the result banner**

In the same file, find the result banner block (currently lines 154-176 — it starts with `<div style={{ ...styles.resultBanner, ... }}>` and closes with `</div>` after the `correctAnswerText` line). Add the explanation render right before the closing `</div>` of the banner, after the "Answer:" line:

```jsx
            <div style={{
              ...styles.resultBanner,
              background: result?.correct ? '#0f2a1a' : '#2a0f0f',
              borderColor: result?.correct ? '#4ade80' : '#ef4444',
            }}>
              <div style={styles.resultIcon}>
                {result?.correct
                  ? <CheckCircle2 size={40} color="#4ade80" />
                  : <XCircle size={40} color="#ef4444" />
                }
              </div>
              <div style={{
                ...styles.resultLabel,
                color: result?.correct ? '#4ade80' : '#ef4444',
              }}>
                {result?.correct ? 'Correct!' : 'Incorrect!'}
              </div>
              {!result?.correct && trivia.options && result?.correct_index !== undefined && (
                <div style={styles.correctAnswerText}>
                  Answer: {trivia.options[result.correct_index]}
                </div>
              )}
              {result?.explanation && (
                <div style={styles.explanationText}>
                  {result.explanation}
                </div>
              )}
            </div>
```

- [ ] **Step 3: Verify the file still parses (no dev server rebuild — per project convention)**

Per the project's feedback memory, the user handles frontend rebuilds. Do not run `npm run dev`, `npm run build`, or any frontend build command. The only check here is that the edit is syntactically well-formed — visually re-read the modified block in the editor and confirm matched JSX tags.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PlayTrivia.jsx
git commit -m "feat(trivia): show answer explanation on results screen"
```

---

## Done

At this point:
- Each of the 30 trivia questions has a one-sentence explanation.
- The `/lobby/{code}/answer` response includes `explanation`.
- The results screen shows the explanation in italic muted text inside the result banner, for both correct and incorrect answers.
- Backend tests cover the new field (schema test + two handler tests).

No deploy needed beyond the user's normal process (CDK deploy for backend, frontend rebuild handled by the user).
