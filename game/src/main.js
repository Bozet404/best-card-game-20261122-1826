// Ember Pact — browser wiring. The engine (engine.js) owns every rule;
// this file only turns clicks and keys into engine calls and paints the
// result. It also owns the shot modes (?shot=title|table|win|loss), the
// scale-to-fit layout, the win/loss record, and the __ember debug hook the
// live test driver uses.

import {
  createGame, startMatch, playCard, attack, endTurn, surrender, scriptedOpening,
} from './engine.js';
import { cardElement, pipsElement } from './ui.js';
import { sfx, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function parseSeed() {
  const raw = Number(params.get('seed'));
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return (Date.now() % 100000) + 1;
}

let game = createGame(parseSeed());
const ui = { selectedHand: null, attackerUid: null, targeting: null, hint: '' };
let countedGame = null;

// ------------------------------------------------------------ record -----

function loadRecord() {
  try {
    const parsed = JSON.parse(localStorage.getItem('ember-pact-record') || '{}');
    return { won: Number(parsed.won) || 0, lost: Number(parsed.lost) || 0 };
  } catch {
    return { won: 0, lost: 0 };
  }
}

function saveRecord(rec) {
  try {
    localStorage.setItem('ember-pact-record', JSON.stringify(rec));
  } catch {
    // Private mode or blocked storage: the record is a nicety, not a rule.
  }
}

let record = loadRecord();

// ------------------------------------------------------------ helpers ----

function setHint(text) {
  ui.hint = text;
  const el = $('hint');
  if (el) el.textContent = text;
}

function countResult() {
  if ((game.phase === 'won' || game.phase === 'lost') && countedGame !== game) {
    countedGame = game;
    if (game.phase === 'won') record.won += 1;
    else record.lost += 1;
    saveRecord(record);
    sfx(game.phase === 'won' ? 'win' : 'lose');
  }
}

function afterAction() {
  countResult();
  render();
}

// Scale the fixed 1280x720 table down (never up) so every control stays
// visible and clickable in shorter browser windows.
function fitTable() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720, 1);
  $('app').style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// ------------------------------------------------------------ rendering --

function render() {
  $('screen-title').classList.toggle('hidden', game.phase !== 'title');
  $('screen-table').classList.toggle('hidden', game.phase !== 'player' && game.phase !== 'ai');
  $('screen-end').classList.toggle('hidden', game.phase !== 'won' && game.phase !== 'lost');
  $('screen-end').classList.toggle('lost', game.phase === 'lost');
  if (game.phase === 'title') renderTitle();
  else if (game.phase === 'player' || game.phase === 'ai') renderTable();
  else renderEnd();
}

function renderTitle() {
  $('record-line').textContent = `Duels won ${record.won} · lost ${record.lost}`;
}

function renderTable() {
  const me = game.players[0];
  const foe = game.players[1];
  $('turn-label').textContent = `Turn ${game.turn}`;
  $('damage-label').textContent = `Damage dealt ${game.stats.damageDealt}`;
  $('deck-label').textContent = `Decks — You ${me.deck.length} · Warden ${foe.deck.length}`;
  $('you-life').textContent = String(me.life);
  $('warden-life').textContent = String(foe.life);
  $('warden-hand-count').textContent = `🂠 ×${foe.hand.length}`;

  const pips = $('ember-pips');
  pips.replaceChildren(pipsElement(me.ember, me.maxEmber));

  const logEl = $('log');
  logEl.replaceChildren();
  for (const [i, line] of game.log.slice(-6).entries()) {
    const row = document.createElement('div');
    if (i === game.log.slice(-6).length - 1) row.className = 'latest';
    row.textContent = line;
    logEl.appendChild(row);
  }
  if (ui.hint) $('hint').textContent = ui.hint;

  const wardenBoard = $('warden-board');
  wardenBoard.replaceChildren();
  for (const c of foe.board) {
    const el = cardElement(c, { targetable: !!ui.targeting });
    wardenBoard.appendChild(el);
  }

  const youBoard = $('you-board');
  youBoard.replaceChildren();
  for (const c of me.board) {
    const ready = c.canAttack && !c.justPlayed && game.phase === 'player';
    youBoard.appendChild(cardElement(c, {
      attacker: ui.attackerUid === c.uid,
      disabled: !ready,
    }));
  }

  const hand = $('you-hand');
  hand.replaceChildren();
  me.hand.forEach((c, i) => {
    hand.appendChild(cardElement(c, {
      index: i,
      selected: ui.selectedHand === i,
      disabled: c.cost > me.ember,
    }));
  });

  $('warden-portrait').classList.toggle('targetable', !!ui.targeting);
  $('btn-end-turn').disabled = game.phase !== 'player';
}

