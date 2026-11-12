import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { QUERY_CACHE_MAX_AGE_MS } from '@src/shared/constants/query-persistence';
import { logger } from '@src/shared/infra/logger/global-logger';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateQuery,
  partialMatchKey,
  type Query,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  PersistedClient,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import { noop, uniq } from 'es-toolkit';
import type { z } from 'zod';

import { QUERY_CACHE_LOG_EVENT } from './query-cache-log-events';

// ⚠️ 영속 계약: 이미 저장된 캐시를 가리키므로 이름을 바꾸면 기존 캐시를 한 번 잃는다
export const QUERY_CACHE_STORAGE_KEY = 'aido.query-cache';
const QUERY_CACHE_OWNER_KEY = 'aido.query-cache.owner';

/** 영속 쿼리의 키나 클라이언트 모델의 모양이 바뀌면 올려 이전 캐시를 버린다 */
const QUERY_CACHE_SCHEMA_VERSION = 6;

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

/** 조회 캐시만 담는 인스턴스. 통째로 비워도 다른 값이 지워지지 않는다 */
type QueryCacheInstance = Pick<EnumerableSyncStorage, 'get' | 'set' | 'remove' | 'clear'>;

/** 암호화 저장소를 열지 못했을 때. 캐시를 기기에 남기지 않고 주인 지정·삭제도 할 일이 없다 */
export const disabledQueryCacheStorage: QueryCacheStorage = {
  getItem: () => null,
  setItem: noop,
  removeItem: noop,
  setOwner: noop,
  clear: noop,
};

export function createQueryCacheStorage(storage: QueryCacheInstance): QueryCacheStorage {
  const ownedKey = (key: string) => {
    const ownerId = storage.get(QUERY_CACHE_OWNER_KEY);
    return ownerId == null ? null : `${key}:${encodeURIComponent(ownerId)}`;
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
      if (storage.get(QUERY_CACHE_OWNER_KEY) === userId) {
        return;
      }
      // 키 하나만 지우면 이전 주인의 다른 키가 파일에 남는다
      storage.clear();
      storage.set(QUERY_CACHE_OWNER_KEY, userId);
    },
    clear: () => storage.clear(),
  };
}

/** 암호화 이전에 기본 MMKV에 평문으로 남긴 캐시와 주인을 지운다. 1.16에서 지운다(compatibility.md) */
export function removePlaintextQueryCache(
  storage: Pick<EnumerableSyncStorage, 'keys' | 'remove'>,
): void {
  for (const key of storage.keys()) {
    if (key === QUERY_CACHE_OWNER_KEY || key.startsWith(`${QUERY_CACHE_STORAGE_KEY}:`)) {
      storage.remove(key);
    }
  }
}

/** 성공한 조회 중 opt-in한 것만 저장한다. 실패·대기 중인 조회와 opt-in하지 않은 조회는 남기지 않는다 */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && query.meta?.persist === true;
}

export interface PersistedQuerySchema {
  /** 앞부분이 같은 키를 모두 이 스키마로 검증한다 */
  queryKey: QueryKey;
  schema: z.ZodType;
}

/** 버전이 같아도 저장값이 깨졌으면 화면이 죽으므로 그 조회만 버리고 서버에서 다시 받는다. 남긴 조회는 스키마 출력(앱 모델)으로 바꿔 나중에 더한 칸의 기본값을 채운다 */
function keepValidPersistedQueries(
  client: PersistedClient,
  schemas: readonly PersistedQuerySchema[],
): PersistedClient {
  const { queries } = client.clientState;
  const parsedQueries = queries.map((query) => {
    const entry = schemas.find(({ queryKey }) => partialMatchKey(query.queryKey, queryKey));
    const parsed = entry?.schema.safeParse(query.state.data);
    return { query, parsed };
  });
  const droppedQueries = parsedQueries
    .filter(({ parsed }) => parsed?.success !== true)
    .map(({ query }) => query);

  if (droppedQueries.length > 0) {
    logger.warn(QUERY_CACHE_LOG_EVENT.RESTORED_QUERIES_DROPPED, {
      droppedCount: droppedQueries.length,
      totalCount: queries.length,
      droppedRoots: uniq(droppedQueries.map(({ queryKey }) => String(queryKey[0]))).join(','),
    });
  }

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: parsedQueries.flatMap(({ query, parsed }) =>
        parsed?.success === true
          ? [{ ...query, state: { ...query.state, data: parsed.data } }]
          : [],
      ),
    },
  };
}

/** 앱 버전이 바뀌면 모델 모양이 달라질 수 있고, 서버가 표시 언어로 만든 값(날씨·알림·AI 결과)이 있어 다른 언어의 캐시도 복원하지 않는다 */
export function createQueryCacheBuster({
  appVersion,
  language,
}: {
  appVersion: string;
  language: string;
}): string {
  return `${QUERY_CACHE_SCHEMA_VERSION}:${appVersion}:${language}`;
}

export function createQueryPersistOptions({
  storage,
  buster,
  schemas,
}: {
  storage: QueryCacheStorage;
  buster: string;
  schemas: readonly PersistedQuerySchema[];
}): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createAsyncStoragePersister({
      storage,
      key: QUERY_CACHE_STORAGE_KEY,
      deserialize: (text) => keepValidPersistedQueries(JSON.parse(text), schemas),
    }),
    maxAge: QUERY_CACHE_MAX_AGE_MS,
    buster,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      shouldDehydrateMutation: () => false,
    },
    // 복원 뒤 아직 화면이 구독하지 않은 조회도 maxAge 동안 남긴다
    hydrateOptions: { defaultOptions: { queries: { gcTime: QUERY_CACHE_MAX_AGE_MS } } },
  };
}
