import type { MutationErrorFeedbackMeta } from '@src/shared/constants/query-meta';
import { logger } from '@src/shared/infra/logger/global-logger';
import { MutationCache, type MutationMeta } from '@tanstack/react-query';

import { QUERY_CACHE_LOG_EVENT } from './query-cache-log-events';

export interface MutationErrorFeedbackEvent {
  error: unknown;
  feedback: MutationErrorFeedbackMeta;
}

type MutationErrorFeedbackListener = (event: MutationErrorFeedbackEvent) => void;

/** 캐시가 사라지면 함께 사라지고, 구독을 풀면 Set에서 빠진다 */
const listenersByCache = new WeakMap<MutationCache, Set<MutationErrorFeedbackListener>>();

/** 전역에서 알릴 실패면 그 설정을, 기능이 직접 보이거나 알리지 않는 실패면 null을 돌려준다 */
function findMutationErrorFeedback(
  meta: MutationMeta | undefined,
  error: unknown,
): MutationErrorFeedbackMeta | null {
  const feedback = meta?.errorFeedback;
  if (feedback == null || feedback === false || feedback.isHandledByFeature?.(error) === true) {
    return null;
  }
  return feedback;
}

/**
 * 앱의 mutation 캐시. 캐시 단계 `onError`는 기능 `onError`·`onSettled`보다 먼저 돌아,
 * `onSettled`가 기다리는 재조회(오프라인이면 멈춘다)에 묶이지 않고 실패를 바로 알린다
 */
export function createAppMutationCache(): MutationCache {
  const cache: MutationCache = new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      // lint는 queries/*.mutations.ts의 mutationOptions만 본다. 컴포넌트에 바로 쓴 옵션의 빠진 선언은 개발 중에 알린다
      if (__DEV__ && mutation.meta?.errorFeedback == null) {
        logger.warn(QUERY_CACHE_LOG_EVENT.ERROR_FEEDBACK_MISSING, {
          mutationKey: JSON.stringify(mutation.options.mutationKey ?? null),
        });
      }
      const feedback = findMutationErrorFeedback(mutation.meta, error);
      if (feedback == null) {
        return;
      }
      for (const listener of listenersByCache.get(cache) ?? []) {
        listener({ error, feedback });
      }
    },
  });
  return cache;
}

/** 해제 함수를 돌려준다. `createAppMutationCache`로 만들지 않은 캐시는 알리지 않는다 */
export function subscribeMutationErrorFeedback(
  cache: MutationCache,
  listener: MutationErrorFeedbackListener,
): () => void {
  const listeners = listenersByCache.get(cache) ?? new Set<MutationErrorFeedbackListener>();
  listenersByCache.set(cache, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
