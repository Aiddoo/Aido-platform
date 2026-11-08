import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useEffect, useEffectEvent } from 'react';

/**
 * 앱이 앞이 아닌 상태에서 앞으로 돌아올 때마다 가장 최근 `callback`을 부른다.
 * 마운트 시점과 이미 앞인 상태의 반복 알림에는 부르지 않는다.
 */
export function useAppForegroundEffect(callback: () => void): void {
  const appLifecycle = useAppLifecycle();
  const handleForeground = useEffectEvent(callback);

  useEffect(() => {
    let wasActive = appLifecycle.getCurrentState() === 'active';
    return appLifecycle.subscribe((state) => {
      const isActive = state === 'active';
      if (isActive && !wasActive) {
        handleForeground();
      }
      wasActive = isActive;
    });
  }, [appLifecycle]);
}
