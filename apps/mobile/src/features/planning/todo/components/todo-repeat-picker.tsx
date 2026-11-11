import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import type { DateKey } from '@src/shared/date/date-key';
import { hasSameDaysOfWeek } from '@src/shared/date/day-of-week';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { formatDaysOfWeek, getDayOfWeekLabel } from '@src/shared/date/format/date-labels';
import { type Instant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, HStack, SheetHeaderLayout, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { getRepeatPresetDays, TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { type TodoRepeat } from '../domains/todo-repeat.model';
import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import {
  getTodoRepeatFormIssue,
  getTodoRepeatFormMonthDay,
  toTodoRepeat,
  createTodoRepeatFormSchema,
  type TodoRepeatFormValues,
} from '../schemas/todo-repeat-form.schema';
import {
  getTodoRepeatFormFirstOccurrenceKey,
  isTodoRepeatFormPreset,
  toTodoRepeatFormValues,
  withTodoRepeatFormBiweeklyToggled,
  withTodoRepeatFormCalendarDate,
  withTodoRepeatFormDayToggled,
  withTodoRepeatFormMonthlyToggled,
  withTodoRepeatFormPreset,
} from '../utils/todo-repeat-form-values';
import { PickerHeader } from './picker-header';
import { RepeatCalendar } from './repeat-calendar';
import { RepeatHintLine } from './repeat-hint-line';

type RepeatForm = UseFormReturn<TodoRepeatFormValues>;

interface RepeatPickerValue {
  startDate: Instant;
  repeat: TodoRepeat | null;
}

interface TodoRepeatPickerProps {
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
  onCancel: () => void;
}

export function TodoRepeatPicker({ value, onChange, onCancel }: TodoRepeatPickerProps) {
  const { timeZone } = useDateFormatContext();
  const form = useForm({
    resolver: zodResolver(createTodoRepeatFormSchema(timeZone)),
    defaultValues: toTodoRepeatFormValues(value.startDate, value.repeat, timeZone),
    mode: 'onChange',
  });
  const picker = useDatePicker({ initialDateKey: toDateKey(value.startDate, timeZone) });

  return (
    <SheetHeaderLayout
      gap={20}
      header={
        <TodoRepeatPicker.RepeatPickerHeader form={form} onChange={onChange} onCancel={onCancel} />
      }
      footer={<TodoRepeatPicker.RepeatPeriodFooter form={form} value={value} onChange={onChange} />}
    >
      <VStack gap={20}>
        <TodoRepeatPicker.DayOfWeekSelector form={form} />
        <TodoRepeatPicker.RepeatFormCalendar form={form} picker={picker} />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

TodoRepeatPicker.PresetChip = function PresetChip({ label, isSelected, onPress }: PresetChipProps) {
  const haptics = useHaptics();

  return (
    <PressableFeedback
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      hitSlop={6}
      className={cn(
        'h-8 items-center justify-center rounded-4xl px-3',
        isSelected ? 'bg-main' : 'bg-gray-2',
      )}
    >
      <Text
        size="b4"
        weight="medium"
        numberOfLines={1}
        className={cn(isSelected && 'text-white')}
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

TodoRepeatPicker.DayOfWeekChip = function DayOfWeekChip({
  day,
  isSelected,
  onPress,
}: DayOfWeekChipProps) {
  const haptics = useHaptics();
  const { i18n } = useTranslation();

  return (
    <PressableFeedback
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      hitSlop={6}
      className={cn(
        'size-8 items-center justify-center rounded-4xl',
        isSelected ? 'bg-main' : 'bg-gray-2',
      )}
    >
      <Text
        size="b4"
        weight="medium"
        className={cn(isSelected && 'text-white')}
        shade={isSelected ? undefined : 7}
      >
        {getDayOfWeekLabel(day, i18n.language)}
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

TodoRepeatPicker.DayOfWeekSelector = function DayOfWeekSelector({ form }: { form: RepeatForm }) {
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
        <TodoRepeatPicker.PresetChip
          label={t('picker.presetDaily')}
          isSelected={isPresetSelected(DAYS_OF_WEEK)}
          onPress={() => applyFormValues(withTodoRepeatFormPreset(form.getValues(), DAYS_OF_WEEK))}
        />
        <TodoRepeatPicker.PresetChip
          label={t('picker.presetWeekdays')}
          isSelected={isPresetSelected(getRepeatPresetDays('WEEKDAYS'))}
          onPress={() =>
            applyFormValues(
              withTodoRepeatFormPreset(form.getValues(), getRepeatPresetDays('WEEKDAYS')),
            )
          }
        />
        <TodoRepeatPicker.PresetChip
          label={t('picker.presetWeekends')}
          isSelected={isPresetSelected(getRepeatPresetDays('WEEKENDS'))}
          onPress={() =>
            applyFormValues(
              withTodoRepeatFormPreset(form.getValues(), getRepeatPresetDays('WEEKENDS')),
            )
          }
        />
        {DAYS_OF_WEEK.map((day) => (
          <TodoRepeatPicker.DayOfWeekChip
            key={day}
            day={day}
            isSelected={!isMonthly && weekdays.includes(day)}
            onPress={() => applyFormValues(withTodoRepeatFormDayToggled(form.getValues(), day))}
          />
        ))}
        <TodoRepeatPicker.PresetChip
          label={t('picker.presetBiweekly')}
          isSelected={!isMonthly && interval === 2}
          onPress={() => applyFormValues(withTodoRepeatFormBiweeklyToggled(form.getValues()))}
        />
        <TodoRepeatPicker.PresetChip
          label={t('picker.presetMonthly', { day: monthDay })}
          isSelected={isMonthly}
          onPress={() => applyFormValues(withTodoRepeatFormMonthlyToggled(form.getValues()))}
        />
      </ScrollView>
      <TodoRepeatPicker.RepeatSummary form={form} />
    </VStack>
  );
};

TodoRepeatPicker.RepeatSummary = function RepeatSummary({ form }: { form: RepeatForm }) {
  const { t, i18n } = useTranslation('todo');
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
  const days = formatDaysOfWeek(weekdays, i18n.language);
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
      ({ weekdays: selected }) => hasSameDaysOfWeek(selected, getRepeatPresetDays('WEEKDAYS')),
      () => t('picker.repeatWeekdays'),
    )
    .when(
      ({ weekdays: selected }) => hasSameDaysOfWeek(selected, getRepeatPresetDays('WEEKENDS')),
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

TodoRepeatPicker.RepeatPickerHeader = function RepeatPickerHeader({
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
  picker: DatePicker;
}

TodoRepeatPicker.RepeatFormCalendar = function RepeatFormCalendar({
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
  const todayKey = useTodayKey();
  const startDateKey = toDateKey(startDate, timeZone);
  const untilDateKey = untilDate == null ? null : toDateKey(untilDate, timeZone);
  const firstWeekDateKey = picker.weeks.at(0)?.at(0)?.dateKey;
  const lastWeekDateKey = picker.weeks.at(-1)?.at(-1)?.dateKey;
  const occurrenceKeys =
    repeat == null || firstWeekDateKey == null || lastWeekDateKey == null
      ? null
      : new Set(
          TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, startDateKey, {
            from: firstWeekDateKey,
            to: lastWeekDateKey,
          }),
        );
  const endDateKey = match(endType)
    .with('UNTIL', () => untilDateKey)
    .with('COUNT', () =>
      repeat == null
        ? null
        : TodoRepeatPolicy.findLastRepeatOccurrenceDateKey(repeat, startDateKey),
    )
    .with('NEVER', () => null)
    .exhaustive();
  // 고른 기간 안에 회차가 없으면 첫 회차가 종료일보다 뒤다. 띠가 뒤집히지 않게 고른 기간을 그대로 그린다
  const hasOccurrenceInPeriod =
    firstOccurrenceKey != null &&
    (endType !== 'UNTIL' || untilDateKey == null || firstOccurrenceKey <= untilDateKey);
  /** 달력의 시작 원과 띠는 폼의 시작일이 아니라 첫 할 일이 생기는 날부터 그린다 */
  const displayStartDateKey = hasOccurrenceInPeriod ? firstOccurrenceKey : startDateKey;

  // 칸마다 넘기는 함수라 렌더 값에 기대지 않고 누른 순간의 폼 값을 읽어 항상 같은 함수로 둔다
  const handleDateChange = (dateKey: DateKey) => {
    applyRepeatFormValues(
      form,
      withTodoRepeatFormCalendarDate(form.getValues(), { dateKey, todayKey, timeZone }),
    );
  };

  return (
    <RepeatCalendar
      picker={picker}
      todayKey={todayKey}
      startDateKey={displayStartDateKey}
      endDateKey={endDateKey}
      isOpenEnded={endType === 'NEVER' && repeat != null}
      occurrenceKeys={occurrenceKeys}
      onValueChange={handleDateChange}
    />
  );
};

interface RepeatPeriodFooterProps {
  form: RepeatForm;
  value: RepeatPickerValue;
  onChange: (value: RepeatPickerValue) => void;
}

TodoRepeatPicker.RepeatPeriodFooter = function RepeatPeriodFooter({
  form,
  value,
  onChange,
}: RepeatPeriodFooterProps) {
  const { t } = useTranslation(['todo', 'common']);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
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
        : TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(
            repeat,
            toDateKey(values.startDate, dateFormatContext.timeZone),
          );
    },
  });
  const formatDate = (dateKey: DateKey) =>
    formatYearAwareDateKeyLabel(dateKey, todayKey, dateFormatContext);
  const isMonthDayClamped = useWatch({
    control: form.control,
    compute: (values) => {
      const repeat = toTodoRepeat({ ...values, endType: 'NEVER' }, dateFormatContext.timeZone);

      return repeat != null && TodoRepeatPolicy.isRepeatMonthDayClamped(repeat);
    },
  });
  const periodStartKey = firstOccurrenceKey ?? toDateKey(startDate, dateFormatContext.timeZone);
  const untilDateKey = untilDate == null ? null : toDateKey(untilDate, dateFormatContext.timeZone);

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
                {t('picker.periodNever', { date: formatDate(periodStartKey) })}
              </Text>
            ))
            .with('COUNT', () => (
              <Text size="b3" tone="brand">
                {t('picker.periodCount', {
                  date: formatDate(periodStartKey),
                  count,
                })}
              </Text>
            ))
            .with('UNTIL', () =>
              untilDateKey != null && periodStartKey !== untilDateKey ? (
                <Text size="b3" tone="brand">
                  {formatDate(periodStartKey)} - {formatDate(untilDateKey)}
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
          <TodoRepeatPicker.PresetChip
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
