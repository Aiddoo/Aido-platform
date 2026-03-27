import type { DayOfWeek } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import {
  ACTION_CHIP_ICON_SIZE,
  ActionChip,
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
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback, Spinner } from 'heroui-native';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ActivityIndicator, Keyboard, ScrollView, type TextInput } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';
import { AiUsagePolicy } from '../../models/todo.model';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useGetAiUsageQueryOptions } from '../queries/use-get-ai-usage-query-options';
import { useGetTodoCategoriesQueryOptions } from '../queries/use-get-todo-categories-query-options';
import { useParseTodoMutationOptions } from '../queries/use-parse-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { type AddTodoFormInput, addTodoFormSchema } from '../schemas/add-todo-form.schema';
import { formatTodoDateLabel } from '../utils/format-todo-date-label';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import { CategorySelectContent } from './CategorySelectBottomSheet';
import { TodoDatePickerContent } from './TodoDatePickerContent';
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

  const todoInputRef = useRef<TextInput>(null);
  const isClosingRef = useRef(false);
  const pendingFocusRef = useRef<number | null>(null);

  const overlay = useOverlay();

  useEffect(() => {
    if (isOpen) isClosingRef.current = false;
    return () => {
      if (pendingFocusRef.current != null) cancelAnimationFrame(pendingFocusRef.current);
    };
  }, [isOpen]);

  const focusTodoInput = () => {
    if (!isOpen || isClosingRef.current) return;
    pendingFocusRef.current = requestAnimationFrame(() => {
      todoInputRef.current?.focus();
    });
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

  const title = methods.watch('title');
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
          if (pickerResult) methods.setValue('startDate', pickerResult);
          focusTodoInput();
        }}
      >
        <TodoDatePickerContent
          startDate={methods.getValues('startDate')}
          onConfirm={(date) => {
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
    let pickerResult: { time: string | undefined; isAllDay: boolean } | null = null;
    overlay.open<{ time: string | undefined; isAllDay: boolean } | null>(
      ({ isOpen, close, exit }) => (
        <ModalBottomSheet
          isOpen={isOpen}
          onClose={() => close(null)}
          onExit={() => {
            exit();
            if (pickerResult) {
              methods.setValue('scheduledTime', pickerResult.time);
              methods.setValue('isAllDay', pickerResult.isAllDay);
            }
            focusTodoInput();
          }}
        >
          <Suspense fallback={<ActivityIndicator />}>
            <TodoTimePickerContent
              draftDate={methods.getValues('startDate')}
              scheduledTime={methods.getValues('scheduledTime') ?? undefined}
              isAllDay={methods.getValues('isAllDay') ?? true}
              onConfirm={(time, isAllDay) => {
                pickerResult = { time, isAllDay };
                close(pickerResult);
              }}
              onCancel={() => close(null)}
            />
          </Suspense>
        </ModalBottomSheet>
      ),
    );
  };

  const openRepeatPicker = () => {
    Keyboard.dismiss();
    let pickerResult: { daysOfWeek: DayOfWeek[]; repeatEndDate: Date | null } | null = null;
    overlay.open<{ daysOfWeek: DayOfWeek[]; repeatEndDate: Date | null } | null>(
      ({ isOpen, close, exit }) => (
        <ModalBottomSheet
          isOpen={isOpen}
          onClose={() => close(null)}
          onExit={() => {
            exit();
            if (pickerResult) {
              methods.setValue('isRecurring', true);
              methods.setValue('daysOfWeek', pickerResult.daysOfWeek);
              methods.setValue('repeatEndDate', pickerResult.repeatEndDate);
            }
            focusTodoInput();
          }}
        >
          <TodoRepeatPickerContent
            startDate={methods.getValues('startDate')}
            repeat={{
              daysOfWeek: methods.getValues('daysOfWeek') ?? [],
              repeatEndDate: methods.getValues('repeatEndDate') ?? null,
            }}
            onConfirm={(repeat) => {
              pickerResult = repeat;
              close(repeat);
            }}
            onCancel={() => close(null)}
          />
        </ModalBottomSheet>
      ),
    );
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
          if (pickerResult != null) methods.setValue('categoryId', pickerResult);
          focusTodoInput();
        }}
      >
        <Suspense fallback={<ActivityIndicator />}>
          <CategorySelectModalContent
            selectedCategoryId={methods.getValues('categoryId')}
            onSelect={(id) => {
              pickerResult = id;
              close(id);
            }}
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
          <Controller
            control={methods.control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <BottomSheetInput
                ref={todoInputRef}
                autoFocus
                placeholder="무엇을 하고 싶으신가요?"
                value={value}
                onChangeText={onChange}
                maxLength={200}
                size="medium"
                renderErrorMessage={false}
                returnKeyType="done"
                onSubmitEditing={isSubmitDisabled ? onClose : onSubmit}
              />
            )}
          />

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
              onPress={onSubmit}
              style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
              className={cn(
                'items-center justify-center rounded-4xl',
                isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
              )}
            >
              {isSubmitting ? (
                <Spinner size="sm" color="white" />
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
};

// --- constants ---

const DEFAULT_CATEGORY_COLOR = '#999';

// --- helpers ---

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_SHORT: Record<DayOfWeek, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
};

