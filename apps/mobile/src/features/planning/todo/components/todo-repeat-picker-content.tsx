import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import {
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
} from '@src/features/planning/todo/utils/calendar-date';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { formatDaysOfWeek, getDayOfWeekLabel } from '@src/shared/date/date-labels';
import { type Instant, toDate, toDateKey } from '@src/shared/date/instant';
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
  IconButton,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { TODO_REPEAT_WEEKDAYS, TODO_REPEAT_WEEKEND_DAYS } from '../constants/todo-repeat.constants';
import { TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { useDatePicker } from '../hooks/use-date-picker';
import {
  getTodoRepeatFormIssue,
  getTodoRepeatFormMonthDay,
  toTodoRepeat,
  createTodoRepeatFormSchema,
  type TodoRepeatFormValues,
} from '../schemas/todo-repeat-form.schema';
import { type TodoRepeat } from '../schemas/todo-repeat.schema';
import {
  DAY_TYPE_TONE,
  getDatePickerDayStyle,
  getWeekRangeBand,
  isTodayHighlighted,
} from '../utils/calendar-day';
import {
  getTodoRepeatFormFirstOccurrenceKey,
  hasSameWeekdays,
  isTodoRepeatFormPreset,
  toTodoRepeatFormValues,
  withTodoRepeatFormBiweeklyToggled,
  withTodoRepeatFormCalendarDate,
  withTodoRepeatFormDayToggled,
  withTodoRepeatFormMonthlyToggled,
  withTodoRepeatFormPreset,
} from '../utils/todo-repeat-form-values';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';
import { RepeatHintLine } from './repeat-hint-line';

type RepeatForm = UseFormReturn<TodoRepeatFormValues>;

interface RepeatPickerValue {
  startDate: Instant;
  repeat: TodoRepeat | null;
}

interface TodoRepeatPickerContentProps {
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

export function TodoRepeatPickerContent({
  value,
  onChange,
  onCancel,
}: TodoRepeatPickerContentProps) {
  const { timeZone } = useDateFormatContext();
  const form = useForm({
    resolver: zodResolver(createTodoRepeatFormSchema(timeZone)),
    defaultValues: toTodoRepeatFormValues(value.startDate, value.repeat, timeZone),
    mode: 'onChange',
  });
  const picker = useDatePicker({ startDate: toDate(value.startDate) });

  return (
    <SheetHeaderLayout
      gap={20}
      header={
        <TodoRepeatPickerContent.RepeatPickerHeader
          form={form}
          onChange={onChange}
          onCancel={onCancel}
        />
      }
      footer={
        <TodoRepeatPickerContent.RepeatPeriodFooter form={form} value={value} onChange={onChange} />
      }
    >
      <VStack gap={20}>
        <TodoRepeatPickerContent.DayOfWeekSelector form={form} />
        <TodoRepeatPickerContent.RepeatFormCalendar form={form} picker={picker} />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

TodoRepeatPickerContent.PresetChip = function PresetChip({
  label,
  isSelected,
  onPress,
}: PresetChipProps) {
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
};

interface DayOfWeekChipProps {
  day: DayOfWeek;
  isSelected: boolean;
  onPress: () => void;
}

TodoRepeatPickerContent.DayOfWeekChip = function DayOfWeekChip({
  day,
  isSelected,
  onPress,
}: DayOfWeekChipProps) {
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
};

/** 값을 바꿀 때마다 스키마를 다시 돌려 확인 버튼(isValid)이 따라오게 한다 */
const VALIDATE = { shouldValidate: true } as const;

function applyRepeatFormValues(form: RepeatForm, next: TodoRepeatFormValues) {
  form.setValue('startDate', next.startDate, VALIDATE);
  form.setValue('weekdays', next.weekdays, VALIDATE);
  form.setValue('interval', next.interval, VALIDATE);
  form.setValue('isMonthly', next.isMonthly, VALIDATE);
  form.setValue('monthDay', next.monthDay, VALIDATE);
  form.setValue('endType', next.endType, VALIDATE);
  form.setValue('untilDate', next.untilDate, VALIDATE);
}

TodoRepeatPickerContent.DayOfWeekSelector = function DayOfWeekSelector({
  form,
}: {
  form: RepeatForm;
}) {
  const { t } = useTranslation('todo');
  const { timeZone } = useDateFormatContext();
  const [weekdays, interval, isMonthly] = useWatch({
    control: form.control,
    name: ['weekdays', 'interval', 'isMonthly'],
  });
  const monthDay = useWatch({
    control: form.control,
    compute: (values) => getTodoRepeatFormMonthDay(values, timeZone),
  });
  const isPresetSelected = (days: readonly DayOfWeek[]) =>
    isTodoRepeatFormPreset({ isMonthly, interval, weekdays }, days);
  const applyFormValues = (next: TodoRepeatFormValues) => applyRepeatFormValues(form, next);

  return (
    <VStack gap={12}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 px-4"
      >
        <TodoRepeatPickerContent.PresetChip
          label={t('picker.presetDaily')}
          isSelected={isPresetSelected(DAYS_OF_WEEK)}
          onPress={() => applyFormValues(withTodoRepeatFormPreset(form.getValues(), DAYS_OF_WEEK))}
        />
        <TodoRepeatPickerContent.PresetChip
          label={t('picker.presetWeekdays')}
          isSelected={isPresetSelected(TODO_REPEAT_WEEKDAYS)}
          onPress={() =>
            applyFormValues(withTodoRepeatFormPreset(form.getValues(), TODO_REPEAT_WEEKDAYS))
          }
        />
        <TodoRepeatPickerContent.PresetChip
          label={t('picker.presetWeekends')}
          isSelected={isPresetSelected(TODO_REPEAT_WEEKEND_DAYS)}
          onPress={() =>
            applyFormValues(withTodoRepeatFormPreset(form.getValues(), TODO_REPEAT_WEEKEND_DAYS))
          }
        />
        {DAYS_OF_WEEK.map((day) => (
          <TodoRepeatPickerContent.DayOfWeekChip
            key={day}
            day={day}
            isSelected={!isMonthly && weekdays.includes(day)}
            onPress={() => applyFormValues(withTodoRepeatFormDayToggled(form.getValues(), day))}
          />
        ))}
        <TodoRepeatPickerContent.PresetChip
          label={t('picker.presetBiweekly')}
          isSelected={!isMonthly && interval === 2}
          onPress={() => applyFormValues(withTodoRepeatFormBiweeklyToggled(form.getValues()))}
        />
        <TodoRepeatPickerContent.PresetChip
          label={t('picker.presetMonthly', { day: monthDay })}
          isSelected={isMonthly}
          onPress={() => applyFormValues(withTodoRepeatFormMonthlyToggled(form.getValues()))}
        />
      </ScrollView>
      <TodoRepeatPickerContent.RepeatSummary form={form} />
    </VStack>
  );
};

TodoRepeatPickerContent.RepeatSummary = function RepeatSummary({ form }: { form: RepeatForm }) {
  const { t } = useTranslation('todo');
  const { timeZone } = useDateFormatContext();
  const [weekdays, interval, isMonthly] = useWatch({
    control: form.control,
    name: ['weekdays', 'interval', 'isMonthly'],
  });
  const monthDay = useWatch({
    control: form.control,
    compute: (values) => getTodoRepeatFormMonthDay(values, timeZone),
  });
  const issue = useWatch({
    control: form.control,
    compute: (values) => getTodoRepeatFormIssue(values, timeZone),
  });
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
      ({ weekdays: selected }) => hasSameWeekdays(selected, TODO_REPEAT_WEEKDAYS),
      () => t('picker.repeatWeekdays'),
    )
    .when(
      ({ weekdays: selected }) => hasSameWeekdays(selected, TODO_REPEAT_WEEKEND_DAYS),
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
};

interface RepeatPickerHeaderProps {
  form: RepeatForm;
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

TodoRepeatPickerContent.RepeatPickerHeader = function RepeatPickerHeader({
  form,
  onChange,
  onCancel,
}: RepeatPickerHeaderProps) {
  const { t } = useTranslation('todo');
  const { timeZone } = useDateFormatContext();
  const { isValid } = useFormState({ control: form.control });

  const handleConfirm = form.handleSubmit((values) => {
    onChange({ startDate: values.startDate, repeat: toTodoRepeat(values, timeZone) });
  });

  return (
    <PickerHeader
      title={t('picker.repeatTitle')}
      onCancel={onCancel}
      onConfirm={() => handleConfirm()}
      isConfirmDisabled={!isValid}
    />
  );
};

interface RepeatFormCalendarProps {
  form: RepeatForm;
  picker: ReturnType<typeof useDatePicker>;
}

TodoRepeatPickerContent.RepeatFormCalendar = function RepeatFormCalendar({
  form,
  picker,
}: RepeatFormCalendarProps) {
  const { timeZone } = useDateFormatContext();
  const [startDate, endType, untilDate] = useWatch({
    control: form.control,
    name: ['startDate', 'endType', 'untilDate'],
  });
  const repeat = useWatch({
    control: form.control,
    compute: (values) => toTodoRepeat(values, timeZone),
  });
  const firstOccurrenceKey = useWatch({
    control: form.control,
    compute: (values) => getTodoRepeatFormFirstOccurrenceKey(values, timeZone),
  });
  const today = useToday();
  const startDateKey = toDateKey(startDate, timeZone);
  const firstWeekDate = picker.weeks.at(0)?.at(0);
  const lastWeekDate = picker.weeks.at(-1)?.at(-1);
  const occurrenceKeys =
    repeat == null || firstWeekDate == null || lastWeekDate == null
      ? null
      : new Set(
          TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, startDateKey, {
            from: toDateKey(firstWeekDate, timeZone),
            to: toDateKey(lastWeekDate, timeZone),
          }),
        );
  const lastOccurrenceKey =
    endType === 'COUNT' && repeat != null
      ? TodoRepeatPolicy.getLastRepeatOccurrenceDateKey(repeat, startDateKey)
      : null;
  const endDate = match(endType)
    .with('UNTIL', () => (untilDate == null ? null : toDate(untilDate)))
    .with('COUNT', () => (lastOccurrenceKey == null ? null : toDate(lastOccurrenceKey)))
    .with('NEVER', () => null)
    .exhaustive();
  // 고른 기간 안에 회차가 없으면 첫 회차가 종료일보다 뒤다. 띠가 뒤집히지 않게 고른 기간을 그대로 그린다
  const hasOccurrenceInPeriod =
    firstOccurrenceKey != null &&
    (endType !== 'UNTIL' ||
      untilDate == null ||
      firstOccurrenceKey <= toDateKey(untilDate, timeZone));
  /** 달력의 시작 원과 띠는 폼의 시작일이 아니라 첫 할 일이 생기는 날부터 그린다 */
  const displayStartDate = toDate(hasOccurrenceInPeriod ? firstOccurrenceKey : startDate);

  // 칸마다 넘기는 함수라 렌더 값에 기대지 않고 누른 순간의 폼 값을 읽어 항상 같은 함수로 둔다
  const handleCalendarPress = (date: Date) => {
    applyRepeatFormValues(
      form,
      withTodoRepeatFormCalendarDate(form.getValues(), date, today, timeZone),
    );
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
};

interface RepeatPeriodFooterProps {
  form: RepeatForm;
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
}

TodoRepeatPickerContent.RepeatPeriodFooter = function RepeatPeriodFooter({
  form,
  value,
  onChange,
}: RepeatPeriodFooterProps) {
  const { t } = useTranslation(['todo', 'common']);
  const dateFormatContext = useDateFormatContext();
  const [startDate, endType, untilDate, count] = useWatch({
    control: form.control,
    name: ['startDate', 'endType', 'untilDate', 'count'],
  });
  const firstOccurrenceKey = useWatch({
    control: form.control,
    compute: (values) => {
      const repeat = toTodoRepeat(values, dateFormatContext.timeZone);
      return repeat == null
        ? null
        : TodoRepeatPolicy.getFirstRepeatOccurrenceDateKey(
            repeat,
            toDateKey(values.startDate, dateFormatContext.timeZone),
          );
    },
  });
  const formatMonthDay = (date: Date | Instant) =>
    formatDateKeyLabel(toDateKey(date, dateFormatContext.timeZone), 'monthDay', dateFormatContext);
  const isMonthDayClamped = useWatch({
    control: form.control,
    compute: (values) => {
      const repeat = toTodoRepeat({ ...values, endType: 'NEVER' }, dateFormatContext.timeZone);
      return repeat != null && TodoRepeatPolicy.isRepeatMonthDayClamped(repeat);
    },
  });
  const periodStart = firstOccurrenceKey == null ? startDate : toDate(firstOccurrenceKey);

  const handleForeverPress = () => {
    form.setValue('endType', endType === 'NEVER' ? 'UNTIL' : 'NEVER', VALIDATE);
    form.setValue('untilDate', null, VALIDATE);
  };

  return (
    <VStack gap={4} className="border-t border-gray-2 px-4 pt-3">
      <HStack align="center" justify="between" gap={8}>
        {/* 글자가 커지면 칩을 아래로 내리지 않고 기간 문구가 왼쪽 안에서 줄을 바꾼다 */}
        <HStack gap={4} align="center" className="flex-1 flex-wrap">
          <Text size="b3" tone="neutral" shade={7}>
            {t('picker.repeatPeriod')} <Text shade={6}>•</Text>
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
              untilDate != null &&
              !isSameDay(periodStart, untilDate, dateFormatContext.timeZone) ? (
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
          <TodoRepeatPickerContent.PresetChip
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
};

interface RepeatCalendarProps {
  picker: ReturnType<typeof useDatePicker>;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  isOpenEnded: boolean;
  /** 띠 안에서 실제로 반복되는 날(YYYY-MM-DD). null이면 흐리게 하지 않는다 */
  occurrenceKeys: ReadonlySet<string> | null;
  onDatePress: (date: Date) => void;
}

function RepeatCalendar({
  picker,
  today,
  startDate,
  endDate,
  isOpenEnded,
  occurrenceKeys,
  onDatePress,
}: RepeatCalendarProps) {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;
  const { t: tCommon } = useTranslation('common');
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  const hasDistinctRange =
    isOpenEnded || (endDate != null && !isSameDay(startDate, endDate, dateFormatContext.timeZone));

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
        {weeks.map((week, weekIndex) => {
          const days = week.map((date) => {
            const isVisible = isSameMonth(date, displayMonth, timeZone);
            const isStart = isSameDay(date, startDate, timeZone);
            const isEnd = endDate != null && isSameDay(date, endDate, timeZone);
            return {
              date,
              isVisible,
              isStart,
              isEnd,
              isInRange:
                isVisible &&
                hasDistinctRange &&
                isAfterDay(date, startDate, timeZone) &&
                (isOpenEnded || (endDate != null && isBeforeDay(date, endDate, timeZone))),
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
                        !occurrenceKeys.has(toDateKey(date, dateFormatContext.timeZone))
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
}

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
  const { timeZone } = useDateFormatContext();
  const isDisabled = isBeforeDay(date, today, timeZone);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today, timeZone });
  const shouldHighlightToday =
    !isDisabled && isTodayHighlighted({ date, isSelected, today, timeZone });

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
          shade={match({ isSelected, isDimmed })
            .with({ isSelected: true }, () => undefined)
            .with({ isDimmed: true }, () => 5 as const)
            .otherwise(() => 7 as const)}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
});
