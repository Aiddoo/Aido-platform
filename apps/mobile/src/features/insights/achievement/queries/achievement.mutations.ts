import { useSystemShare, useViewCapture } from '@src/bootstrap/providers/di-context';
import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { ACHIEVEMENT_MUTATION_KEYS } from './achievement-mutation-keys';

type ShareOutcome = 'shared' | 'unsupported' | 'capture-failed';

/** 배지 상장을 그림으로 찍어 시스템 공유 시트로 보낸다. 변수는 찍을 상장 뷰다 */
export function useShareCertificateMutationOptions() {
  const systemShare = useSystemShare();
  const viewCapture = useViewCapture();
  const toast = useAppToast();

  return mutationOptions({
    mutationKey: ACHIEVEMENT_MUTATION_KEYS.shareCertificate(),
    // 공유는 기기 안의 일이라 오프라인에도 멈추지 않는다
    networkMode: 'always',
    mutationFn: async (certificate: ViewCaptureHandle | null): Promise<ShareOutcome> => {
      if (!(await systemShare.isImageShareAvailable())) {
        return 'unsupported';
      }
      const uri = await viewCapture.capture(certificate);
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
}
