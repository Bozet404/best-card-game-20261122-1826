# Ember Pact

A turn-based duel card game for the [make.fun](https://make.fun/bounty/best-card-game-20261122-1826) bounty **best-card-game-20261122-1826** — you versus the Ashen Warden, on a bright felt table, in a desktop browser, fully offline.

## How to play

- **Goal:** reduce the Ashen Warden from 30 life to 0 before it does the same to you.
- **Ember:** each turn grants ember equal to the turn number (up to 10) and refills it. Playing a card spends its cost.
- **Creatures:** click a hand card twice to summon it. A new creature has summoning sickness — it attacks from your next turn. Click your ready creature, then an enemy creature or the Warden's portrait, to attack. Creatures trade damage both ways.
- **Spells:** Ember Burst deals 3 to any target (click the target). Healing Rain restores 5 of your life. Root Wisdom draws 2 cards. Quake Slam deals 2 to all enemy creatures.
- **Decks:** 30 cards each (15 designs × 2), opening hand 3, one draw per turn, hand max 7. An empty deck still demands its draw — fatigue damage rises 1, 2, 3…, so every duel ends.
- **Houses:** Flame ▲ hits hard · Tide ≈ endures · Thorn ✿ holds the line · Stone ◆ shakes the board.
- **Keys:** 1–7 select / play a hand card · Space end turn · Esc cancel or close · M mute · Enter duel.

## The Warden

A deterministic AI: it heals when hurt, draws when its hand runs dry, quakes into a wide board, bursts for lethal or at a big threat, fields its biggest affordable creature, and attacks lethal first — else a trade it wins against a 4+ attack creature, else straight at your face. The same board always plays the same way.

## Run it

```sh
node serve.ts            # http://127.0.0.1:8080
node --test tests/logic.test.mjs   # 15 logic tests
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # dossier
```

Screenshots are real renders of the game's own code (`?shot=title|table|win|loss&seed=7`). Add `?seed=N` to any URL for a different shuffle; `?autostart=1` jumps straight into a duel.

## Files

- `game/index.html`, `game/style.css` — the table
- `game/src/rng.js` — mulberry32 seeded RNG
- `game/src/cards.js` — the 15-card catalogue, four houses
- `game/src/engine.js` — all rules: turns, combat, spells, fatigue, AI
- `game/src/ui.js` — card faces and ember pips
- `game/src/audio.js` — WebAudio synth blips, no audio files
- `game/src/main.js` — wiring, keyboard, shot modes, scale-to-fit
- `main.ts` — builds `dossier.json` with the vendored make.fun library
- `serve.ts` — tiny static server for local play

MIT licensed. Original game — its own names, art, sounds and rules.
