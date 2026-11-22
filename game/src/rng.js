// Seeded randomness for Ember Pact. mulberry32 is a tiny deterministic
// generator: the same seed always deals the same hands, so screenshots and
// tests are reproducible. No browser APIs are used here, so the node test
// suite can import this module directly.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// In-place Fisher-Yates shuffle driven by the given rng.
export function shuffle(deck, rng) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}
