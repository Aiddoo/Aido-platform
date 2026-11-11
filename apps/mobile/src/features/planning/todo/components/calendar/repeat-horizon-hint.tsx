import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { InfoIcon, RepeatIcon } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { useFeedDateKey } from '../../hooks/use-feed-params';
import { useGetHasUpcomingRepeatQueryOptions } from '../../queries/todo.queries';
import { RepeatHintLine } from '../repeat-hint-line';

interface RepeatHorizonHintProps {
  /** 먼저 뜰 자동 화면(알림 화면·새로운 기능)이 남았으면 false라 안내를 미룬다. 눌러서 연 설명은 기다리지 않는다 */
  shouldShowHint?: boolean;
}

/** 달을 넘기면 닫히고, 읽을 틈 없이 넘긴 경우에는 본 것으로 남기지 않아 멈춘 달에서 다시 열린다 */
export function RepeatHorizonHint({ shouldShowHint = true }: RepeatHorizonHintProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const [selectedDateKey] = useFeedDateKey();
  const { data: hasUpcomingRepeat = false } = useQuery(useGetHasUpcomingRepeatQueryOptions());
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <CoachmarkPopover
      kind="repeat-horizon"
      title={t('repeat.horizonInfo.title')}
      description={t('repeat.horizonInfo.description')}
      Icon={RepeatIcon}
      placement="bottom"
      align="start"
      avoidCollisions
      isEnabled={isInfoOpen || hasUpcomingRepeat}
      isForced={isInfoOpen}
      shouldAutoOpen={shouldShowHint}
      isPassThrough={!isInfoOpen}
      onDismiss={() => setIsInfoOpen(false)}
      dismissKey={selectedDateKey}
    >
      <PressableFeedback
        onPress={() => setIsInfoOpen(true)}
        hitSlop={{ top: 12, bottom: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('repeat.horizonInfo.label')}
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