function renderEnd() {
  const won = game.phase === 'won';
  $('end-title').textContent = won ? 'VICTORY' : 'DEFEAT';
  $('end-subtitle').textContent = won
    ? 'The Ashen Warden falls. The ember is yours.'
    : 'The Ashen Warden stands over the ashes of your pact.';
  const stats = [
    ['Turns', String(game.turn)],
    ['Your life', String(game.players[0].life)],
    ['Warden life', String(game.players[1].life)],
    ['Damage dealt', String(game.stats.damageDealt)],
    ['Cards played', String(game.stats.cardsPlayed)],
    ['Duels won', `${record.won} · lost ${record.lost}`],
  ];
  const grid = $('end-stats');
  grid.replaceChildren();
  for (const [label, value] of stats) {
    const cell = document.createElement('div');
    cell.className = 'stat';
    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = value;
    const l = document.createElement('div');
    l.className = 'stat-label';
    l.textContent = label;
    cell.appendChild(v);
    cell.appendChild(l);
    grid.appendChild(cell);
  }
}

// ------------------------------------------------------------ actions ----

function clearSelection() {
  ui.selectedHand = null;
  ui.attackerUid = null;
  ui.targeting = null;
}

function startDuel() {
  clearSelection();
  countedGame = null;
  startMatch(game);
  setHint('Your turn — play a card or attack.');
  sfx('turn');
  render();
}

function duelAgain() {
  game = createGame((Date.now() % 100000) + 1);
  window.__ember.game = game;
  startDuel();
}

function backToTitle() {
  clearSelection();
  game.phase = 'title';
  render();
}

function onHandCard(index) {
  if (game.phase !== 'player') return;
  const card = game.players[0].hand[index];
  if (!card) return;
  if (ui.targeting) {
    ui.targeting = null;
    setHint('Targeting cancelled.');
    render();
    return;
  }
  if (ui.selectedHand === index) {
    confirmPlay(index);
    return;
  }
  ui.selectedHand = index;
  ui.attackerUid = null;
  const desc = card.type === 'creature'
    ? `${card.attack}/${card.health} creature`
    : card.text;
  setHint(`${card.name} — ${desc} · costs ${card.cost} ember. Click again to play.`);
  sfx('select');
  render();
}

function confirmPlay(index) {
  const me = game.players[0];
  const card = me.hand[index];
  if (!card) return;
  if (card.cost > me.ember) {
    setHint(`Not enough ember to play ${card.name} — it costs ${card.cost}, you have ${me.ember}.`);
    sfx('error');
    render();
    return;
  }
  if (card.type === 'creature' && me.board.length >= 5) {
    setHint('Your board is full (5 creatures).');
    sfx('error');
    render();
    return;
  }
  if (card.defId === 'ember-burst') {
    ui.targeting = { handIndex: index };
    ui.selectedHand = null;
    setHint('Ember Burst — click an enemy creature or the Ashen Warden to deal 3 damage. Esc to cancel.');
    sfx('select');
    render();
    return;
  }
  const res = playCard(game, 0, index);
  ui.selectedHand = null;
  if (res.ok) {
    setHint(`Played ${card.name}.`);
    sfx(card.type === 'spell' ? 'spell' : 'play');
  } else {
    setHint(res.error + '.');
    sfx('error');
  }
  afterAction();
}

function onOwnCreature(uid) {
  if (game.phase !== 'player') return;
  if (ui.targeting) {
    ui.targeting = null;
    setHint('Targeting cancelled.');
    render();
    return;
  }
  const c = game.players[0].board.find((x) => x.uid === uid);
  if (!c) return;
  if (c.justPlayed || !c.canAttack) {
    setHint(`${c.name} has summoning sickness — it can attack next turn.`);
    render();
    return;
  }
  ui.attackerUid = ui.attackerUid === uid ? null : uid;
  ui.selectedHand = null;
  setHint(ui.attackerUid
    ? `${c.name} is ready — click an enemy creature or the Warden to attack.`
    : 'Attack cancelled.');
  sfx('select');
  render();
}

function onEnemyCreature(uid) {
  if (ui.targeting) {
    castTargeted({ kind: 'creature', player: 1, uid });
    return;
  }
  if (ui.attackerUid != null) doAttack({ kind: 'creature', player: 1, uid });
}

function onWardenPortrait() {
  if (ui.targeting) {
    castTargeted({ kind: 'hero', player: 1 });
    return;
  }
  if (ui.attackerUid != null) {
    doAttack({ kind: 'hero', player: 1 });
    return;
  }
  setHint('The Ashen Warden — select one of your ready creatures, then click here to attack.');
  render();
}

