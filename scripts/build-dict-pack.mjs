// Usage:
//   node scripts/build-dict-pack.mjs --jmdict jmdict-eng-common.json [--kanjidic kanjidic2-en.json]
//        [--jlpt-dir dir-with-n1.csv..n5.csv] [--freq words-by-frequency.txt] [--all-words] --version 1 --out dist-packs
// Then: node scripts/build-catalog.mjs dist-packs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildPacks, parseJlptCsv } from './dict-convert.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
  return acc;
}, []));
if (!args.jmdict && !args.kanjidic) { console.error('Cần ít nhất --jmdict hoặc --kanjidic'); process.exit(1); }

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const jlptRows = [];
if (args['jlpt-dir']) {
  for (const n of [1, 2, 3, 4, 5]) {
    const f = join(args['jlpt-dir'], `n${n}.csv`);
    if (existsSync(f)) jlptRows.push(...parseJlptCsv(readFileSync(f, 'utf8'), n));
  }
}
const packs = buildPacks({
  jmdict: args.jmdict && readJson(args.jmdict),
  kanjidic: args.kanjidic && readJson(args.kanjidic),
  jlptRows,
  freqWords: args.freq ? readFileSync(args.freq, 'utf8').split(/\r?\n/).map((l) => l.split('\t')[0]).filter(Boolean) : undefined,
  version: Number(args.version ?? 1),
  commonOnly: !args['all-words']
});
const out = args.out ?? 'dist-packs';
mkdirSync(out, { recursive: true });
for (const [id, pack] of Object.entries(packs)) {
  writeFileSync(join(out, `${id}.pack.json`), JSON.stringify(pack));
  const counts = Object.entries(pack.upserts).map(([c, r]) => `${r.length} ${c}`).join(', ');
  console.log(`${id}.pack.json: ${counts}`);
}
