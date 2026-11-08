import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useEffect, useEffectEvent } from 'react';

/** 앱이 앞으로 돌아올 때마다 `callback`을 부른다. 마운트 시점에는 부르지 않는다 */
export function useAppForegroundEffect(callback: () => void): void {
  const appLifecycle = useAppLifecycle();
  const handleForeground = useEffectEvent(callback);

  useEffect(
    () =>
      appLifecycle.subscribe((state) => {
        if (state === 'active') {
          handleForeground();
        }
      }),
    [appLifecycle],
  );
}
