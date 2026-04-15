# Trivia Answer Explanations — Design

**Date:** 2026-04-15
**Status:** Approved

## Goal

After a player answers a trivia question in the Play Together minigame, show a short (~1 sentence) explanation of the correct answer on the results screen. Explanations appear regardless of whether the player got the question right or wrong — correct answers get reinforcement, wrong answers get the learning moment.

## Non-goals

- No longer-form explanations or multi-paragraph facts.
- No explanations mid-question (only after answering).
- No explanation for each wrong option — just the correct answer.

## Changes

### 1. Trivia data — `backend/src/shared/game_data.py`

Add an `"explanation"` field to each of the 30 entries in the `TRIVIA` list. Each explanation is a single sentence (~10–25 words) that states the fact behind the correct answer.

Example shape:

```python
{
    "question": "What period did the T-Rex live in?",
    "options": ["Jurassic", "Cretaceous", "Triassic", "Permian"],
    "answer": 1,
    "explanation": "T-Rex lived during the late Cretaceous period, about 68–66 million years ago.",
},
```

All 30 entries get an explanation. No other shape changes.

### 2. Backend response — `backend/src/handlers/lobby.py`

In `answer_lobby_handler` (around line 281), include the explanation in the response payload:

```python
return success({
    "correct": is_correct,
    "correct_index": correct_index,
    "explanation": trivia.get("explanation", ""),
    "xp_awarded": xp_amount,
    ...
})
```

Using `.get(..., "")` keeps behavior safe if a stored lobby somehow lacks the field (e.g., an in-flight lobby from before deploy — TTL is 2 minutes so this window is tiny).

### 3. Frontend display — `frontend/src/components/PlayTrivia.jsx`

In the results view (around line 152, inside `resultBanner`), render the explanation below the result label and below the "Answer: X" text when shown. Only render if `result?.explanation` is truthy.

Style: muted secondary text (`#9ca3af`, 13px, line-height 1.5), matching the existing `correctAnswerText` treatment. Add a new `explanationText` style entry; small top margin so it reads as its own line.

Placement:
```
[Result icon]
[Correct! / Incorrect!]
[Answer: X]          <-- only when wrong (existing)
[Explanation text]   <-- new, always shown when present
```

### 4. Tests — `backend/tests/test_game_data.py`

Extend `test_trivia_format` to also assert every entry has a non-empty `explanation` string. No new test file.

## Risks & mitigations

- **In-flight lobbies during deploy:** a lobby created pre-deploy stores the old trivia dict in DynamoDB; answering post-deploy would miss the explanation. Mitigated by `.get(..., "")` + the frontend only rendering when truthy. Lobby TTL is 2 minutes so the window is negligible.
- **Tone/accuracy:** explanations will be written to match the playful party tone but stay factually correct. Reviewed in the diff.

## Out of scope

- Per-option explanations
- Localizing/translating
- Admin-editable trivia
