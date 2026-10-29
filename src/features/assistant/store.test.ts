import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, type DB } from '../../lib/db';
import { clearAssistantData, loadAssistant, saveApiKey, saveAssistantSettings, saveHistory, DEFAULT_ASSISTANT, MAX_HISTORY } from './store';
import { grantConsent } from './assistant';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`assistant-test-${n++}`); });

describe('assistant store', () => {
  it('starts with AI off and defaults', async () => {
    const { settings, apiKey, history } = await loadAssistant(db);
    expect(settings).toEqual(DEFAULT_ASSISTANT);
    expect(apiKey).toBe('');
    expect(history).toEqual([]);
  });
  it('round-trips settings, consent and key; caps history', async () => {
    await saveAssistantSettings(db, grantConsent({ ...DEFAULT_ASSISTANT, useAi: true, personaId: 'kitsune' }));
    await saveApiKey(db, 'sk-x');
    await saveHistory(db, Array.from({ length: MAX_HISTORY + 20 }, (_, i) => ({ role: 'user' as const, text: String(i) })));
    const r = await loadAssistant(db);
    expect(r.settings.personaId).toBe('kitsune');
    expect(r.settings.consent?.aiSend).toBe(true);
    expect(r.apiKey).toBe('sk-x');
    expect(r.history).toHaveLength(MAX_HISTORY);
  });
  it('clear wipes chat, key and consent', async () => {
    await saveAssistantSettings(db, grantConsent({ ...DEFAULT_ASSISTANT, useAi: true }));
    await saveApiKey(db, 'sk-x');
    await clearAssistantData(db);
    const r = await loadAssistant(db);
    expect(r.apiKey).toBe('');
    expect(r.settings.consent).toBeUndefined();
  });
});
