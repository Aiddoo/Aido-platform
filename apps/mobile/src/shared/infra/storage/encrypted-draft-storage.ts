import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { Storage } from '@src/core/ports/storage';
import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { noop } from 'es-toolkit';
import { getRandomBytes } from 'expo-crypto';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';
import { z } from 'zod';

import {
  createDraftEncryptionKey,
  DRAFT_ENCRYPTION_KEY_BYTE_LENGTH,
  isDraftEncryptionKey,
} from './draft-encryption-key';

// 초안만 담는 인스턴스로 분리해 로그아웃 시 다른 설정을 건드리지 않고 한 번에 비운다.
const DRAFT_STORAGE_ID = 'aido.drafts.encrypted';
// 암호화 이전 평문 인스턴스. 내용을 옮긴 뒤 파일째 삭제한다.
const LEGACY_DRAFT_STORAGE_ID = 'aido.drafts';
// 오프라인 복원용 조회 캐시. 초안과 같은 키를 쓰되 인스턴스를 나눠 초안 정리가 캐시를 건드리지 않게 한다.
const QUERY_CACHE_STORAGE_ID = 'aido.query-cache.encrypted';
// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const DRAFT_ENCRYPTION_KEY_STORAGE_KEY = 'aido_draft_encryption_key';

type EncryptedSyncStorage = EnumerableSyncStorage & ObservableSyncStorage;

export interface EncryptedStorageBootstrap {
  draftStorage: EncryptedSyncStorage;
  /** 조회 캐시 저장소. 암호화 저장소를 열지 못하면 `null`이고 캐시를 기기에 남기지 않는다. */
  queryCacheStorage: SyncStorage | null;
  /** 암호화 저장소를 열지 못해 초안·조회 캐시 저장을 끈 사유. 정상이면 없다. */
  failure?: unknown;
}

/** 초안 기능을 끈 상태. 저장은 버리고 복원은 항상 비어 있어 폼은 빈 값으로 동작한다. */
export const disabledDraftStorage: EncryptedSyncStorage = {
  get: () => undefined,
  set: () => undefined,
  remove: () => undefined,
  keys: () => [],
  clear: () => undefined,
  subscribe: () => noop,
};

async function resolveEncryptionKey(secureStorage: Storage) {
  const storedKey = await secureStorage.get(DRAFT_ENCRYPTION_KEY_STORAGE_KEY, z.string());
  if (isDraftEncryptionKey(storedKey)) {
    return { key: storedKey, isNew: false };
  }

  const key = createDraftEncryptionKey(getRandomBytes(DRAFT_ENCRYPTION_KEY_BYTE_LENGTH));
  await secureStorage.set(DRAFT_ENCRYPTION_KEY_STORAGE_KEY, key);

  return { key, isNew: true };
}

function openEncryptedMmkv(id: string, key: string) {
  return toEncryptedSyncStorage(createMMKV({ id, encryptionKey: key, encryptionType: 'AES-256' }));
}

function toEncryptedSyncStorage(mmkv: ReturnType<typeof createMMKV>): EncryptedSyncStorage {
  return {
    get: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    remove: (key) => mmkv.remove(key),
    keys: () => mmkv.getAllKeys(),
    clear: () => mmkv.clearAll(),
    subscribe: (key, listener) => {
      const subscription = mmkv.addOnValueChangedListener((changedKey) => {
        if (changedKey === key) {
          listener();
        }
      });
      return () => subscription.remove();
    },
  };
}

function migrateLegacyDrafts(target: EnumerableSyncStorage) {
  if (!existsMMKV(LEGACY_DRAFT_STORAGE_ID)) {
    return;
  }

  try {
    const legacy = createMMKV({ id: LEGACY_DRAFT_STORAGE_ID });
    for (const key of legacy.getAllKeys()) {
      const value = legacy.getString(key);
      if (value != null) {
        target.set(key, value);
      }
    }
  } finally {
    // 복사에 실패해도 평문 저장소는 지운다. 옮기지 못한 초안보다 평문 초안을 기기에 남기지 않는 쪽이 우선이다
    deleteMMKV(LEGACY_DRAFT_STORAGE_ID);
  }
}

/** SecureStore 조회가 비동기라 스플래시 구간에서 미리 호출해야 초안·캐시 복원이 첫 렌더에 동기로 읽힌다. 실패해도 저장만 끈다 */
export async function openEncryptedStorage(
  secureStorage: Storage,
): Promise<EncryptedStorageBootstrap> {
  try {
    const { key, isNew } = await resolveEncryptionKey(secureStorage);
    if (isNew) {
      // 새 키로는 이전 키로 암호화한 파일을 읽을 수 없다
      deleteMMKV(DRAFT_STORAGE_ID);
      deleteMMKV(QUERY_CACHE_STORAGE_ID);
    }

    const draftStorage = openEncryptedMmkv(DRAFT_STORAGE_ID, key);
    migrateLegacyDrafts(draftStorage);

    return { draftStorage, queryCacheStorage: openEncryptedMmkv(QUERY_CACHE_STORAGE_ID, key) };
  } catch (failure) {
    return { draftStorage: disabledDraftStorage, queryCacheStorage: null, failure };
  }
}
