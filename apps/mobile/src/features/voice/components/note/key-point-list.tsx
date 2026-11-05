import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/feature-discovery/hooks/use-my-pending-coachmark';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, FlagIcon, HStack, PlayIcon, Text, VStack, WordWrapText } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactElement } from 'react';

import type { VoiceNoteKeyPoint } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/format-media-time';

/** 위로 뜨는 시간 칩 안내의 높이. 이만큼 비워 요약과 "핵심 포인트" 제목을 가리지 않는다 */
const KEY_POINT_HINT_HEIGHT = 116;

interface KeyPointListProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  keyPoints: readonly VoiceNoteKeyPoint[];
  /** 지금 재생 위치가 속한 포인트. 모르면 강조하지 않는다 */
  activeKeyPointId?: string;
  /** 포인트를 누르면 그 지점부터 재생하라고 알린다. 들을 녹음이 없으면 넘기지 않아 누를 수 없다 */
  onPressKeyPoint?: (keyPoint: VoiceNoteKeyPoint) => void;
  /** 들을 수 있으면 시각이 있는 첫 포인트의 시간 칩에 "시간을 누르면 들려요" 안내를 처음 한 번 붙인다 */
  hasTimeCoachmark?: boolean;
}

/** 핵심 포인트 목록. 누르면 그 시각부터 들려주고, 재생 중인 포인트는 배경으로 강조한다 */
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
      {keyPoints.map((keyPoint) => (
        <KeyPointList.Item
          key={keyPoint.id}
          keyPoint={keyPoint}
          isActive={keyPoint.id === activeKeyPointId}
          isPlayable={onPressKeyPoint != null}
          hasTimeCoachmark={keyPoint.id === coachmarkKeyPointId}
          onPress={() => onPressKeyPoint?.(keyPoint)}
        />
      ))}
    </VStack>
  );
}

/** 안내가 남아 있는 동안만 말풍선 자리를 비운다 */
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
  isActive: boolean;
  isPlayable: boolean;
  hasTimeCoachmark: boolean;
}

function KeyPointItem({
  keyPoint,
  isActive,
  isPlayable,
  hasTimeCoachmark,
  className,
  ...pressableProps
}: KeyPointItemProps) {
  const { t } = useTranslation('voiceNote');
  const time = keyPoint.startMs == null ? null : formatMediaTime(keyPoint.startMs);
  const canPlay = isPlayable && time != null;
  const timeChip = time != null && (
    <Text
      size="e1"
      weight="bold"
      tone="brand"
      className="rounded-full bg-main/10 px-2 py-1 tabular-nums"
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
        {hasTimeCoachmark && timeChip !== false ? (
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
        icon={PlayIcon}
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

KeyPointList.Item = KeyPointItem;
