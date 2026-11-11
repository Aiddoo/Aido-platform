import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useSyncExternalStore } from 'react';

/** 앱이 백그라운드일 때만 참이다. 제어 센터로 `inactive`가 되거나 투명 시트가 화면을 덮어도 값은 계속 모아야 해서 `inactive`는 뒤로 보지 않는다 */
export function useIsAppInBackground(): boolean {
  const appLifecycle = useAppLifecycle();
  const appLifecycleState = useSyncExternalStore(
    appLifecycle.subscribe,
    appLifecycle.getCurrentState,
  );
  return appLifecycleState === 'background';
}
