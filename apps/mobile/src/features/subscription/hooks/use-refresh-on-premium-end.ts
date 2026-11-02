import { useLogger } from '@src/bootstrap/providers/di-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { type PremiumAccess, PremiumAccessPolicy } from '../domains/premium-access.model';
import { refreshAfterPremiumEnded } from '../queries/subscription-cache';

/**
 * 앱이 켜져 있는 동안 프리미엄 기간이 끝나면 내 정보와 의존 쿼리를 한 번 다시 불러온다.
 * 분 시계는 앱이 앞에 있을 때만 돌고, 앱으로 돌아오면 바로 다시 확인해 백그라운드 중에 끝난 기간도 잡는다.
 */
export function useRefreshOnPremiumEnd(access: PremiumAccess) {
  const queryClient = useQueryClient();
  const logger = useLogger();
  const now = useMinuteNow();
  const lastCheckedAtRef = useRef(now);

  useEffect(() => {
    const lastCheckedAt = lastCheckedAtRef.current;
    lastCheckedAtRef.current = now;
    if (!PremiumAccessPolicy.hasEndedSince(access, lastCheckedAt, now)) {
      return;
    }

    refreshAfterPremiumEnded(queryClient).catch((error) =>
      logger.warn(SUBSCRIPTION_LOG_EVENT.PREMIUM_ENDED_REFRESH_FAILED, { error }),
    );
  }, [access, now, queryClient, logger]);
}
