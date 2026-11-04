import { useTranslation } from '@src/shared/i18n';
import { FlagIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { VoiceNoteKeyPoint } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/format-media-time';

interface KeyPointListProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  keyPoints: readonly VoiceNoteKeyPoint[];
  /** 지금 재생 위치가 속한 포인트. 모르면 강조하지 않는다 */
  activeKeyPointId?: string;
  /** 포인트를 누르면 그 지점부터 재생하라고 알린다 */
  onPressKeyPoint: (keyPoint: VoiceNoteKeyPoint) => void;
}

/** 핵심 포인트 목록. 누르면 그 시각부터 들려주고, 재생 중인 포인트는 배경으로 강조한다 */
export function KeyPointList({
  keyPoints,
  activeKeyPointId,
  onPressKeyPoint,
  ...stackProps
}: KeyPointListProps) {
  return (
    <VStack gap={2} {...stackProps}>
      {keyPoints.map((keyPoint) => (
        <KeyPointList.Item
          key={keyPoint.id}
          keyPoint={keyPoint}
          isActive={keyPoint.id === activeKeyPointId}
          onPress={() => onPressKeyPoint(keyPoint)}
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
}

function KeyPointItem({ keyPoint, isActive, className, ...pressableProps }: KeyPointItemProps) {
  const { t } = useTranslation('voiceNote');
  const time = keyPoint.startMs == null ? null : formatMediaTime(keyPoint.startMs);

  return (
    <PressableFeedback
      accessibilityRole={time == null ? undefined : 'button'}
      accessibilityLabel={time == null ? undefined : t('keyPoints.playFrom', { time })}
      accessibilityState={{ selected: isActive }}
      isDisabled={time == null}
      className={cn('rounded-xl p-2.5', isActive && 'bg-main/10', className)}
      {...pressableProps}
    >
      <HStack gap={10} className="items-start">
        {time != null && (
          <Text
            size="e1"
            weight="bold"
            tone="brand"
            className="mt-px rounded-full bg-main/10 px-2 py-0.5 tabular-nums"
          >
            {time}
          </Text>
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

KeyPointList.Item = KeyPointItem;
