export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type Style = 'gentle' | 'cheerful' | 'strict';
export type AssistMode = 'chat' | 'grammar' | 'correct' | 'roleplay';
export type ProviderKind = 'anthropic' | 'openai-compatible' | 'webllm';

export interface ChatMessage { role: 'user' | 'assistant'; text: string; source?: 'ai' | 'offline' }

export interface ProviderConfig { kind: ProviderKind; baseUrl: string; model: string }

/** Consent is bound to ONE host: changing the endpoint makes it invalid until the user opts in again. */
export interface Consent { aiSend: true; host: string; at: string }

export interface AssistantSettings {
  personaId: string;
  customName: string;
  style: Style;
  level: Level;
  useAi: boolean;
  provider: ProviderConfig;
  consent?: Consent;
  /** RAM the user told us (or the browser reported), used to label which models fit. */
  deviceRamGb?: number;
}

export interface RoleplayState { scenarioId: string; step: number; done: boolean }
