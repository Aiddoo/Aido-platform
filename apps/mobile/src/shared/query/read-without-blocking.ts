import { onlineManager } from '@tanstack/react-query';
import { withTimeout } from 'es-toolkit';

/** 사용자가 누른 동작 앞에서 아무 표시 없이 기다릴 수 있는 시간. 넘기면 없는 값으로 이어 가고 응답은 캐시에 쌓인다 */
const READ_TIMEOUT_MS = 3_000;

/**
 * 동작을 막지 않고 조회 값을 읽는다. 캐시가 있으면 그것을, 오프라인이면 멈춘 조회의 `ensureQueryData`가 끝나지 않아
 * (`networkMode`로도 못 푼다) null을, 온라인이면 제한 시간까지만 기다린다
 */
export async function readWithoutBlocking<T>(
  cached: T | undefined,
  fetch: () => Promise<T>,
  onFailure: (error: unknown) => void,
): Promise<T | null> {
  if (cached != null) {
    return cached;
  }
  if (!onlineManager.isOnline()) {
    return null;
  }
  return withTimeout(fetch, READ_TIMEOUT_MS).catch((error: unknown) => {
    onFailure(error);
    return null;
  });
}
