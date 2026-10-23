import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, type TextShade, type TextTone } from '@src/shared/ui';
import { getWeekdayLabels } from '@src/shared/utils/date';
import { match } from 'ts-pattern';

type WeekdayStyle = { tone: TextTone; shade: TextShade | undefined };

const SUNDAY_INDEX = 0;
const SATURDAY_INDEX = 6;

const getWeekdayStyle = (dayIndex: number): WeekdayStyle => {
  return match<number, WeekdayStyle>(dayIndex)
    .with(SUNDAY_INDEX, () => ({ tone: 'danger', shade: undefined }))
    .with(SATURDAY_INDEX, () => ({ tone: 'info', shade: undefined }))
    .otherwise(() => ({ tone: 'neutral', shade: 6 }));
};

export const CalendarWeekdayHeader = () => {
  // 언어 변경 시 리렌더를 위해 useTranslation 구독
  useTranslation();

  return (
    <HStack px={8}>
      {getWeekdayLabels().map((label, dayIndex) => {
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
};
