import { useSessionRevocationService } from '@src/bootstrap/providers/di-context';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

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

  useOnAppForeground(() => {
    if (onlineManager.isOnline()) {
      sessionRevocationService.flush();
    }
  });
}
