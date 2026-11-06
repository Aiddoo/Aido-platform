import { isSameDay, isSameMonth } from '@src/features/planning/todo/utils/calendar-date';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { getWeekdayLabels } from '@src/shared/date/date-labels';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Box,
  HStack,
  ListRow,
  SheetHeaderLayout,
  Text,
  VStack,
  IconButton,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import dayjs from 'dayjs';
import { PressableFeedback } from 'heroui-native';

import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';

interface TodoDatePickerContentProps {
  value: Date;
  onChange: (date: Date) => void;
  onCancel: () => void;
}

export function TodoDatePickerContent({ value, onChange, onCancel }: TodoDatePickerContentProps) {
  const picker = useDatePicker({ startDate: value });
  const { t } = useTranslation('todo');

  const handleConfirm = () => {
    onChange(picker.date);
  };

  return (
    <SheetHeaderLayout
      gap={20}
      header={
        <PickerHeader title={t('picker.dateTitle')} onCancel={onCancel} onConfirm={handleConfirm} />
      }
    >
      <VStack gap={20}>
        <QuickDateOptions picker={picker} onSelect={onChange} />

        <DatePickerCalendar picker={picker} onDatePress={picker.selectDate} />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface QuickDateOptionsProps {
  picker: DatePicker;
  onSelect: (date: Date) => void;
}

function QuickDateOptions({ picker, onSelect }: QuickDateOptionsProps) {
  const { t } = useTranslation('todo');
  const today = useToday();
  const todayStart = dayjs(today).startOf('day').toDate();
  const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

  return (
    <VStack gap={4}>
      <QuickDateRow
        label={t('picker.today')}
        date={todayStart}
        isSelected={isSameDay(picker.date, todayStart)}
        onSelect={onSelect}
      />
      <QuickDateRow
        label={t('picker.tomorrow')}
        date={tomorrowStart}
        isSelected={isSameDay(picker.date, tomorrowStart)}
        onSelect={onSelect}
      />
    </VStack>
  );
}

interface QuickDateRowProps {
  label: string;
  date: Date;
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

function QuickDateRow({ label, date, isSelected, onSelect }: QuickDateRowProps) {
  const { i18n } = useTranslation();
  const weekdayLabels = getWeekdayLabels(i18n.language);
  const tone = isSelected ? 'brand' : 'neutral';

  return (
    <PressableFeedback
      onPress={() => onSelect(date)}
      className={cn('rounded-lg', isSelected && 'bg-main/5')}
    >
      <ListRow
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{
              size: 'b2',
              weight: 'medium',
              tone,
              shade: isSelected ? undefined : 8,
            }}
          />
        }
        right={
          <Text size="b2" tone={tone} shade={isSelected ? undefined : 6}>
            {weekdayLabels[dayjs(date).day()]}
          </Text>
        }
        horizontalPadding="medium"
        verticalPadding="medium"
      />
    </PressableFeedback>
  );
}

interface DatePickerCalendarProps {
  picker: DatePicker;
  onDatePress: (date: Date) => void;
}

const DatePickerCalendar = ({ picker, onDatePress }: DatePickerCalendarProps) => {
  const { displayMonth, weeks, date: startDate, goToPrevMonth, goToNextMonth } = picker;
  const { t: tCommon } = useTranslation('common');
  const dateFormatContext = useDateFormatContext();

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <IconButton
          accessibilityLabel={tCommon('calendar.previousMonth')}
          icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />}
          className="min-h-0 min-w-0"
          hitSlop={12}
          onPress={goToPrevMonth}
        />
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {formatDateKeyLabel(
            toDateKey(displayMonth, dateFormatContext.timeZone),
            'yearMonth',
            dateFormatContext,
          )}
        </Text>
        <IconButton
          accessibilityLabel={tCommon('calendar.nextMonth')}
          icon={<ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />}
          className="min-h-0 min-w-0"
          hitSlop={12}
          onPress={goToNextMonth}
        />
      </HStack>

      <CalendarWeekdayHeader />

      {/* 달마다 4~6주라 6주 높이(48 × 6)를 미리 잡아 달을 넘겨도 시트 높이가 변하지 않게 한다 */}
      <VStack className="h-[288px]">
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
          <HStack key={weekIndex} px={8}>
            {week.map((date) =>
              isSameMonth(date, displayMonth) ? (
                <DatePickerDateCell
                  key={date.toISOString()}
                  date={date}
                  startDate={startDate}
                  onPress={onDatePress}
                />
              ) : (
                <Box key={date.toISOString()} className="h-[48px] flex-1" />
              ),
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
};

interface DatePickerDateCellProps {
  date: Date;
  startDate: Date;
  onPress: (date: Date) => void;
}

const DatePickerDateCell = ({ date, startDate, onPress }: DatePickerDateCellProps) => {
  const dayOfMonth = date.getDate();
  const today = useToday();
  const isSelected = isSameDay(date, startDate);
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today });
  const highlightToday = isTodayHighlighted({ date, isSelected, today });

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      className="relative h-[48px] flex-1 items-center justify-center"
    >
      <Box
        className={cn(
          'z-10 size-8 items-center justify-center rounded-[16px]',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text
          size="b3"
          weight="medium"
          tone={DAY_TYPE_TONE[dayStyle]}
          shade={isSelected ? undefined : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
};
