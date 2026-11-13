import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useSyncExternalStore } from 'react';

/** 앱 수명 상태 구독 하나. 무엇을 "앞"으로 볼지(inactive 포함 여부)는 쓰는 훅이 정한다 */
export function useAppLifecycleState(): AppLifecycleState {
  const appLifecycle = useAppLifecycle();

  return useSyncExternalStore(appLifecycle.subscribe, appLifecycle.getCurrentState);
}
