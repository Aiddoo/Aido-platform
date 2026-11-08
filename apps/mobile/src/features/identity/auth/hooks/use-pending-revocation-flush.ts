import { useSessionRevocationService } from '@src/bootstrap/providers/di-context';
import { useAppForegroundEffect } from '@src/shared/hooks/use-app-foreground-effect';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

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
