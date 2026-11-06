import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategorySelectInput } from '@src/features/planning/todo/components/category-select-input';
import { TodoDatePickerContent } from '@src/features/planning/todo/components/todo-date-picker-content';
import { TodoRepeatPickerContent } from '@src/features/planning/todo/components/todo-repeat-picker-content';
import { TodoTimePickerContent } from '@src/features/planning/todo/components/todo-time-picker-content';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/todo/queries/get-todo-categories-query-options';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import { formatDateKeyLabel, formatDateKeyRange } from '@src/shared/date/date-format';
import { toDate, toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
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
  QueryErrorBoundary,
  RepeatIcon,
  SHEET_CONTENT_PADDING,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useFormState,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form';
import { ScrollView } from 'react-native-gesture-handler';

import {
  planTodoEditFormSchema,
  type PlanTodoEditFormValues,
  type PlanTodoFormValues,
} from '../../domains/plan-review-form.schema';
import { type PlannedTodo, VoicePlanPolicy } from '../../domains/voice-plan.model';

interface PlanTodoEditSheetProps {
  todo: PlanTodoFormValues;
  fallbackCategoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (todo: PlanTodoFormValues) => void;
}

export function PlanTodoEditSheet({
  todo,
  fallbackCategoryId,
  isOpen,
  onOpenChange,
  onConfirm,
}: PlanTodoEditSheetProps) {
  const { t } = useTranslation('voicePlan');
  const methods = useForm({
    resolver: zodResolver(planTodoEditFormSchema),
    defaultValues: { todo },
    mode: 'onChange',
  });
  const { isValid } = useFormState({ control: methods.control });
  const handleConfirm = methods.handleSubmit((values) => onConfirm(values.todo));

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <FormProvider {...methods}>
        <VStack gap={12}>
          <FormField control={methods.control} name="todo.title">
            {({ value, onChange }) => (
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
          </FormField>

          {/* RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
          >
            <DateChip />
            <TimeChip />
            <RepeatChip />
            <VisibilityChip />
            <CategoryChip fallbackCategoryId={fallbackCategoryId} />
          </ScrollView>

          <Button
            isDisabled={!isValid}
            onPress={() => handleConfirm()}
            testID="plan-todo-edit-confirm"
          >
            {t('edit.confirm')}
          </Button>
        </VStack>
      </FormProvider>
    </KeyboardBottomSheet>
  );
}

function updateTodo(
  { getValues, setValue }: UseFormReturn<PlanTodoEditFormValues>,
  change: (current: PlannedTodo) => PlannedTodo,
) {
  const { isSelected, ...current } = getValues('todo');
  setValue('todo', { ...change(current), isSelected }, { shouldDirty: true, shouldValidate: true });
}

function DateChip() {
  const { t } = useTranslation('common');
  const overlay = useOverlay();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const form = useFormContext<PlanTodoEditFormValues>();
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
              VoicePlanPolicy.withStartDate(current, toDateKey(nextStartDate, getDeviceTimezone())),
            );
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
        endDate == null ? singleDayLabel : formatDateKeyRange(startDate, endDate, dateFormatContext)
      }
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip() {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const form = useFormContext<PlanTodoEditFormValues>();
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
    <ActionChip
      icon={
        <ActionChip.Icon
          as={ClockIcon}
          colorClassName={scheduledTime == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={scheduledTime ?? t('chip.allDay')}
      isActive={scheduledTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip() {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();
  const form = useFormContext<PlanTodoEditFormValues>();
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
          value={{ startDate: toDate(startDate), repeat }}
          onChange={(next) => {
            updateTodo(form, (current) =>
              VoicePlanPolicy.withRepeat(
                { ...current, startDate: toDateKey(next.startDate, getDeviceTimezone()) },
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
    <ActionChip
      icon={
        <ActionChip.Icon
          as={RepeatIcon}
          colorClassName={repeat == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, dateFormatContext)}
      isActive={repeat != null}
      onPress={handlePress}
    />
  );
}

function VisibilityChip() {
  const { t } = useTranslation('todo');
  const form = useFormContext<PlanTodoEditFormValues>();
  const visibility = useWatch({ control: form.control, name: 'todo.visibility' });
  const isPrivate = visibility === 'PRIVATE';

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
      onPress={() =>
        updateTodo(form, (current) => ({
          ...current,
          visibility: isPrivate ? 'PUBLIC' : 'PRIVATE',
        }))
      }
    />
  );
}

function CategoryChip({ fallbackCategoryId }: { fallbackCategoryId: number }) {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const form = useFormContext<PlanTodoEditFormValues>();
  const todo = useWatch({ control: form.control, name: 'todo' });
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const categoryId = VoicePlanPolicy.getCategoryId(todo, fallbackCategoryId);
  const category = categories.find(({ id }) => id === categoryId);

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet isOpen={isOpen} onOpenChange={() => close()} onExit={unmount}>
        <QueryErrorBoundary>
          <Suspense fallback={<CategorySelectInput.Loading />}>
            <CategorySelectInput
              value={categoryId}
              onChange={(nextCategoryId) => {
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
    <ActionChip
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
