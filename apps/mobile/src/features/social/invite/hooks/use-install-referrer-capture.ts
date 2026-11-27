import { useLogger, usePendingRedemptionService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useEffect, useEffectEvent } from 'react';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import type { PendingRedemption } from '../domains/pending-redemption.model';

/** Android에서 스토어로 설치한 뒤 처음 열면 초대 링크의 코드를 이어서 열 초대로 남긴다 */
export function useInstallReferrerCapture() {
  const pendingRedemptionService = usePendingRedemptionService();
  const logger = useLogger();
  const { trackEvent } = useTrack();

  const handleCaptured = useEffectEvent((pending: PendingRedemption | null) => {
    if (pending != null) {
      trackEvent('invite_link_opened', { source: pending.source });
    }
  });

  useEffect(() => {
    pendingRedemptionService
      .captureInstallReferrer(getNowInstant())
      .then(handleCaptured)
      .catch((error: unknown) => {
        logger.warn(INVITE_LOG_EVENT.INSTALL_REFERRER_READ_FAILED, {
          error: getErrorMessage(error),
        });
      });
  }, [pendingRedemptionService, logger]);
}
