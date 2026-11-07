import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { TodoDatePickerContent } from '@src/features/planning/todo/components/todo-date-picker-content';
import { TodoRepeatPickerContent } from '@src/features/planning/todo/components/todo-repeat-picker-content';
import { TodoTimePickerContent } from '@src/features/planning/todo/components/todo-time-picker-content';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { toNullableInstant } from '@src/features/planning/todo/utils/calendar-date';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import { formatDateKeyCompactRange, formatDateKeyLabel } from '@src/shared/date/date-format';
import { fromDate, toDate, toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionChip,
  ArrowUpIcon,
  Box,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  ModalBottomSheet,
  type Overlay,
  QueryErrorBoundary,
  RepeatIcon,
  SHEET_CONTENT_PADDING,
  useOverlay,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native-gesture-handler';
import { useResolveClassNames } from 'uniwind';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

type ComposerForm = UseFormReturn<AddTodoFormValues>;

interface TodoComposerChipsProps {
  form: ComposerForm;
  isSeriesOccurrence?: boolean;
  canChangeRepeat?: boolean;
}

/** 할 일을 만드는 시트가 함께 쓰는 칩 줄. 시트가 가진 폼을 받아 읽고 바꾼다 */
export function TodoComposerChips({
  form,
  isSeriesOccurrence = false,
  canChangeRepeat = true,
}: TodoComposerChipsProps) {
  const overlay = useOverlay();

  return (
    // RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
    >
      <DateChip form={form} isSeriesOccurrence={isSeriesOccurrence} />
      <TimeChip form={form} />
      {canChangeRepeat && (
        <RepeatChip form={form} onPress={() => openTodoRepeatPicker(overlay, form)} />
      )}
      <VisibilityChip form={form} />
      {/* 루트 overlay에 그려지므로 칩 조회 실패가 앱 경계까지 올라가지 않게 칩만 숨긴다 */}
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={<ActionChip.Loading />}>
          <CategoryChip form={form} />
        </Suspense>
      </QueryErrorBoundary>
    </ScrollView>
  );
}

/** 저장이 거절됐을 때 제출 함수에서도 열어야 해 훅이 아니라 함수다 */
export function openTodoRepeatPicker(
  overlay: Overlay,
  form: Pick<UseFormReturn<AddTodoFormValues>, 'getValues' | 'setFocus' | 'setValue'>,
) {
  overlay.open(({ isOpen, close, unmount }) => (
    <ModalBottomSheet
      hasFixedHeader
      isOpen={isOpen}
      onOpenChange={() => close()}
      onCloseStart={() => requestAnimationFrame(() => form.setFocus('title'))}
      onExit={unmount}
    >
      <TodoRepeatPickerContent
        value={{
          startDate: form.getValues('startDate'),
          repeat: form.getValues('repeat'),
        }}
        onChange={({ startDate, repeat }) => {
          form.setValue('startDate', startDate);
          form.setValue('repeat', repeat);
          if (repeat != null) {
            form.setValue('endDate', null);
          }
          close();
        }}
        onCancel={close}
      />
    </ModalBottomSheet>
  ));
}

interface TodoComposerSubmitButtonProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'isDisabled' | 'onPress' | 'testID'
> {
  isSubmitting: boolean;
}

export function TodoComposerSubmitButton({
  isDisabled,
  isSubmitting,
  onPress,
  testID,
}: TodoComposerSubmitButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');

  return (
    <PressableFeedback
      testID={testID}
      isDisabled={isDisabled}
      onPress={onPress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className={cn(
        'items-center justify-center rounded-4xl',
        isDisabled ? 'bg-gray-3' : 'bg-main',
      )}
    >
      {isSubmitting ? (
        <Spinner size="sm" color={typeof spinnerColor === 'string' ? spinnerColor : undefined} />
      ) : (
        <ArrowUpIcon
          width={fontScaledSize(18)}
          height={fontScaledSize(18)}
          colorClassName="text-white"
        />
      )}
    </PressableFeedback>
  );
}

function DateChip({
  form,
  isSeriesOccurrence,
}: {
  form: ComposerForm;
  isSeriesOccurrence: boolean;
}) {
  const { t } = useTranslation('common');
  const overlay = useOverlay();
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { getValues, setFocus, setValue } = form;
  const [startDate, endDate] = useWatch({ control: form.control, name: ['startDate', 'endDate'] });
  const startDateKey = toDateKey(startDate, dateFormatContext.timeZone);
  const endDateKey = endDate == null ? null : toDateKey(endDate, dateFormatContext.timeZone);
  const singleDayLabel =
    startDateKey === todayDateKey
      ? t('dateSections.today')
      : formatDateKeyLabel(startDateKey, 'monthDay', dateFormatContext);

  const applyStartDate = (nextStartDate: Date) => {
    const repeat = getValues('repeat');
    // 반복 회차의 날짜 이동은 이 회차에만 적용되므로 규칙은 그대로 둔다
    if (repeat != null && !isSeriesOccurrence) {
      setValue(
        'repeat',
        TodoRepeatPolicy.withRepeatStartDate(
          repeat,
          toDateKey(startDate, dateFormatContext.timeZone),
          toDateKey(nextStartDate, dateFormatContext.timeZone),
        ),
      );
    }
    // 여러 날 할 일은 기간을 유지한 채 옮긴다. 날짜 변경 시트와 같은 규칙이고, 끝 날짜보다 뒤를 골라도 시작이 끝을 넘지 않는다
    const nextEndDate = TodoPolicy.getShiftedEndDate(
      {
        startDate: toDateKey(startDate, dateFormatContext.timeZone),
        endDate: endDate == null ? null : toDateKey(endDate, dateFormatContext.timeZone),
      },
      toDateKey(nextStartDate, dateFormatContext.timeZone),
    );
    setValue('startDate', fromDate(nextStartDate));
    setValue('endDate', toNullableInstant(nextEndDate));
  };

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <TodoDatePickerContent
          value={toDate(startDate)}
          onChange={(nextStartDate) => {
            applyStartDate(nextStartDate);
            close();
          }}
          onCancel={close}
        />
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionChip
      icon={<ActionChip.Icon as={CalendarIcon} colorClassName="text-main" />}
      label={
        endDateKey == null || endDateKey === startDateKey
          ? singleDayLabel
          : formatDateKeyCompactRange(startDateKey, endDateKey, dateFormatContext)
      }
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { setFocus, setValue } = form;
  const [startDate, scheduledTime, isAllDay] = useWatch({
    control: form.control,
    name: ['startDate', 'scheduledTime', 'isAllDay'],
  });
  const displayedTime = isAllDay ? null : scheduledTime;

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePickerContent.Loading />}>
            <TodoTimePickerContent
              date={toDate(startDate)}
              value={{ scheduledTime, isAllDay }}
              onChange={(nextTime) => {
                setValue('scheduledTime', nextTime.scheduledTime);
                setValue('isAllDay', nextTime.isAllDay);
                close();
              }}
              onCancel={close}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionChip
      icon={
        <ActionChip.Icon
          as={ClockIcon}
          colorClassName={displayedTime == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={displayedTime ?? t('chip.allDay')}
      isActive={displayedTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip({
  form,
  onPress,
}: Pick<ComponentProps<typeof ActionChip>, 'onPress'> & { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const repeat = useWatch({ control: form.control, name: 'repeat' });

  return (
    <ActionChip
      icon={
        <ActionChip.Icon
          as={RepeatIcon}
          colorClassName={repeat == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, dateFormatContext)}
      isActive={repeat != null}
      onPress={onPress}
    />
  );
}

function VisibilityChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');

  return (
    <Controller
      control={form.control}
      name="visibility"
      render={({ field: { value, onChange } }) => {
        const isPrivate = TodoPolicy.isPrivate({ visibility: value });

        return (
          <ActionChip
            icon={
              isPrivate ? (
                <ActionChip.Icon as={EyeOffIcon} colorClassName="text-gray-6" />
              ) : (
                <ActionChip.Icon as={EyeIcon} colorClassName="text-gray-5" />
              )
            }
            label={isPrivate ? t('chip.private') : t('chip.public')}
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
          />
        );
      }}
    />
  );
}

function CategoryChip({ form }: { form: ComposerForm }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { setFocus } = form;
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <Controller
      control={form.control}
      name="categoryId"
      render={({ field: { value: categoryId, onChange } }) => {
        const category = categories.find(({ id }) => id === categoryId);

        return (
          <ActionChip
            icon={
              <Box
                className={cn('size-2 rounded-full', category == null && 'bg-gray-5')}
                style={category == null ? undefined : { backgroundColor: category.color }}
              />
            }
            label={category?.name ?? t('chip.category')}
            onPress={() => {
              overlay.open(({ isOpen, close, unmount }) => (
                <ModalBottomSheet
                  isOpen={isOpen}
                  onOpenChange={() => close()}
                  onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
                  onExit={unmount}
                >
                  <QueryErrorBoundary>
                    <Suspense fallback={<CategorySelectInput.Loading />}>
                      <CategorySelectInput
                        value={categoryId}
                        onChange={(nextCategoryId) => {
                          onChange(nextCategoryId);
                          close();
                        }}
                        submitLabel={t('add.submit')}
                      />
                    </Suspense>
                  </QueryErrorBoundary>
                </ModalBottomSheet>
              ));
            }}
          />
        );
      }}
    />
  );
}
