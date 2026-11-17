import { getIsoWeekYear } from '@src/shared/date/date-key';
import { formatYearLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  HStack,
  IconButton,
  type StyledIcon,
  Text,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { AchievementYearsPolicy } from '../domains/achievement-years.model';
import { useAchievementYear } from '../hooks/use-achievement-params';
import { useGetAchievementYearsQueryOptions } from '../queries/achievement.queries';

const ARROW_SIZE = 20;

/**
 * 배지·기록이 어느 해의 것인지 보이고 기록 있는 앞뒤 해로 옮긴다. 고를 해가 없고 올해를 보면 숨는다.
 * 해가 바뀐 직후 지난해 53주를 보일 때도 연도가 보여 새해 기록이 아님을 안다
 */
export function AchievementYearBar({
  className,
}: Pick<ComponentProps<typeof HStack>, 'className'>) {
  const { t } = useTranslation('achievement');

  const { data: achievementYears } = useSuspenseQuery(useGetAchievementYearsQueryOptions());
  // 보이는 해는 기록 있는 연도를 받아야 정해진다
  const [year, setYear] = useAchievementYear(achievementYears);

  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  const previousYear = AchievementYearsPolicy.findPreviousYear(achievementYears, year);
  const nextYear = AchievementYearsPolicy.findNextYear(achievementYears, year);
  const hasNothingToSwitch = previousYear == null && nextYear == null;
  const isShowingCurrentYear = year === getIsoWeekYear(todayKey);

  if (hasNothingToSwitch && isShowingCurrentYear) {
    return null;
  }

  return (
    <HStack align="center" justify="center" className={cn('gap-3', className)}>
      <AchievementYearBar.Step
        accessibilityLabel={t('yearBar.previousYear')}
        Icon={ArrowLeftIcon}
        targetYear={previousYear}
        onSelectYear={setYear}
      />
      <Text size="b2" weight="semibold" shade={9}>
        {formatYearLabel(year, dateFormatContext)}
      </Text>
      <AchievementYearBar.Step
        accessibilityLabel={t('yearBar.nextYear')}
        Icon={ArrowRightIcon}
        targetYear={nextYear}
        onSelectYear={setYear}
      />
    </HStack>
  );
}

interface StepProps {
  accessibilityLabel: string;
  Icon: StyledIcon;
  /** 옮겨 갈 기록 있는 해. 없으면 꺼진다 */
  targetYear: number | null;
  onSelectYear: (year: number) => void;
}

AchievementYearBar.Step = function Step({
  accessibilityLabel,
  Icon,
  targetYear,
  onSelectYear,
}: StepProps) {
  const fontScaledSize = useFontScaledSize();
  const hasTargetYear = targetYear != null;

  const handlePress = () => {
    if (targetYear != null) {
      onSelectYear(targetYear);
    }
  };

  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      icon={
        <Icon
          width={fontScaledSize(ARROW_SIZE)}
          height={fontScaledSize(ARROW_SIZE)}
          colorClassName={cn(hasTargetYear && 'text-gray-6', !hasTargetYear && 'text-gray-3')}
        />
      }
      isDisabled={!hasTargetYear}
      onPress={handlePress}
    />
  );
};

/** 연도를 받지 못하면 배지·기록 경계가 다시 시도를 보이므로 막대는 자리를 비운다 */
AchievementYearBar.Error = function ErrorFallback() {
  return null;
};
