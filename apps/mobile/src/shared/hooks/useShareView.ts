import { useAppToast } from '@src/shared/hooks/useAppToast';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import type ViewShot from 'react-native-view-shot';

export function useShareView(viewShotRef: React.RefObject<ViewShot | null>) {
  const { warning, error } = useAppToast();
  const [isSharing, setIsSharing] = useState(false);

  const shareCapture = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        warning('이 기기에서는 공유할 수 없어요');
        return;
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        error('공유 이미지를 준비하지 못했어요');
        return;
      }

      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      error('공유에 실패했어요');
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, viewShotRef, warning, error]);

  return { shareCapture, isSharing };
}
