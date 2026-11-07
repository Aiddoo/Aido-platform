import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { QUERY_CACHE_MAX_AGE_MS } from '@src/shared/constants/query-persistence';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

// ⚠️ 영속 계약: 이미 저장된 캐시를 가리키므로 이름을 바꾸면 기존 캐시를 한 번 잃는다
export const QUERY_CACHE_STORAGE_KEY = 'aido.query-cache';
const QUERY_CACHE_OWNER_KEY = 'aido.query-cache.owner';

/** 저장한 클라이언트 모델의 모양이 바뀌면 올려 이전 캐시를 버린다 */
const QUERY_CACHE_SCHEMA_VERSION = 5;

/** persister가 쓰는 저장소. 캐시는 주인(사용자 id)별 키에 두고, 주인이 없으면 읽지도 쓰지도 않는다 */
export interface QueryCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 로그인한 사용자를 캐시 주인으로 정한다. 주인이 바뀌면 이전 주인의 캐시를 지운다 */
  setOwner(userId: string): void;
  /** 캐시와 주인을 모두 지운다. 로그아웃·세션 만료 때 부른다 */
  clear(): void;
}

/** 암호화 저장소를 열지 못했을 때. 캐시를 기기에 남기지 않고 주인 지정·삭제도 할 일이 없다 */
export const disabledQueryCacheStorage: QueryCacheStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  setOwner: () => undefined,
  clear: () => undefined,
};

export const createQueryCacheStorage = (storage: SyncStorage): QueryCacheStorage => {
  const ownedKey = (key: string, ownerId = storage.get(QUERY_CACHE_OWNER_KEY)) =>
    ownerId == null ? null : `${key}:${encodeURIComponent(ownerId)}`;

  const removeOwnedCache = (ownerId: string | undefined) => {
    const key = ownedKey(QUERY_CACHE_STORAGE_KEY, ownerId);
    if (key != null) {
      storage.remove(key);
    }
  };

  return {
    getItem: (key) => {
      const owned = ownedKey(key);
      return owned == null ? null : (storage.get(owned) ?? null);
    },
    setItem: (key, value) => {
      const owned = ownedKey(key);
      if (owned != null) {
        storage.set(owned, value);
      }
    },
    removeItem: (key) => {
      const owned = ownedKey(key);
      if (owned != null) {
        storage.remove(owned);
      }
    },
    setOwner: (userId) => {
      const previousOwnerId = storage.get(QUERY_CACHE_OWNER_KEY);
      if (previousOwnerId === userId) {
        return;
      }
      removeOwnedCache(previousOwnerId);
      storage.set(QUERY_CACHE_OWNER_KEY, userId);
    },
    clear: () => {
      removeOwnedCache(storage.get(QUERY_CACHE_OWNER_KEY));
      storage.remove(QUERY_CACHE_OWNER_KEY);
    },
  };
};

/** 암호화 이전에 기본 MMKV에 평문으로 남긴 캐시와 주인을 지운다 */
export const removePlaintextQueryCache = (
  storage: Pick<EnumerableSyncStorage, 'keys' | 'remove'>,
): void => {
  for (const key of storage.keys()) {
    if (key === QUERY_CACHE_OWNER_KEY || key.startsWith(`${QUERY_CACHE_STORAGE_KEY}:`)) {
      storage.remove(key);
    }
  }
};

/** 성공한 조회 중 opt-in한 것만 저장한다. 실패·대기 중인 조회와 opt-in하지 않은 조회는 남기지 않는다 */
export const shouldPersistQuery = (query: Query): boolean =>
  defaultShouldDehydrateQuery(query) && query.meta?.persist === true;

/**
 * 앱 버전이 바뀌면 모델 모양이 달라질 수 있어 캐시를 버린다.
 * 날씨·알림·AI 결과처럼 서버가 표시 언어로 만든 값도 담겨, 다른 언어로 저장한 캐시도 복원하지 않는다
 */
export const createQueryCacheBuster = ({
  appVersion,
  language,
}: {
  appVersion: string | null | undefined;
  language: string;
}): string => `${QUERY_CACHE_SCHEMA_VERSION}:${appVersion ?? 'unknown'}:${language}`;

export const createQueryPersistOptions = ({
  storage,
  buster,
}: {
  storage: QueryCacheStorage;
  buster: string;
}): Omit<PersistQueryClientOptions, 'queryClient'> => ({
  persister: createAsyncStoragePersister({
    storage,
    key: QUERY_CACHE_STORAGE_KEY,
  }),
  maxAge: QUERY_CACHE_MAX_AGE_MS,
  buster,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    shouldDehydrateMutation: () => false,
  },
  // 복원 뒤 아직 화면이 구독하지 않은 조회도 maxAge 동안 남긴다
  hydrateOptions: { defaultOptions: { queries: { gcTime: QUERY_CACHE_MAX_AGE_MS } } },
});
