import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, Box, HStack, PlusIcon, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  getDayOfWeekLabel,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
  toDate,
} from '@src/shared/utils/date';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { PressableFeedback } from 'heroui-native';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import type { TodoRepeatFormValues } from '../domains/todo-repeat-form.schema';
import {
  type TodoRepeat,
  type TodoRepeatEndType,
  type TodoRepeatKind,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';
import { useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function PresetChip({ label, isSelected, onPress }: PresetChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'h-8 items-center justify-center rounded-4xl px-3',
        isSelected ? 'bg-main' : 'bg-gray-2',
      )}
    >
      <Text
        size="b4"
        weight="medium"
        maxLines={1}
        className={isSelected ? 'text-white' : undefined}
        shade={isSelected ? undefined : 7}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}

interface DayOfWeekChipProps {
  day: DayOfWeek;
  isSelected: boolean;
  onPress: () => void;
}

function DayOfWeekChip({ day, isSelected, onPress }: DayOfWeekChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'size-8 items-center justify-center rounded-4xl',
        isSelected ? 'bg-main' : 'bg-gray-2',
      )}
    >
      <Text
        size="b4"
        weight="medium"
        className={isSelected ? 'text-white' : undefined}
        shade={isSelected ? undefined : 7}
      >
        {getDayOfWeekLabel(day)}
      </Text>
    </PressableFeedback>
  );
}

interface RepeatKindSelectorProps {
  startDateKey: string;
}

function RepeatKindSelector({ startDateKey }: RepeatKindSelectorProps) {
  const { t } = useTranslation('todo');
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const kind = useWatch({ control, name: 'kind' });
  const monthDay = Number(startDateKey.slice(8, 10));

  const handleKindPress = (nextKind: TodoRepeatKind) => {
    setValue('kind', nextKind);
    setValue('repeat', TodoRepeatPolicy.withKind(getValues('repeat'), nextKind, startDateKey));
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1.5 px-4"
    >
      <PresetChip
        label={t('repeat.kind.NONE', { day: monthDay })}
        isSelected={kind === 'NONE'}
        onPress={() => handleKindPress('NONE')}
      />
      <PresetChip
        label={t('repeat.kind.DAILY', { day: monthDay })}
        isSelected={kind === 'DAILY'}
        onPress={() => handleKindPress('DAILY')}
      />
      <PresetChip
        label={t('repeat.kind.WEEKDAYS', { day: monthDay })}
        isSelected={kind === 'WEEKDAYS'}
        onPress={() => handleKindPress('WEEKDAYS')}
      />
      <PresetChip
        label={t('repeat.kind.WEEKLY', { day: monthDay })}
        isSelected={kind === 'WEEKLY'}
        onPress={() => handleKindPress('WEEKLY')}
      />
      <PresetChip
        label={t('repeat.kind.BIWEEKLY', { day: monthDay })}
        isSelected={kind === 'BIWEEKLY'}
        onPress={() => handleKindPress('BIWEEKLY')}
      />
      <PresetChip
        label={t('repeat.kind.MONTHLY', { day: monthDay })}
        isSelected={kind === 'MONTHLY'}
        onPress={() => handleKindPress('MONTHLY')}
      />
    </ScrollView>
  );
}

function WeekdaySelector() {
  const { t } = useTranslation('todo');
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const repeat = useWatch({ control, name: 'repeat' });

  if (repeat == null || repeat.frequency !== 'WEEKLY') {
    return null;
  }

  const change = (next: TodoRepeat) => setValue('repeat', next);
  const current = () => getValues('repeat') ?? repeat;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1.5 px-4"
    >
      <PresetChip
        label={t('repeat.weekdayPreset.ALL')}
        isSelected={TodoRepeatPolicy.hasWeekdays(repeat, DAYS_OF_WEEK)}
        onPress={() => change(TodoRepeatPolicy.withWeekdayPreset(current(), 'ALL'))}
      />
      <PresetChip
        label={t('repeat.weekdayPreset.WEEKDAYS')}
        isSelected={TodoRepeatPolicy.hasWeekdays(repeat, ['MON', 'TUE', 'WED', 'THU', 'FRI'])}
        onPress={() => change(TodoRepeatPolicy.withWeekdayPreset(current(), 'WEEKDAYS'))}
      />
      <PresetChip
        label={t('repeat.weekdayPreset.WEEKENDS')}
        isSelected={TodoRepeatPolicy.hasWeekdays(repeat, ['SAT', 'SUN'])}
        onPress={() => change(TodoRepeatPolicy.withWeekdayPreset(current(), 'WEEKENDS'))}
      />
      {DAYS_OF_WEEK.map((day) => (
        <DayOfWeekChip
          key={day}
          day={day}
          isSelected={repeat.weekdays.includes(day)}
          onPress={() => change(TodoRepeatPolicy.withWeekdayToggled(current(), day))}
        />
      ))}
    </ScrollView>
  );
}

