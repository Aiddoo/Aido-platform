import { zodResolver } from '@hookform/resolvers/zod';
import { AiUsagePolicy } from '@src/features/ai/domains/ai-usage.model';
import { useGetAiUsageQueryOptions } from '@src/features/ai/queries/get-ai-usage-query-options';
import { useParseTodoMutationOptions } from '@src/features/ai/queries/use-parse-todo-mutation-options';
import { useConvertMemoToTodosMutationOptions } from '@src/features/memo/queries/use-convert-memo-to-todos-mutation-options';
import { toMemoConversionInput } from '@src/features/memo/utils/to-memo-conversion-input';
import type { Todo } from '@src/features/todo/domains/todo.model';
import { useTrack } from '@src/shared/analytics';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSpeechRecognition } from '@src/shared/hooks/use-speech-recognition';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionChip,
  useActionChipIconSize,
  ArrowUpIcon,
  BottomSheetInput,
  Box,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  HStack,
  InfoIcon,
  KeyboardBottomSheet,
  MicIcon,
  ModalBottomSheet,
  PauseIcon,
  RepeatIcon,
  Text,
  useOverlay,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { formatDate, formatDaysOfWeek } from '@src/shared/utils/date';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentRef } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { ActivityIndicator, Keyboard, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';
import type { z } from 'zod';

import { type AddTodoFormInput, addTodoFormSchema } from '../domains/add-todo-form.schema';
import { useGetTodoCategoriesQueryOptions } from '../queries/get-todo-categories-query-options';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { formatTodoDateLabel } from '../utils/format-todo-date-label';
import { toTodoEditFormValues } from '../utils/to-todo-edit-form-values';
import { CategorySelectInput } from './category-select-bottom-sheet';
import { TodoDatePickerContent } from './todo-date-picker-content';
import {
  type RepeatPickerCloseResult,
  TodoRepeatPickerContent,
} from './todo-repeat-picker-content';
import { type TodoTimeValue, TodoTimePickerContent } from './todo-time-picker-content';

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
  todo: Todo;
}

interface AddTodoBottomSheetConvertMemoProps extends AddTodoBottomSheetBaseProps {
  mode: 'convert-memo';
  memoId: number;
  selectedDate: Date;
  categoryId: number;
  initialValues?: {
    title?: string;
  };
  onSuccess?: () => void;
}

type AddTodoBottomSheetProps =
  | AddTodoBottomSheetCreateProps
  | AddTodoBottomSheetEditProps
  | AddTodoBottomSheetConvertMemoProps;
type AddTodoFormValues = z.input<typeof addTodoFormSchema>;

