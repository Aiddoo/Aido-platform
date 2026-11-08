import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useSyncExternalStore } from 'react';

/** 앱의 현재 생명주기 상태. 바뀌면 다시 그린다 */
export function useAppLifecycleState(): AppLifecycleState {
  const appLifecycle = useAppLifecycle();
  return useSyncExternalStore(appLifecycle.subscribe, appLifecycle.getCurrentState);
}
