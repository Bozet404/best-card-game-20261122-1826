// Ember Pact engine — the whole duel as pure logic, no DOM anywhere, so
// the node test suite can drive it directly and the browser UI is a thin
// skin over the same functions.
//
// The shape of a game:
//   phase: 'title' | 'player' | 'ai' | 'won' | 'lost'
//   turn: the round number; both duelists draw from it for ember.
//   players[0] is you, players[1] is the Ashen Warden.
// A player: life, deck, hand (max 7), board (max 5 creatures), ember,
// maxEmber, fatigue (rising empty-deck damage).
// A creature: uid, defId, name, house, cost, attack, health, justPlayed
// (summoning sickness), canAttack.

import { buildDeck, makeCard } from './cards.js';
import { mulberry32 } from './rng.js';

export function createGame(seed = 1) {
  return {
    seed,
    turn: 1,
    phase: 'title',
    winner: null,
    players: [newPlayer(0, 'You'), newPlayer(1, 'Ashen Warden')],
    log: [],
    stats: { damageDealt: 0, cardsPlayed: 0 },
    nextUid: 1,
    rng: mulberry32(seed),
  };
}

function newPlayer(id, name) {
  return {
    id,
    name,
    life: 30,
    maxLife: 30,
    deck: [],
    hand: [],
    board: [],
    ember: 0,
    maxEmber: 0,
    fatigue: 0,
    isAI: id === 1,
  };
}

function note(game, text) {
  game.log.push(text);
  if (game.log.length > 40) game.log.splice(0, game.log.length - 40);
}

// ---------------------------------------------------------------- damage --

function checkEnd(game) {
  if (game.players[1].life <= 0) {
    game.phase = 'won';
    game.winner = 0;
    note(game, 'The Ashen Warden falls — VICTORY!');
  } else if (game.players[0].life <= 0) {
    game.phase = 'lost';
    game.winner = 1;
    note(game, 'You fall — DEFEAT.');
  }
}

// fromIdx is who deals the damage (0 = you, 1 = the Warden, -1 = nobody,
// e.g. fatigue). Only your damage counts toward the "Damage dealt" score.
function hurtHero(game, fromIdx, toIdx, amount) {
  const target = game.players[toIdx];
  target.life -= amount;
  if (fromIdx === 0) game.stats.damageDealt += amount;
  checkEnd(game);
}

function hurtCreature(game, fromIdx, ownerIdx, uid, amount) {
  const owner = game.players[ownerIdx];
  const victim = owner.board.find((c) => c.uid === uid);
  if (!victim) return false;
  victim.health -= amount;
  if (fromIdx === 0) game.stats.damageDealt += amount;
  if (victim.health <= 0) {
    owner.board = owner.board.filter((c) => c.uid !== uid);
    note(game, `${victim.name} is destroyed.`);
  }
  return true;
}

// ------------------------------------------------------------------ turns --

export function startMatch(game) {
  game.rng = mulberry32(game.seed);
  game.turn = 1;
  game.phase = 'player';
  game.winner = null;
  game.log = [];
  game.stats = { damageDealt: 0, cardsPlayed: 0 };
  game.nextUid = 1;
  for (const p of game.players) {
    p.life = 30;
    p.deck = buildDeck(game.rng, game);
    p.hand = [];
    p.board = [];
    p.ember = 0;
    p.maxEmber = 0;
    p.fatigue = 0;
  }
  for (let i = 0; i < 3; i += 1) {
    drawCard(game, 0, true);
    drawCard(game, 1, true);
  }
  game.players[0].maxEmber = 1;
  game.players[0].ember = 1;
  note(game, 'The duel begins — your turn, 1 ember.');
}

// Start of one duelist's turn: ember grows by one (capped at 10) and
// refills, summoning sickness lifts on every creature they own, then they
// draw. An empty deck still demands its draw — fatigue damage rises
// 1, 2, 3… so no duel can stall forever.
export function beginTurn(game, playerIdx) {
  const p = game.players[playerIdx];
  p.maxEmber = Math.min(p.maxEmber + 1, 10);
  p.ember = p.maxEmber;
  for (const c of p.board) {
    c.justPlayed = false;
    c.canAttack = true;
  }
  drawCard(game, playerIdx);
  if (game.phase === 'won' || game.phase === 'lost') return;
  note(game, `${p.name} begin${p.id === 0 ? '' : 's'} turn ${game.turn} — ${p.ember} ember.`);
}

export function drawCard(game, playerIdx, opening = false) {
  const p = game.players[playerIdx];
  if (p.deck.length === 0) {
    p.fatigue += 1;
    note(game, `${p.name} draws from an empty deck — fatigue ${p.fatigue}!`);
    hurtHero(game, -1, playerIdx, p.fatigue);
    return { card: null, fatigued: true };
  }
  const card = p.deck.pop();
  if (p.hand.length >= 7) {
    note(game, `${p.name}'s hand is full — ${card.name} burns.`);
    return { card: null, burned: true };
  }
  p.hand.push(card);
  if (!opening) note(game, `${p.name} draws a card.`);
  return { card, fatigued: false };
}

