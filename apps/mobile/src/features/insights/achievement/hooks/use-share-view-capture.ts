import { useLogger, useSystemShare, useViewCapture } from '@src/bootstrap/providers/di-context';
import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { type RefObject, useCallback, useRef, useState } from 'react';

import { SHARE_VIEW_CAPTURE_LOG_EVENT } from '../constants/share-view-capture-log-events';

export function useShareViewCapture(viewShotRef: RefObject<ViewCaptureHandle | null>) {
  const systemShare = useSystemShare();
  const viewCapture = useViewCapture();
  const logger = useLogger();
  const { warning, error } = useAppToast();
  const [isSharing, setIsSharing] = useState(false);
  // 상태는 다시 그린 뒤에야 바뀌므로 그 전에 한 번 더 누르는 것은 ref로 막는다
  const isSharingRef = useRef(false);

  const shareCapture = useCallback(async () => {
    if (isSharingRef.current) {
      return;
    }
    isSharingRef.current = true;
    setIsSharing(true);
    try {
      const isAvailable = await systemShare.isImageShareAvailable();
      if (!isAvailable) {
        warning(t('common:share.unsupported'));
        return;
      }

      const uri = await viewCapture.capture(viewShotRef.current);
      if (uri == null) {
        error(t('common:share.prepareFailed'));
        return;
      }

      await systemShare.shareImage(uri);
    } catch (shareError) {
      logger.warn(SHARE_VIEW_CAPTURE_LOG_EVENT.SHARE_FAILED, {
        error: getErrorMessage(shareError),
      });
      error(t('common:share.failed'));
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  }, [systemShare, viewCapture, logger, viewShotRef, warning, error]);

  return { shareCapture, isSharing };
}
