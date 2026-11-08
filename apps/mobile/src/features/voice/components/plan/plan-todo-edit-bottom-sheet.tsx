import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { TodoDatePickerContent } from '@src/features/planning/todo/components/todo-date-picker-content';
import { TodoRepeatPickerContent } from '@src/features/planning/todo/components/todo-repeat-picker-content';
import { TodoTimePickerContent } from '@src/features/planning/todo/components/todo-time-picker-content';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import {
  formatDateKeyLabel,
  formatDateKeyRange,
  formatHHmmTime,
} from '@src/shared/date/date-format';
import { fromDate, toDate, toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionButton,
  BottomSheetInput,
  Box,
  Button,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardBottomSheet,
  ModalBottomSheet,
  QueryErrorBoundary,
  RepeatIcon,
  SHEET_CONTENT_PADDING,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Controller, useForm, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';
import { ScrollView } from 'react-native-gesture-handler';

import { VoicePlanPolicy } from '../../domains/voice-plan.model';
import {
  type PlanTodoEditFormValues,
  planTodoEditFormSchema,
  type PlanTodoFormValues,
} from '../../schemas/plan-review-form.schema';
import { type PlannedTodo } from '../../schemas/voice-plan.schema';

interface PlanTodoEditBottomSheetProps {
  todo: PlanTodoFormValues;
  fallbackCategoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (todo: PlanTodoFormValues) => void;
}

export function PlanTodoEditBottomSheet({
  todo,
  fallbackCategoryId,
  isOpen,
  onOpenChange,
  onConfirm,
}: PlanTodoEditBottomSheetProps) {
  const { t } = useTranslation('voicePlan');
  const form = useForm({
    resolver: zodResolver(planTodoEditFormSchema),
    defaultValues: { todo },
    mode: 'onChange',
  });
  const { isValid } = useFormState({ control: form.control });
  const handleConfirm = form.handleSubmit((values) => onConfirm(values.todo));

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={12}>
        <Controller
          control={form.control}
          name="todo.title"
          render={({ field: { value, onChange } }) => (
            <BottomSheetInput
              accessibilityLabel={t('edit.titleLabel')}
              value={value}
              onChange={onChange}
              maxLength={ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH}
              size="medium"
              renderErrorMessage={false}
              returnKeyType="done"
              onSubmitEditing={() => handleConfirm()}
            />
          )}
        />

        {/* RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
        >
          <DateChip form={form} />
          <TimeChip form={form} />
          <RepeatChip form={form} />
          <VisibilityChip form={form} />
          <CategoryChip form={form} fallbackCategoryId={fallbackCategoryId} />
        </ScrollView>

        <Button
          isDisabled={!isValid}
          onPress={() => handleConfirm()}
          testID="plan-todo-edit-confirm"
        >
          {t('edit.confirm')}
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
}

interface PlanTodoChipProps {
  form: UseFormReturn<PlanTodoEditFormValues>;
}

function updateTodo(
  { getValues, setValue }: UseFormReturn<PlanTodoEditFormValues>,
  change: (current: PlannedTodo) => PlannedTodo,
) {
  const { isSelected, ...current } = getValues('todo');
  setValue('todo', { ...change(current), isSelected }, { shouldDirty: true, shouldValidate: true });
}

function DateChip({ form }: PlanTodoChipProps) {
  const { t } = useTranslation('common');
  const overlay = useOverlay();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const [startDate, endDate] = useWatch({
    control: form.control,
    name: ['todo.startDate', 'todo.endDate'],
  });
  const singleDayLabel =
    startDate === todayKey
      ? t('dateSections.today')
      : formatDateKeyLabel(startDate, 'monthDay', dateFormatContext);

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onExit={unmount}
      >
        <TodoDatePickerContent
          value={toDate(startDate)}
          onChange={(nextStartDate) => {
            updateTodo(form, (current) =>
              VoicePlanPolicy.withStartDate(
                current,
                toDateKey(nextStartDate, dateFormatContext.timeZone),
              ),
            );
            close();
          }}
          onCancel={close}
        />
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionButton
      icon={<ActionButton.Icon Icon={CalendarIcon} colorClassName="text-main" />}
      label={
        endDate == null ? singleDayLabel : formatDateKeyRange(startDate, endDate, dateFormatContext)
      }
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip({ form }: PlanTodoChipProps) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const [startDate, scheduledTime] = useWatch({
    control: form.control,
    name: ['todo.startDate', 'todo.scheduledTime'],
  });

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onExit={unmount}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePickerContent.Loading />}>
            <TodoTimePickerContent
              date={toDate(startDate)}
              value={{ scheduledTime, isAllDay: scheduledTime == null }}
              onChange={(nextTime) => {
                updateTodo(form, (current) =>
                  VoicePlanPolicy.withScheduledTime(
                    current,
                    nextTime.isAllDay ? null : nextTime.scheduledTime,
                  ),
                );
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
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={ClockIcon}
          colorClassName={scheduledTime == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={
        scheduledTime == null
          ? t('chip.allDay')
          : formatHHmmTime(scheduledTime, preference.timeFormat, dateFormatContext)
      }
      isActive={scheduledTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip({ form }: PlanTodoChipProps) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  const [startDate, repeat] = useWatch({
    control: form.control,
    name: ['todo.startDate', 'todo.repeat'],
  });

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onExit={unmount}
      >
        <TodoRepeatPickerContent
          value={{ startDate: fromDate(toDate(startDate)), repeat }}
          onChange={(next) => {
            updateTodo(form, (current) =>
              VoicePlanPolicy.withRepeat(
                { ...current, startDate: toDateKey(next.startDate, dateFormatContext.timeZone) },
                next.repeat,
              ),
            );
            close();
          }}
          onCancel={close}
        />
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionButton
      icon={
        <ActionButton.Icon
          Icon={RepeatIcon}
          colorClassName={repeat == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, dateFormatContext)}
      isActive={repeat != null}
      onPress={handlePress}
    />
  );
}

function VisibilityChip({ form }: PlanTodoChipProps) {
  const { t } = useTranslation('todo');
  const visibility = useWatch({ control: form.control, name: 'todo.visibility' });
  const isPrivate = TodoPolicy.isPrivate({ visibility });

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
      onPress={() => updateTodo(form, TodoPolicy.withVisibilityToggled)}
    />
  );
}

function CategoryChip({
  form,
  fallbackCategoryId,
}: PlanTodoChipProps & { fallbackCategoryId: number }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const todoCategoryId = useWatch({ control: form.control, name: 'todo.categoryId' });
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const categoryId = todoCategoryId ?? fallbackCategoryId;
  const category = TodoCategoryPolicy.findCategory(categories, categoryId);

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet isOpen={isOpen} onOpenChange={() => close()} onExit={unmount}>
        <QueryErrorBoundary>
          <Suspense fallback={<CategorySelectInput.Loading />}>
            <CategorySelectInput
              defaultValue={categoryId}
              onSubmit={(nextCategoryId) => {
                updateTodo(form, (current) => ({ ...current, categoryId: nextCategoryId }));
                close();
              }}
              submitLabel={t('add.submit')}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
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