export function AddTodoBottomSheet(props: AddTodoBottomSheetProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');
  const { showBoundary } = useErrorBoundary();
  const { isOpen, onOpenChange, onClose } = props;

  const defaultValues: AddTodoFormValues = match(props)
    .with({ mode: 'edit' }, ({ todo }) => toTodoEditFormValues(todo))
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
    .with({ mode: 'convert-memo' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: null,
      scheduledTime: undefined,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC' as const,
      isRecurring: false,
      repeatEndDate: null,
      daysOfWeek: [],
      source: 'manual' as const,
    }))
    .exhaustive();

  const methods = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });

  const todoInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const isClosingRef = useRef(false);
  const pendingFocusRef = useRef<number | null>(null);

  const overlay = useOverlay();

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
    }
    return () => {
      if (pendingFocusRef.current != null) {
        cancelAnimationFrame(pendingFocusRef.current);
      }
    };
  }, [isOpen]);

  const focusTodoInput = () => {
    if (!isOpen || isClosingRef.current) {
      return;
    }
    pendingFocusRef.current = requestAnimationFrame(() => {
      todoInputRef.current?.focus();
    });
  };

  const createMutation = useMutation(useCreateTodoMutationOptions());
  const updateMutation = useMutation(useUpdateTodoMutationOptions());
  const createRecurringMutation = useMutation(useCreateRecurringTodoMutationOptions());
  const convertMemoMutation = useMutation(useConvertMemoToTodosMutationOptions());

  const { isSubmitting } = useFormState({ control: methods.control });

  const onSubmit = methods.handleSubmit(async (data: AddTodoFormInput) => {
    try {
      await match(props)
        .with({ mode: 'edit' }, async ({ todo }) => {
          await updateMutation.mutateAsync(
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
        .with({ mode: 'convert-memo' }, async (convertProps) => {
          await convertMemoMutation.mutateAsync(
            {
              memoId: convertProps.memoId,
              input: toMemoConversionInput(data),
              source: 'manual',
            },
            {
              onSuccess: () => {
                onClose();
                convertProps.onSuccess?.();
              },
            },
          );
        })
        .with({ mode: 'create' }, async (createProps) => {
          const onMutationSuccess = () => {
            onClose();
            createProps.onSuccess?.();
          };

          if (data.isRecurring) {
            await createRecurringMutation.mutateAsync(
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
            await createMutation.mutateAsync(
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
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  const title = useWatch({ control: methods.control, name: 'title' });
  const isSubmitDisabled = !title?.trim() || isSubmitting;

  const openDatePicker = () => {
    Keyboard.dismiss();
    let pickerResult: Date | null = null;
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onClose={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult) {
            methods.setValue('startDate', pickerResult);
          }
          focusTodoInput();
        }}
      >
        <TodoDatePickerContent
          value={methods.getValues('startDate')}
          onChange={(date) => {
            pickerResult = date;
            close(date);
          }}
          onCancel={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };

  const openTimePicker = () => {
    Keyboard.dismiss();
    let pickerResult: TodoTimeValue | null = null;
    overlay.open<TodoTimeValue | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onClose={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult) {
            methods.setValue('scheduledTime', pickerResult.scheduledTime);
            methods.setValue('isAllDay', pickerResult.isAllDay);
          }
          focusTodoInput();
        }}
      >
        <Suspense fallback={<ActivityIndicator />}>
          <TodoTimePickerContent
            date={methods.getValues('startDate')}
            value={{
              scheduledTime: methods.getValues('scheduledTime') ?? undefined,
              isAllDay: methods.getValues('isAllDay') ?? true,
            }}
            onChange={(value) => {
              pickerResult = value;
              close(value);
            }}
            onCancel={() => close(null)}
          />
        </Suspense>
      </ModalBottomSheet>
    ));
  };

  const openRepeatPicker = () => {
    Keyboard.dismiss();
    let pickerResult: RepeatPickerCloseResult | null = null;
    overlay.open<RepeatPickerCloseResult | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onClose={() => close({ type: 'cancel' })}
        onExit={() => {
          exit();
          match(pickerResult)
            .with({ type: 'reset' }, () => {
              methods.setValue('isRecurring', false);
              methods.setValue('daysOfWeek', []);
              methods.setValue('repeatEndDate', null);
            })
            .with({ type: 'confirm' }, ({ value }) => {
              methods.setValue('isRecurring', true);
              methods.setValue('daysOfWeek', value.daysOfWeek);
              methods.setValue('repeatEndDate', value.repeatEndDate);
              methods.setValue('startDate', value.startDate);
            })
            .otherwise(() => {});
          focusTodoInput();
        }}
      >
        <TodoRepeatPickerContent
          startDate={methods.getValues('startDate')}
          repeat={{
            daysOfWeek: methods.getValues('daysOfWeek') ?? [],
            repeatEndDate: methods.getValues('repeatEndDate') ?? null,
          }}
          onClose={(result) => {
            pickerResult = result;
            close(result);
          }}
        />
      </ModalBottomSheet>
    ));
  };

  const openCategoryPicker = () => {
    Keyboard.dismiss();
    let pickerResult: number | null = null;
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onClose={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult != null) {
            methods.setValue('categoryId', pickerResult);
          }
          focusTodoInput();
        }}
      >
        <Suspense fallback={<ActivityIndicator />}>
          <CategorySelectInput
            value={methods.getValues('categoryId')}
            onChange={(categoryId) => {
              pickerResult = categoryId;
              close(categoryId);
            }}
            submitLabel={t('add.submit')}
          />
        </Suspense>
      </ModalBottomSheet>
    ));
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
        <VStack gap={12}>
          <FormField control={methods.control} name="title">
            {({ onChange, value }) => (
              <BottomSheetInput
                ref={todoInputRef}
                autoFocus
                placeholder={t('add.placeholder')}
                value={value}
                onChange={onChange}
                maxLength={200}
                size="medium"
                renderErrorMessage={false}
                returnKeyType="done"
                onSubmitEditing={() => (isSubmitDisabled ? onClose() : onSubmit())}
              />
            )}
          </FormField>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerClassName="gap-2"
          >
            <DateChip onPress={openDatePicker} />
            <TimeChip onPress={openTimePicker} />
            <RepeatChip onPress={openRepeatPicker} />
            <VisibilityChip />
            <CategoryChip onPress={openCategoryPicker} />
          </ScrollView>

          <Box className="h-px bg-gray-2" />

          <HStack gap={8} align="center" justify="end">
            <AiFeatureTooltip />
            <AiParseButton onClose={onClose} />
            <PressableFeedback
              isDisabled={isSubmitDisabled}
              onPress={() => onSubmit()}
              style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
              className={cn(
                'items-center justify-center rounded-4xl',
                isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
              )}
            >
              {isSubmitting ? (
                <Spinner
                  size="sm"
                  color={typeof spinnerColor === 'string' ? spinnerColor : undefined}
                />
              ) : (
                <ArrowUpIcon
                  width={fontScaledSize(18)}
                  height={fontScaledSize(18)}
                  colorClassName="text-white"
                />
              )}
            </PressableFeedback>
          </HStack>
        </VStack>
      </KeyboardBottomSheet>
    </FormProvider>
  );
}

