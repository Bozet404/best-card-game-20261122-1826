// DOM builders for Ember Pact cards and ember pips. Pure presentational
// helpers: the engine owns the state, main.js owns the wiring, this file
// only turns a card object into the element the player sees and clicks.

import { HOUSES } from './cards.js';

// One card face. Hand cards carry their hand index (data-index) so a click
// can be routed back to the hand; board creatures carry their uid.
// A sick creature (just played) wears a "Z" badge at the top centre —
// never over the house label, which sits at the top left.
export function cardElement(card, opts = {}) {
  const house = HOUSES[card.house];
  const el = document.createElement('div');
  el.className = 'card house-' + card.house
    + (opts.selected ? ' selected' : '')
    + (opts.attacker ? ' attacker' : '')
    + (opts.targetable ? ' targetable' : '')
    + (card.justPlayed ? ' sick' : '')
    + (opts.disabled ? ' disabled' : '');
  if (opts.index !== undefined) el.dataset.index = String(opts.index);
  if (card.uid !== undefined) el.dataset.uid = String(card.uid);

  const cost = document.createElement('div');
  cost.className = 'cost';
  cost.textContent = String(card.cost);
  el.appendChild(cost);

  const houseLine = document.createElement('div');
  houseLine.className = 'house-line';
  houseLine.style.color = house.color;
  houseLine.textContent = house.glyph + ' ' + house.name;
  el.appendChild(houseLine);

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = card.name;
  el.appendChild(name);

  const art = document.createElement('div');
  art.className = 'art';
  art.style.color = house.color;
  art.textContent = house.glyph;
  el.appendChild(art);

  if (card.type === 'creature') {
    const stats = document.createElement('div');
    stats.className = 'stats';
    const atk = document.createElement('span');
    atk.className = 'atk';
    atk.textContent = '⚔ ' + card.attack;
    const hp = document.createElement('span');
    hp.className = 'hp';
    hp.textContent = '❤ ' + card.health;
    stats.appendChild(atk);
    stats.appendChild(hp);
    el.appendChild(stats);
  } else {
    const spell = document.createElement('div');
    spell.className = 'spell-text';
    spell.textContent = card.text;
    el.appendChild(spell);
  }

  if (card.justPlayed) {
    const badge = document.createElement('div');
    badge.className = 'sick-badge';
    badge.textContent = 'Z';
    badge.title = 'Summoning sickness — attacks next turn';
    el.appendChild(badge);
  }
  return el;
}

// Ten ember pips; filled ones show how much ember is banked right now.
export function pipsElement(current, max) {
  const wrap = document.createElement('div');
  wrap.className = 'pips';
  for (let i = 0; i < 10; i += 1) {
    const pip = document.createElement('span');
    pip.className = 'pip' + (i < current ? ' on' : '') + (i < max ? '' : ' locked');
    pip.textContent = '●';
    wrap.appendChild(pip);
  }
  const label = document.createElement('span');
  label.className = 'pips-label';
  label.textContent = `${current} / ${max} ember`;
  wrap.appendChild(label);
  return wrap;
}
