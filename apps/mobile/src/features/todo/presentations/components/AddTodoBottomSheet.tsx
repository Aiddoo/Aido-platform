import type { DayOfWeek } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardBottomSheet, StackedBottomSheetModal, useBottomSheetModal } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useEffect, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ActivityIndicator, type TextInput } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { type AddTodoFormInput, addTodoFormSchema } from '../schemas/add-todo-form.schema';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { TodoDatePickerContent } from './TodoDatePickerContent';
import { TodoFormContent } from './TodoFormContent';
import { TodoRepeatPickerContent } from './TodoRepeatPickerContent';
import { TodoTimePickerContent } from './TodoTimePickerContent';

interface AddTodoBottomSheetBaseProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

interface AddTodoBottomSheetCreateProps extends AddTodoBottomSheetBaseProps {
  mode: 'create';
  selectedDate: Date;
  categoryId: number;
  initialValues?: {
    title?: string;
    scheduledTime?: string | null;
    isAllDay?: boolean;
    endDate?: Date | null;
  };
  onSuccess?: () => void;
}

interface AddTodoBottomSheetEditProps extends AddTodoBottomSheetBaseProps {
  mode: 'edit';
  todo: TodoItemViewModel;
}

type AddTodoBottomSheetProps = AddTodoBottomSheetCreateProps | AddTodoBottomSheetEditProps;
type AddTodoFormValues = z.input<typeof addTodoFormSchema>;

export const AddTodoBottomSheet = (props: AddTodoBottomSheetProps) => {
  const { isOpen, onOpenChange, onClose } = props;

  const defaultValues: AddTodoFormValues = match(props)
    .with({ mode: 'edit' }, ({ todo }) => ({
      title: todo.title,
      startDate: todo.startDateObj,
      endDate: todo.endDateObj,
      scheduledTime: todo.isAllDay ? undefined : todo.scheduledTime24,
      isAllDay: todo.isAllDay,
      categoryId: todo.category.id,
      visibility: todo.visibility,
      isRecurring: false,
      repeatEndDate: null,
      daysOfWeek: [],
      source: 'manual' as const,
    }))
    .with({ mode: 'create' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: initialValues?.endDate ?? null,
      scheduledTime: initialValues?.scheduledTime ?? undefined,
      isAllDay: initialValues?.isAllDay ?? true,
      categoryId,
      visibility: 'PUBLIC' as const,
      isRecurring: false,
      repeatEndDate: null,
      daysOfWeek: [],
      source: 'manual' as const,
    }))
    .exhaustive();

  const methods = useForm<AddTodoFormValues, unknown, AddTodoFormInput>({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });

  const titleInputRef = useRef<TextInput>(null);

  const dateModal = useBottomSheetModal();
  const timeModal = useBottomSheetModal();
  const repeatModal = useBottomSheetModal();

  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isOpen) isClosingRef.current = false;
  }, [isOpen]);

  const focusTitle = () => {
    if (!isOpen || isClosingRef.current) return;
    titleInputRef.current?.focus();
  };

  const createMutation = useMutation(useCreateTodoMutationOptions());
  const updateMutation = useMutation(useUpdateTodoMutationOptions());
  const createRecurringMutation = useMutation(useCreateRecurringTodoMutationOptions());

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || createRecurringMutation.isPending;

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
          { onSuccess: onClose },
        );
      })
      .with({ mode: 'create' }, (createProps) => {
        const onMutationSuccess = () => {
          onClose();
          createProps.onSuccess?.();
        };

        if (data.isRecurring) {
          createRecurringMutation.mutate(
            {
              input: {
                title: data.title,
                startDate: formatDate(data.startDate),
                endDate: formatDate(data.repeatEndDate ?? data.startDate),
                daysOfWeek: data.daysOfWeek,
                scheduledTime: data.isAllDay ? undefined : data.scheduledTime,
                isAllDay: data.isAllDay,
                visibility: data.visibility,
                categoryId: data.categoryId,
              },
              source: data.source,
            },
            { onSuccess: onMutationSuccess },
          );
        } else {
          createMutation.mutate(
            {
              input: {
                title: data.title,
                startDate: formatDate(data.startDate),
                scheduledTime: data.isAllDay ? undefined : data.scheduledTime,
                isAllDay: data.isAllDay,
                visibility: data.visibility,
                categoryId: data.categoryId,
              },
              source: data.source,
            },
            { onSuccess: onMutationSuccess },
          );
        }
      })
      .exhaustive();
  });

  const handleDateConfirm = (start: Date) => {
    methods.setValue('startDate', start);
    dateModal.close();
  };

  const handleTimeConfirm = (time: string | undefined, allDay: boolean) => {
    methods.setValue('scheduledTime', time);
    methods.setValue('isAllDay', allDay);
    timeModal.close();
  };

  const handleRepeatConfirm = (repeat: { daysOfWeek: DayOfWeek[]; repeatEndDate: Date | null }) => {
    methods.setValue('isRecurring', true);
    methods.setValue('daysOfWeek', repeat.daysOfWeek);
    methods.setValue('repeatEndDate', repeat.repeatEndDate);
    repeatModal.close();
  };

  return (
    <FormProvider {...methods}>
      <KeyboardBottomSheet
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onCloseStart={() => {
          isClosingRef.current = true;
        }}
      >
        <TodoFormContent
          titleInputRef={titleInputRef}
          onDatePress={() => dateModal.open()}
          onTimePress={() => timeModal.open()}
          onRepeatPress={() => repeatModal.open()}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onClose={onClose}
        />
      </KeyboardBottomSheet>

      <StackedBottomSheetModal modalRef={dateModal.ref} onDismiss={focusTitle}>
        <TodoDatePickerContent
          startDate={methods.getValues('startDate')}
          onConfirm={handleDateConfirm}
          onCancel={() => dateModal.close()}
        />
      </StackedBottomSheetModal>

      <StackedBottomSheetModal modalRef={timeModal.ref} onDismiss={focusTitle}>
        <Suspense fallback={<ActivityIndicator />}>
          <TodoTimePickerContent
            draftDate={methods.getValues('startDate')}
            scheduledTime={methods.getValues('scheduledTime') ?? undefined}
            isAllDay={methods.getValues('isAllDay') ?? true}
            onConfirm={handleTimeConfirm}
            onCancel={() => timeModal.close()}
          />
        </Suspense>
      </StackedBottomSheetModal>

      <StackedBottomSheetModal modalRef={repeatModal.ref} onDismiss={focusTitle}>
        <TodoRepeatPickerContent
          startDate={methods.getValues('startDate')}
          repeat={{
            daysOfWeek: methods.getValues('daysOfWeek') ?? [],
            repeatEndDate: methods.getValues('repeatEndDate') ?? null,
          }}
          onConfirm={handleRepeatConfirm}
          onCancel={() => repeatModal.close()}
        />
      </StackedBottomSheetModal>
    </FormProvider>
  );
};
