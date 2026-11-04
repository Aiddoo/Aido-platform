import { zodResolver } from '@hookform/resolvers/zod';
import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import type { ParsedTodo } from '@src/features/ai/domains/parsed-todo.model';
import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useParseTodoMutationOptions } from '@src/features/ai/queries/use-parse-todo-mutation-options';
import { useConvertMemoToTodosMutationOptions } from '@src/features/memo/queries/use-convert-memo-to-todos-mutation-options';
import { toMemoConversionInput } from '@src/features/memo/utils/to-memo-conversion-input';
import { QuotaChip } from '@src/features/subscription/components/quota-chip';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import type { Todo } from '@src/features/todo/domains/todo.model';
import { useDictation } from '@src/features/voice/hooks/use-dictation';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
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
  QueryErrorBoundary,
  RepeatIcon,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { isEqual } from 'es-toolkit';
import { Popover, PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentRef } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { ActivityIndicator, Keyboard, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { type AddTodoFormValues, addTodoFormSchema } from '../domains/add-todo-form.schema';
import { type TodoRepeat, TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { TodoPolicy } from '../domains/todo.model';
import { useSelectTodoScope } from '../hooks/use-select-todo-scope';
import { useGetTodoCategoriesQueryOptions } from '../queries/get-todo-categories-query-options';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { formatRepeatSummary } from '../utils/format-repeat-summary';
import { toTodoEditFormValues } from '../utils/to-todo-edit-form-values';
import { CategorySelectInput } from './category-select-input';
import { TodoDatePickerContent } from './todo-date-picker-content';
import { TodoRepeatPickerContent } from './todo-repeat-picker-content';
import { type TodoTimeValue, TodoTimePickerContent } from './todo-time-picker-content';

interface AddTodoBottomSheetBaseProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  /** 닫기 애니메이션 없이 바로 다른 화면으로 떠날 때(구독 화면 이동). 없으면 onClose. */
  onExit?: () => void;
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
  repeat?: TodoRepeat | null;
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

function toParsedTodoRepeat({ isRecurring, recurrence }: ParsedTodo): TodoRepeat | null {
  return isRecurring && recurrence != null
    ? TodoRepeatPolicy.createWeeklyUntil(recurrence.daysOfWeek, toDeviceDateKey(recurrence.endDate))
    : null;
}

function toDefaultFormValues(props: AddTodoBottomSheetProps): AddTodoFormValues {
  return match(props)
    .returnType<AddTodoFormValues>()
    .with({ mode: 'edit' }, ({ todo, repeat }) => toTodoEditFormValues(todo, repeat))
    .with({ mode: 'create' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: initialValues?.endDate ?? null,
      scheduledTime: initialValues?.scheduledTime ?? undefined,
      isAllDay: initialValues?.isAllDay ?? true,
      categoryId,
      visibility: 'PUBLIC',
      repeat: null,
      source: 'manual',
    }))
    .with({ mode: 'convert-memo' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: null,
      scheduledTime: undefined,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC',
      repeat: null,
      source: 'manual',
    }))
    .exhaustive();
}

