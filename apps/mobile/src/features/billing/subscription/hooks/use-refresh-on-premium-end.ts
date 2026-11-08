import { useLogger } from '@src/bootstrap/providers/di-context';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { type PremiumAccess } from '@src/features/identity/user/domains/premium-access.model';
import { getErrorMessage } from '@src/shared/errors';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { refreshAfterPremiumEnded } from '../queries/subscription-cache';

// 분 시계는 앞에 있을 때만 돌아 복귀 시 바로 다시 확인해 백그라운드 중 끝난 기간도 잡는다
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
      logger.warn(SUBSCRIPTION_LOG_EVENT.PREMIUM_ENDED_REFRESH_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  }, [access, now, queryClient, logger]);
}