// ------------------------------------------------------------------ cards --

function isYourTurn(game, playerIdx) {
  return (playerIdx === 0 && game.phase === 'player')
    || (playerIdx === 1 && game.phase === 'ai');
}

export function playCard(game, playerIdx, handIndex, target = null) {
  const p = game.players[playerIdx];
  if (!isYourTurn(game, playerIdx)) return { ok: false, error: 'not your turn' };
  const card = p.hand[handIndex];
  if (!card) return { ok: false, error: 'no such card' };
  if (card.cost > p.ember) {
    return { ok: false, error: `not enough ember to play ${card.name}` };
  }
  if (card.type === 'creature' && p.board.length >= 5) {
    return { ok: false, error: 'your board is full' };
  }
  if (card.defId === 'ember-burst' && !target) {
    return { ok: false, error: 'Ember Burst needs a target', needsTarget: true };
  }
  p.ember -= card.cost;
  p.hand.splice(handIndex, 1);
  game.stats.cardsPlayed += 1;
  if (card.type === 'creature') {
    card.justPlayed = true;
    card.canAttack = false;
    p.board.push(card);
    note(game, `${p.name} summon${p.id === 0 ? '' : 's'} ${card.name} (${card.attack}/${card.health}).`);
    return { ok: true };
  }
  castSpell(game, playerIdx, card, target);
  return { ok: true };
}

function castSpell(game, playerIdx, card, target) {
  const p = game.players[playerIdx];
  const foe = game.players[1 - playerIdx];
  if (card.defId === 'ember-burst') {
    note(game, `${p.name} cast${p.id === 0 ? '' : 's'} Ember Burst for 3 damage.`);
    if (target.kind === 'hero') hurtHero(game, playerIdx, target.player, 3);
    else hurtCreature(game, playerIdx, target.player, target.uid, 3);
  } else if (card.defId === 'healing-rain') {
    const healed = Math.min(5, p.maxLife - p.life);
    p.life += healed;
    note(game, `${p.name} cast${p.id === 0 ? '' : 's'} Healing Rain, restoring ${healed} life.`);
  } else if (card.defId === 'root-wisdom') {
    note(game, `${p.name} cast${p.id === 0 ? '' : 's'} Root Wisdom and draws 2 cards.`);
    drawCard(game, playerIdx);
    drawCard(game, playerIdx);
  } else if (card.defId === 'quake-slam') {
    note(game, `${p.name} cast${p.id === 0 ? '' : 's'} Quake Slam — 2 damage to all enemy creatures.`);
    for (const c of [...foe.board]) hurtCreature(game, playerIdx, 1 - playerIdx, c.uid, 2);
  }
}

// ----------------------------------------------------------------- combat --

// One creature hitting one target. Creature-vs-creature is simultaneous:
// both deal their damage even if one of them dies from it.
function strike(game, attackerIdx, attackerUid, target) {
  const attackerSide = game.players[attackerIdx];
  const attacker = attackerSide.board.find((c) => c.uid === attackerUid);
  if (!attacker) return { ok: false, error: 'no such creature' };
  if (attacker.justPlayed || !attacker.canAttack) {
    return { ok: false, error: `${attacker.name} cannot attack yet` };
  }
  attacker.canAttack = false;
  if (target.kind === 'hero') {
    if (target.player === attackerIdx) return { ok: false, error: 'invalid target' };
    note(game, `${attacker.name} strikes ${game.players[target.player].name} for ${attacker.attack}.`);
    hurtHero(game, attackerIdx, target.player, attacker.attack);
    return { ok: true };
  }
  const defender = game.players[target.player].board.find((c) => c.uid === target.uid);
  if (!defender) return { ok: false, error: 'no such target' };
  note(game, `${attacker.name} attacks ${defender.name}.`);
  const dealt = attacker.attack;
  const taken = defender.attack;
  hurtCreature(game, attackerIdx, target.player, target.uid, dealt);
  hurtCreature(game, target.player, attackerIdx, attackerUid, taken);
  return { ok: true };
}

export function attack(game, attackerUid, target) {
  if (game.phase !== 'player') return { ok: false, error: 'not your turn' };
  return strike(game, 0, attackerUid, target);
}

// --------------------------------------------------------------------- AI --

