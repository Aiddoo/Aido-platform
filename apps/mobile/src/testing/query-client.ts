import { createAppMutationCache } from '@src/bootstrap/query/mutation-error-feedback-cache';
import { notifyManager, QueryClient, type QueryClientConfig } from '@tanstack/react-query';

const createdClients = new Set<QueryClient>();

/**
 * 테스트용 QueryClient. TanStack Query 테스트 가이드의 권장값을 기본으로 둔다.
 * - retry: false — 실패를 바로 드러낸다
 * - gcTime: Infinity — 캐시 정리 타이머를 만들지 않아 테스트가 끝나면 Jest가 바로 종료된다
 * mutation 캐시는 앱과 같아 `meta.errorFeedback`이 `TestUiProvider`의 전역 오류 피드백으로 간다.
 * 각 테스트가 끝나면 jest.setup의 afterEach가 만든 클라이언트를 모두 비운다.
 */
export function createTestQueryClient(config: QueryClientConfig = {}): QueryClient {
  const { defaultOptions, mutationCache = createAppMutationCache(), ...rest } = config;
  const client = new QueryClient({
    ...rest,
    mutationCache,
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

/** 쿼리 알림이 다 나갈 때까지 기다리는 스케줄러 차례 수. 비동기 onMutate가 남긴 알림은 다음 차례에 잡힌다 */
const NOTIFICATION_ROUNDS = 3;

/** TanStack notifyManager는 구독자 알림을 다음 틱으로 미룬다. 같은 스케줄러에 여러 번 줄을 서 앞선 알림이 다 나간 뒤 돌아온다 */
export async function deliverQueryNotifications() {
  for (let round = 0; round < NOTIFICATION_ROUNDS; round += 1) {
    await new Promise<void>((resolve) => notifyManager.schedule(resolve));
  }
}
