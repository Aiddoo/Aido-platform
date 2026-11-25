import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useMutation } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { useShareCertificateMutationOptions } from '../queries/achievement.mutations';

interface ShareViewCaptureOptions {
  /** 공유를 시작할 때 한 번 부른다(시도 지표). 연타·공유 중의 누름에는 부르지 않는다 */
  onShare: () => void;
}

interface ShareViewCapture {
  shareCapture: () => void;
  isSharing: boolean;
}

/** 배지 상장 화면 두 곳이 같은 공유를 쓴다. 공유 시트가 떠 있는 동안의 누름은 무시한다 */
export function useShareViewCapture(
  viewShotRef: RefObject<ViewCaptureHandle | null>,
  { onShare }: ShareViewCaptureOptions,
): ShareViewCapture {
  const share = useMutation(useShareCertificateMutationOptions());

  // isPending은 다시 그린 뒤에야 바뀌어 그 전의 연타는 한 번 누름으로 접는다
  const shareCapture = useSingleTap(() => {
    if (!share.isPending) {
      onShare();
      share.mutate(viewShotRef.current);
    }
  });

  return { shareCapture, isSharing: share.isPending };
}
