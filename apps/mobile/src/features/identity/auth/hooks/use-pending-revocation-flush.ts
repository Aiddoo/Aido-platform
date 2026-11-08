import { useSessionRevocationService } from '@src/bootstrap/providers/di-context';
import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

/**
 * 오프라인 로그아웃이 남긴 세션 해제를 시작할 때, 연결이 돌아올 때, 포그라운드로 돌아올 때 시도한다.
 * 부팅 판정과 무관하고 토큰 저장소를 건드리지 않는다. 서버 장애면 다음 복귀 때 다시 시도한다.
 */
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

/**
 * 앱이 앞이 아닌 상태에서 앞으로 돌아올 때마다 가장 최근 `callback`을 부른다.
 * 마운트 시점과 이미 앞인 상태의 반복 알림에는 부르지 않는다.
 */
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
