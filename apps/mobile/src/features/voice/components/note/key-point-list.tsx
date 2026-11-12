import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, FlagIcon, HStack, PlayIcon, Text, VStack, WordWrapText } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactElement } from 'react';

import type { VoiceNoteKeyPoint } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/media-time.view-model';

/** 위로 뜨는 시간 칩 안내의 높이. 이만큼 비워 요약과 "핵심 포인트" 제목을 가리지 않는다 */
const KEY_POINT_HINT_HEIGHT = 116;

interface KeyPointListProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  keyPoints: readonly VoiceNoteKeyPoint[];
  activeKeyPointId?: string;
  onPressKeyPoint?: (keyPoint: VoiceNoteKeyPoint) => void;
  hasTimeCoachmark?: boolean;
}

export function KeyPointList({
  keyPoints,
  activeKeyPointId,
  onPressKeyPoint,
  hasTimeCoachmark = false,
  ...stackProps
}: KeyPointListProps) {
  // 들을 녹음이 없으면 안내가 사실이 아니라 띄우지 않고 소비하지도 않는다
  const coachmarkKeyPointId =
    hasTimeCoachmark && onPressKeyPoint != null
      ? keyPoints.find(({ startMs }) => startMs != null)?.id
      : undefined;

  return (
    <VStack gap={4} {...stackProps}>
      {coachmarkKeyPointId != null && <KeyPointHintSpace />}
      {keyPoints.map((keyPoint, index) => (
        <KeyPointList.Item
          key={keyPoint.id}
          keyPoint={keyPoint}
          isSameTimeAsPrevious={hasSameTime(keyPoint, keyPoints[index - 1])}
          isActive={keyPoint.id === activeKeyPointId}
          isPlayable={onPressKeyPoint != null}
          hasTimeCoachmark={keyPoint.id === coachmarkKeyPointId}
          onPress={() => onPressKeyPoint?.(keyPoint)}
        />
      ))}
    </VStack>
  );
}

/** 한 문장에서 포인트가 여러 개 나오면 시각이 같다. 초 단위로 같게 보이면 같은 칩이 줄줄이 서지 않게 비교한다 */
function hasSameTime(keyPoint: VoiceNoteKeyPoint, previous: VoiceNoteKeyPoint | undefined) {
  return (
    keyPoint.startMs != null &&
    previous?.startMs != null &&
    formatMediaTime(keyPoint.startMs) === formatMediaTime(previous.startMs)
  );
}

function KeyPointHintSpace() {
  const fontScaledSize = useFontScaledSize();
  const [isHintPending] = useMyPendingCoachmark('voice-key-point');

  return isHintPending && <Box style={{ height: fontScaledSize(KEY_POINT_HINT_HEIGHT) }} />;
}

interface KeyPointItemProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel'
> {
  keyPoint: VoiceNoteKeyPoint;
  /** 칩을 숨기되 글자 시작선이 위 포인트와 맞게 자리는 남긴다. 눌러서 재생하는 건 그대로다 */
  isSameTimeAsPrevious: boolean;
  isActive: boolean;
  isPlayable: boolean;
  hasTimeCoachmark: boolean;
}

/** 칩이 터치를 받으면 포인트 재생이 막혀 안내는 자리만 재고 터치는 행으로 넘긴다 */
function KeyPointTimeCoachmark({ children }: { children: ReactElement }) {
  const { t } = useTranslation('voiceNote');

  return (
    <Box pointerEvents="none">
      <CoachmarkPopover
        kind="voice-key-point"
        title={t('coach.keyPoint.title')}
        description={t('coach.keyPoint.description')}
        Icon={PlayIcon}
        // 아래로 띄우면 다음 포인트를 가린다. 위쪽 자리가 모자라면 말풍선이 알아서 뒤집는다
        placement="top"
        align="start"
        avoidCollisions
      >
        {children}
      </CoachmarkPopover>
    </Box>
  );
}

KeyPointList.Item = function Item({
  keyPoint,
  isSameTimeAsPrevious,
  isActive,
  isPlayable,
  hasTimeCoachmark,
  className,
  ...pressableProps
}: KeyPointItemProps) {
  const { t } = useTranslation('voiceNote');
  const time = keyPoint.startMs == null ? null : formatMediaTime(keyPoint.startMs);
  const canPlay = isPlayable && time != null;
  const timeChip =
    time == null ? null : (
      <Text
        size="e1"
        weight="bold"
        tone="brand"
        accessibilityElementsHidden={isSameTimeAsPrevious}
        importantForAccessibility={isSameTimeAsPrevious ? 'no-hide-descendants' : 'auto'}
        className={cn(
          'rounded-full bg-main/10 px-2 py-1 tabular-nums',
          isSameTimeAsPrevious && 'opacity-0',
        )}
      >
        {time}
      </Text>
    );

  return (
    <PressableFeedback
      accessibilityRole={canPlay ? 'button' : undefined}
      accessibilityLabel={canPlay ? t('keyPoints.playFrom', { time }) : undefined}
      accessibilityState={{ selected: isActive }}
      isDisabled={!canPlay}
      className={cn('rounded-xl p-3', isActive && 'bg-main/10', className)}
      {...pressableProps}
    >
      <HStack gap={12} className="items-start">
        {hasTimeCoachmark && timeChip != null ? (
          <KeyPointTimeCoachmark>{timeChip}</KeyPointTimeCoachmark>
        ) : (
          timeChip
        )}
        <WordWrapText size="b3" className="shrink flex-1">
          {keyPoint.text}
        </WordWrapText>
        {keyPoint.isBookmarked && (
          <FlagIcon
            colorClassName="text-main"
            width={16}
            height={16}
            accessibilityLabel={t('keyPoints.marked')}
          />
        )}
      </HStack>
    </PressableFeedback>
  );
};
