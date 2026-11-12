import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  HStack,
  type HintPopoverContentProps,
  MicIcon,
  Text,
  useAdaptivePaneLayoutKey,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useStartVoiceNote } from '../hooks/use-start-voice-note';
import { voiceNoteStartParamsSchema } from '../schemas/voice-note-params.schema';

interface VoiceNoteStartButtonProps {
  coachmarkPlacement: HintPopoverContentProps['placement'];
  coachmarkOffset?: HintPopoverContentProps['offset'];
}

export function VoiceNoteStartButton({
  coachmarkPlacement,
  coachmarkOffset,
}: VoiceNoteStartButtonProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const start = useStartVoiceNote();
  // 연타가 시작 탭 이벤트와 동의·권한 확인을 두 번 내지 않게 한다
  const startOnce = useSingleTap(start);
  const layoutKey = useAdaptivePaneLayoutKey();
  useStartRequestedVoiceNote({ start });

  return (
    <CoachmarkPopover
      kind="voice-note-start"
      title={t('coach.noteStart.title')}
      description={t('coach.noteStart.description')}
      dismissKey={layoutKey}
      placement={coachmarkPlacement}
      offset={coachmarkOffset}
      align="center"
      avoidCollisions
      isPassThrough
    >
      <PressableFeedback
        onPress={() => startOnce()}
        accessibilityRole="button"
        accessibilityLabel={t('start.label')}
        className="h-11 justify-center rounded-full bg-gray-2 px-4"
        testID="voice-note-start"
      >
        <HStack gap={6} align="center">
          <MicIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-8"
          />
          <Text size="b4" weight="semibold" shade={8} numberOfLines={1}>
            {t('start.shortLabel')}
          </Text>
        </HStack>
      </PressableFeedback>
    </CoachmarkPopover>
  );
}

interface UseStartRequestedVoiceNoteOptions {
  /** 버튼과 같은 시작. 한도·동의·마이크를 거친다 */
  start: () => Promise<void>;
}

/** 다른 화면이 시작을 요청했으면 한 번만 버튼을 누른 것처럼 시작한다. 동의·마이크를 거절하면 메모 탭에 남아 다시 누를 수 있다 */
function useStartRequestedVoiceNote({ start }: UseStartRequestedVoiceNoteOptions) {
  const [{ startVoiceNote }, setParams] = useRouteParams(voiceNoteStartParamsSchema);
  const hasStartedRef = useRef(false);
  const reportUnexpectedError = useReportUnexpectedError('voice');
  const startRequested = useEffectEvent(() => {
    setParams({ startVoiceNote: undefined });
    start().catch(reportUnexpectedError);
  });

  // 요청을 지우면 다시 받을 수 있게 되돌린다. 같은 탭에 머문 채 다시 요청이 와도 또 시작한다
  useEffect(() => {
    if (startVoiceNote == null) {
      hasStartedRef.current = false;
      return;
    }
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    startRequested();
  }, [startVoiceNote]);
}
