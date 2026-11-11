import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { QueryClient } from '@tanstack/react-query';

import { shouldRetryQuery } from './query-retry';

const MIN_STALE_TIME = 5 * MINUTE_MS;
const MIN_GC_TIME = 6 * MINUTE_MS;
/** 재시도 백오프 상한. 죽은 서버를 과하게 두드리지 않는다 */
const MAX_RETRY_DELAY = 5 * SECOND_MS;

/** 상한 지수 백오프(1s → 2s → 4s → 5s…). `shouldRetryQuery`의 일시 장애 6회와 합치면 재시도 창이 약 22초라 서버 재시작(5-10초)을 덮어 재시도 화면 대신 로딩을 유지한다 */
function retryDelay(attempt: number): number {
  return Math.min(SECOND_MS * 2 ** attempt, MAX_RETRY_DELAY);
}

/** 앱의 조회 캐시. 프로세스에 하나라 `composition-root`만 부른다 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MIN_STALE_TIME,
        gcTime: MIN_GC_TIME,
        retry: shouldRetryQuery,
        retryDelay,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
