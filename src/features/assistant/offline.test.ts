import { describe, it, expect } from 'vitest';
import { checkSentence, offlineChat, offlineCorrect, offlineGrammar, offlineRoleplay, roleplayOpening } from './offline';
import { SCENARIOS } from './scenarios';

const first = () => 0;

describe('offline grammar', () => {
  it('explains a particle by keyword', () => {
    expect(offlineGrammar('は là gì?')).toContain('chủ đề');
  });
  it('lists topics when nothing matches', () => {
    expect(offlineGrammar('xyz')).toContain('•');
  });
});

describe('offline sentence checking', () => {
  it('fixes を with 好き', () => {
    expect(checkSentence('猫を好きです。').corrected).toBe('猫が好きです。');
  });
  it('fixes dictionary verb + です', () => {
    expect(checkSentence('毎日食べるです。').corrected).toBe('毎日食べます。');
  });
  it('fixes な-adjective with extra い and い-adjective with extra な', () => {
    expect(checkSentence('きれいいです').corrected).toBe('きれいです');
    expect(checkSentence('おいしいな食べ物').corrected).toBe('おいしい食べ物');
    expect(checkSentence('おいしいなあ').corrected).toBe('おいしいなあ');
  });
  it('replaces latin punctuation', () => {
    expect(checkSentence('私は学生です.').corrected).toBe('私は学生です。');
  });
  it('praises a correct sentence and says it has limits', () => {
    const r = offlineCorrect('私は学生です。', 'gentle', first);
    expect(r).toContain('không thấy lỗi');
  });
  it('reports corrected sentence and tips', () => {
    const r = offlineCorrect('猫を好きです。', 'strict', first);
    expect(r).toContain('猫が好きです。');
    expect(r).toContain('•');
  });
});

describe('offline chat', () => {
  it('answers greetings', () => {
    expect(offlineChat('おはよう', 'cheerful', first)).toContain('おはようございます');
  });
  it('encourages and points to other modes otherwise', () => {
    expect(offlineChat('hmm', 'gentle', first)).toContain('offline');
  });
});

describe('offline role-play', () => {
  it('walks every scenario to completion', () => {
    for (const sc of SCENARIOS) {
      let { state } = roleplayOpening(sc.id);
      for (const t of sc.turns) {
        const r = offlineRoleplay(t.model, state, 'gentle', first);
        state = r.state;
      }
      expect(state.done).toBe(true);
    }
  });
  it('gives the model answer when the reply is off', () => {
    const { state } = roleplayOpening('konbini');
    const r = offlineRoleplay('banana', state, 'gentle', first);
    expect(r.text).toContain('Câu mẫu');
    expect(r.state.step).toBe(1);
  });
  it('refuses to continue once finished', () => {
    expect(() => offlineRoleplay('はい', { scenarioId: 'konbini', step: 3, done: true }, 'gentle')).toThrow();
  });
});
