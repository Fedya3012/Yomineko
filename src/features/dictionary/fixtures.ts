// Test helper: loads the sample pack that ships in packs-example/ as an index.
import sample from '../../../packs-example/dict-sample.pack.json';
import { DictionaryIndex } from './index';
import type { Word } from './types';

export const samplePack = sample;
export const sampleWords = sample.upserts.words as unknown as Word[];
export const sampleIndex = () => new DictionaryIndex(sampleWords);
