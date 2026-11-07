import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { usePendingCoachmark } from '@src/features/device/coachmark/hooks/use-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  FlagFilledIcon,
  FlagIcon,
  HintPopoverContent,
  HStack,
  InfoIcon,
  Text,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import {
  RECORD_BUTTON_GAP,
  RECORD_BUTTON_ICON_SIZE,
  RecordButton,
  useRecordButtonLabelClearance,
} from './record-button';

/** `Popover.Content`의 기본 간격과 같다 */
const INFO_POPOVER_GAP = 9;
/** 글자는 시스템 배율을 따르지 않아, 아이콘을 고정해야 라벨 기준선이 옆 칸과 어긋나지 않는다 */
const INFO_ICON_SIZE = 14;

interface VoiceNoteMarkControlProps {
  markCount: number;
  isListening: boolean;
  onPress: () => void;
}

export function VoiceNoteMarkControl({
  markCount,
  isListening,
  onPress,
}: VoiceNoteMarkControlProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const [isHintPending] = usePendingCoachmark({ accountId: me.id, kind: 'voice-note-mark' });
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const title = t('coach.mark.title');
  const description = t('coach.mark.description');
  const labelClearance = useRecordButtonLabelClearance();
  const iconSize = fontScaledSize(RECORD_BUTTON_ICON_SIZE);
  const isMarked = markCount > 0;

  return (
    <RecordButton.Column
      label={
        <Popover isOpen={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <Popover.Trigger asChild isDisabled={isHintPending}>
            <PressableFeedback
              hitSlop={{ top: RECORD_BUTTON_GAP - 2, bottom: 22, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('record.markInfo')}
              className="max-w-full"
              testID="voice-note-mark-info"
            >
              <HStack gap={4} align="center" justify="center">
                <Text
                  size="e1"
                  tone={isMarked ? 'brand' : 'neutral'}
                  shade={isMarked ? undefined : 7}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  className="shrink tabular-nums"
                >
                  {isMarked ? t('record.markWithCount', { amount: markCount }) : t('record.mark')}
                </Text>
                {!isHintPending && (
                  <InfoIcon
                    width={INFO_ICON_SIZE}
                    height={INFO_ICON_SIZE}
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
            offset={labelClearance + INFO_POPOVER_GAP}
          />
        </Popover>
      }
    >
      <CoachmarkPopover
        kind="voice-note-mark"
        title={title}
        description={description}
        icon={FlagIcon}
        align="center"
        isEnabled={isListening}
        isPassThrough
        isTargetDisabled={!isListening}
      >
        <RecordButton.Button
          label={isMarked ? t('record.markA11y', { amount: markCount }) : t('record.mark')}
          isActive={isMarked}
          onPress={onPress}
          isDisabled={!isListening}
          testID="voice-note-mark"
        >
          {isMarked ? (
            <FlagFilledIcon
              width={iconSize}
              height={iconSize}
              colorClassName="text-main"
              testID="voice-note-mark-active"
            />
          ) : (
            <FlagIcon width={iconSize} height={iconSize} colorClassName="text-gray-7" />
          )}
        </RecordButton.Button>
      </CoachmarkPopover>
    </RecordButton.Column>
  );
}
