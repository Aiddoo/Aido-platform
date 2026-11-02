import type { Storage } from '@src/core/ports/storage';
import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
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
const DRAFT_ENCRYPTION_KEY_STORAGE_KEY = 'aido_draft_encryption_key';

export interface EncryptedStorageBootstrap {
  draftStorage: EnumerableSyncStorage;
  /** 조회 캐시 저장소. 암호화 저장소를 열지 못하면 `null`이고 캐시를 기기에 남기지 않는다. */
  queryCacheStorage: SyncStorage | null;
  /** 암호화 저장소를 열지 못해 초안·조회 캐시 저장을 끈 사유. 정상이면 없다. */
  failure?: unknown;
}

/** 초안 기능을 끈 상태. 저장은 버리고 복원은 항상 비어 있어 폼은 빈 값으로 동작한다. */
export const disabledDraftStorage: EnumerableSyncStorage = {
  getString: () => undefined,
  set: () => undefined,
  delete: () => undefined,
  getAllKeys: () => [],
  clearAll: () => undefined,
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
  return toEnumerableSyncStorage(createMMKV({ id, encryptionKey: key, encryptionType: 'AES-256' }));
}

function toEnumerableSyncStorage(mmkv: ReturnType<typeof createMMKV>): EnumerableSyncStorage {
  return {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    delete: (key) => mmkv.remove(key),
    getAllKeys: () => mmkv.getAllKeys(),
    clearAll: () => mmkv.clearAll(),
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
    deleteMMKV(LEGACY_DRAFT_STORAGE_ID);
  }
}

/**
 * 키는 SecureStore에 최초 1회 만들어 보관하고, 같은 키로 초안·조회 캐시 MMKV(AES-256) 인스턴스를 연다.
 * SecureStore 조회가 비동기라 앱 부트스트랩(스플래시 유지 구간)에서 미리 호출해야
 * 초안 화면과 조회 캐시 복원이 첫 렌더에 동기로 읽을 수 있다. 실패해도 앱은 정상 동작하도록 저장만 끈다.
 */
export async function openEncryptedMmkvStorage(
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
