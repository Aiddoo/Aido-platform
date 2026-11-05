import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useTranslation } from '@src/shared/i18n';
import { Box, FlagIcon, HStack, PlayIcon, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactElement } from 'react';

import type { VoiceNoteKeyPoint } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/format-media-time';

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
        <Text size="b3" lineBreakStrategyIOS="hangul-word" className="shrink flex-1">
          {keyPoint.text}
        </Text>
        {keyPoint.isBookmarked && (
          <FlagIcon
            colorClassName="accent-main"
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
        placement="bottom"
        align="start"
        avoidCollisions
      >
        {children}
      </CoachmarkPopover>
    </Box>
  );
}

KeyPointList.Item = KeyPointItem;
