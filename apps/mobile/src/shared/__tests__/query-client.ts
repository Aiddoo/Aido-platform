import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

const createdClients = new Set<QueryClient>();

/**
 * 테스트용 QueryClient. TanStack Query 테스트 가이드의 권장값을 기본으로 둔다.
 * - retry: false — 실패를 바로 드러낸다
 * - gcTime: Infinity — 캐시 정리 타이머를 만들지 않아 테스트가 끝나면 Jest가 바로 종료된다
 * 각 테스트가 끝나면 jest.setup의 afterEach가 만든 클라이언트를 모두 비운다.
 */
export function createTestQueryClient(config: QueryClientConfig = {}): QueryClient {
  const { defaultOptions, ...rest } = config;
  const client = new QueryClient({
    ...rest,
    defaultOptions: {
      ...defaultOptions,
      queries: { retry: false, gcTime: Infinity, ...defaultOptions?.queries },
      mutations: { retry: false, gcTime: Infinity, ...defaultOptions?.mutations },
    },
  });
  createdClients.add(client);
  return client;
}

export function clearTestQueryClients(): void {
  for (const client of createdClients) {
    client.clear();
  }
  createdClients.clear();
}