export function AddTodoBottomSheet(props: AddTodoBottomSheetProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');
  const { showBoundary } = useErrorBoundary();
  const { isOpen, onOpenChange, onClose, onExit = onClose } = props;

  const defaultValues = toDefaultFormValues(props);

  const methods = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });

  const todoInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const isClosingRef = useRef(false);
  const pendingFocusRef = useRef<number | null>(null);

  const overlay = useOverlay();
  const { selectEditScope } = useSelectTodoScope();

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

  const handleSubmitTodo = methods.handleSubmit(async (values) => {
    try {
      await match(props)
        .with({ mode: 'edit' }, async ({ todo }) => {
          const isSeries = TodoPolicy.isRecurring(todo);
          const scope = isSeries ? await selectEditScope() : 'THIS_ONLY';
          if (scope == null) {
            return;
          }
          const isRepeatChanged = !isEqual(values.repeat, defaultValues.repeat);
          await updateMutation.mutateAsync(
            {
              todoId: todo.id,
              input: {
                title: values.title,
                startDate: formatDateKey(values.startDate, getDeviceTimezone()),
                endDate: values.endDate ? formatDateKey(values.endDate, getDeviceTimezone()) : null,
                scheduledTime: values.isAllDay ? null : (values.scheduledTime ?? null),
                isAllDay: values.isAllDay,
                visibility: values.visibility,
              },
              ...((isSeries || isRepeatChanged) && {
                options: { scope, ...(isRepeatChanged && { repeat: values.repeat }) },
              }),
            },
            { onSuccess: onClose },
          );
        })
        .with({ mode: 'convert-memo' }, async (convertProps) => {
          await convertMemoMutation.mutateAsync(
            {
              memoId: convertProps.memoId,
              input: toMemoConversionInput(values),
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
          const handleMutationSuccess = () => {
            onClose();
            createProps.onSuccess?.();
          };

          if (values.repeat != null) {
            await createRecurringMutation.mutateAsync(
              {
                input: {
                  title: values.title,
                  startDate: formatDateKey(values.startDate, getDeviceTimezone()),
                  scheduledTime: values.isAllDay ? undefined : values.scheduledTime,
                  isAllDay: values.isAllDay,
                  visibility: values.visibility,
                  categoryId: values.categoryId,
                  repeat: values.repeat,
                },
                source: values.source,
              },
              { onSuccess: handleMutationSuccess },
            );
          } else {
            await createMutation.mutateAsync(
              {
                input: {
                  title: values.title,
                  startDate: formatDateKey(values.startDate, getDeviceTimezone()),
                  endDate: values.endDate
                    ? formatDateKey(values.endDate, getDeviceTimezone())
                    : undefined,
                  scheduledTime: values.isAllDay ? undefined : values.scheduledTime,
                  isAllDay: values.isAllDay,
                  visibility: values.visibility,
                  categoryId: values.categoryId,
                },
                source: values.source,
              },
              { onSuccess: handleMutationSuccess },
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

  const handleDateChipPress = () => {
    Keyboard.dismiss();
    let pickerResult: Date | null = null;
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult) {
            const { startDate, repeat } = methods.getValues();
            if (repeat != null) {
              methods.setValue(
                'repeat',
                TodoRepeatPolicy.withStartDate(
                  repeat,
                  toDeviceDateKey(startDate),
                  toDeviceDateKey(pickerResult),
                ),
              );
            }
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

  const handleTimeChipPress = () => {
    Keyboard.dismiss();
    let pickerResult: TodoTimeValue | null = null;
    overlay.open<TodoTimeValue | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult) {
            methods.setValue('scheduledTime', pickerResult.scheduledTime);
            methods.setValue('isAllDay', pickerResult.isAllDay);
          }
          focusTodoInput();
        }}
      >
        <QueryErrorBoundary>
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
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  const handleRepeatChipPress = () => {
    Keyboard.dismiss();
    let pickerResult: { value: TodoRepeat | null } | null = null;
    overlay.open<{ value: TodoRepeat | null } | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult) {
            methods.setValue('repeat', pickerResult.value);
            if (pickerResult.value != null) {
              methods.setValue('endDate', null);
            }
          }
          focusTodoInput();
        }}
      >
        <TodoRepeatPickerContent
          startDate={methods.getValues('startDate')}
          value={methods.getValues('repeat') ?? null}
          onChange={(value) => {
            pickerResult = { value };
            close(pickerResult);
          }}
          onCancel={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };

  const handleCategoryChipPress = () => {
    Keyboard.dismiss();
    let pickerResult: number | null = null;
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={() => {
          exit();
          if (pickerResult != null) {
            methods.setValue('categoryId', pickerResult);
          }
          focusTodoInput();
        }}
      >
        <QueryErrorBoundary>
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
        </QueryErrorBoundary>
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
        <VStack gap={12} testID="todo-add-sheet">
          <FormField control={methods.control} name="title">
            {({ onChange, value }) => (
              <BottomSheetInput
                ref={todoInputRef}
                autoFocus
                placeholder={t('add.placeholder')}
                value={value}
                onChange={onChange}
                maxLength={addTodoFormSchema.shape.title.maxLength ?? undefined}
                size="medium"
                renderErrorMessage={false}
                returnKeyType="done"
                onSubmitEditing={() => (isSubmitDisabled ? onClose() : handleSubmitTodo())}
              />
            )}
          </FormField>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerClassName="gap-2"
          >
            <DateChip onPress={handleDateChipPress} />
            <TimeChip onPress={handleTimeChipPress} />
            <RepeatChip onPress={handleRepeatChipPress} />
            <VisibilityChip />
            {/* 루트 overlay에 그려지므로 칩 조회 실패가 앱 경계까지 올라가지 않게 칩만 숨긴다 */}
            <QueryErrorBoundary fallback={() => null}>
              <Suspense fallback={null}>
                <CategoryChip onPress={handleCategoryChipPress} />
              </Suspense>
            </QueryErrorBoundary>
          </ScrollView>

          <Box className="h-px bg-gray-2" />

          <HStack gap={8} align="center" justify="end">
            <AiFeatureTooltip />
            <QuotaChip feature="AI_PARSE" />
            <AiParseButton onExit={onExit} />
            <PressableFeedback
              isDisabled={isSubmitDisabled}
              onPress={() => handleSubmitTodo()}
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
  const { t } = useTranslation('common');
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const startDateKey = formatDateKey(startDate, getDeviceTimezone());
  const label =
    startDateKey === todayDateKey
      ? t('dateSections.today')
      : formatDateKeyLabel(startDateKey, 'monthDay', dateFormatContext);

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
  const repeat = useWatch<AddTodoFormValues, 'repeat'>({ name: 'repeat' });
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const isActive = repeat != null;
  const label = repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, dateFormatContext);

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
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = useMemo(
    () => categoriesResult.categories.find((c) => c.id === categoryId),
    [categoriesResult.categories, categoryId],
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
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <Popover isOpen={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback
          onPress={() => setIsTooltipOpen(true)}
          className="items-center justify-center"
          testID="todo-ai-feature-tooltip"
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
  onExit: () => void;
}

const AiParseButton = ({ onExit }: AiParseButtonProps) => {
  const fontScaledSize = useFontScaledSize();
  const methods = useFormContext<AddTodoFormValues>();
  const toast = useAppToast();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });

  const parseMutation = useMutation(useParseTodoMutationOptions());
  const aiConsent = useAiDataSharingConsentGate();
  // 이번 녹음에서 동의 안내를 이미 띄웠는지. 한 번의 시도에서 안내를 두 번 띄우지 않는다
  const hasAskedConsentRef = useRef(false);

  const parseTitle = (text: string, categoryId?: number) => {
    parseMutation.mutate(
      { text, categoryId },
      {
        // 서버에 동의가 없으면(다른 기기에서 철회 등) 한 번만 다시 묻고, 동의하면 받아 적은 문장 그대로 정리한다
        onError: async (error) => {
          if (!isAiDataSharingConsentRequiredError(error)) {
            return;
          }
          if (hasAskedConsentRef.current) {
            toast.error(error.message);
            return;
          }
          hasAskedConsentRef.current = true;
          if (await aiConsent.requestAgreement()) {
            parseTitle(text, categoryId);
          }
        },
        onSuccess: (result) => {
          const { data: parsedTodo } = result;
          const parsedTodoRepeat = toParsedTodoRepeat(parsedTodo);
          methods.reset(
            (prev) => ({
              ...prev,
              title: parsedTodo.title,
              startDate: parsedTodo.startDate,
              endDate: parsedTodoRepeat == null ? parsedTodo.endDate : null,
              scheduledTime: parsedTodo.scheduledTime,
              isAllDay: parsedTodo.scheduledTime ? false : parsedTodo.isAllDay,
              repeat: parsedTodoRepeat,
              source: 'ai',
            }),
            { keepDirtyValues: true },
          );
        },
      },
    );
  };

  const handleRecognitionEnd = () => {
    const currentTitle = methods.getValues('title');
    if (!currentTitle?.trim()) {
      return;
    }
    parseTitle(currentTitle.trim(), methods.getValues('categoryId'));
  };

  const { isListening, start, stop } = useDictation({
    onResult: (text) => {
      methods.setValue('title', text);
    },
    onEnd: handleRecognitionEnd,
  });

  const handlePress = async () => {
    if (isListening) {
      stop();
      return;
    }

    if (!gate.guard({ onSubscribe: onExit })) {
      return;
    }

    // 동의 시트가 키보드에 가리지 않게 먼저 내린다. 동의하지 않으면 직접 입력을 이어간다
    Keyboard.dismiss();
    const consent = await aiConsent.ensureAgreed();
    hasAskedConsentRef.current = consent.wasAsked;
    if (!consent.isAgreed) {
      return;
    }
    start();
  };

  return (
    <PressableFeedback
      onPress={handlePress}
      isDisabled={parseMutation.isPending}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className="items-center justify-center rounded-full bg-main/10"
    >
      {isListening ? (
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
