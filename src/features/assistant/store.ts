import { getUserData, setUserData, type DB } from '../../lib/db';
import { PROVIDER_PRESETS } from './ai';
import { DEFAULT_PERSONA_ID } from './personas';
import type { AssistantSettings, ChatMessage } from './types';

const K = { settings: 'assistant.settings', key: 'assistant.apikey', history: 'assistant.history' };
export const MAX_HISTORY = 100;

const { label: _label, ...defaultProvider } = PROVIDER_PRESETS.ollama;

/** AI is OFF by default: a fresh install never contacts any server. */
export const DEFAULT_ASSISTANT: AssistantSettings = {
  personaId: DEFAULT_PERSONA_ID, customName: '', style: 'gentle', level: 'N5', useAi: false, provider: defaultProvider
};

export async function loadAssistant(db: DB): Promise<{ settings: AssistantSettings; apiKey: string; history: ChatMessage[] }> {
  const saved = await getUserData<Partial<AssistantSettings>>(db, K.settings);
  return {
    settings: { ...DEFAULT_ASSISTANT, ...saved, provider: { ...defaultProvider, ...saved?.provider } },
    apiKey: (await getUserData<string>(db, K.key)) ?? '',
    history: (await getUserData<ChatMessage[]>(db, K.history)) ?? []
  };
}

export const saveAssistantSettings = (db: DB, s: AssistantSettings) => setUserData(db, K.settings, s);
export const saveApiKey = (db: DB, key: string) => setUserData(db, K.key, key);
export const saveHistory = (db: DB, h: ChatMessage[]) => setUserData(db, K.history, h.slice(-MAX_HISTORY));

/** One tap to wipe everything the assistant stored (chat, key, consent). */
export async function clearAssistantData(db: DB) {
  await Promise.all(Object.values(K).map((k) => db.delete('userdata', k)));
}
