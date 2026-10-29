// Command: npm run packs:build -- [packs-src] [out]   (logic lives in packs-lib.ts)
import { buildPacks } from './packs-lib';

const [src = 'packs-src', out = 'dist-packs'] = process.argv.slice(2);
try {
  const c = buildPacks(src, out);
  console.log(`✔ Đã tạo ${c.packs.length} file gói trong "${out}/" (kèm catalog.json)`);
  for (const e of c.packs) console.log(`  ${e.base ? '↳ cập nhật' : '• đầy đủ  '} ${e.url}  (${e.size} byte)`);
} catch (e) {
  console.error(`✘ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
