import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Box,
  Button,
  HStack,
  SheetHeaderLayout,
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
  toDate,
} from '@src/shared/utils/date';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { without, xor } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { TODO_REPEAT_WEEKDAYS, TODO_REPEAT_WEEKEND_DAYS } from '../constants/todo-repeat.constants';
import {
  getTodoRepeatFormIssue,
  getTodoRepeatFormMonthDay,
  toTodoRepeat,
  todoRepeatFormSchema,
  type TodoRepeatFormValues,
} from '../domains/todo-repeat-form.schema';
import { type TodoRepeat, TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { useDatePicker } from '../hooks/use-date-picker';
import {
  DAY_TYPE_TONE,
  getDatePickerDayStyle,
  getWeekRangeBand,
  isTodayHighlighted,
} from '../utils/calendar-day';
import {
  toTodoRepeatFormValues,
  withTodoRepeatFormStartDate,
} from '../utils/todo-repeat-form-values';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';
import { RepeatHintLine } from './repeat-hint-line';

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function PresetChip({ label, isSelected, onPress }: PresetChipProps) {
  const haptics = useHaptics();

  return (
    <PressableFeedback
      onPress={() => {
        haptics.selection();
        onPress();
      }}
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
  const haptics = useHaptics();

  return (
    <PressableFeedback
      onPress={() => {
        haptics.selection();
        onPress();
      }}
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

/** 값을 바꿀 때마다 스키마를 다시 돌려 확인 버튼(isValid)이 따라오게 한다 */
const VALIDATE = { shouldValidate: true } as const;

function DayOfWeekSelector() {
  const { t } = useTranslation('todo');
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const [weekdays, interval, isMonthly] = useWatch({
    control,
    name: ['weekdays', 'interval', 'isMonthly'],
  });
  const monthDay = useWatch({ control, compute: getTodoRepeatFormMonthDay });
  const isWeeklyEveryWeek = !isMonthly && interval === 1;

  const handlePresetPress = (days: readonly DayOfWeek[]) => {
    setValue('isMonthly', false, VALIDATE);
    setValue('interval', 1, VALIDATE);
    setValue(
      'weekdays',
      isWeeklyEveryWeek && isSameWeekdays(weekdays, days) ? [] : [...days],
      VALIDATE,
    );
  };

  const handleBiweeklyPress = () => {
    setValue('isMonthly', false, VALIDATE);
    setValue('interval', interval === 2 ? 1 : 2, VALIDATE);
  };

  const handleMonthlyPress = () => {
    setValue('isMonthly', !isMonthly, VALIDATE);
    setValue('interval', 1, VALIDATE);
  };

  const handleDayPress = (day: DayOfWeek) => {
    const current = getValues('weekdays');
    setValue('isMonthly', false, VALIDATE);
    setValue(
      'weekdays',
      isMonthly ? [day] : current.includes(day) ? without(current, day) : [...current, day],
      VALIDATE,
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
        {DAYS_OF_WEEK.map((day) => (
          <DayOfWeekChip
            key={day}
            day={day}
            isSelected={!isMonthly && weekdays.includes(day)}
            onPress={() => handleDayPress(day)}
          />
        ))}
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
      </ScrollView>
      <RepeatSummary />
    </VStack>
  );
}

function RepeatSummary() {
  const { t } = useTranslation('todo');
  const { control } = useFormContext<TodoRepeatFormValues>();
  const [weekdays, interval, isMonthly] = useWatch({
    control,
    name: ['weekdays', 'interval', 'isMonthly'],
  });
  const monthDay = useWatch({ control, compute: getTodoRepeatFormMonthDay });
  const issue = useWatch({ control, compute: getTodoRepeatFormIssue });
  const days = formatDaysOfWeek(weekdays);
  const summary = match({ weekdays, interval, isMonthly })
    .returnType<string | null>()
    .with({ isMonthly: true }, () => t('picker.repeatMonthly', { day: monthDay }))
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

  if (summary == null) {
    return <RepeatHintLine className="justify-end px-4">{t('picker.selectDays')}</RepeatHintLine>;
  }

  return issue === 'no-occurrence' ? (
    <RepeatHintLine className="justify-end px-4">{t('picker.noOccurrence')}</RepeatHintLine>
  ) : (
    <RepeatHintLine isHighlighted className="justify-end px-4">
      {summary}
    </RepeatHintLine>
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
    resolver: zodResolver(todoRepeatFormSchema),
    defaultValues: toTodoRepeatFormValues(value.startDate, value.repeat),
    mode: 'onChange',
  });
  const picker = useDatePicker({ startDate: value.startDate });

  return (
    <FormProvider {...methods}>
      <SheetHeaderLayout
        gap={20}
        header={<RepeatPickerHeader onChange={onChange} onCancel={onCancel} />}
        footer={<RepeatPeriodFooter value={value} onChange={onChange} />}
      >
        <VStack gap={20}>
          <DayOfWeekSelector />
          <RepeatCalendarSection picker={picker} />
        </VStack>
      </SheetHeaderLayout>
    </FormProvider>
  );
};

interface RepeatPickerHeaderProps {
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

function RepeatPickerHeader({ onChange, onCancel }: RepeatPickerHeaderProps) {
  const { t } = useTranslation('todo');
  const { control, handleSubmit } = useFormContext<TodoRepeatFormValues>();
  const { isValid } = useFormState({ control });

  const handleConfirm = handleSubmit((values) => {
    onChange({ startDate: values.startDate, repeat: toTodoRepeat(values) });
  });

  return (
    <PickerHeader
      title={t('picker.repeatTitle')}
      onCancel={onCancel}
      onConfirm={() => handleConfirm()}
      isConfirmDisabled={!isValid}
    />
  );
}

interface RepeatCalendarSectionProps {
  picker: ReturnType<typeof useDatePicker>;
}

/** 날짜 종료를 아직 안 골랐어도 첫 회차는 알 수 있으므로 끝이 없는 규칙으로 계산한다. 첫 할 일이 실제로 생기는 날이다 */
function getFirstOccurrenceKey(values: TodoRepeatFormValues): string | null {
  const repeat = toTodoRepeat({ ...values, endType: 'NEVER' });
  return repeat == null
    ? null
    : TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, toDeviceDateKey(values.startDate));
}

function RepeatCalendarSection({ picker }: RepeatCalendarSectionProps) {
  const { control, getValues, setValue } = useFormContext<TodoRepeatFormValues>();
  const [startDate, endType, untilDate] = useWatch({
    control,
    name: ['startDate', 'endType', 'untilDate'],
  });
  const repeat = useWatch({ control, compute: toTodoRepeat });
  const firstOccurrenceKey = useWatch({ control, compute: getFirstOccurrenceKey });
  const today = useToday();
  const startDateKey = toDeviceDateKey(startDate);
  const firstWeekDate = picker.weeks.at(0)?.at(0);
  const lastWeekDate = picker.weeks.at(-1)?.at(-1);
  const occurrenceKeys =
    repeat == null || firstWeekDate == null || lastWeekDate == null
      ? null
      : new Set(
          TodoRepeatPolicy.getOccurrenceDateKeys(repeat, startDateKey, {
            from: toDeviceDateKey(firstWeekDate),
            to: toDeviceDateKey(lastWeekDate),
          }),
        );
  const lastOccurrenceKey =
    endType === 'COUNT' && repeat != null
      ? TodoRepeatPolicy.getLastOccurrenceDateKey(repeat, startDateKey)
      : null;
  const endDate = match(endType)
    .with('UNTIL', () => untilDate)
    .with('COUNT', () => (lastOccurrenceKey == null ? null : toDate(lastOccurrenceKey)))
    .with('NEVER', () => null)
    .exhaustive();
  // 고른 기간 안에 회차가 없으면 첫 회차가 종료일보다 뒤다. 띠가 뒤집히지 않게 고른 기간을 그대로 그린다
  const hasOccurrenceInPeriod =
    firstOccurrenceKey != null &&
    (endType !== 'UNTIL' || untilDate == null || firstOccurrenceKey <= toDeviceDateKey(untilDate));
  /** 달력의 시작 원과 띠는 폼의 시작일이 아니라 첫 할 일이 생기는 날부터 그린다 */
  const displayStartDate = hasOccurrenceInPeriod ? toDate(firstOccurrenceKey) : startDate;

  const changeStartDate = (date: Date) => {
    const next = withTodoRepeatFormStartDate(getValues(), date);
    setValue('startDate', next.startDate, VALIDATE);
    setValue('monthDay', next.monthDay, VALIDATE);
    setValue('weekdays', next.weekdays, VALIDATE);
    setValue('untilDate', next.untilDate, VALIDATE);
  };

  // 칸마다 넘기는 함수라 렌더 값에 기대지 않고 누른 순간의 폼 값을 읽어 항상 같은 함수로 둔다
  const handleCalendarPress = (date: Date) => {
    if (isBeforeDay(date, today)) {
      return;
    }

    const values = getValues();
    const firstKey = getFirstOccurrenceKey(values);

    if (
      firstKey != null &&
      toDeviceDateKey(date) === firstKey &&
      !isSameDay(date, values.startDate)
    ) {
      changeStartDate(date);
      setValue('untilDate', null, VALIDATE);
      return;
    }

    if (values.endType === 'UNTIL' && values.untilDate != null) {
      changeStartDate(date);
      setValue('untilDate', null, VALIDATE);
      return;
    }

    if (isAfterDay(date, values.startDate)) {
      setValue('endType', 'UNTIL', VALIDATE);
      setValue('untilDate', date, VALIDATE);
    } else if (isBeforeDay(date, values.startDate)) {
      changeStartDate(date);
    }
  };

  return (
    <RepeatCalendar
      picker={picker}
      today={today}
      startDate={displayStartDate}
      endDate={endDate}
      isOpenEnded={endType === 'NEVER' && repeat != null}
      occurrenceKeys={occurrenceKeys}
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
  const { control, setValue } = useFormContext<TodoRepeatFormValues>();
  const [startDate, endType, untilDate, count] = useWatch({
    control,
    name: ['startDate', 'endType', 'untilDate', 'count'],
  });
  const firstOccurrenceKey = useWatch({
    control,
    compute: (values) => {
      const repeat = toTodoRepeat(values);
      return repeat == null
        ? null
        : TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, toDeviceDateKey(values.startDate));
    },
  });
  const dateFormatContext = useDateFormatContext();
  const formatMonthDay = (date: Date) =>
    formatDateKeyLabel(toDeviceDateKey(date), 'monthDay', dateFormatContext);
  const isMonthDayClamped = useWatch({
    control,
    compute: (values) => {
      const repeat = toTodoRepeat({ ...values, endType: 'NEVER' });
      return repeat != null && TodoRepeatPolicy.isMonthDayClamped(repeat);
    },
  });
  const periodStart = firstOccurrenceKey == null ? startDate : toDate(firstOccurrenceKey);

  const handleForeverPress = () => {
    setValue('endType', endType === 'NEVER' ? 'UNTIL' : 'NEVER', VALIDATE);
    setValue('untilDate', null, VALIDATE);
  };

  return (
    <VStack gap={4} className="border-t border-gray-2 px-4 pt-3">
      <HStack align="center" justify="between" gap={8}>
        {/* 글자가 커지면 칩을 아래로 내리지 않고 기간 문구가 왼쪽 안에서 줄을 바꾼다 */}
        <HStack gap={4} align="center" className="flex-1 flex-wrap">
          <Text size="b3" tone="neutral" shade={7}>
            {t('picker.repeatPeriod')}
          </Text>
          <Text size="b3" tone="neutral" shade={6}>
            •
          </Text>
          {match(endType)
            .with('NEVER', () => (
              <Text size="b3" tone="brand">
                {t('picker.periodNever', { date: formatMonthDay(periodStart) })}
              </Text>
            ))
            .with('COUNT', () => (
              <Text size="b3" tone="brand">
                {t('picker.periodCount', {
                  date: formatMonthDay(periodStart),
                  count,
                })}
              </Text>
            ))
            .with('UNTIL', () =>
              untilDate != null && !isSameDay(periodStart, untilDate) ? (
                <Text size="b3" tone="brand">
                  {formatMonthDay(periodStart)} - {formatMonthDay(untilDate)}
                </Text>
              ) : (
                <Text size="b3" tone="neutral" shade={5}>
                  {t('picker.selectPeriod')}
                </Text>
              ),
            )
            .exhaustive()}
        </HStack>
        <HStack gap={6} align="center" className="shrink-0">
          <PresetChip
            label={t('picker.repeatForever')}
            isSelected={endType === 'NEVER'}
            onPress={handleForeverPress}
          />
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
      </HStack>
      {isMonthDayClamped && <RepeatHintLine>{t('repeat.monthEndHint')}</RepeatHintLine>}
    </VStack>
  );
}

interface RepeatCalendarProps {
  picker: ReturnType<typeof useDatePicker>;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  /** 끝이 없는 반복이라 띠가 시작일부터 달력 끝까지 이어진다 */
  isOpenEnded: boolean;
  /** 띠 안에서 실제로 반복되는 날(YYYY-MM-DD). null이면 흐리게 하지 않는다 */
  occurrenceKeys: ReadonlySet<string> | null;
  onDatePress: (date: Date) => void;
}

const RepeatCalendar = ({
  picker,
  today,
  startDate,
  endDate,
  isOpenEnded,
  occurrenceKeys,
  onDatePress,
}: RepeatCalendarProps) => {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;
  const dateFormatContext = useDateFormatContext();
  const hasDistinctRange = isOpenEnded || (endDate != null && !isSameDay(startDate, endDate));

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
        {weeks.map((week, weekIndex) => {
          const days = week.map((date) => {
            const isVisible = isSameMonth(date, displayMonth);
            const isStart = isSameDay(date, startDate);
            const isEnd = endDate != null && isSameDay(date, endDate);
            return {
              date,
              isVisible,
              isStart,
              isEnd,
              isInRange:
                isVisible &&
                hasDistinctRange &&
                isAfterDay(date, startDate) &&
                (isOpenEnded || (endDate != null && isBeforeDay(date, endDate))),
              isRangeStart: isVisible && hasDistinctRange && isStart,
              isRangeEnd: isVisible && !isOpenEnded && hasDistinctRange && isEnd,
            };
          });
          const band = getWeekRangeBand(days);

          return (
            // 주 순서는 고정되어 index가 안정적인 key다.
            <Box key={weekIndex} px={8}>
              <HStack className="relative">
                {/* 칸마다 나눠 그리면 폭이 소수점인 칸 경계에 세로선이 생겨 한 주에 띠 하나로 그린다 */}
                {band != null && (
                  <Box
                    className="absolute top-[8px] h-[32px] bg-main/8"
                    style={{
                      left: `${band.startRatio * 100}%`,
                      right: `${(1 - band.endRatio) * 100}%`,
                    }}
                  />
                )}
                {days.map(({ date, isVisible, isStart, isEnd, isInRange }) =>
                  isVisible ? (
                    <RepeatDateCell
                      key={date.toISOString()}
                      date={date}
                      today={today}
                      isStart={isStart}
                      isEnd={isEnd}
                      isDimmed={
                        occurrenceKeys != null &&
                        isInRange &&
                        !occurrenceKeys.has(toDeviceDateKey(date))
                      }
                      onPress={onDatePress}
                    />
                  ) : (
                    <Box key={date.toISOString()} className="h-[48px] flex-1" />
                  ),
                )}
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </VStack>
  );
};

interface RepeatDateCellProps {
  date: Date;
  today: Date;
  isStart: boolean;
  isEnd: boolean;
  isDimmed: boolean;
  onPress: (date: Date) => void;
}

/** 달력은 칸이 많아 입력 하나로 전부 다시 그리지 않도록 값이 바뀐 칸만 그린다 */
const RepeatDateCell = memo(function RepeatDateCell({
  date,
  today,
  isStart,
  isEnd,
  isDimmed,
  onPress,
}: RepeatDateCellProps) {
  const dayOfMonth = date.getDate();
  const isDisabled = isBeforeDay(date, today);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today });
  const shouldHighlightToday = !isDisabled && isTodayHighlighted({ date, isSelected, today });

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      isDisabled={isDisabled}
      className={cn(
        'relative h-[48px] flex-1 items-center justify-center',
        isDisabled && 'opacity-30',
      )}
    >
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
          tone={isDisabled || isDimmed ? 'neutral' : DAY_TYPE_TONE[dayStyle]}
          shade={isSelected ? undefined : isDimmed ? 5 : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
});
