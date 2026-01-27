import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import type { TextShade, TextTone } from '@src/shared/ui/Text/Text.types';
import { WEEKDAY_LABELS } from '@src/shared/utils/date';
import { match } from 'ts-pattern';

type WeekdayStyle = { tone: TextTone; shade: TextShade | undefined };

const getWeekdayStyle = (label: string): WeekdayStyle => {
  return match<string, WeekdayStyle>(label)
    .with('일', () => ({ tone: 'danger', shade: undefined }))
    .with('토', () => ({ tone: 'info', shade: undefined }))
    .otherwise(() => ({ tone: 'neutral', shade: 6 }));
};

export const CalendarWeekdayHeader = () => {
  return (
    <HStack px={8}>
      {WEEKDAY_LABELS.map((label) => {
        const style = getWeekdayStyle(label);

        return (
          <Box key={label} className="flex-1 items-center py-2">
            <Text size="e1" weight="medium" shade={style.shade} tone={style.tone}>
              {label}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
};
