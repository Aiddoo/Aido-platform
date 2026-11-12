import { useSystemShare, useViewCapture } from '@src/bootstrap/providers/di-context';
import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { RefObject } from 'react';
import { match } from 'ts-pattern';

type ShareOutcome = 'shared' | 'unsupported' | 'capture-failed';

export function useShareViewCapture(viewShotRef: RefObject<ViewCaptureHandle | null>) {
  const systemShare = useSystemShare();
  const viewCapture = useViewCapture();
  const toast = useAppToast();
  const share = useMutation({
    // 공유는 기기 안의 일이라 오프라인에도 멈추지 않는다
    networkMode: 'always',
    mutationFn: async (): Promise<ShareOutcome> => {
      if (!(await systemShare.isImageShareAvailable())) {
        return 'unsupported';
      }
      const uri = await viewCapture.capture(viewShotRef.current);
      if (uri == null) {
        return 'capture-failed';
      }
      await systemShare.shareImage(uri);
      return 'shared';
    },
    onSuccess: (outcome) =>
      match(outcome)
        .with('shared', noop)
        .with('unsupported', () => toast.warning(t('common:share.unsupported')))
        .with('capture-failed', () => toast.error(t('common:share.prepareFailed')))
        .exhaustive(),
    meta: {
      errorFeedback: { feature: 'share_view_capture', fallbackKey: 'common:share.failed' },
    },
  });

  // isPending은 다시 그린 뒤에야 바뀌어 그 전의 연타는 한 번 누름으로 접는다
  const shareCapture = useSingleTap(() => {
    if (!share.isPending) {
      share.mutate();
    }
  });

  return { shareCapture, isSharing: share.isPending };
}
