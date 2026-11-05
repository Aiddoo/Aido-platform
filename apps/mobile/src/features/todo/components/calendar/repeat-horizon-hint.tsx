import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { InfoIcon, RepeatIcon } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { useFeedDateKey } from '../../hooks/use-feed-date';
import { useGetHasUpcomingRepeatQueryOptions } from '../../queries/get-has-upcoming-repeat-query-options';
import { RepeatHintLine } from '../repeat-hint-line';

/**
 * 달력 아래 3개월 안내. 반복 할 일이 있는 계정이 범위를 처음 넘으면 설명을 한 번 자동으로 열고,
 * 그 뒤에는 줄을 눌러 다시 본다. 자동으로 열려도 달력 넘기기를 막지 않는다. 달을 넘기면 닫히고,
 * 읽을 틈 없이 넘긴 경우에는 본 것으로 남기지 않아 멈춘 달에서 다시 열린다.
 */
export function RepeatHorizonHint() {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const selectedDateKey = useFeedDateKey();
  const { data: hasUpcomingRepeat = false } = useQuery(useGetHasUpcomingRepeatQueryOptions());
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <CoachmarkPopover
      kind="repeat-horizon"
      title={t('repeat.horizonInfo.title')}
      description={t('repeat.horizonInfo.description')}
      icon={RepeatIcon}
      placement="bottom"
      align="start"
      avoidCollisions
      isEnabled={isInfoOpen || hasUpcomingRepeat}
      isForced={isInfoOpen}
      isPassThrough={!isInfoOpen}
      onDismiss={() => setIsInfoOpen(false)}
      dismissKey={selectedDateKey}
    >
      <PressableFeedback
        onPress={() => setIsInfoOpen(true)}
        hitSlop={{ top: 12, bottom: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('repeat.horizonInfo.label')}
        className="mx-4 self-start"
        testID="repeat-horizon-hint"
      >
        <RepeatHintLine
          right={
            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          }
        >
          {t('repeat.horizonHint')}
        </RepeatHintLine>
      </PressableFeedback>
    </CoachmarkPopover>
  );
}
