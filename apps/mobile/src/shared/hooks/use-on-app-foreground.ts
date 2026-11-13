import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useEffect, useEffectEvent } from 'react';

/** 앱이 뒤에서 앞으로 돌아올 때 부른다. 마운트 시점과 이미 앞인 상태의 반복 알림에는 부르지 않는다 */
export function useOnAppForeground(onForeground: () => void): void {
  const appLifecycle = useAppLifecycle();
  const handleForeground = useEffectEvent(onForeground);

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
