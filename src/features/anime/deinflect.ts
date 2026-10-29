// Tiny rule-based de-inflection: turn "食べました" / "高くなかった" back into dictionary forms to look up.
// Not a full grammar engine; it covers the common endings so subtitles hit the dictionary.
// Candidates are only trusted when the dictionary actually contains them.
type Rule = [suffix: string, replacement: string];

const ICHIDAN: Rule[] = [
  ['ませんでした', 'る'], ['ました', 'る'], ['ません', 'る'], ['ます', 'る'],
  ['ている', 'る'], ['ていた', 'る'], ['てい', 'る'], ['なかった', 'る'], ['ない', 'る'], ['られ', 'る'], ['させ', 'る'],
  ['た', 'る'], ['て', 'る'], ['ろ', 'る'], ['よう', 'る']
];

// godan: [inflected ending, dictionary ending]
const GODAN: Rule[] = [
  ['いた', 'く'], ['いて', 'く'], ['かない', 'く'], ['きます', 'く'], ['きました', 'く'], ['けば', 'く'], ['こう', 'く'],
  ['いだ', 'ぐ'], ['いで', 'ぐ'], ['がない', 'ぐ'], ['ぎます', 'ぐ'], ['ぎました', 'ぐ'],
  ['した', 'す'], ['して', 'す'], ['さない', 'す'], ['します', 'す'], ['しました', 'す'], ['せば', 'す'], ['そう', 'す'],
  ['った', 'う'], ['って', 'う'], ['わない', 'う'], ['います', 'う'], ['いました', 'う'], ['おう', 'う'],
  ['った', 'つ'], ['って', 'つ'], ['たない', 'つ'], ['ちます', 'つ'], ['ちました', 'つ'],
  ['った', 'る'], ['って', 'る'], ['らない', 'る'], ['ります', 'る'], ['りました', 'る'], ['れば', 'る'], ['ろう', 'る'],
  ['んだ', 'む'], ['んで', 'む'], ['まない', 'む'], ['みます', 'む'], ['みました', 'む'], ['もう', 'む'],
  ['んだ', 'ぶ'], ['んで', 'ぶ'], ['ばない', 'ぶ'], ['びます', 'ぶ'], ['びました', 'ぶ'],
  ['んだ', 'ぬ'], ['んで', 'ぬ'], ['なない', 'ぬ'], ['にます', 'ぬ']
];

const ADJ_I: Rule[] = [
  ['くなかった', 'い'], ['くない', 'い'], ['かった', 'い'], ['くて', 'い'], ['く', 'い'], ['さ', 'い'], ['そう', 'い']
];

const IRREGULAR: Rule[] = [
  ['しました', 'する'], ['します', 'する'], ['しない', 'する'], ['して', 'する'], ['した', 'する'], ['している', 'する'], ['しよう', 'する'],
  ['きました', 'くる'], ['きます', 'くる'], ['こない', 'くる'], ['きて', 'くる'], ['きた', 'くる'],
  ['来ました', '来る'], ['来ます', '来る'], ['来ない', '来る'], ['来て', '来る'], ['来た', '来る'],
  ['じゃない', 'だ'], ['ではない', 'だ'], ['だった', 'だ'], ['でした', 'だ'], ['です', 'だ']
];

/** Candidate dictionary forms for `surface`, most specific first. Always includes `surface` itself. */
export function deinflect(surface: string): string[] {
  const out = [surface];
  const seen = new Set(out);
  for (const rules of [IRREGULAR, ICHIDAN, GODAN, ADJ_I]) {
    for (const [suffix, repl] of rules) {
      if (surface.endsWith(suffix)) {
        const stem = surface.slice(0, -suffix.length);
        if (!stem && rules !== IRREGULAR) continue;
        const cand = stem + repl;
        if (!seen.has(cand)) { seen.add(cand); out.push(cand); }
      }
    }
  }
  return out;
}
