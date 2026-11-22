// Ember Pact — the entrypoint handed to make.fun. It gathers the game
// (game/) and its four screenshots (screenshots/) from beside this file,
// drops them into the output directory, and writes the dossier.json the
// judge reads. Run it with plain node (Node 22+, standard library only):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
const shotSrc = join(here, 'screenshots');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotSrc)) {
  cpSync(shotSrc, join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: four screenshots at most, each under 256 KiB; the
// game itself under 993 files / 48 MiB with no path over 1000 bytes; the
// dossier text under 160 KiB. Anything over those lines is refused, so
// the same limits are enforced here before handing in.
//
// Fail fast with a plain message when the entry is incomplete, instead of
// letting the dossier builder throw a cryptic error halfway through.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('Ember Pact: game/index.html is missing — nothing to hand in.');
}
const shots = existsSync(shotSrc)
  ? readdirSync(shotSrc).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
  : [];
if (shots.length < 3) {
  throw new Error(`Ember Pact: only ${shots.length} screenshot(s) found, need at least 3.`);
}
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Ember Pact dossier written to ${join(outDir, 'dossier.json')}`);
