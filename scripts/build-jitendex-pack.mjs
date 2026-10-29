// Usage: node scripts/build-jitendex-pack.mjs --zip jitendex-yomitan.zip [--version N] [--out packs-src]
// Without --version the number comes from Jitendex's own release date (2026.10.03.0 -> 20261003), which only ever grows.
// The zip is the official Yomitan release: https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip
// Writes <out>/dict-jitendex/v<version>.json; `npm run packs:build -- <out> dist-packs` then adds it to the catalog.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { buildJitendexPack } from './jitendex-convert.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
  return acc;
}, []));
if (!args.zip) { console.error('Cần --zip jitendex-yomitan.zip'); process.exit(1); }

const files = unzipSync(new Uint8Array(readFileSync(args.zip)), { filter: (f) => /(^|\/)(term_bank_\d+|index)\.json$/.test(f.name) });
const index = files['index.json'] ? JSON.parse(strFromU8(files['index.json'])) : {};
const version = args.version && args.version !== true ? Number(args.version) : Number(String(index.revision ?? '').split('.').slice(0, 3).join(''));
if (!Number.isInteger(version) || version < 1) { console.error('Không đọc được số phiên bản; thêm --version N'); process.exit(1); }
const rows = [];
for (const name of Object.keys(files).filter((n) => n !== 'index.json').sort()) for (const row of JSON.parse(strFromU8(files[name]))) rows.push(row);

const pack = buildJitendexPack({ rows, version });
const dir = join(args.out ?? 'packs-src', 'dict-jitendex');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `v${pack.manifest.version}.json`), JSON.stringify(pack));
console.log(`dict-jitendex/v${pack.manifest.version}.json: ${pack.upserts.jitendex.length} từ`);
