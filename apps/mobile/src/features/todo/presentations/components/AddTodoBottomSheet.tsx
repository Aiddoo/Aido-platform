import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowUpIcon, CalendarIcon, ClockIcon, EyeIcon, EyeOffIcon } from '@src/shared/ui/Icon';
import { BottomSheetInput } from '@src/shared/ui/Input';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
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
import { formatTodoDateLabel } from '../utils/format-todo-date-label';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { TodoDatePickerContent } from './TodoDatePickerContent';
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

  const [activeView, setActiveView] = useState<PickerView>('form');

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
          { onSuccess: onClose },
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
          { onSuccess: onClose },
        );
      })
      .exhaustive();
  });

  return (
    <FormProvider {...methods}>
      <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        {match(activeView)
          .with('date', () => <FormDatePicker onDone={() => setActiveView('form')} />)
          .with('time', () => <FormTimePicker onDone={() => setActiveView('form')} />)
          .with('form', () => (
            <VStack>
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
                      setActiveView('date');
                      Keyboard.dismiss();
                    }}
                  />

                  <TimeLabelButton
                    onPress={() => {
                      setActiveView('time');
                      Keyboard.dismiss();
                    }}
                  />

                  <VisibilityChip />
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
          ))
          .exhaustive()}
      </KeyboardBottomSheet>
    </FormProvider>
  );
};

const DateLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();

  const [startDate, endDate] = useWatch({
    control,
    name: ['startDate', 'endDate'],
  });

  const dateLabel = formatTodoDateLabel({
    startDate,
    endDate,
    scheduledTime: null,
    isAllDay: true,
  });

  return (
    <PressableFeedback
      onPress={onPress}
      className="h-8 flex-row items-center gap-1.5 rounded-full bg-main/10 px-3"
    >
      <CalendarIcon width={16} height={16} colorClassName="text-main" />
      <Text size="e1" tone="brand" weight="medium">
        {dateLabel}
      </Text>
    </PressableFeedback>
  );
};

const TimeLabelButton = ({ onPress }: { onPress: () => void }) => {
  const { control } = useFormContext<AddTodoFormInput>();

  const [scheduledTime, isAllDay] = useWatch({
    control,
    name: ['scheduledTime', 'isAllDay'],
  });

  const hasTime = !isAllDay && !!scheduledTime;
  const timeLabel = isAllDay ? '종일' : (scheduledTime ?? '종일');

  return (
    <PressableFeedback
      onPress={onPress}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full px-3',
        hasTime ? 'bg-main/10' : 'bg-gray-2',
      )}
    >
      <ClockIcon width={16} height={16} colorClassName={hasTime ? 'text-main' : 'text-gray-5'} />
      <Text size="e1" weight="medium" {...(hasTime ? { tone: 'brand' } : { shade: 6 })}>
        {timeLabel}
      </Text>
    </PressableFeedback>
  );
};

const FormDatePicker = ({ onDone }: { onDone: () => void }) => {
  const { getValues, setValue } = useFormContext<AddTodoFormValues>();

  return (
    <TodoDatePickerContent
      startDate={getValues('startDate')}
      endDate={getValues('endDate') ?? null}
      onConfirm={(start, end) => {
        setValue('startDate', start);
        setValue('endDate', end);
        onDone();
      }}
      onCancel={onDone}
    />
  );
};

const FormTimePicker = ({ onDone }: { onDone: () => void }) => {
  const { getValues, setValue } = useFormContext<AddTodoFormValues>();

  return (
    <TodoTimePickerContent
      draftDate={getValues('startDate')}
      scheduledTime={getValues('scheduledTime') ?? undefined}
      isAllDay={getValues('isAllDay') ?? true}
      onConfirm={(time, allDay) => {
        setValue('scheduledTime', time);
        setValue('isAllDay', allDay);
        onDone();
      }}
      onCancel={onDone}
    />
  );
};

const VisibilityChip = () => {
  const { control } = useFormContext<AddTodoFormInput>();

  return (
    <Controller
      control={control}
      name="visibility"
      render={({ field: { value, onChange } }) => {
        const isPrivate = (value ?? 'PUBLIC') === 'PRIVATE';

        return (
          <PressableFeedback
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-gray-2 px-3"
          >
            {isPrivate ? (
              <EyeOffIcon width={16} height={16} colorClassName="text-gray-6" />
            ) : (
              <EyeIcon width={16} height={16} colorClassName="text-gray-5" />
            )}
            <Text size="e1" weight="medium" shade={6}>
              {isPrivate ? '비공개' : '공개'}
            </Text>
          </PressableFeedback>
        );
      }}
    />
  );
};
