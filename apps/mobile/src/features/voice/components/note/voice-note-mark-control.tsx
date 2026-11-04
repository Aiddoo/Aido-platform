import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useCoachmarkSettle } from '@src/features/feature-discovery/hooks/use-coachmark-settle';
import { usePendingCoachmark } from '@src/features/feature-discovery/hooks/use-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { FlagIcon, HintPopoverContent, HStack, InfoIcon, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { RECORD_CONTROL_GAP, RECORD_CONTROL_SIDE_SIZE, RecordControl } from './record-control';

/** `Popover.Content`의 기본 간격과 같다 */
const INFO_POPOVER_GAP = 9;

interface VoiceNoteMarkControlProps {
  /** 지금까지 중요 표시한 문장 수 */
  markCount: number;
  isListening: boolean;
  onPress: () => void;
}

/**
 * 녹음 화면의 중요 표시. 듣기가 시작되면 처음 한 번 안내가 뜨고, 안내가 떠 있어도 첫 탭이 바로 표시한다.
 * 안내가 끝나면 라벨 옆 ⓘ로 같은 설명을 다시 본다.
 */
export function VoiceNoteMarkControl({
  markCount,
  isListening,
  onPress,
}: VoiceNoteMarkControlProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const [isHintPending] = usePendingCoachmark({ accountId: me.id, kind: 'voice-note-mark' });
  const isSettled = useCoachmarkSettle();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const title = t('coach.mark.title');
  const description = t('coach.mark.description');

  return (
    <RecordControl.Column>
      <CoachmarkPopover
        kind="voice-note-mark"
        title={title}
        description={description}
        icon={FlagIcon}
        align="center"
        isEnabled={isSettled && isListening}
        isPassThrough
        isTargetDisabled={!isListening}
      >
        <RecordControl.Button
          label={markCount > 0 ? t('record.markA11y', { amount: markCount }) : t('record.mark')}
          onPress={onPress}
          isDisabled={!isListening}
          testID="voice-note-mark"
        >
          <FlagIcon width={22} height={22} colorClassName="text-main" />
        </RecordControl.Button>
      </CoachmarkPopover>
      <Popover isOpen={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <Popover.Trigger asChild isDisabled={isHintPending}>
          <PressableFeedback
            hitSlop={{ top: RECORD_CONTROL_GAP - 2, bottom: 20, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('record.markInfo')}
            className="max-w-full"
            testID="voice-note-mark-info"
          >
            <HStack gap={4} align="center" justify="center">
              <Text size="e1" shade={7} maxLines={1} className="shrink tabular-nums">
                {markCount > 0
                  ? t('record.markWithCount', { amount: markCount })
                  : t('record.mark')}
              </Text>
              {!isHintPending && (
                <InfoIcon
                  width={fontScaledSize(16)}
                  height={fontScaledSize(16)}
                  colorClassName="text-gray-6"
                />
              )}
            </HStack>
          </PressableFeedback>
        </Popover.Trigger>
        {/* 라벨 바로 위는 버튼 자리라 버튼 위로 올린다. 처음 안내와 같은 자리다 */}
        <HintPopoverContent
          icon={FlagIcon}
          title={title}
          description={description}
          align="center"
          offset={fontScaledSize(RECORD_CONTROL_SIDE_SIZE) + RECORD_CONTROL_GAP + INFO_POPOVER_GAP}
        />
      </Popover>
    </RecordControl.Column>
  );
}
