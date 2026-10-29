// Local database (IndexedDB). Works offline in browser, PWA, Tauri and Capacitor alike.
//
// Three stores, deliberately separated so a content update can never touch the learner's progress:
//   packs    : which content packs are installed (id -> version, license, ...)
//   records  : content rows, key = [collection, id], tagged with the pack that owns them
//   userdata : the learner's own data (SRS state, progress, settings) as key/value
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { License, PackKind, RecordData } from './packs/format';

export interface InstalledPack {
  id: string; kind: PackKind; title: string; version: number; license: License; installedAt: number;
}
export interface StoredRecord { collection: string; id: string; packId: string; data: RecordData }

interface YominekoDB extends DBSchema {
  packs: { key: string; value: InstalledPack };
  records: {
    key: [string, string];
    value: StoredRecord;
    indexes: { byPack: string; byCollection: string };
  };
  userdata: { key: string; value: unknown };
}

export type DB = IDBPDatabase<YominekoDB>;
export const DB_NAME = 'yomineko';
export const DB_VERSION = 1;

export function openDatabase(name = DB_NAME): Promise<DB> {
  return openDB<YominekoDB>(name, DB_VERSION, {
    upgrade(db) {
      // Future schema changes: add `if (oldVersion < 2) {...}` blocks here, never edit the v1 block.
      db.createObjectStore('packs', { keyPath: 'id' });
      const records = db.createObjectStore('records', { keyPath: ['collection', 'id'] });
      records.createIndex('byPack', 'packId');
      records.createIndex('byCollection', 'collection');
      db.createObjectStore('userdata');
    }
  });
}

/** Read helpers that feature threads can use directly. */
export const getRecord = (db: DB, collection: string, id: string) =>
  db.get('records', [collection, id]).then((r) => r?.data);

export const listCollection = (db: DB, collection: string) =>
  db.getAllFromIndex('records', 'byCollection', collection).then((rows) => rows.map((r) => r.data));

export const getUserData = <T>(db: DB, key: string) => db.get('userdata', key) as Promise<T | undefined>;
export const setUserData = (db: DB, key: string, value: unknown) => db.put('userdata', value, key);