interface CountStepperProps {
  count: number;
  onCountChange: (count: number) => void;
}

function CountStepper({ count, onCountChange }: CountStepperProps) {
  const { t } = useTranslation('todo');

  return (
    <HStack gap={12} align="center" className="px-4">
      <PressableFeedback
        onPress={() => onCountChange(count - 1)}
        isDisabled={count <= TODO_REPEAT_COUNT.MIN}
        accessibilityRole="button"
        accessibilityLabel={t('repeat.end.countDecrease')}
        className={cn(
          'size-8 items-center justify-center rounded-full bg-gray-2',
          count <= TODO_REPEAT_COUNT.MIN && 'opacity-40',
        )}
      >
        <Text size="b2" weight="medium" shade={7}>
          −
        </Text>
      </PressableFeedback>
      <Text size="b2" weight="semibold" className="tabular-nums" tone="brand">
        {t('repeat.end.COUNT', { count })}
      </Text>
      <PressableFeedback
        onPress={() => onCountChange(count + 1)}
        isDisabled={count >= TODO_REPEAT_COUNT.MAX}
        accessibilityRole="button"
        accessibilityLabel={t('repeat.end.countIncrease')}
        className={cn(
          'size-8 items-center justify-center rounded-full bg-gray-2',
          count >= TODO_REPEAT_COUNT.MAX && 'opacity-40',
        )}
      >
        <PlusIcon width={14} height={14} colorClassName="text-gray-7" />
      </PressableFeedback>
    </HStack>
  );
}

interface TodoRepeatPickerContentProps {
  startDate: Date;
  value: TodoRepeat | null;
  onChange: (value: TodoRepeat | null) => void;
  onCancel: () => void;
}

export const TodoRepeatPickerContent = ({
  startDate,
  value,
  onChange,
  onCancel,
}: TodoRepeatPickerContentProps) => {
  const { t } = useTranslation('todo');
  const startDateKey = toDeviceDateKey(startDate);
  const methods = useForm<TodoRepeatFormValues>({
    defaultValues: { kind: TodoRepeatPolicy.getKind(value), repeat: value },
  });

  return (
    <FormProvider {...methods}>
      <VStack gap={20}>
        <PickerHeader
          title={t('picker.repeatTitle')}
          onCancel={onCancel}
          onConfirm={() => onChange(methods.getValues('repeat'))}
        />

        <RepeatKindSelector startDateKey={startDateKey} />
        <WeekdaySelector />
        <RepeatEndSection startDate={startDate} />
      </VStack>
    </FormProvider>
  );
};

interface RepeatEndSectionProps {
  startDate: Date;
}

function RepeatEndSection({ startDate }: RepeatEndSectionProps) {
  const { t } = useTranslation('todo');
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const repeat = useWatch({ control, name: 'repeat' });
  const startDateKey = toDeviceDateKey(startDate);

  if (repeat == null) {
    return null;
  }

  const change = (next: TodoRepeat) => setValue('repeat', next);
  const handleEndTypeChange = (type: TodoRepeatEndType) =>
    change(TodoRepeatPolicy.withEndType(getValues('repeat') ?? repeat, type, startDateKey));

  return (
    <>
      <VStack gap={12}>
        <Text size="b3" tone="neutral" shade={7} className="px-4">
          {t('repeat.end.title')}
        </Text>
        <HStack gap={6} className="px-4">
          <PresetChip
            label={t('repeat.end.NEVER')}
            isSelected={repeat.end.type === 'NEVER'}
            onPress={() => handleEndTypeChange('NEVER')}
          />
          <PresetChip
            label={t('repeat.end.UNTIL')}
            isSelected={repeat.end.type === 'UNTIL'}
            onPress={() => handleEndTypeChange('UNTIL')}
          />
          <PresetChip
            label={t('repeat.end.COUNT', {
              count: repeat.end.type === 'COUNT' ? repeat.end.count : TODO_REPEAT_COUNT.DEFAULT,
            })}
            isSelected={repeat.end.type === 'COUNT'}
            onPress={() => handleEndTypeChange('COUNT')}
          />
        </HStack>
        {repeat.end.type === 'COUNT' && (
          <CountStepper
            count={repeat.end.count}
            onCountChange={(count) => change(TodoRepeatPolicy.withCount(repeat, count))}
          />
        )}
      </VStack>

      {repeat.end.type === 'UNTIL' && (
        <UntilCalendar
          startDate={startDate}
          untilDate={toDate(repeat.end.date)}
          onUntilDateChange={(date) =>
            change(TodoRepeatPolicy.withUntilDate(repeat, toDeviceDateKey(date)))
          }
        />
      )}

      <VStack gap={4} className="border-t border-gray-2 px-4 pt-3">
        {TodoRepeatPolicy.isMonthDayClamped(repeat) && (
          <Text size="b4" tone="neutral" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('repeat.monthEndHint')}
          </Text>
        )}
        <Text size="b4" tone="neutral" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('repeat.horizonHint')}
        </Text>
      </VStack>
    </>
  );
}

