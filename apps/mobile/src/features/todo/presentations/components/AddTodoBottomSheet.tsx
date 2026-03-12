import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardBottomSheet } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { type AddTodoFormInput, addTodoFormSchema } from '../schemas/add-todo-form.schema';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { TodoDatePickerContent } from './TodoDatePickerContent';
import { TodoFormContent } from './TodoFormContent';
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
type PickerView = 'form' | 'date' | 'time';

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
    }))
    .exhaustive();

  const methods = useForm<AddTodoFormValues, unknown, AddTodoFormInput>({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });

  const [activeView, setActiveView] = useState<PickerView>('form');

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
              title: data.title,
              startDate: formatDate(data.startDate),
              endDate: formatDate(data.repeatEndDate ?? data.startDate),
              daysOfWeek: data.daysOfWeek,
              scheduledTime: data.isAllDay ? undefined : data.scheduledTime,
              isAllDay: data.isAllDay,
              visibility: data.visibility,
              categoryId: data.categoryId,
            },
            { onSuccess: onMutationSuccess },
          );
        } else {
          createMutation.mutate(
            {
              title: data.title,
              startDate: formatDate(data.startDate),
              scheduledTime: data.isAllDay ? undefined : data.scheduledTime,
              isAllDay: data.isAllDay,
              visibility: data.visibility,
              categoryId: data.categoryId,
            },
            { onSuccess: onMutationSuccess },
          );
        }
      })
      .exhaustive();
  });

  const handleDateConfirm = (
    start: Date,
    repeatResult: {
      isRecurring: boolean;
      daysOfWeek: import('@aido/validators').DayOfWeek[];
      repeatEndDate: Date | null;
    } | null,
  ) => {
    methods.setValue('startDate', start);
    if (repeatResult) {
      methods.setValue('isRecurring', repeatResult.isRecurring);
      methods.setValue('daysOfWeek', repeatResult.daysOfWeek);
      methods.setValue('repeatEndDate', repeatResult.repeatEndDate);
    }
    setActiveView('form');
  };

  const handleTimeConfirm = (time: string | undefined, allDay: boolean) => {
    methods.setValue('scheduledTime', time);
    methods.setValue('isAllDay', allDay);
    setActiveView('form');
  };

  const handleDatePress = () => {
    Keyboard.dismiss();
    setActiveView('date');
  };

  const handleTimePress = () => {
    Keyboard.dismiss();
    setActiveView('time');
  };

  const returnToForm = () => setActiveView('form');

  return (
    <FormProvider {...methods}>
      <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        {match(activeView)
          .with('date', () => (
            <TodoDatePickerContent
              startDate={methods.getValues('startDate')}
              repeat={
                props.mode === 'create'
                  ? {
                      isRecurring: methods.getValues('isRecurring') ?? false,
                      daysOfWeek: methods.getValues('daysOfWeek') ?? [],
                      repeatEndDate: methods.getValues('repeatEndDate') ?? null,
                    }
                  : undefined
              }
              showRepeat={props.mode === 'create'}
              onConfirm={handleDateConfirm}
              onCancel={returnToForm}
            />
          ))
          .with('time', () => (
            <Suspense fallback={<ActivityIndicator />}>
              <TodoTimePickerContent
                draftDate={methods.getValues('startDate')}
                scheduledTime={methods.getValues('scheduledTime') ?? undefined}
                isAllDay={methods.getValues('isAllDay') ?? true}
                onConfirm={handleTimeConfirm}
                onCancel={returnToForm}
              />
            </Suspense>
          ))
          .with('form', () => (
            <TodoFormContent
              onDatePress={handleDatePress}
              onTimePress={handleTimePress}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              onClose={onClose}
            />
          ))
          .exhaustive()}
      </KeyboardBottomSheet>
    </FormProvider>
  );
};
