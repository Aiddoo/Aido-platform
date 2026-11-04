import { PLAN_IN_PROGRESS_RETRY } from '../constants/voice.constants';
import { isPlanInProgressError } from '../domains/voice.error';

/** 응답을 놓친 뒤 다시 보냈는데 앞선 요청이 아직 처리 중이면 안내만 하고 끝내지 않고 결과가 나올 때까지 기다린다 */
export const planInProgressRetryOptions = {
  retry: (failureCount: number, error: unknown) =>
    isPlanInProgressError(error) && failureCount < PLAN_IN_PROGRESS_RETRY.maxCount,
  retryDelay: PLAN_IN_PROGRESS_RETRY.delayMs,
} as const;
