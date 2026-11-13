import type { DateKey } from '@src/shared/date/date-key';
import { Box, FishIcon, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';

import type { DailyCompletionSummary } from '../../domains/daily-completion.model';
import { type CalendarDayType, DAY_TYPE_TONE } from '../../utils/calendar-day.view-model';

export const CALENDAR_DATE_CELL_HEIGHT = 56;
const MAX_CATEGORY_INDICATOR_COUNT = 3;

interface CalendarDateCellProps {
  dateKey: DateKey;
  dayNumber: string;
  /** 읽어 줄 날짜. 쪽마다 한 번 만들어 칸이 다시 그려질 때 Intl을 부르지 않는다 */
  label: string;
  isSelected: boolean;
  dayType: CalendarDayType;
  isTodayHighlighted: boolean;
  isOutsideMonth: boolean;
  completion: DailyCompletionSummary | undefined;
  onSelect: (dateKey: DateKey) => void;
}

/** 칸이 많아 pager가 route를 한 번 읽고 파생 값만 넘긴다. 날짜를 바꾸면 선택이 바뀐 칸만 다시 그린다 */
export const CalendarDateCell = memo(function CalendarDateCell({
  dateKey,
  dayNumber,
  label,
  isSelected,
  dayType,
  isTodayHighlighted,
  isOutsideMonth,
  completion,
  onSelect,
}: CalendarDateCellProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(dateKey)}
      style={{ height: CALENDAR_DATE_CELL_HEIGHT }}
      className={cn('flex-1 items-center justify-between py-1', isOutsideMonth && 'opacity-20')}
    >
      <Box
        className={cn(
          'size-7.5 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          isTodayHighlighted && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text size="b4" weight="medium" tone={DAY_TYPE_TONE[dayType]} shade={7}>
          {dayNumber}
        </Text>
      </Box>
      <Box className="h-3 items-center justify-center">
        <CompletionIndicator completion={completion} />
      </Box>
    </PressableFeedback>
  );
});

interface CompletionIndicatorProps {
  completion: DailyCompletionSummary | undefined;
}

function CompletionIndicator({ completion }: CompletionIndicatorProps) {
  if (completion == null) {
    return null;
  }
  if (completion.isComplete) {
    return <FishIcon width={16} height={12} colorClassName="text-fish" />;
  }
  if (completion.totalTodos > 0) {
    return <CategoryIndicator colors={completion.categoryColors} />;
  }

  return null;
}

interface CategoryIndicatorProps {
  colors: string[];
}

function CategoryIndicator({ colors }: CategoryIndicatorProps) {
  const [firstColor] = colors;

  if (colors.length <= 1) {
    return (
      <Box
        className={cn('size-1.5 rounded-2xl', firstColor == null && 'bg-gray-5')}
        style={firstColor == null ? undefined : { backgroundColor: firstColor }}
      />
    );
  }

  return (
    <HStack className="h-1.5 w-4 overflow-hidden rounded-2xl">
      {colors.slice(0, MAX_CATEGORY_INDICATOR_COUNT).map((color) => (
        <Box key={color} style={{ backgroundColor: color }} className="flex-1" />
      ))}
    </HStack>
  );
}
