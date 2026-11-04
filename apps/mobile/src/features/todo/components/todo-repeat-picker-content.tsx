import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Box,
  Button,
  HStack,
  PlusIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatDaysOfWeek,
  getDayOfWeekLabel,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { clamp, without, xor } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import {
  TODO_REPEAT_COUNT,
  TODO_REPEAT_WEEKDAYS,
  TODO_REPEAT_WEEKEND_DAYS,
} from '../constants/todo-repeat.constants';
import type { TodoRepeatFormValues } from '../domains/todo-repeat-form.schema';
import {
  getMonthDayOfDateKey,
  type TodoRepeat,
  type TodoRepeatEndType,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';
import { useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import {
  canConfirmTodoRepeatForm,
  toTodoRepeat,
  toTodoRepeatFormValues,
  withTodoRepeatFormStartDate,
} from '../utils/todo-repeat-form-values';
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

const isSameWeekdays = (a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean =>
  xor(a, b).length === 0;

function DayOfWeekSelector() {
  const { t } = useTranslation('todo');
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const [weekdays, interval, isMonthly, startDate] = useWatch({
    control,
    name: ['weekdays', 'interval', 'isMonthly', 'startDate'],
  });
  const monthDay = getMonthDayOfDateKey(toDeviceDateKey(startDate));
  const isWeeklyEveryWeek = !isMonthly && interval === 1;

  const handlePresetPress = (days: readonly DayOfWeek[]) => {
    setValue('isMonthly', false);
    setValue('interval', 1);
    setValue('weekdays', isWeeklyEveryWeek && isSameWeekdays(weekdays, days) ? [] : [...days]);
  };

  const handleBiweeklyPress = () => {
    setValue('isMonthly', false);
    setValue('interval', interval === 2 ? 1 : 2);
  };

  const handleMonthlyPress = () => {
    setValue('isMonthly', !isMonthly);
    setValue('interval', 1);
  };

  const handleDayPress = (day: DayOfWeek) => {
    const current = getValues('weekdays');
    setValue('isMonthly', false);
    setValue(
      'weekdays',
      isMonthly ? [day] : current.includes(day) ? without(current, day) : [...current, day],
    );
  };

  return (
    <VStack gap={12}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 px-4"
      >
        <PresetChip
          label={t('picker.presetDaily')}
          isSelected={isWeeklyEveryWeek && weekdays.length === DAYS_OF_WEEK.length}
          onPress={() => handlePresetPress(DAYS_OF_WEEK)}
        />
        <PresetChip
          label={t('picker.presetWeekdays')}
          isSelected={isWeeklyEveryWeek && isSameWeekdays(weekdays, TODO_REPEAT_WEEKDAYS)}
          onPress={() => handlePresetPress(TODO_REPEAT_WEEKDAYS)}
        />
        <PresetChip
          label={t('picker.presetWeekends')}
          isSelected={isWeeklyEveryWeek && isSameWeekdays(weekdays, TODO_REPEAT_WEEKEND_DAYS)}
          onPress={() => handlePresetPress(TODO_REPEAT_WEEKEND_DAYS)}
        />
        <PresetChip
          label={t('picker.presetBiweekly')}
          isSelected={!isMonthly && interval === 2}
          onPress={handleBiweeklyPress}
        />
        <PresetChip
          label={t('picker.presetMonthly', { day: monthDay })}
          isSelected={isMonthly}
          onPress={handleMonthlyPress}
        />
        {DAYS_OF_WEEK.map((day) => (
          <DayOfWeekChip
            key={day}
            day={day}
            isSelected={!isMonthly && weekdays.includes(day)}
            onPress={() => handleDayPress(day)}
          />
        ))}
      </ScrollView>
      <RepeatSummary />
    </VStack>
  );
}

function RepeatSummary() {
  const { t } = useTranslation('todo');
  const { control } = useFormContext<TodoRepeatFormValues>();
  const [weekdays, interval, isMonthly, startDate] = useWatch({
    control,
    name: ['weekdays', 'interval', 'isMonthly', 'startDate'],
  });
  const days = formatDaysOfWeek(weekdays);
  const summary = match({ weekdays, interval, isMonthly })
    .returnType<string | null>()
    .with({ isMonthly: true }, () =>
      t('picker.repeatMonthly', { day: getMonthDayOfDateKey(toDeviceDateKey(startDate)) }),
    )
    .when(
      ({ weekdays: selected }) => selected.length === 0,
      () => null,
    )
    .with({ interval: 2 }, () => t('picker.repeatBiweekly', { days }))
    .when(
      ({ weekdays: selected }) => selected.length === DAYS_OF_WEEK.length,
      () => t('picker.repeatDaily'),
    )
    .when(
      ({ weekdays: selected }) => isSameWeekdays(selected, TODO_REPEAT_WEEKDAYS),
      () => t('picker.repeatWeekdays'),
    )
    .when(
      ({ weekdays: selected }) => isSameWeekdays(selected, TODO_REPEAT_WEEKEND_DAYS),
      () => t('picker.repeatWeekends'),
    )
    .otherwise(() => t('picker.repeatWeekly', { days }));

  return summary == null ? (
    <Text size="b3" tone="neutral" shade={5} align="right" className="px-4">
      * {t('picker.selectDays')}
    </Text>
  ) : (
    <Text size="b3" tone="brand" align="right" className="px-4">
      * {summary}
    </Text>
  );
}

function CountStepper() {
  const { t } = useTranslation('todo');
  const { control, setValue } = useFormContext<TodoRepeatFormValues>();
  const count = useWatch({ control, name: 'count' });
  const changeCount = (next: number) =>
    setValue('count', clamp(next, TODO_REPEAT_COUNT.MIN, TODO_REPEAT_COUNT.MAX));

  return (
    <HStack gap={12} align="center" className="px-4">
      <PressableFeedback
        onPress={() => changeCount(count - 1)}
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
        onPress={() => changeCount(count + 1)}
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

function RepeatEndSelector() {
  const { t } = useTranslation('todo');
  const { control, setValue } = useFormContext<TodoRepeatFormValues>();
  const endType = useWatch({ control, name: 'endType' });
  const handleEndTypePress = (type: TodoRepeatEndType) => {
    setValue('endType', type);
    setValue('untilDate', null);
  };

  return (
    <VStack gap={12}>
      <HStack gap={6} className="px-4">
        <PresetChip
          label={t('picker.endNever')}
          isSelected={endType === 'NEVER'}
          onPress={() => handleEndTypePress('NEVER')}
        />
        <PresetChip
          label={t('picker.endUntil')}
          isSelected={endType === 'UNTIL'}
          onPress={() => handleEndTypePress('UNTIL')}
        />
        <PresetChip
          label={t('picker.endCount')}
          isSelected={endType === 'COUNT'}
          onPress={() => handleEndTypePress('COUNT')}
        />
      </HStack>
      {endType === 'COUNT' && <CountStepper />}
    </VStack>
  );
}

interface RepeatPickerValue {
  startDate: Date;
  repeat: TodoRepeat | null;
}

interface TodoRepeatPickerContentProps {
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

export const TodoRepeatPickerContent = ({
  value,
  onChange,
  onCancel,
}: TodoRepeatPickerContentProps) => {
  const methods = useForm<TodoRepeatFormValues>({
    defaultValues: toTodoRepeatFormValues(value.startDate, value.repeat),
  });
  const picker = useDatePicker({ startDate: value.startDate });

  return (
    <FormProvider {...methods}>
      <VStack gap={20}>
        <RepeatPickerHeader onChange={onChange} onCancel={onCancel} />
        <DayOfWeekSelector />
        <RepeatEndSelector />
        <RepeatCalendarSection picker={picker} />
        <RepeatPeriodFooter value={value} onChange={onChange} />
      </VStack>
    </FormProvider>
  );
};

function useRepeatFormValues(): TodoRepeatFormValues {
  const { control, getValues } = useFormContext<TodoRepeatFormValues>();
  useWatch({ control });
  return getValues();
}

interface RepeatPickerHeaderProps {
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

function RepeatPickerHeader({ onChange, onCancel }: RepeatPickerHeaderProps) {
  const { t } = useTranslation('todo');
  const values = useRepeatFormValues();
  const isConfirmDisabled = !canConfirmTodoRepeatForm(values);

  const handleConfirm = () => {
    if (isConfirmDisabled) {
      return;
    }
    onChange({ startDate: values.startDate, repeat: toTodoRepeat(values) });
  };

  return (
    <PickerHeader
      title={t('picker.repeatTitle')}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      isConfirmDisabled={isConfirmDisabled}
    />
  );
}

interface RepeatCalendarSectionProps {
  picker: ReturnType<typeof useDatePicker>;
}

function RepeatCalendarSection({ picker }: RepeatCalendarSectionProps) {
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const [startDate, endType, untilDate] = useWatch({
    control,
    name: ['startDate', 'endType', 'untilDate'],
  });
  const today = useToday();

  const changeStartDate = (date: Date) => {
    const next = withTodoRepeatFormStartDate(getValues(), date);
    setValue('startDate', next.startDate);
    setValue('weekdays', next.weekdays);
    setValue('untilDate', next.untilDate);
  };

  const handleCalendarPress = (date: Date) => {
    if (isBeforeDay(date, today)) {
      return;
    }

    if (endType !== 'UNTIL') {
      changeStartDate(date);
      return;
    }

    if (untilDate == null) {
      if (isAfterDay(date, startDate)) {
        setValue('untilDate', date);
      } else if (isBeforeDay(date, startDate)) {
        changeStartDate(date);
      }
      return;
    }

    changeStartDate(date);
    setValue('untilDate', null);
  };

  return (
    <RepeatCalendar
      picker={picker}
      today={today}
      startDate={startDate}
      endDate={endType === 'UNTIL' ? untilDate : null}
      onDatePress={handleCalendarPress}
    />
  );
}

interface RepeatPeriodFooterProps {
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
}

function RepeatPeriodFooter({ value, onChange }: RepeatPeriodFooterProps) {
  const { t } = useTranslation(['todo', 'common']);
  const values = useRepeatFormValues();
  const dateFormatContext = useDateFormatContext();
  const formatMonthDay = (date: Date) =>
    formatDateKeyLabel(toDeviceDateKey(date), 'monthDay', dateFormatContext);
  const monthlyRepeat = values.isMonthly ? toTodoRepeat({ ...values, endType: 'NEVER' }) : null;

  return (
    <VStack gap={4} className="border-t border-gray-2 px-4 pt-3">
      <HStack align="center" justify="between" gap={8}>
        <HStack gap={4} align="center" className="shrink">
          <Text size="b3" tone="neutral" shade={7}>
            {t('picker.repeatPeriod')}
          </Text>
          <Text size="b3" tone="neutral" shade={6}>
            •
          </Text>
          {match(values.endType)
            .with('NEVER', () => (
              <Text size="b3" tone="brand">
                {t('picker.periodNever', { date: formatMonthDay(values.startDate) })}
              </Text>
            ))
            .with('COUNT', () => (
              <Text size="b3" tone="brand">
                {t('picker.periodCount', {
                  date: formatMonthDay(values.startDate),
                  count: values.count,
                })}
              </Text>
            ))
            .with('UNTIL', () =>
              values.untilDate != null && !isSameDay(values.startDate, values.untilDate) ? (
                <Text size="b3" tone="brand">
                  {formatMonthDay(values.startDate)} - {formatMonthDay(values.untilDate)}
                </Text>
              ) : (
                <Text size="b3" tone="neutral" shade={5}>
                  {t('picker.selectPeriod')}
                </Text>
              ),
            )
            .exhaustive()}
        </HStack>
        {value.repeat != null && (
          <Button
            size="small"
            variant="weak"
            color="danger"
            display="inline"
            onPress={() => onChange({ startDate: value.startDate, repeat: null })}
          >
            {t('common:actions.delete')}
          </Button>
        )}
      </HStack>
      {monthlyRepeat != null && TodoRepeatPolicy.isMonthDayClamped(monthlyRepeat) && (
        <Text size="b4" tone="neutral" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('repeat.monthEndHint')}
        </Text>
      )}
    </VStack>
  );
}

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
