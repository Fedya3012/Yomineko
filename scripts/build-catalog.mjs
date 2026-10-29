// Scans a folder of *.pack.json files and writes catalog.json next to them.
// Usage: node scripts/build-catalog.mjs packs-example
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'packs-example';
const packs = readdirSync(dir).filter((f) => f.endsWith('.pack.json')).map((file) => {
  const bytes = readFileSync(join(dir, file));
  const { manifest } = JSON.parse(bytes.toString('utf8'));
  return { id: manifest.id, version: manifest.version, base: manifest.base, url: file,
    sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
});
writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ format: 1, generatedAt: new Date().toISOString(), packs }, null, 2));
console.log(`catalog.json: ${packs.length} pack(s)`);