const formatRepeatLabel = (days: DayOfWeek[]): string => {
  if (days.length === 7) return '매일';
  const sorted = ALL_DAYS.filter((d) => days.includes(d));
  return `매주 ${sorted.map((d) => DAY_SHORT[d]).join(', ')}`;
};

// --- chip components ---

const DateChip = ({ onPress }: { onPress: () => void }) => {
  const startDate = useWatch<AddTodoFormValues, 'startDate'>({ name: 'startDate' });
  const label = formatTodoDateLabel({ startDate, scheduledTime: null, isAllDay: true });

  return (
    <ActionChip
      icon={
        <CalendarIcon
          width={ACTION_CHIP_ICON_SIZE}
          height={ACTION_CHIP_ICON_SIZE}
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
  const [scheduledTime, isAllDay] = useWatch<AddTodoFormValues, ['scheduledTime', 'isAllDay']>({
    name: ['scheduledTime', 'isAllDay'],
  });
  const hasTime = !isAllDay && !!scheduledTime;
  const label = isAllDay ? '종일' : (scheduledTime ?? '종일');

  return (
    <ActionChip
      icon={
        <ClockIcon
          width={ACTION_CHIP_ICON_SIZE}
          height={ACTION_CHIP_ICON_SIZE}
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
  const [isRecurring, daysOfWeek] = useWatch<AddTodoFormValues, ['isRecurring', 'daysOfWeek']>({
    name: ['isRecurring', 'daysOfWeek'],
  });
  const isActive = isRecurring && (daysOfWeek?.length ?? 0) > 0;
  const label = isActive ? formatRepeatLabel(daysOfWeek ?? []) : '반복';

  return (
    <ActionChip
      icon={
        <RepeatIcon
          width={ACTION_CHIP_ICON_SIZE}
          height={ACTION_CHIP_ICON_SIZE}
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
  const { control } = useFormContext<AddTodoFormValues>();
  return (
    <Controller
      control={control}
      name="visibility"
      render={({ field: { value, onChange } }) => {
        const isPrivate = (value ?? 'PUBLIC') === 'PRIVATE';
        return (
          <ActionChip
            icon={
              isPrivate ? (
                <EyeOffIcon
                  width={ACTION_CHIP_ICON_SIZE}
                  height={ACTION_CHIP_ICON_SIZE}
                  colorClassName="text-gray-6"
                />
              ) : (
                <EyeIcon
                  width={ACTION_CHIP_ICON_SIZE}
                  height={ACTION_CHIP_ICON_SIZE}
                  colorClassName="text-gray-5"
                />
              )
            }
            label={isPrivate ? '비공개' : '공개'}
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
          />
        );
      }}
    />
  );
};

const CategoryChip = ({ onPress }: { onPress: () => void }) => {
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
          className="size-2 rounded-full"
          style={{ backgroundColor: category?.color ?? DEFAULT_CATEGORY_COLOR }}
        />
      }
      label={category?.name ?? '카테고리'}
      onPress={onPress}
    />
  );
};

function CategorySelectModalContent({
  selectedCategoryId,
  onSelect,
}: {
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
}) {
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <CategorySelectContent
      categories={data.categories}
      selectedCategoryId={selectedCategoryId}
      onSelect={onSelect}
      submitLabel="선택하기"
      isLoading={false}
    />
  );
}

const AiFeatureTooltip = () => {
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
              AI 기능
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
                말로 할일을 추가해요
              </Text>
            </HStack>
            <Text size="b3" shade={6}>
              "이번 주 금요일 저녁 7시 약속"처럼{'\n'}말하면 날짜·시간을 채워줘요
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
    if (!currentTitle?.trim()) return;

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
        description: '프리미엄 구독으로 매일 무제한 AI 파싱을 사용할 수 있어요',
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
