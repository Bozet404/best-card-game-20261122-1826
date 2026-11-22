// Logic tests for the Ember Pact engine (pure logic, no DOM).
// Run: node --test tests/logic.test.mjs — expect 15/15.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startMatch, playCard, attack, endTurn, surrender,
  scriptedOpening, drawCard,
} from '../game/src/engine.js';
import { CARD_DEFS, makeCard } from '../game/src/cards.js';

function fresh(seed = 7) {
  const g = createGame(seed);
  startMatch(g);
  return g;
}

// Force a card into a player's hand (tests set up exact boards this way).
function give(g, playerIdx, defId) {
  const card = makeCard(defId, g);
  g.players[playerIdx].hand.push(card);
  return card;
}

function place(g, playerIdx, defId) {
  const card = makeCard(defId, g);
  card.justPlayed = false;
  card.canAttack = true;
  g.players[playerIdx].board.push(card);
  return card;
}

test('deck has 30 cards, opening hand 3, ember 1, phase player', () => {
  const g = fresh();
  assert.equal(g.players[0].deck.length, 27);
  assert.equal(g.players[0].hand.length, 3);
  assert.equal(g.players[0].ember, 1);
  assert.equal(g.phase, 'player');
  assert.equal(CARD_DEFS.length, 15);
  // The same seed deals the same opening hands.
  const hands = (x) => x.players[0].hand.map((c) => c.defId).join(',');
  assert.equal(hands(fresh(42)), hands(fresh(42)));
  assert.notEqual(hands(fresh(43)), hands(fresh(42)));
});

test('playing a creature costs ember and it cannot attack that turn', () => {
  const g = fresh();
  g.players[0].ember = 10;
  give(g, 0, 'ember-imp');
  const before = g.players[0].ember;
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, true);
  assert.equal(g.players[0].ember, before - 1);
  assert.equal(g.players[0].board.length, 1);
  const imp = g.players[0].board[0];
  assert.equal(imp.justPlayed, true);
  const atk = attack(g, imp.uid, { kind: 'hero', player: 1 });
  assert.equal(atk.ok, false);
});

test('an unaffordable card is refused with a clear error', () => {
  const g = fresh();
  g.players[0].ember = 0;
  give(g, 0, 'flame-drake');
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, false);
  assert.match(res.error, /not enough ember/);
  assert.equal(g.players[0].board.length, 0);
});

test('the board caps at 5 creatures', () => {
  const g = fresh();
  g.players[0].ember = 10;
  for (let i = 0; i < 5; i += 1) place(g, 0, 'ember-imp');
  give(g, 0, 'mist-sprite');
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, false);
  assert.match(res.error, /board is full/);
});

test('combat trades damage both ways', () => {
  const g = fresh();
  const wolf = place(g, 0, 'cinder-wolf'); // 3/2
  const brute = place(g, 1, 'granite-brute'); // 4/6
  const res = attack(g, wolf.uid, { kind: 'creature', player: 1, uid: brute.uid });
  assert.equal(res.ok, true);
  assert.equal(brute.health, 3); // took 3
  assert.equal(g.players[0].board.length, 0); // wolf took 4, died
  assert.equal(g.players[1].board.length, 1); // brute survives at 3
});

test('a hero attack reduces life and wins at 0', () => {
  const g = fresh();
  const wolf = place(g, 0, 'cinder-wolf'); // 3 attack
  g.players[1].life = 3;
  const res = attack(g, wolf.uid, { kind: 'hero', player: 1 });
  assert.equal(res.ok, true);
  assert.equal(g.players[1].life, 0);
  assert.equal(g.phase, 'won');
});

test('Ember Burst needs a target and deals 3 damage', () => {
  const g = fresh();
  g.players[0].ember = 10;
  give(g, 0, 'ember-burst');
  const idx = g.players[0].hand.length - 1;
  const noTarget = playCard(g, 0, idx);
  assert.equal(noTarget.ok, false);
  assert.equal(noTarget.needsTarget, true);
  const lifeBefore = g.players[1].life;
  const res = playCard(g, 0, idx, { kind: 'hero', player: 1 });
  assert.equal(res.ok, true);
  assert.equal(g.players[1].life, lifeBefore - 3);
});

test('Healing Rain restores 5 life', () => {
  const g = fresh();
  g.players[0].ember = 10;
  g.players[0].life = 20;
  give(g, 0, 'healing-rain');
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, true);
  assert.equal(g.players[0].life, 25);
});

test('Root Wisdom draws 2 cards', () => {
  const g = fresh();
  g.players[0].ember = 10;
  const before = g.players[0].hand.length;
  give(g, 0, 'root-wisdom');
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, true);
  assert.equal(g.players[0].hand.length, before + 2); // +2 drawn, -1 played, +1 given
});

