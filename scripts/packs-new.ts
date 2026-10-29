// Starts the next version of a pack: copies the newest vN.json to v(N+1).json with "version" bumped.
// Usage: npm run packs:new -- <pack-id>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVersions } from './packs-lib';

const id = process.argv[2];
if (!id) { console.error('Cách dùng: npm run packs:new -- <id-gói>'); process.exit(1); }
const dir = join('packs-src', id);
const latest = loadVersions(dir, id).at(-1)!;
const next = latest.manifest.version + 1;
const text = readFileSync(join(dir, `v${latest.manifest.version}.json`), 'utf8').replace(/("version"\s*:\s*)\d+/, `$1${next}`);
writeFileSync(join(dir, `v${next}.json`), text);
console.log(`✔ Đã tạo ${dir}/v${next}.json. Hãy sửa nội dung trong file đó rồi chạy: npm run packs:build`);