interface UntilCalendarProps {
  startDate: Date;
  untilDate: Date;
  onUntilDateChange: (date: Date) => void;
}

const UntilCalendar = ({ startDate, untilDate, onUntilDateChange }: UntilCalendarProps) => {
  const picker = useDatePicker({ startDate: untilDate });
  const today = useToday();

  return (
    <RepeatCalendar
      picker={picker}
      today={today}
      startDate={startDate}
      endDate={untilDate}
      onDatePress={(date) => {
        if (!isBeforeDay(date, startDate)) {
          onUntilDateChange(date);
        }
      }}
    />
  );
};

interface RepeatCalendarProps {
  picker: ReturnType<typeof useDatePicker>;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  onDatePress: (date: Date) => void;
}

const RepeatCalendar = ({
  picker,
  today,
  startDate,
  endDate,
  onDatePress,
}: RepeatCalendarProps) => {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;
  const dateFormatContext = useDateFormatContext();

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <PressableFeedback onPress={goToPrevMonth} hitSlop={12}>
          <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {formatDateKeyLabel(
            formatDateKey(displayMonth, getDeviceTimezone()),
            'yearMonth',
            dateFormatContext,
          )}
        </Text>
        <PressableFeedback onPress={goToNextMonth} hitSlop={12}>
          <ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />
        </PressableFeedback>
      </HStack>

      <CalendarWeekdayHeader />

      <VStack>
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
          <HStack key={weekIndex} px={8}>
            {week.map((date) =>
              isSameMonth(date, displayMonth) ? (
                <RepeatDateCell
                  key={date.toISOString()}
                  date={date}
                  today={today}
                  startDate={startDate}
                  endDate={endDate}
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

interface RepeatDateCellProps {
  date: Date;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  onPress: (date: Date) => void;
}

const RepeatDateCell = ({ date, today, startDate, endDate, onPress }: RepeatDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isDisabled = isBeforeDay(date, today);
  const isStart = isSameDay(date, startDate);
  const isEnd = endDate != null && isSameDay(date, endDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today });
  const shouldHighlightToday = !isDisabled && isTodayHighlighted({ date, isSelected, today });

  const hasDistinctRange = endDate != null && !isSameDay(startDate, endDate);
  const isInRange = hasDistinctRange && isAfterDay(date, startDate) && isBeforeDay(date, endDate);
  const isRangeStart = hasDistinctRange && isStart;
  const isRangeEnd = hasDistinctRange && isEnd;

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      isDisabled={isDisabled}
      className={cn(
        'relative h-[48px] flex-1 items-center justify-center',
        isDisabled && 'opacity-30',
      )}
    >
      {isRangeStart && <Box className="absolute right-0 top-[8px] h-[32px] w-1/2 bg-main/8" />}
      {isRangeEnd && <Box className="absolute left-0 top-[8px] h-[32px] w-1/2 bg-main/8" />}
      {isInRange && <Box className="absolute inset-x-0 top-[8px] h-[32px] bg-main/8" />}
      <Box
        className={cn(
          'z-10 size-8 items-center justify-center rounded-[16px]',
          isSelected && 'bg-main',
          shouldHighlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text
          size="b3"
          weight="medium"
          tone={isDisabled ? 'neutral' : DAY_TYPE_TONE[dayStyle]}
          shade={isSelected ? undefined : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
};
