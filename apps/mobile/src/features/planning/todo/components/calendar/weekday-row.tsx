import { getWeekdayLabels } from '@src/shared/date/format/date-labels';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, type TextShade, type TextTone } from '@src/shared/ui';
import { match } from 'ts-pattern';

type WeekdayStyle = { tone: TextTone; shade: TextShade | undefined };

const SUNDAY_INDEX = 0;
const SATURDAY_INDEX = 6;

function getWeekdayStyle(dayIndex: number): WeekdayStyle {
  return match<number, WeekdayStyle>(dayIndex)
    .with(SUNDAY_INDEX, () => ({ tone: 'danger', shade: undefined }))
    .with(SATURDAY_INDEX, () => ({ tone: 'info', shade: undefined }))
    .otherwise(() => ({ tone: 'neutral', shade: 6 }));
}

export function WeekdayRow() {
  const { i18n } = useTranslation();

  return (
    <HStack px={8}>
      {getWeekdayLabels(i18n.language).map((label, dayIndex) => {
        const style = getWeekdayStyle(dayIndex);

        return (
          <Box key={label} className="flex-1 items-center py-2">
            <Text size="b4" weight="medium" shade={style.shade} tone={style.tone}>
              {label}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
}