// --- chip components ---

const DateChip = ({ onPress }: { onPress: () => void }) => {
  const actionChipIconSize = useActionChipIconSize();
  const startDate = useWatch<AddTodoFormValues, 'startDate'>({ name: 'startDate' });
  const today = useToday();
  const label = formatTodoDateLabel({ startDate, scheduledTime: null, isAllDay: true, today });

  return (
    <ActionChip
      icon={
        <CalendarIcon
          width={actionChipIconSize}
          height={actionChipIconSize}
          colorClassName="text-main"
        />
      }
      label={label}
      isActive
      onPress={onPress}
    />
  );
};

const TimeChip = ({ onPress }: { onPress: () => void }) => {
  const actionChipIconSize = useActionChipIconSize();
  const [scheduledTime, isAllDay] = useWatch<AddTodoFormValues, ['scheduledTime', 'isAllDay']>({
    name: ['scheduledTime', 'isAllDay'],
  });
  const hasTime = !isAllDay && !!scheduledTime;
  const { t } = useTranslation('todo');
  const label = isAllDay ? t('chip.allDay') : (scheduledTime ?? t('chip.allDay'));

  return (
    <ActionChip
      icon={
        <ClockIcon
          width={actionChipIconSize}
          height={actionChipIconSize}
          colorClassName={hasTime ? 'text-main' : 'text-gray-5'}
        />
      }
      label={label}
      isActive={hasTime}
      onPress={onPress}
    />
  );
};

const RepeatChip = ({ onPress }: { onPress: () => void }) => {
  const actionChipIconSize = useActionChipIconSize();
  const [isRecurring, daysOfWeek] = useWatch<AddTodoFormValues, ['isRecurring', 'daysOfWeek']>({
    name: ['isRecurring', 'daysOfWeek'],
  });
  const { t } = useTranslation('todo');
  const isActive = isRecurring && (daysOfWeek?.length ?? 0) > 0;
  const days = daysOfWeek ?? [];
  const label = match({ isActive, isEveryDay: days.length === 7 })
    .with({ isActive: false }, () => t('chip.repeat'))
    .with({ isEveryDay: true }, () => t('chip.daily'))
    .otherwise(() => t('chip.weeklyDays', { days: formatDaysOfWeek(days) }));

  return (
    <ActionChip
      icon={
        <RepeatIcon
          width={actionChipIconSize}
          height={actionChipIconSize}
          colorClassName={isActive ? 'text-main' : 'text-gray-5'}
        />
      }
      label={label}
      isActive={isActive}
      onPress={onPress}
    />
  );
};

