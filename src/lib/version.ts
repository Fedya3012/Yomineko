// Tiny semver helpers ("0.2.0" style, with an optional leading "v"). Enough for app/tag versions.

const parse = (v: string): number[] | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export const isVersion = (v: string) => parse(v) !== null;

/** <0 if a<b, 0 if equal, >0 if a>b. Throws on text that is not a version. */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) throw new Error(`Số phiên bản không hợp lệ: "${pa ? b : a}"`);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}
