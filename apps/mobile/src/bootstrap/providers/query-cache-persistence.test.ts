import { createMemorySyncStorage } from '@src/shared/__tests__';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import {
  createQueryCacheBuster,
  createQueryCacheStorage,
  createQueryPersistOptions,
  deserializeQueryCache,
  QUERY_CACHE_STORAGE_KEY,
  removePlaintextQueryCache,
  serializeQueryCache,
  shouldPersistQuery,
} from './query-cache-persistence';

const clients: QueryClient[] = [];

const createClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return client;
};

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.clear();
  }
});

const queryOf = (client: QueryClient, queryKey: readonly unknown[]) => {
  const query = client.getQueryCache().find({ queryKey, exact: true });
  if (query == null) {
    throw new Error('query not found');
  }
  return query;
};

describe('createQueryCacheStorage', () => {
  it('주인이 정해지기 전에는 캐시를 쓰지도 읽지도 않는다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());

    // When
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '캐시');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('주인이 바뀌면 이전 사용자의 캐시를 지워 새 사용자에게 복원하지 않는다', () => {
    // Given
    const backing = createMemorySyncStorage();
    const storage = createQueryCacheStorage(backing);
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, 'user-1 캐시');

    // When
    storage.setOwner('user-2');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    storage.setOwner('user-1');
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('같은 주인을 다시 정하면 저장한 캐시를 그대로 둔다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');

    // When
    storage.setOwner('user-1');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBe('내 캐시');
  });

  it('비우면 캐시와 주인을 함께 지워 늦게 도착한 저장도 버린다', () => {
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');

    // When
    storage.clear();
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '로그아웃 뒤 저장');

    // Then
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });
});

describe('removePlaintextQueryCache', () => {
  it('평문 저장소에 남은 사용자별 캐시와 주인만 지우고 다른 설정은 남긴다', () => {
    // Given
    const plaintext = createMemorySyncStorage();
    plaintext.set(`${QUERY_CACHE_STORAGE_KEY}:user-1`, '평문 캐시');
    plaintext.set(`${QUERY_CACHE_STORAGE_KEY}:user-2`, '다른 사용자 평문 캐시');
    plaintext.set('aido.query-cache.owner', 'user-1');
    plaintext.set('aido_activation_v1:user-1:campaign', '{}');

    // When
    removePlaintextQueryCache(plaintext);

    // Then
    expect(plaintext.getAllKeys()).toEqual(['aido_activation_v1:user-1:campaign']);
  });
});

describe('shouldPersistQuery', () => {
  it('opt-in한 성공 조회만 저장한다', () => {
    // Given
    const client = createClient();
    client.getQueryCache().build(client, { queryKey: ['opted'], ...PERSISTED_QUERY_OPTIONS });
    client.setQueryData(['opted'], { value: 1 });
    client.setQueryData(['plain'], { value: 1 });

    // When · Then
    expect(shouldPersistQuery(queryOf(client, ['opted']))).toBe(true);
    expect(shouldPersistQuery(queryOf(client, ['plain']))).toBe(false);
  });

  it('opt-in했어도 실패했거나 아직 받는 중인 조회는 저장하지 않는다', async () => {
    // Given
    const client = createClient();
    await client
      .fetchQuery({
        queryKey: ['failed'],
        queryFn: () => Promise.reject(new Error('boom')),
        ...PERSISTED_QUERY_OPTIONS,
      })
      .catch(() => undefined);
    client.getQueryCache().build(client, { queryKey: ['pending'], ...PERSISTED_QUERY_OPTIONS });

    // When · Then
    expect(shouldPersistQuery(queryOf(client, ['failed']))).toBe(false);
    expect(shouldPersistQuery(queryOf(client, ['pending']))).toBe(false);
  });
});

describe('serializeQueryCache', () => {
  it('클라이언트 모델의 Date를 되살린다', () => {
    // Given
    const fetchedAt = new Date('2026-11-02T03:00:00.000Z');
    const client = {
      timestamp: 1,
      buster: '1:1.14.0',
      clientState: { mutations: [], queries: [] },
      report: { fetchedAt, label: '2026-11-02' },
    };

    // When
    const restored = deserializeQueryCache(serializeQueryCache(client));

    // Then
    expect(restored).toEqual(client);
  });
});

describe('createQueryPersistOptions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const saveAndRestore = async (savedBuster: string, restoringBuster: string) => {
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const source = createClient();
    source.getQueryCache().build(source, { queryKey: ['opted'], ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData(['opted'], { savedAt: new Date('2026-11-02T00:00:00.000Z') });
    await persistQueryClientSave({
      queryClient: source,
      ...createQueryPersistOptions({ storage, buster: savedBuster }),
    });
    await jest.runAllTimersAsync();

    const target = createClient();
    await persistQueryClientRestore({
      queryClient: target,
      ...createQueryPersistOptions({ storage, buster: restoringBuster }),
    });
    return target.getQueryData(['opted']);
  };

  it('같은 앱 버전이면 저장한 조회를 Date까지 복원한다', async () => {
    // Given · When
    const buster = createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' });
    const restored = await saveAndRestore(buster, buster);

    // Then
    expect(restored).toEqual({ savedAt: new Date('2026-11-02T00:00:00.000Z') });
  });

  it('앱 버전이 바뀌면 이전 캐시를 복원하지 않는다', async () => {
    // Given · When
    const restored = await saveAndRestore(
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' }),
      createQueryCacheBuster({ appVersion: '1.15.0', language: 'ko' }),
    );

    // Then
    expect(restored).toBeUndefined();
  });

  it('표시 언어가 바뀌면 이전 언어로 받은 캐시를 복원하지 않는다', async () => {
    // Given · When
    const restored = await saveAndRestore(
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'ko' }),
      createQueryCacheBuster({ appVersion: '1.14.0', language: 'en' }),
    );

    // Then
    expect(restored).toBeUndefined();
  });
});
