import { Text } from '@src/shared/ui/Text/Text';
import { getMonthHeaderText, getWeekHeaderText } from '@src/shared/utils/date';
import { match } from 'ts-pattern';
import type { CalendarViewMode } from './calendar.types';

interface CalendarHeaderTextProps {
  viewMode: CalendarViewMode;
  displayDate: Date;
}

export const CalendarHeaderText = ({ viewMode, displayDate }: CalendarHeaderTextProps) => {
  const headerText = match(viewMode)
    .with('week', () => getWeekHeaderText(displayDate))
    .with('month', () => getMonthHeaderText(displayDate))
    .exhaustive();

  return (
    <Text size="t3" weight="semibold">
      {headerText}
    </Text>
  );
};
