import type { DateKey } from '@src/shared/date/date-key';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';
import { match } from 'ts-pattern';

import { PICKER_DATE_CELL_HEIGHT } from '../constants/todo.constants';
import { type CalendarDayType, DAY_TYPE_TONE } from '../utils/calendar-day';

interface PickerDateCellProps {
  dateKey: DateKey;
  dayNumber: string;
  /** 읽어 줄 날짜. 달을 그릴 때 한 번 만들어 칸에서 Intl을 부르지 않는다 */
  label: string;
  dayType: CalendarDayType;
  isSelected: boolean;
  isTodayHighlighted: boolean;
  /** 고를 수 없는 날(반복 시작 전) */
  isDisabled?: boolean;
  /** 기간 안이지만 반복하지 않는 날 */
  isDimmed?: boolean;
  onPress: (dateKey: DateKey) => void;
}

/** 날짜·반복 피커가 함께 쓰는 칸. 값이 바뀐 칸만 다시 그리고 칸 안에서 훅·날짜 계산을 하지 않는다 */
function PickerDateCellBase({
  dateKey,
  dayNumber,
  label,
  dayType,
  isSelected,
  isTodayHighlighted,
  isDisabled = false,
  isDimmed = false,
  onPress,
}: PickerDateCellProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      onPress={() => onPress(dateKey)}
      style={{ height: PICKER_DATE_CELL_HEIGHT }}
      isDisabled={isDisabled}
      className={cn('relative flex-1 items-center justify-center', isDisabled && 'opacity-30')}
    >
      <Box
        className={cn(
          'z-10 size-8 items-center justify-center rounded-[16px]',
          isSelected && 'bg-main',
          isTodayHighlighted && !isDisabled && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text
          size="b3"
          weight="medium"
          tone={isDisabled || isDimmed ? 'neutral' : DAY_TYPE_TONE[dayType]}
          shade={match({ isSelected, isDimmed })
            .with({ isSelected: true }, () => undefined)
            .with({ isDimmed: true }, () => 5 as const)
            .otherwise(() => 7 as const)}
        >
          {dayNumber}
        </Text>
      </Box>
    </PressableFeedback>
  );
}

/** 보고 있는 달 밖의 칸. 자리만 잡아 주 줄의 칸 폭을 맞춘다 */
function Placeholder() {
  return <Box className="flex-1" style={{ height: PICKER_DATE_CELL_HEIGHT }} />;
}

export const PickerDateCell = Object.assign(memo(PickerDateCellBase), { Placeholder });
