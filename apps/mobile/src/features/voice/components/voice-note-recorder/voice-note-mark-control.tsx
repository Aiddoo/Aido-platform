import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
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
import { Popover, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import {
  RECORD_BUTTON_GAP,
  RECORD_BUTTON_ICON_SIZE,
  RECORD_BUTTON_LABEL_CLEARANCE,
  RECORD_BUTTON_LABEL_MIN_SCALE,
  RecordButton,
} from './record-button';

/** `Popover.Content`의 기본 간격과 같다 */
const INFO_POPOVER_GAP = 9;
/** 글자는 시스템 배율을 따르지 않아, 아이콘을 고정해야 라벨 기준선이 옆 칸과 어긋나지 않는다 */
const INFO_ICON_SIZE = 14;
/** 라벨(한 줄)만으로는 44pt에 못 미쳐 위아래로 늘린다. 위는 위 버튼과 2pt 겹치지 않게 간격보다 조금 덜 늘린다 */
const LABEL_HIT_SLOP = { top: RECORD_BUTTON_GAP - 2, bottom: 22, left: 8, right: 8 } as const;

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
  const [isHintPending] = useMyPendingCoachmark('voice-note-mark');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const title = t('coach.mark.title');
  const description = t('coach.mark.description');
  const iconSize = fontScaledSize(RECORD_BUTTON_ICON_SIZE);
  const isMarked = markCount > 0;

  return (
    <RecordButton.Column
      label={
        <Popover isOpen={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <Popover.Trigger asChild isDisabled={isHintPending}>
            <PressableFeedback
              hitSlop={LABEL_HIT_SLOP}
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
                  minimumFontScale={RECORD_BUTTON_LABEL_MIN_SCALE}
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
            Icon={FlagIcon}
            title={title}
            description={description}
            align="center"
            offset={RECORD_BUTTON_LABEL_CLEARANCE + INFO_POPOVER_GAP}
          />
        </Popover>
      }
    >
      <CoachmarkPopover
        kind="voice-note-mark"
        title={title}
        description={description}
        Icon={FlagIcon}
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
