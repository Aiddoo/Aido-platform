import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TodoScheduleChips,
  type TodoScheduleChipsValue,
} from '@src/features/planning/todo/components/todo-schedule-chips';
import { getScheduledTime, getVisibility } from '@src/features/planning/todo/domains/todo.model';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetInput, Button, KeyboardBottomSheet, VStack } from '@src/shared/ui';
import { Controller, useForm, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import type { PlannedTodo } from '../domains/voice-plan.model';
import {
  type PlanTodoEditFormValues,
  planTodoEditFormSchema,
  type PlanTodoFormValues,
} from '../schemas/plan-review-form.schema';

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
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      footer={
        <VStack gap={12}>
          <PlanTodoScheduleChips form={form} fallbackCategoryId={fallbackCategoryId} />

          <Button
            isDisabled={!isValid}
            onPress={() => handleConfirm()}
            testID="plan-todo-edit-confirm"
          >
            {t('edit.confirm')}
          </Button>
        </VStack>
      }
    >
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
    </KeyboardBottomSheet>
  );
}

interface PlanTodoScheduleChipsProps {
  form: UseFormReturn<PlanTodoEditFormValues>;
  fallbackCategoryId: number;
}

/** 할 일 작성과 같은 일정 칩. 계획 카드는 종일을 시각 null로, 정하지 않은 공개 범위·카테고리를 null로 둔다 */
function PlanTodoScheduleChips({ form, fallbackCategoryId }: PlanTodoScheduleChipsProps) {
  const todo = useWatch({ control: form.control, name: 'todo' });
  const value: TodoScheduleChipsValue = {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: todo.scheduledTime,
    isAllDay: todo.scheduledTime == null,
    repeat: todo.repeat,
    visibility: getVisibility(todo.visibility),
    categoryId: todo.categoryId ?? fallbackCategoryId,
  };

  return (
    <TodoScheduleChips
      value={value}
      onChange={(next) => updateTodo(form, (current) => withScheduleChips(current, value, next))}
    />
  );
}

function updateTodo(
  { getValues, setValue }: UseFormReturn<PlanTodoEditFormValues>,
  change: (current: PlannedTodo) => PlannedTodo,
) {
  const { isSelected, ...current } = getValues('todo');
  setValue('todo', { ...change(current), isSelected }, { shouldDirty: true, shouldValidate: true });
}

// 칩이 바꾼 칸만 옮긴다. 정하지 않은 공개 범위·카테고리(null)는 직접 고르기 전까지 그대로 둔다
function withScheduleChips(
  todo: PlannedTodo,
  previous: TodoScheduleChipsValue,
  next: TodoScheduleChipsValue,
): PlannedTodo {
  return {
    ...todo,
    startDate: next.startDate,
    endDate: next.endDate,
    scheduledTime: getScheduledTime(next),
    repeat: next.repeat,
    visibility: next.visibility === previous.visibility ? todo.visibility : next.visibility,
    categoryId: next.categoryId === previous.categoryId ? todo.categoryId : next.categoryId,
  };
}
