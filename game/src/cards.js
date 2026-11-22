// The Ember Pact card catalogue: fifteen designs, two copies of each in a
// thirty-card deck. Four houses, each told apart by colour AND shape, so a
// card is readable even without its colour: Flame is a red triangle,
// Tide a blue wave, Thorn a green flower, Stone an amber diamond.

import { shuffle } from './rng.js';

export const HOUSES = {
  flame: { name: 'Flame', glyph: '▲', color: '#d63c2f', soft: '#fdeceb' },
  tide: { name: 'Tide', glyph: '≈', color: '#2f7fd0', soft: '#e9f2fc' },
  thorn: { name: 'Thorn', glyph: '✿', color: '#3d9e4d', soft: '#eaf7ec' },
  stone: { name: 'Stone', glyph: '◆', color: '#b97a06', soft: '#fdf3e0' },
};

export const CARD_DEFS = [
  // Flame creatures — fast, hard-hitting.
  { id: 'ember-imp', name: 'Ember Imp', house: 'flame', type: 'creature', cost: 1, attack: 2, health: 1, text: '' },
  { id: 'cinder-wolf', name: 'Cinder Wolf', house: 'flame', type: 'creature', cost: 2, attack: 3, health: 2, text: '' },
  { id: 'flame-drake', name: 'Flame Drake', house: 'flame', type: 'creature', cost: 4, attack: 5, health: 4, text: '' },
  { id: 'pyre-colossus', name: 'Pyre Colossus', house: 'flame', type: 'creature', cost: 6, attack: 7, health: 6, text: '' },
  // Tide creatures — tough, patient.
  { id: 'mist-sprite', name: 'Mist Sprite', house: 'tide', type: 'creature', cost: 1, attack: 1, health: 2, text: '' },
  { id: 'river-serpent', name: 'River Serpent', house: 'tide', type: 'creature', cost: 3, attack: 3, health: 4, text: '' },
  { id: 'tide-leviathan', name: 'Tide Leviathan', house: 'tide', type: 'creature', cost: 5, attack: 6, health: 5, text: '' },
  // Thorn creatures — stubborn walls that grow back into the fight.
  { id: 'thorn-sprout', name: 'Thorn Sprout', house: 'thorn', type: 'creature', cost: 1, attack: 1, health: 3, text: '' },
  { id: 'briar-stalker', name: 'Briar Stalker', house: 'thorn', type: 'creature', cost: 2, attack: 2, health: 3, text: '' },
  { id: 'grove-ancient', name: 'Grove Ancient', house: 'thorn', type: 'creature', cost: 5, attack: 4, health: 7, text: '' },
  // Stone creatures — one huge wall.
  { id: 'granite-brute', name: 'Granite Brute', house: 'stone', type: 'creature', cost: 4, attack: 4, health: 6, text: '' },
  // Spells, one per house.
  { id: 'ember-burst', name: 'Ember Burst', house: 'flame', type: 'spell', cost: 2, text: 'Deal 3 damage to any target.' },
  { id: 'healing-rain', name: 'Healing Rain', house: 'tide', type: 'spell', cost: 2, text: 'Restore 5 life to yourself.' },
  { id: 'root-wisdom', name: 'Root Wisdom', house: 'thorn', type: 'spell', cost: 1, text: 'Draw 2 cards.' },
  { id: 'quake-slam', name: 'Quake Slam', house: 'stone', type: 'spell', cost: 3, text: 'Deal 2 damage to all enemy creatures.' },
];

export const DEF_BY_ID = Object.fromEntries(CARD_DEFS.map((d) => [d.id, d]));

// Build one live card from its design. The game hands out unique ids so the
// UI and the engine can point at a single copy on the board.
export function makeCard(defId, game) {
  const def = DEF_BY_ID[defId];
  const card = {
    uid: game.nextUid,
    defId: def.id,
    name: def.name,
    house: def.house,
    type: def.type,
    cost: def.cost,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    text: def.text,
    justPlayed: false,
    canAttack: false,
  };
  game.nextUid += 1;
  return card;
}

// A fresh thirty-card deck: two copies of every design, shuffled with the
// game's seeded rng. The caller advances game.nextUid through makeCard.
export function buildDeck(rng, game) {
  const ids = [];
  for (const def of CARD_DEFS) ids.push(def.id, def.id);
  shuffle(ids, rng);
  return ids.map((id) => makeCard(id, game));
}
