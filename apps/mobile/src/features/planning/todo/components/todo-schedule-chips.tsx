import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import type { DateKey } from '@src/shared/date/date-key';
import { formatHHmmTime } from '@src/shared/date/format/date-format';
import { toLocalDay } from '@src/shared/date/native-date';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionButton,
  Box,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  QueryErrorBoundary,
  RepeatIcon,
  SheetChipRow,
  useOpenSheet,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import {
  getScheduledTime,
  isPrivateVisibility,
  type TodoSchedule,
  withScheduleRepeat,
  withScheduleStartDate,
  withVisibilityToggled,
} from '../domains/todo.model';
import { type SheetOptions, useOpenTodoRepeatPicker } from '../hooks/use-open-todo-repeat-picker';
import type { TodoFormValues } from '../schemas/todo-form.schema';
import { formatRepeatSummary } from '../utils/format-repeat-summary';
import { formatTodoPeriod } from '../utils/todo-period.view-model';
import { TodoDatePicker } from './todo-date-picker';
import { TodoTimePicker } from './todo-time-picker';

export type TodoScheduleChipsValue = TodoSchedule &
  Pick<TodoFormValues, 'visibility' | 'categoryId'>;

interface ChipProps<T> {
  value: TodoScheduleChipsValue;
  onChange: (next: T) => void;
  sheetOptions: SheetOptions;
}

interface TodoScheduleChipsProps {
  value: TodoScheduleChipsValue;
  onChange: (value: TodoScheduleChipsValue) => void;
  /** 반복의 한 회차를 고친다. 날짜를 옮겨도 그 회차에만 적용돼 반복 규칙은 그대로 둔다 */
  isSeriesOccurrence?: boolean;
  /** 반복 규칙을 바꿀 수 없는 할 일은 반복 칩을 숨긴다 */
  canChangeRepeat?: boolean;
  /** 고르기 시트가 닫히기 시작할 때. 작성 시트는 여기서 제목 칸으로 키보드를 돌린다 */
  onPickerCloseStart?: () => void;
}

/** 할 일 작성·수정·메모 옮기기·음성 계획 고치기가 함께 쓰는 일정 칩 줄. 칩마다 고르기 시트를 띄우고 고른 값으로 onChange를 부른다 */
export function TodoScheduleChips({
  value,
  onChange,
  isSeriesOccurrence = false,
  canChangeRepeat = true,
  onPickerCloseStart,
}: TodoScheduleChipsProps) {
  const sheetOptions = { onCloseStart: onPickerCloseStart };

  return (
    <SheetChipRow>
      <DateChip
        value={value}
        onChange={(startDate) =>
          onChange({ ...value, ...withScheduleStartDate(value, startDate, { isSeriesOccurrence }) })
        }
        sheetOptions={sheetOptions}
      />
      <TimeChip
        value={value}
        onChange={(time) => onChange({ ...value, ...time })}
        sheetOptions={sheetOptions}
      />
      {canChangeRepeat && (
        <RepeatChip
          value={value}
          onChange={(repeat) => onChange({ ...value, ...withScheduleRepeat(value, repeat) })}
          sheetOptions={sheetOptions}
        />
      )}
      <VisibilityChip value={value} onChange={() => onChange(withVisibilityToggled(value))} />
      {/* 루트 overlay에 그려지므로 칩 조회 실패가 앱 경계까지 올라가지 않게 칩만 숨긴다 */}
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={<ActionButton.Loading />}>
          <CategoryChip
            value={value}
            onChange={(categoryId) => onChange({ ...value, categoryId })}
            sheetOptions={sheetOptions}
          />
        </Suspense>
      </QueryErrorBoundary>
    </SheetChipRow>
  );
}

