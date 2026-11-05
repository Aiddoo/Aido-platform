import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategorySelectInput } from '@src/features/todo/components/category-select-input';
import { TodoDatePickerContent } from '@src/features/todo/components/todo-date-picker-content';
import {
  type TodoTimeValue,
  TodoTimePickerContent,
} from '@src/features/todo/components/todo-time-picker-content';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionChip,
  BottomSheetInput,
  Box,
  Button,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardBottomSheet,
  ModalBottomSheet,
  SHEET_CONTENT_PADDING,
  QueryErrorBoundary,
  useActionChipIconSize,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import {
  formatDateKey,
  formatDateKeyLabel,
  formatDateKeyRange,
} from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { useForm, useFormState, useWatch } from 'react-hook-form';
import { ActivityIndicator, Keyboard } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import {
  type PlanTodoEditFormValues,
  planTodoEditFormSchema,
  type PlanTodoFormValues,
} from '../../domains/plan-review-form.schema';
import {
  type PlannedTodo,
  withRepeat,
  withScheduledTime,
  withStartDate,
} from '../../domains/voice-plan.model';
import { PlanRepeatChip } from './plan-repeat';

interface PlanTodoEditSheetProps {
  /** 고치기 시작할 카드. 시트는 이 값의 사본을 고친다 */
  todo: PlanTodoFormValues;
  /** 카테고리를 고르지 못한 할 일이 시작하는 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 확인을 눌렀다. 검증을 지난 값만 온다. 닫기만 하면 고친 값을 버린다 */
  onConfirm: (todo: PlanTodoFormValues) => void;
}

/** 계획 카드 하나를 할 일 추가 시트와 같은 칩·바텀시트로 고친다. 고친 값은 이 시트의 폼에만 있다가 확인할 때 돌려준다 */
export function PlanTodoEditSheet({
  todo: initialTodo,
  fallbackCategoryId,
  isOpen,
  onOpenChange,
  onConfirm,
}: PlanTodoEditSheetProps) {
  const { t } = useTranslation(['todo', 'voicePlan', 'common']);
  const iconSize = useActionChipIconSize();
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { control, getValues, handleSubmit, setValue } = useForm<PlanTodoEditFormValues>({
    resolver: zodResolver(planTodoEditFormSchema),
    defaultValues: { todo: initialTodo },
    mode: 'onChange',
  });
  const todo = useWatch({ control, name: 'todo' });
  const { isValid } = useFormState({ control });
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const update = (change: (current: PlannedTodo) => PlannedTodo) => {
    const { isSelected, ...current } = getValues('todo');
    setValue(
      'todo',
      { ...change(current), isSelected },
      { shouldDirty: true, shouldValidate: true },
    );
  };
  const handleConfirm = handleSubmit((values) => onConfirm(values.todo));

  const startDateKey = formatDateKey(todo.startDate, getDeviceTimezone());
  const dateLabel =
    todo.endDate == null
      ? startDateKey === todayKey
        ? t('common:dateSections.today')
        : formatDateKeyLabel(startDateKey, 'monthDay', dateFormatContext)
      : formatDateKeyRange(
          startDateKey,
          formatDateKey(todo.endDate, getDeviceTimezone()),
          dateFormatContext,
        );
  const hasTime = todo.scheduledTime != null;
  const categoryId = todo.categoryId ?? fallbackCategoryId;
  const category = categoriesResult.categories.find((candidate) => candidate.id === categoryId);
  const isPrivate = todo.visibility === 'PRIVATE';

  const handleDateChipPress = () => {
    Keyboard.dismiss();
    overlay.open<Date | null>(({ isOpen: isPickerOpen, close, exit }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isPickerOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
      >
        <TodoDatePickerContent
          value={todo.startDate}
          onChange={(date) => {
            update((current) => withStartDate(current, date));
            close(date);
          }}
          onCancel={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };

  const handleTimeChipPress = () => {
    Keyboard.dismiss();
    overlay.open<TodoTimeValue | null>(({ isOpen: isPickerOpen, close, exit }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isPickerOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<ActivityIndicator />}>
            <TodoTimePickerContent
              date={todo.startDate}
              value={{ scheduledTime: todo.scheduledTime ?? undefined, isAllDay: !hasTime }}
              onChange={(value) => {
                update((current) =>
                  withScheduledTime(current, value.isAllDay ? null : (value.scheduledTime ?? null)),
                );
                close(value);
              }}
              onCancel={() => close(null)}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  const handleCategoryChipPress = () => {
    Keyboard.dismiss();
    overlay.open<number | null>(({ isOpen: isPickerOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isPickerOpen} onOpenChange={() => close(null)} onExit={exit}>
        <QueryErrorBoundary>
          <Suspense fallback={<ActivityIndicator />}>
            <CategorySelectInput
              value={categoryId}
              onChange={(nextCategoryId) => {
                update((current) => ({ ...current, categoryId: nextCategoryId }));
                close(nextCategoryId);
              }}
              submitLabel={t('todo:add.submit')}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={12}>
        <FormField control={control} name="todo.title">
          {({ value, onChange }) => (
            <BottomSheetInput
              accessibilityLabel={t('voicePlan:edit.titleLabel')}
              value={value}
              onChange={onChange}
              maxLength={ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH}
              size="medium"
              renderErrorMessage={false}
              returnKeyType="done"
              onSubmitEditing={() => handleConfirm()}
            />
          )}
        </FormField>

        {/* RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
        >
          <ActionChip
            icon={<CalendarIcon width={iconSize} height={iconSize} colorClassName="text-main" />}
            label={dateLabel}
            isActive
            onPress={handleDateChipPress}
          />
          <ActionChip
            icon={
              <ClockIcon
                width={iconSize}
                height={iconSize}
                colorClassName={hasTime ? 'text-main' : 'text-gray-5'}
              />
            }
            label={todo.scheduledTime ?? t('todo:chip.allDay')}
            isActive={hasTime}
            onPress={handleTimeChipPress}
          />
          <PlanRepeatChip
            value={todo.repeat}
            startDate={todo.startDate}
            onChange={(repeat, startDate) =>
              update((current) => withRepeat({ ...current, startDate }, repeat))
            }
          />
          <ActionChip
            icon={
              isPrivate ? (
                <EyeOffIcon width={iconSize} height={iconSize} colorClassName="text-gray-6" />
              ) : (
                <EyeIcon width={iconSize} height={iconSize} colorClassName="text-gray-5" />
              )
            }
            label={isPrivate ? t('todo:chip.private') : t('todo:chip.public')}
            onPress={() =>
              update((current) => ({ ...current, visibility: isPrivate ? 'PUBLIC' : 'PRIVATE' }))
            }
          />
          <ActionChip
            icon={
              <Box
                className={cn('size-2 rounded-full', category == null && 'bg-gray-5')}
                style={category == null ? undefined : { backgroundColor: category.color }}
              />
            }
            label={category?.name ?? t('todo:chip.category')}
            onPress={handleCategoryChipPress}
          />
        </ScrollView>

        <Button
          isDisabled={!isValid}
          onPress={() => handleConfirm()}
          testID="plan-todo-edit-confirm"
        >
          {t('voicePlan:edit.confirm')}
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
}
