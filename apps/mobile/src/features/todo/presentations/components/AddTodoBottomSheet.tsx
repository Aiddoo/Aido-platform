import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowUpIcon, CalendarIcon, EyeIcon, LockIcon } from '@src/shared/ui/Icon';
import { BottomSheetInput } from '@src/shared/ui/Input';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import {
  formatDate,
  formatDayOfMonth,
  formatMonthDay,
  isDateToday,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';
import { createTodoMutationOptions } from '../queries/create-todo-mutation-options';
import { updateTodoMutationOptions } from '../queries/update-todo-mutation-options';
import { type AddTodoFormInput, addTodoFormSchema } from '../schemas/add-todo-form.schema';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { TodoDateTimeEditorContent } from './TodoDateTimeEditorContent';

interface AddTodoBottomSheetBaseProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRequestClose: () => void;
}

interface AddTodoBottomSheetCreateProps extends AddTodoBottomSheetBaseProps {
  mode: 'create';
  selectedDate: Date;
  categoryId: number;
}

interface AddTodoBottomSheetEditProps extends AddTodoBottomSheetBaseProps {
  mode: 'edit';
  todo: TodoItemViewModel;
}

type AddTodoBottomSheetProps = AddTodoBottomSheetCreateProps | AddTodoBottomSheetEditProps;
type AddTodoFormValues = z.input<typeof addTodoFormSchema>;

export const AddTodoBottomSheet = (props: AddTodoBottomSheetProps) => {
  const { isOpen, onOpenChange, onRequestClose } = props;

  const defaultValues: AddTodoFormValues = match(props)
    .with({ mode: 'edit' }, ({ todo }) => ({
      title: todo.title,
      startDate: todo.startDateObj,
      endDate: todo.endDateObj,
      scheduledTime: todo.isAllDay ? undefined : todo.scheduledTime24,
      isAllDay: todo.isAllDay,
      categoryId: todo.category.id,
      visibility: todo.visibility,
    }))
    .with({ mode: 'create' }, ({ selectedDate, categoryId }) => ({
      title: '',
      startDate: selectedDate,
      endDate: null,
      scheduledTime: undefined,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC' as const,
    }))
    .exhaustive();

  const methods = useForm<AddTodoFormValues, unknown, AddTodoFormInput>({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const createMutation = useMutation(createTodoMutationOptions());
  const updateMutation = useMutation(updateTodoMutationOptions());

  const title = methods.watch('title');
  const isSubmitDisabled = !title?.trim() || createMutation.isPending || updateMutation.isPending;

  const onSubmit = methods.handleSubmit((data: AddTodoFormInput) => {
    match(props)
      .with({ mode: 'edit' }, ({ todo }) => {
        updateMutation.mutate(
          {
            todoId: todo.id,
            input: {
              title: data.title,
              startDate: formatDate(data.startDate),
              endDate: data.endDate ? formatDate(data.endDate) : null,
              scheduledTime: data.isAllDay ? null : (data.scheduledTime ?? null),
              isAllDay: data.isAllDay,
              visibility: data.visibility,
            },
          },
          { onSuccess: onRequestClose },
        );
      })
      .with({ mode: 'create' }, () => {
        createMutation.mutate(
          {
            title: data.title,
            startDate: formatDate(data.startDate),
            endDate: data.endDate ? formatDate(data.endDate) : undefined,
            scheduledTime: data.isAllDay ? undefined : data.scheduledTime,
            isAllDay: data.isAllDay,
            visibility: data.visibility,
            categoryId: data.categoryId,
          },
          { onSuccess: onRequestClose },
        );
      })
      .exhaustive();
  });

  return (
    <FormProvider {...methods}>
      <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        {showDatePicker ? (
          <TodoDateTimePicker onClose={() => setShowDatePicker(false)} />
        ) : (
          <VStack gap={12}>
            <VStack gap={10}>
              <Controller
                control={methods.control}
                name="title"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <BottomSheetInput
                    autoFocus
                    placeholder="무엇을 하고 싶으신가요?"
                    value={value}
                    onChangeText={onChange}
                    maxLength={200}
                    size="medium"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                  />
                )}
              />

              <HStack align="center" justify="between" className="w-full">
                <HStack gap={4} align="center">
                  <DateLabelButton
                    onPress={() => {
                      setShowDatePicker(true);
                      Keyboard.dismiss();
                    }}
                  />

                  <Controller
                    control={methods.control}
                    name="visibility"
                    render={({ field: { value, onChange } }) => {
                      const isPrivate = (value ?? 'PUBLIC') === 'PRIVATE';

                      return (
                        <PressableFeedback
                          onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
                          className="size-10 items-center justify-center"
                        >
                          {isPrivate ? (
                            <LockIcon width={20} height={20} colorClassName="text-gray-6" />
                          ) : (
                            <EyeIcon width={22} height={22} colorClassName="text-gray-5" />
                          )}
                        </PressableFeedback>
                      );
                    }}
                  />
                </HStack>

                <PressableFeedback
                  isDisabled={isSubmitDisabled}
                  onPress={onSubmit}
                  className={cn(
                    'size-8 items-center justify-center rounded-4xl',
                    isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
                  )}
                >
                  <ArrowUpIcon width={18} height={18} colorClassName="text-white" />
                </PressableFeedback>
              </HStack>
            </VStack>
          </VStack>
        )}
      </KeyboardBottomSheet>
    </FormProvider>
  );
};

const DateLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();

  const [startDate, endDate, scheduledTime, isAllDay] = useWatch({
    control,
    name: ['startDate', 'endDate', 'scheduledTime', 'isAllDay'],
  });

  const start = isDateToday(startDate) ? '오늘' : formatMonthDay(startDate);

  let dateLabel = start;

  if (endDate && !isSameDay(startDate, endDate)) {
    const end = isSameMonth(startDate, endDate)
      ? formatDayOfMonth(endDate)
      : formatMonthDay(endDate);
    dateLabel += ` - ${end}`;
  }

  if (!isAllDay && scheduledTime) {
    dateLabel += ` ${scheduledTime}`;
  }

  return (
    <PressableFeedback onPress={onPress} className="h-10 flex-row items-center gap-1 px-2">
      <CalendarIcon width={22} height={22} colorClassName="text-main" />
      <Text size="b3" tone="brand" weight="medium">
        {dateLabel}
      </Text>
    </PressableFeedback>
  );
};

const TodoDateTimePicker = ({ onClose }: { onClose: () => void }) => {
  const { control, setValue } = useFormContext<AddTodoFormInput>();
  const [startDate, endDate, scheduledTime, isAllDay] = useWatch({
    control,
    name: ['startDate', 'endDate', 'scheduledTime', 'isAllDay'],
  });

  return (
    <TodoDateTimeEditorContent
      initialValue={{
        startDate,
        endDate,
        scheduledTime,
        isAllDay,
      }}
      onCancel={onClose}
      onConfirm={({
        startDate: nextStartDate,
        endDate: nextEndDate,
        scheduledTime: nextScheduledTime,
        isAllDay: nextIsAllDay,
      }) => {
        setValue('startDate', nextStartDate);
        setValue('endDate', nextEndDate);
        setValue('scheduledTime', nextScheduledTime);
        setValue('isAllDay', nextIsAllDay);
        onClose();
      }}
    />
  );
};
