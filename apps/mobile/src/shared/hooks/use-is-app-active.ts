import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useSyncExternalStore } from 'react';

/** 앱이 사용자 앞에 떠 있는지 */
export function useIsAppActive(): boolean {
  const appLifecycle = useAppLifecycle();
  return useSyncExternalStore(
    appLifecycle.subscribe,
    () => appLifecycle.getCurrentState() === 'active',
  );
}
