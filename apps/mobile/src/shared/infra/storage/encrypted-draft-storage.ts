import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { DEVICE_SECURE_STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
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
const DRAFT_ENCRYPTION_KEY_STORAGE_KEY = DEVICE_SECURE_STORAGE_KEYS.DRAFT_ENCRYPTION_KEY;

type EncryptedSyncStorage = EnumerableSyncStorage & ObservableSyncStorage;

export interface EncryptedStorageBootstrap {
  /** 암호화 저장소를 열지 못하면 이번 실행 동안만 메모리에 두는 저장소다. 기기의 초안은 보이지 않는다 */
  draftStorage: EncryptedSyncStorage;
  /** 조회 캐시 저장소. 암호화 저장소를 열지 못하면 `null`이고 캐시를 기기에 남기지 않는다. */
  queryCacheStorage: EnumerableSyncStorage | null;
  /** 암호화 저장소를 열지 못해 초안을 메모리에만 두고 조회 캐시 저장을 끈 사유. 정상이면 없다. */
  failure?: unknown;
}

/** 저장소를 열지 못한 실행에서 끝난 세션의 값. 열기 전에 인스턴스째 지운다 */
interface DiscardedSessionStorage {
  queryCache: boolean;
  drafts: boolean;
}

/** 키를 읽지 못한 실행(재부팅 뒤 잠금 해제 전 깨어남)의 초안 저장소. 버리지 않고 이번 실행 동안 들고 있어 쓰던 글자와 말로 메모가 화면을 옮겨도 남는다 */
function createSessionDraftStorage(): EncryptedSyncStorage {
  const values = new Map<string, string>();
  const listenersByKey = new Map<string, Set<() => void>>();
  const notify = (key: string) => listenersByKey.get(key)?.forEach((listener) => listener());

  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      notify(key);
    },
    remove: (key) => {
      values.delete(key);
      notify(key);
    },
    keys: () => [...values.keys()],
    clear: () => {
      const keys = [...values.keys()];
      values.clear();
      keys.forEach(notify);
    },
    subscribe: (key, listener) => {
      const listeners = listenersByKey.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByKey.set(key, listeners);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

async function resolveEncryptionKey(secureStorage: KeyValueStorage) {
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
    clear: () => {
      mmkv.clearAll();
      // 지운 계정 값이 파일의 빈 공간에 남지 않게 파일을 줄인다
      mmkv.trim();
    },
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

/** 암호화 전 평문 MMKV `aido.drafts`의 초안을 옮기고 그 저장소를 지운다. 1.16.0에서 지운다(compatibility.md) */
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

/** SecureStore 조회가 비동기라 스플래시 구간에서 미리 호출해야 초안·캐시 복원이 첫 렌더에 동기로 읽힌다. 실패해도 기기 저장만 끈다 */
export async function openEncryptedStorage(
  secureStorage: KeyValueStorage,
  discarded: DiscardedSessionStorage | null,
): Promise<EncryptedStorageBootstrap> {
  try {
    const { key, isNew } = await resolveEncryptionKey(secureStorage);
    // 새 키로는 이전 키로 암호화한 파일을 읽을 수 없다. 끝난 세션의 값은 복원 전에 지운다
    if (isNew || discarded?.drafts === true) {
      deleteMMKV(DRAFT_STORAGE_ID);
    }
    if (isNew || discarded?.queryCache === true) {
      deleteMMKV(QUERY_CACHE_STORAGE_ID);
    }

    const draftStorage = openEncryptedMmkv(DRAFT_STORAGE_ID, key);
    migrateLegacyDrafts(draftStorage);

    return { draftStorage, queryCacheStorage: openEncryptedMmkv(QUERY_CACHE_STORAGE_ID, key) };
  } catch (failure) {
    return { draftStorage: createSessionDraftStorage(), queryCacheStorage: null, failure };
  }
}
