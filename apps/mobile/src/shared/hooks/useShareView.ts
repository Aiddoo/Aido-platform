import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import type { ViewShotRef } from 'react-native-view-shot';

export function useShareView(viewShotRef: React.RefObject<ViewShotRef | null>) {
  const { warning, error } = useAppToast();
  const [isSharing, setIsSharing] = useState(false);

  const shareCapture = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        warning(t('common:share.unsupported'));
        return;
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        error(t('common:share.prepareFailed'));
        return;
      }

      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      error(t('common:share.failed'));
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, viewShotRef, warning, error]);

  return { shareCapture, isSharing };
}
