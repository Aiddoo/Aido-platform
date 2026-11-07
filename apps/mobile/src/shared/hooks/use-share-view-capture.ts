import { useSystemShare } from '@src/shared/di/shared-di-context';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { type RefObject, useCallback, useState } from 'react';
import type { ViewShotRef } from 'react-native-view-shot';

export function useShareViewCapture(viewShotRef: RefObject<ViewShotRef | null>) {
  const systemShare = useSystemShare();
  const { warning, error } = useAppToast();
  const [isSharing, setIsSharing] = useState(false);

  const shareCapture = useCallback(async () => {
    if (isSharing) {
      return;
    }
    setIsSharing(true);
    try {
      const isAvailable = await systemShare.isImageShareAvailable();
      if (!isAvailable) {
        warning(t('common:share.unsupported'));
        return;
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        error(t('common:share.prepareFailed'));
        return;
      }

      await systemShare.shareImage(uri);
    } catch {
      error(t('common:share.failed'));
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, systemShare, viewShotRef, warning, error]);

  return { shareCapture, isSharing };
}