function doAttack(target) {
  const attacker = game.players[0].board.find((c) => c.uid === ui.attackerUid);
  const res = attack(game, ui.attackerUid, target);
  ui.attackerUid = null;
  if (res.ok) {
    setHint(attacker ? `${attacker.name} attacks!` : 'Attack!');
    sfx('attack');
  } else {
    setHint(res.error + '.');
    sfx('error');
  }
  afterAction();
}

function castTargeted(target) {
  const idx = ui.targeting.handIndex;
  const card = game.players[0].hand[idx];
  ui.targeting = null;
  const res = playCard(game, 0, idx, target);
  if (res.ok) {
    setHint('Ember Burst hits for 3 damage!');
    sfx('spell');
  } else {
    setHint((res.error || 'Could not cast that') + '.');
    sfx('error');
  }
  afterAction();
}

function onEndTurn() {
  if (game.phase !== 'player') return;
  clearSelection();
  endTurn(game);
  setHint('Your turn — play a card or attack.');
  sfx('turn');
  afterAction();
}

function onSurrender() {
  if (game.phase !== 'player') return;
  clearSelection();
  surrender(game);
  afterAction();
}

function onRestart() {
  game = createGame((Date.now() % 100000) + 1);
  window.__ember.game = game;
  startDuel();
}

function toggleMute() {
  setMuted(!isMuted());
  $('btn-mute').textContent = isMuted() ? '🔇 Sound: Off' : '🔊 Sound: On';
}

function openHow() {
  $('overlay-how').classList.remove('hidden');
}

function closeHow() {
  $('overlay-how').classList.add('hidden');
}

// ------------------------------------------------------------ wiring -----

function bind() {
  $('btn-duel').addEventListener('click', startDuel);
  $('btn-how').addEventListener('click', openHow);
  $('btn-how-close').addEventListener('click', closeHow);
  $('btn-end-turn').addEventListener('click', onEndTurn);
  $('btn-surrender').addEventListener('click', onSurrender);
  $('btn-restart').addEventListener('click', onRestart);
  $('btn-mute').addEventListener('click', toggleMute);
  $('btn-again').addEventListener('click', duelAgain);
  $('btn-title').addEventListener('click', backToTitle);

  $('you-hand').addEventListener('click', (e) => {
    const cardEl = e.target.closest('.card');
    if (cardEl) onHandCard(Number(cardEl.dataset.index));
  });
  $('you-board').addEventListener('click', (e) => {
    const cardEl = e.target.closest('.card');
    if (cardEl) onOwnCreature(Number(cardEl.dataset.uid));
  });
  $('warden-board').addEventListener('click', (e) => {
    const cardEl = e.target.closest('.card');
    if (cardEl) onEnemyCreature(Number(cardEl.dataset.uid));
  });
  $('warden-portrait').addEventListener('click', onWardenPortrait);

  document.addEventListener('keydown', (e) => {
    if (!$('overlay-how').classList.contains('hidden')) {
      if (e.key === 'Escape') closeHow();
      return;
    }
    if (game.phase === 'title') {
      if (e.key === 'Enter') startDuel();
      return;
    }
    if (game.phase === 'won' || game.phase === 'lost') {
      if (e.key === 'Enter') duelAgain();
      return;
    }
    if (game.phase === 'player') {
      if (e.key >= '1' && e.key <= '7') {
        const i = Number(e.key) - 1;
        if (i < game.players[0].hand.length) onHandCard(i);
      } else if (e.key === ' ') {
        e.preventDefault();
        onEndTurn();
      } else if (e.key === 'Escape') {
        clearSelection();
        setHint('Selection cancelled.');
        render();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    }
  });

  window.addEventListener('resize', fitTable);
}

// ------------------------------------------------------------ shots ------

function applyShot() {
  const shot = params.get('shot');
  if (params.get('autostart') === '1') {
    startDuel();
    return;
  }
  if (!shot) {
    render();
    return;
  }
  if (shot === 'title') {
    game.phase = 'title';
    render();
    return;
  }
  if (shot === 'table') {
    scriptedOpening(game);
    render();
    return;
  }
  if (shot === 'win') {
    scriptedOpening(game);
    game.players[1].life = 3;
    render();
    return;
  }
  if (shot === 'loss') {
    scriptedOpening(game);
    game.players[0].life = 1;
    render();
    return;
  }
  render();
}

// Debug hook for the live test driver (and curious players).
window.__ember = {
  game,
  controls: { startDuel, duelAgain, onEndTurn, onSurrender },
};

setHint('Your turn — play a card or attack.');
bind();
fitTable();
applyShot();
