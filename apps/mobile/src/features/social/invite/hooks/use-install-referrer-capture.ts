import { useInviteService, useLogger } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { fromDate } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useEffect } from 'react';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';

/** Android에서 스토어로 설치한 뒤 처음 열면 초대 링크의 코드를 이어서 열 초대로 남긴다 */
export function useInstallReferrerCapture() {
  const inviteService = useInviteService();
  const logger = useLogger();
  const { trackEvent } = useTrack();

  useEffect(() => {
    inviteService
      .captureInstallReferrer(fromDate(new Date()))
      .then((pending) => {
        if (pending != null) {
          trackEvent('invite_link_opened', { source: pending.source });
        }
      })
      .catch((error: unknown) => {
        logger.warn(INVITE_LOG_EVENT.INSTALL_REFERRER_READ_FAILED, {
          error: getErrorMessage(error),
        });
      });
  }, [inviteService, logger, trackEvent]);
}