const VisibilityChip = () => {
  const { t } = useTranslation('todo');
  const actionChipIconSize = useActionChipIconSize();
  const { control } = useFormContext<AddTodoFormValues>();
  return (
    <FormField control={control} name="visibility">
      {({ value, onChange }) => {
        const isPrivate = (value ?? 'PUBLIC') === 'PRIVATE';
        return (
          <ActionChip
            icon={
              isPrivate ? (
                <EyeOffIcon
                  width={actionChipIconSize}
                  height={actionChipIconSize}
                  colorClassName="text-gray-6"
                />
              ) : (
                <EyeIcon
                  width={actionChipIconSize}
                  height={actionChipIconSize}
                  colorClassName="text-gray-5"
                />
              )
            }
            label={isPrivate ? t('chip.private') : t('chip.public')}
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
          />
        );
      }}
    </FormField>
  );
};

const CategoryChip = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation('todo');
  const categoryId = useWatch<AddTodoFormValues, 'categoryId'>({ name: 'categoryId' });
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = useMemo(
    () => data.categories.find((c) => c.id === categoryId),
    [data.categories, categoryId],
  );

  return (
    <ActionChip
      icon={
        <Box
          className={cn('size-2 rounded-full', !category && 'bg-gray-5')}
          style={category && { backgroundColor: category.color }}
        />
      }
      label={category?.name ?? t('chip.category')}
      onPress={onPress}
    />
  );
};

const AiFeatureTooltip = () => {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Popover isOpen={tooltipOpen} onOpenChange={setTooltipOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback
          onPress={() => setTooltipOpen(true)}
          className="items-center justify-center"
        >
          <HStack gap={4} align="center">
            <Text size="e2" weight="medium" shade={6}>
              {t('add.aiFeature')}
            </Text>
            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <Popover.Portal disableFullWindowOverlay={false}>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="top"
          align="end"
          avoidCollisions={false}
          className="rounded-2xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <VStack gap={4}>
            <HStack gap={4} align="center">
              <MicIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-main"
              />
              <Text size="b3" weight="semibold">
                {t('add.voiceAddTitle')}
              </Text>
            </HStack>
            <Text size="b3" shade={6}>
              {t('add.voiceAddHint')}
            </Text>
          </VStack>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

interface AiParseButtonProps {
  onClose: () => void;
}

const AiParseButton = ({ onClose }: AiParseButtonProps) => {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const methods = useFormContext<AddTodoFormInput>();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

  const { data: aiUsage } = useQuery(useGetAiUsageQueryOptions());
  const isAiLimitReached = aiUsage != null && AiUsagePolicy.isLimitReached(aiUsage);

  const parseMutation = useMutation(useParseTodoMutationOptions());

  const handleRecognitionEnd = () => {
    const currentTitle = methods.getValues('title');
    const currentCategoryId = methods.getValues('categoryId');
    if (!currentTitle?.trim()) {
      return;
    }

    parseMutation.mutate(
      { text: currentTitle.trim(), categoryId: currentCategoryId },
      {
        onSuccess: (result) => {
          const { data } = result;
          methods.reset(
            (prev) => ({
              ...prev,
              title: data.title,
              startDate: data.startDate,
              endDate: data.endDate,
              scheduledTime: data.scheduledTime,
              isAllDay: data.scheduledTime ? false : data.isAllDay,
              isRecurring: data.isRecurring,
              daysOfWeek: data.recurrence?.daysOfWeek ?? [],
              repeatEndDate: data.recurrence?.endDate ?? null,
              source: 'ai',
            }),
            { keepDirtyValues: true },
          );
        },
      },
    );
  };

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult: (text) => {
      methods.setValue('title', text);
    },
    onEnd: handleRecognitionEnd,
    onError: toast.error,
  });

  const handlePress = () => {
    if (isRecognizing) {
      stop();
      return;
    }

    if (isAiLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'ai_parse' });
      premiumDialog.open({
        description: t('premium.unlimitedParse'),
        onConfirm: onClose,
      });
      return;
    }

    Keyboard.dismiss();
    start();
  };

  return (
    <PressableFeedback
      onPress={handlePress}
      isDisabled={parseMutation.isPending}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className="items-center justify-center rounded-full bg-main/10"
    >
      {isRecognizing ? (
        <PauseIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-error"
        />
      ) : (
        <MicIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-main"
        />
      )}
    </PressableFeedback>
  );
};
