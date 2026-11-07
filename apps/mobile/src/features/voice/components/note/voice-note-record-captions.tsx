import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import type { ComponentProps } from 'react';

import { SentenceCaptionList } from './sentence-caption-list';

const MARK_HINT_HEIGHT = 124;

export function VoiceNoteRecordCaptions(
  props: Omit<
    ComponentProps<typeof SentenceCaptionList>,
    'isLive' | 'contentBottomInset' | 'className'
  >,
) {
  const isCompact = useWindowSizeClass() === 'compact';
  const fontScaledSize = useFontScaledSize();
  const [isMarkHintPending] = useMyPendingCoachmark('voice-note-mark');

  return (
    <SentenceCaptionList
      {...props}
      isLive
      // 처음 안내가 조작 줄 위로 떠 자막 맨 아래를 덮는다. 방금 말한 문장이 그 위에 오게 한다
      contentBottomInset={isCompact && isMarkHintPending ? fontScaledSize(MARK_HINT_HEIGHT) : 0}
      className="min-h-24 flex-1"
    />
  );
}
