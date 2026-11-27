import type { DayOfWeek } from '@aido/api/vocabulary';
import { getDayOfWeekLabel } from '@src/shared/date/format/date-labels';
import { CALENDAR_DAYS_OF_WEEK } from '@src/shared/date/week-start';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, type TextShade, type TextTone } from '@src/shared/ui';
import { match } from 'ts-pattern';

type WeekdayStyle = { tone: TextTone; shade: TextShade | undefined };

function getWeekdayStyle(day: DayOfWeek): WeekdayStyle {
  return match<DayOfWeek, WeekdayStyle>(day)
    .with('SUN', () => ({ tone: 'danger', shade: undefined }))
    .with('SAT', () => ({ tone: 'info', shade: undefined }))
    .otherwise(() => ({ tone: 'neutral', shade: 6 }));
}

export function WeekdayRow() {
  const { i18n } = useTranslation();

  return (
    <HStack px={8}>
      {CALENDAR_DAYS_OF_WEEK.map((day) => {
        const style = getWeekdayStyle(day);

        return (
          <Box key={day} className="flex-1 items-center py-2">
            <Text size="b4" weight="medium" shade={style.shade} tone={style.tone}>
              {getDayOfWeekLabel(day, i18n.language)}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
}