test('Quake Slam deals 2 to all enemy creatures', () => {
  const g = fresh();
  g.players[0].ember = 10;
  const a = place(g, 1, 'mist-sprite'); // 1/2
  const b = place(g, 1, 'thorn-sprout'); // 1/3
  give(g, 0, 'quake-slam');
  const res = playCard(g, 0, g.players[0].hand.length - 1);
  assert.equal(res.ok, true);
  assert.equal(g.players[1].board.length, 1); // sprite died, sprout at 1
  assert.equal(b.health, 1);
  assert.equal(a.health, 0);
});

test('end turn runs the Warden and returns the turn', () => {
  const g = fresh();
  const res = endTurn(g);
  assert.equal(res.ok, true);
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 'player');
  assert.equal(g.players[0].ember, 2);
  assert.equal(g.players[0].hand.length, 4); // 3 + 1 drawn
});

test('surrender loses the duel', () => {
  const g = fresh();
  const res = surrender(g);
  assert.equal(res.ok, true);
  assert.equal(g.phase, 'lost');
});

test('the scripted opening builds a real mid-game table', () => {
  const g = createGame(7);
  scriptedOpening(g);
  assert.equal(g.phase, 'player');
  assert.ok(g.players[0].board.length >= 2);
  assert.ok(g.players[1].board.length >= 1);
  assert.equal(g.players[0].board[1].defId, 'cinder-wolf');
  assert.equal(g.players[0].board[1].canAttack, true);
  assert.equal(g.players[0].life, 30);
  assert.equal(g.players[1].life, 30);
});

test('sickness lifts on the next turn and the Warden attacks on its turns', () => {
  const g = fresh();
  g.players[0].ember = 10;
  give(g, 0, 'ember-imp');
  playCard(g, 0, g.players[0].hand.length - 1);
  const imp = g.players[0].board[0];
  assert.equal(imp.canAttack, false);
  endTurn(g); // Warden turn, then back to you, turn 2
  assert.equal(imp.canAttack, true);
  assert.equal(imp.justPlayed, false);
  // The Warden attacks: give it a ready Mist Sprite, clear your board.
  g.players[0].board = [];
  const sprite = place(g, 1, 'mist-sprite');
  sprite.justPlayed = false;
  sprite.canAttack = true;
  const lifeBefore = g.players[0].life;
  endTurn(g);
  assert.ok(g.players[0].life < lifeBefore, 'Warden should have attacked face');
  assert.equal(g.phase, 'player');
});

test('twelve seeded full matches always end within 60 turns', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const g = createGame(seed);
    startMatch(g);
    let rounds = 0;
    while ((g.phase === 'player' || g.phase === 'ai') && rounds < 60) {
      rounds += 1;
      const me = g.players[0];
      let guard = 0;
      while (guard++ < 40) {
        const idx = me.hand.findIndex(
          (c) => c.type === 'creature' && c.cost <= me.ember && me.board.length < 5,
        );
        if (idx < 0) break;
        playCard(g, 0, idx);
      }
      // Simple spells: draw when the hand is thin, heal when hurt.
      const wisdom = me.hand.findIndex((c) => c.defId === 'root-wisdom');
      if (wisdom >= 0 && me.ember >= 1 && me.hand.length <= 3) playCard(g, 0, wisdom);
      const rain = me.hand.findIndex((c) => c.defId === 'healing-rain');
      if (rain >= 0 && me.ember >= 2 && me.life <= 20) playCard(g, 0, rain);
      for (const c of [...me.board]) {
        if (g.phase !== 'player') break;
        if (c.canAttack && !c.justPlayed) {
          attack(g, c.uid, { kind: 'hero', player: 1 });
        }
      }
      if (g.phase === 'player') endTurn(g);
    }
    assert.ok(
      g.phase === 'won' || g.phase === 'lost',
      `seed ${seed} did not finish (phase ${g.phase}, turn ${g.turn})`,
    );
    assert.ok(g.turn <= 60, `seed ${seed} took ${g.turn} turns`);
  }
  // And the mechanism that guarantees it: an empty-deck draw is fatigue,
  // and the damage rises every time.
  const g = fresh();
  const me = g.players[0];
  me.deck = [];
  me.life = 30;
  const first = drawCard(g, 0);
  assert.equal(first.fatigued, true);
  assert.equal(me.life, 29);
  assert.equal(me.fatigue, 1);
  drawCard(g, 0);
  assert.equal(me.life, 27);
  assert.equal(me.fatigue, 2);
});
