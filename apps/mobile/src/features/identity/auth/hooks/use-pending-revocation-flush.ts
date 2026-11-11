import { useAppLifecycle, useSessionRevocationService } from '@src/bootstrap/providers/di-context';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

/** 부팅 판정·토큰 저장소와 무관하게 돌고, 서버 장애면 다음 복귀 때 다시 시도한다 */
export function usePendingRevocationFlush(): void {
  const sessionRevocationService = useSessionRevocationService();

  useEffect(() => {
    const flushIfOnline = () => {
      if (onlineManager.isOnline()) {
        sessionRevocationService.flush();
      }
    };

    flushIfOnline();
    return onlineManager.subscribe(flushIfOnline);
  }, [sessionRevocationService]);

  useAppForegroundEffect(() => {
    if (onlineManager.isOnline()) {
      sessionRevocationService.flush();
    }
  });
}

/** 마운트 시점과 이미 앞인 상태의 반복 알림에는 부르지 않는다 */
function useAppForegroundEffect(callback: () => void): void {
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
