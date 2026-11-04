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
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardBottomSheet,
  ModalBottomSheet,
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
import { useFormContext, useWatch } from 'react-hook-form';
import { ActivityIndicator, Keyboard, ScrollView } from 'react-native';

import type { PlanReviewFormValues } from '../../domains/plan-review-form.schema';
import {
  type PlannedTodo,
  withRepeat,
  withScheduledTime,
  withStartDate,
} from '../../domains/voice-plan.model';
import { PlanRepeatChip } from './plan-repeat';

interface PlanTodoEditSheetProps {
  /** 폼 `actions`에서 고칠 할 일의 위치 */
  index: number;
  /** 카테고리를 고르지 못한 할 일이 시작하는 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** 계획 카드 하나를 할 일 추가 시트와 같은 칩·바텀시트로 고친다. 고친 값은 곧바로 폼에 반영된다 */
export function PlanTodoEditSheet({
  index,
  fallbackCategoryId,
  isOpen,
  onOpenChange,
}: PlanTodoEditSheetProps) {
  const { t } = useTranslation(['todo', 'voicePlan', 'common']);
  const iconSize = useActionChipIconSize();
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { control, getValues, setValue } = useFormContext<PlanReviewFormValues>();
  const todo = useWatch({ control, name: `actions.${index}` });
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  if (todo.type !== 'create-todo') {
    return null;
  }

  const update = (change: (current: PlannedTodo) => PlannedTodo) => {
    const current = getValues(`actions.${index}`);
    if (current.type !== 'create-todo') {
      return;
    }
    const { isSelected, ...currentTodo } = current;
    setValue(
      `actions.${index}`,
      { ...change(currentTodo), isSelected },
      { shouldDirty: true, shouldValidate: true },
    );
  };

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
      <ModalBottomSheet isOpen={isPickerOpen} onOpenChange={() => close(null)} onExit={exit}>
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
      <ModalBottomSheet isOpen={isPickerOpen} onOpenChange={() => close(null)} onExit={exit}>
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
        <FormField control={control} name={`actions.${index}.title`}>
          {({ value, onChange }) => (
            <BottomSheetInput
              accessibilityLabel={t('voicePlan:edit.titleLabel')}
              value={String(value)}
              onChange={onChange}
              maxLength={200}
              size="medium"
              renderErrorMessage={false}
              returnKeyType="done"
              onSubmitEditing={() => onOpenChange(false)}
            />
          )}
        </FormField>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerClassName="gap-2"
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
      </VStack>
    </KeyboardBottomSheet>
  );
}
