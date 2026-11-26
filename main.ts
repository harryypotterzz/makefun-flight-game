// Nusantara Skies — Island Hopper: the entry program (Node 22, standard library only).
//
// It hands the game in: it copies game/ and screenshots/ from beside this file
// into the output directory and writes output/dossier.json with the vendored
// make.fun library, exactly the summary the judge reads.
//
// The output directory is a mount point for the grader (it runs as an
// unprivileged user), so this program never deletes the directory itself:
// it creates it when missing and clears only its contents, then writes
// into it. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory when it is missing; otherwise empty it out
// entry by entry, leaving the directory itself in place.
if (!existsSync(out)) {
  mkdirSync(out, { recursive: true });
} else {
  for (const entry of readdirSync(out)) {
    rmSync(join(out, entry), { recursive: true, force: true });
  }
}

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