// The Warden's turn, deterministic: the same board always plays the same
// way. Spells first (heal when hurt, draw when the hand runs dry, quake
// into a wide board, burst for lethal or at a big threat), then the biggest
// affordable creature it can field, then every ready creature attacks —
// lethal first, else a trade it wins against a 4+ attack creature, else
// straight at your face.
export function runAiTurn(game) {
  const ai = game.players[1];
  const foe = game.players[0];
  let acted = true;
  while (acted && game.phase === 'ai') {
    acted = false;
    const at = (defId) => ai.hand.findIndex((c) => c.defId === defId);
    const heal = at('healing-rain');
    const draw = at('root-wisdom');
    const quake = at('quake-slam');
    const burst = at('ember-burst');
    if (heal >= 0 && ai.life <= 14 && ai.ember >= 2) {
      playCard(game, 1, heal);
      acted = true;
    } else if (draw >= 0 && ai.hand.length <= 3 && ai.ember >= 1) {
      playCard(game, 1, draw);
      acted = true;
    } else if (quake >= 0 && foe.board.length >= 2 && ai.ember >= 3) {
      playCard(game, 1, quake);
      acted = true;
    } else if (burst >= 0 && ai.ember >= 2) {
      if (foe.life <= 3) {
        playCard(game, 1, burst, { kind: 'hero', player: 0 });
        acted = true;
      } else {
        const threat = [...foe.board]
          .filter((c) => c.attack >= 4)
          .sort((a, b) => b.attack - a.attack)[0];
        if (threat) {
          playCard(game, 1, burst, { kind: 'creature', player: 0, uid: threat.uid });
          acted = true;
        }
      }
    }
  }
  if (game.phase !== 'ai') return;
  while (ai.board.length < 5) {
    let best = -1;
    for (let i = 0; i < ai.hand.length; i += 1) {
      const c = ai.hand[i];
      if (c.type !== 'creature' || c.cost > ai.ember) continue;
      if (best < 0) { best = i; continue; }
      const b = ai.hand[best];
      if (c.cost > b.cost || (c.cost === b.cost && c.attack > b.attack)) best = i;
    }
    if (best < 0) break;
    playCard(game, 1, best);
    if (game.phase !== 'ai') return;
  }
  for (const attacker of [...ai.board]) {
    if (game.phase !== 'ai') return;
    if (!attacker.canAttack || attacker.justPlayed) continue;
    if (foe.life <= attacker.attack) {
      strike(game, 1, attacker.uid, { kind: 'hero', player: 0 });
      continue;
    }
    const prey = foe.board
      .filter((c) => c.attack >= 4 && c.health <= attacker.attack && attacker.health > c.attack)
      .sort((a, b) => b.attack - a.attack)[0];
    if (prey) strike(game, 1, attacker.uid, { kind: 'creature', player: 0, uid: prey.uid });
    else strike(game, 1, attacker.uid, { kind: 'hero', player: 0 });
  }
}

export function endTurn(game) {
  if (game.phase !== 'player') return { ok: false, error: 'not your turn' };
  game.phase = 'ai';
  note(game, 'The Ashen Warden takes its turn.');
  beginTurn(game, 1);
  if (game.phase === 'won' || game.phase === 'lost') return { ok: true };
  runAiTurn(game);
  if (game.phase === 'won' || game.phase === 'lost') return { ok: true };
  game.turn += 1;
  game.phase = 'player';
  beginTurn(game, 0);
  return { ok: true };
}

export function surrender(game) {
  if (game.phase !== 'player') return { ok: false, error: 'not your turn' };
  game.phase = 'lost';
  game.winner = 1;
  note(game, 'You surrender — DEFEAT.');
  return { ok: true };
}

// ------------------------------------------------------- scripted opening --

// The fixed mid-game table the screenshots use: start a match, hand both
// sides scripted cards, play Ember Imp + Cinder Wolf, let the Warden answer,
// then drop Flame Drake and wake your whole board. After this, your board
// is [Ember Imp, Cinder Wolf, Flame Drake] (the Wolf, index 1, has 3 attack
// and is ready), the Warden holds a Mist Sprite, and both sides sit at 30.
export function scriptedOpening(game) {
  startMatch(game);
  const me = game.players[0];
  const foe = game.players[1];
  me.hand = [
    makeCard('ember-imp', game),
    makeCard('cinder-wolf', game),
    makeCard('flame-drake', game),
    makeCard('mist-sprite', game),
    makeCard('healing-rain', game),
  ];
  me.ember = 10;
  me.maxEmber = 10;
  playCard(game, 0, 0); // Ember Imp
  playCard(game, 0, 0); // Cinder Wolf
  foe.hand = [
    makeCard('mist-sprite', game),
    makeCard('thorn-sprout', game),
    makeCard('granite-brute', game),
    makeCard('ember-burst', game),
  ];
  endTurn(game);
  me.ember = 10;
  me.maxEmber = 10;
  const drake = me.hand.findIndex((c) => c.defId === 'flame-drake');
  playCard(game, 0, drake);
  for (const c of me.board) {
    c.justPlayed = false;
    c.canAttack = true;
  }
  return game;
}