function DateChip({ value, onChange, sheetOptions }: ChipProps<DateKey>) {
  const openSheet = useOpenSheet();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  const handlePress = async () => {
    const startDate = await openSheet<DateKey>(
      (close) => (
        <TodoDatePicker value={value.startDate} onChange={close} onCancel={() => close()} />
      ),
      { ...sheetOptions, hasFixedHeader: true },
    );
    if (startDate != null) {
      onChange(startDate);
    }
  };

  return (
    <ActionButton
      icon={<ActionButton.Icon Icon={CalendarIcon} colorClassName="text-main" />}
      label={formatTodoPeriod(value, todayKey, dateFormatContext)}
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip({
  value,
  onChange,
  sheetOptions,
}: ChipProps<Pick<TodoSchedule, 'scheduledTime' | 'isAllDay'>>) {
  const { t } = useTranslation('todo');
  const openSheet = useOpenSheet();
  const dateFormatContext = useDateFormatContext();
  // 루트 overlay라 경계로 터지지 않게 Suspense 대신 상태로 읽는다. 읽지 못하면 설정 기본 표기다
  const { data: preference, isError } = useQuery(useGetPreferenceQueryOptions());
  const displayedTime = getScheduledTime(value);

  // 설정을 읽는 동안 다른 표기로 먼저 보였다가 바뀌지 않게 카테고리 칩과 같은 자리 잡기를 보인다
  if (displayedTime != null && preference == null && !isError) {
    return <ActionButton.Loading />;
  }

  const handlePress = async () => {
    const time = await openSheet<Pick<TodoSchedule, 'scheduledTime' | 'isAllDay'>>(
      (close) => (
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePicker.Loading />}>
            <TodoTimePicker
              date={toLocalDay(value.startDate)}
              value={{ scheduledTime: value.scheduledTime, isAllDay: value.isAllDay }}
              onChange={close}
              onCancel={() => close()}
            />
          </Suspense>
        </QueryErrorBoundary>
      ),
      { ...sheetOptions, hasFixedHeader: true },
    );
    if (time != null) {
      onChange(time);
    }
  };

  return (
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={ClockIcon}
          colorClassName={cn(
            displayedTime == null && 'text-gray-5',
            displayedTime != null && 'text-main',
          )}
        />
      }
      label={
        displayedTime == null
          ? t('chip.allDay')
          : formatHHmmTime(
              displayedTime,
              preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
              dateFormatContext,
            )
      }
      isActive={displayedTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip({
  value,
  onChange,
  sheetOptions,
}: ChipProps<Pick<TodoSchedule, 'startDate' | 'repeat'>>) {
  const { t } = useTranslation('todo');
  const openRepeatPicker = useOpenTodoRepeatPicker();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const handlePress = async () => {
    const next = await openRepeatPicker(value, sheetOptions);
    if (next != null) {
      onChange(next);
    }
  };

  return (
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={RepeatIcon}
          colorClassName={cn(
            value.repeat == null && 'text-gray-5',
            value.repeat != null && 'text-main',
          )}
        />
      }
      label={
        value.repeat == null
          ? t('chip.repeat')
          : formatRepeatSummary(value.repeat, todayKey, dateFormatContext)
      }
      isActive={value.repeat != null}
      onPress={handlePress}
    />
  );
}

function VisibilityChip({ value, onChange }: Omit<ChipProps<void>, 'sheetOptions'>) {
  const { t } = useTranslation('todo');
  const isPrivate = isPrivateVisibility(value.visibility);

  return (
    <ActionButton
      icon={
        isPrivate ? (
          <ActionButton.Icon Icon={EyeOffIcon} colorClassName="text-gray-6" />
        ) : (
          <ActionButton.Icon Icon={EyeIcon} colorClassName="text-gray-5" />
        )
      }
      label={isPrivate ? t('chip.private') : t('chip.public')}
      onPress={() => onChange()}
    />
  );
}

function CategoryChip({ value, onChange, sheetOptions }: ChipProps<number>) {
  const { t } = useTranslation('todo');
  const openSheet = useOpenSheet();
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = TodoCategoryPolicy.findCategory(categories, value.categoryId);

  const handlePress = async () => {
    const categoryId = await openSheet<number>(
      (close) => (
        <QueryErrorBoundary>
          <Suspense fallback={<CategorySelectInput.Loading />}>
            <CategorySelectInput
              defaultValue={value.categoryId}
              onSubmit={close}
              submitLabel={t('add.submit')}
            />
          </Suspense>
        </QueryErrorBoundary>
      ),
      sheetOptions,
    );
    if (categoryId != null) {
      onChange(categoryId);
    }
  };

  return (
    <ActionButton
      icon={
        <Box
          className={cn('size-2 rounded-full', category == null && 'bg-gray-5')}
          style={category == null ? undefined : { backgroundColor: category.color }}
        />
      }
      label={category?.name ?? t('chip.category')}
      onPress={handlePress}
    />
  );
}
