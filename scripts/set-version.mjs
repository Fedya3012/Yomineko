// Makes the app's own version match the release tag, so the "new version" notice does not nag after updating.
// Usage: node scripts/set-version.mjs v0.2.0
import { readFileSync, writeFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('Cần số phiên bản dạng v1.2.3'); process.exit(1); }
for (const file of ['package.json', 'src-tauri/tauri.conf.json']) {
  const text = readFileSync(file, 'utf8').replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  writeFileSync(file, text);
}
console.log(`Phiên bản app = ${version}`);
