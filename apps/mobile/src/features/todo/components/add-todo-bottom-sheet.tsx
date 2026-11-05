import { zodResolver } from '@hookform/resolvers/zod';
import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useConvertMemoToTodosMutationOptions } from '@src/features/memo/queries/use-convert-memo-to-todos-mutation-options';
import { toMemoConversionInput } from '@src/features/memo/utils/to-memo-conversion-input';
import type { Todo } from '@src/features/todo/domains/todo.model';
import { QuickVoiceButton } from '@src/features/voice/components/quick-voice/quick-voice-button';
import { QuickVoiceInfo } from '@src/features/voice/components/quick-voice/quick-voice-info';
import { QuickVoicePanel } from '@src/features/voice/components/quick-voice/quick-voice-panel';
import { SheetEdgeGlow } from '@src/features/voice/components/visualizers/sheet-edge-glow';
import { VoiceCapturePolicy } from '@src/features/voice/domains/voice-capture.model';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
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
  KeyboardBottomSheet,
  ModalBottomSheet,
  SHEET_CONTENT_PADDING,
  QueryErrorBoundary,
  RepeatIcon,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { formatDateKey, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps, ComponentRef } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { match, P } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import {
  type AddTodoFormInput,
  type AddTodoFormValues,
  addTodoFormSchema,
} from '../domains/add-todo-form.schema';
import {
  type TodoRepeat,
  TodoRepeatPolicy,
  type TodoUpdateScope,
} from '../domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '../domains/todo-series.error';
import { TodoPolicy } from '../domains/todo.model';
import { useAddTodoQuickVoice } from '../hooks/use-add-todo-quick-voice';
import { useSelectTodoEditScopeInOverlay } from '../hooks/use-select-todo-scope';
import { useGetTodoCategoriesQueryOptions } from '../queries/get-todo-categories-query-options';
import { useCreateRecurringTodoMutationOptions } from '../queries/use-create-recurring-todo-mutation-options';
import { useCreateTodoMutationOptions } from '../queries/use-create-todo-mutation-options';
import { useUpdateTodoMutationOptions } from '../queries/use-update-todo-mutation-options';
import { formatRepeatSummary } from '../utils/format-repeat-summary';
import { toTodoEditFormValues } from '../utils/to-todo-edit-form-values';
import {
  hasOnlyDateChanges,
  hasTodoUpdateChanges,
  toTodoUpdateChanges,
} from '../utils/to-todo-update-changes';
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
  /** 기능 소개에서 "지금 말해볼게요"로 왔다. 키보드를 올리지 않고 마이크 안내를 이미 봤어도 다시 띄운다 */
  isVoiceHintForced?: boolean;
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

function toDefaultFormValues(props: AddTodoBottomSheetProps): AddTodoFormInput {
  return match(props)
    .returnType<AddTodoFormInput>()
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
  const { t: tVoice } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const { isOpen, onOpenChange, onClose, onExit = onClose } = props;

  // 서버 재조회로 할 일이 바뀌어도 고치기 시작한 값과 비교한다. 사용자가 안 고친 칸을 덮어쓰지 않는다
  const [initialValues] = useState(() => toDefaultFormValues(props));
  const canChangeRepeat =
    props.mode !== 'edit' ||
    TodoRepeatPolicy.canChangeRepeat({ ...props.todo, repeat: initialValues.repeat });

  const methods = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues: initialValues,
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

  const selectEditScope = useSelectTodoEditScopeInOverlay({ onBack: focusTodoInput });

  const createMutation = useMutation(useCreateTodoMutationOptions());
  const updateMutation = useMutation(useUpdateTodoMutationOptions());
  const createRecurringMutation = useMutation(useCreateRecurringTodoMutationOptions());
  const convertMemoMutation = useMutation(useConvertMemoToTodosMutationOptions());

  const { isSubmitting } = useFormState({ control: methods.control });
  const voice = useAddTodoQuickVoice({ methods, onExit });
  const isVoiceHintRequested = props.mode === 'create' && props.isVoiceHintForced === true;
  const [isVoiceHintForced, setIsVoiceHintForced] = useState(isVoiceHintRequested);

  const handleSubmitTodo = methods.handleSubmit(async (values) => {
    try {
      await match(props)
        .with({ mode: 'edit' }, async ({ todo }) => {
          const changes = toTodoUpdateChanges(values, initialValues);
          if (!hasTodoUpdateChanges(changes)) {
            onClose();
            return;
          }
          const scope = await match(
            TodoRepeatPolicy.getTodoEditScopeDecision({
              isSeries: TodoRepeatPolicy.hasRepeatRule({ ...todo, repeat: initialValues.repeat }),
              repeat: changes.repeat,
              isDateOnly: hasOnlyDateChanges(changes),
            }),
          )
            .returnType<Promise<TodoUpdateScope | null | undefined>>()
            .with('not-repeating', async () => undefined)
            .with('this-only', async () => 'THIS_ONLY')
            .with('ask', () => selectEditScope(todo.startDate))
            .with('ask-following-only', () =>
              selectEditScope(todo.startDate, { isFollowingOnly: true }),
            )
            .exhaustive();
          // nullish-strict: 생략은 범위가 없는 수정, null은 범위 선택에서 뒤로 간 취소다
          if (scope === null) {
            return;
          }
          await updateMutation.mutateAsync(
            {
              todoId: todo.id,
              input: changes.input,
              options: {
                ...(scope != null && { scope }),
                // nullish-strict: repeat null은 반복 끝내기라 보낸다
                ...(changes.repeat !== undefined && { repeat: changes.repeat }),
              },
            },
            { onSuccess: onClose },
          );
        })
        .with({ mode: 'convert-memo' }, async (convertProps) => {
          await convertMemoMutation.mutateAsync(
            {
              memoId: convertProps.memoId,
              input: toMemoConversionInput(values),
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
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      reportUnexpectedError(error);
      if (shouldReopenRepeatPicker(error)) {
        handleRepeatChipPress();
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
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onCloseStart={focusTodoInput}
        onExit={() => {
          exit();
          if (pickerResult) {
            const { startDate, repeat } = methods.getValues();
            // 반복 회차의 날짜 이동은 이 회차에만 적용되므로 규칙은 그대로 둔다
            const isSeriesOccurrence =
              props.mode === 'edit' && TodoPolicy.isRecurringTodo(props.todo);
            if (repeat != null && !isSeriesOccurrence) {
              methods.setValue(
                'repeat',
                TodoRepeatPolicy.withRepeatStartDate(
                  repeat,
                  toDeviceDateKey(startDate),
                  toDeviceDateKey(pickerResult),
                ),
              );
            }
            methods.setValue('startDate', pickerResult);
          }
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
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onCloseStart={focusTodoInput}
        onExit={() => {
          exit();
          if (pickerResult) {
            methods.setValue('scheduledTime', pickerResult.scheduledTime);
            methods.setValue('isAllDay', pickerResult.isAllDay);
          }
        }}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePickerContent.Loading />}>
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
    let pickerResult: { startDate: Date; repeat: TodoRepeat | null } | null = null;
    overlay.open<{ startDate: Date; repeat: TodoRepeat | null } | null>(
      ({ isOpen, close, exit }) => (
        <ModalBottomSheet
          hasFixedHeader
          isOpen={isOpen}
          onOpenChange={() => close(null)}
          onCloseStart={focusTodoInput}
          onExit={() => {
            exit();
            if (pickerResult) {
              methods.setValue('startDate', pickerResult.startDate);
              methods.setValue('repeat', pickerResult.repeat);
              if (pickerResult.repeat != null) {
                methods.setValue('endDate', null);
              }
            }
          }}
        >
          <TodoRepeatPickerContent
            value={{
              startDate: methods.getValues('startDate'),
              repeat: methods.getValues('repeat') ?? null,
            }}
            onChange={(value) => {
              pickerResult = value;
              close(value);
            }}
            onCancel={() => close(null)}
          />
        </ModalBottomSheet>
      ),
    );
  };

  const handleCategoryChipPress = () => {
    Keyboard.dismiss();
    let pickerResult: number | null = null;
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onCloseStart={focusTodoInput}
        onExit={() => {
          exit();
          if (pickerResult != null) {
            methods.setValue('categoryId', pickerResult);
          }
        }}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<CategorySelectInput.Loading />}>
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
        backgroundDecoration={
          voice.state.status === 'listening' && <SheetEdgeGlow level={voice.level} />
        }
        isContentPanEnabled={
          !VoiceCapturePolicy.isActive(voice.state) && voice.state.status !== 'planning'
        }
      >
        {match(voice.state)
          .with({ status: P.union('preparing', 'listening', 'paused', 'finalizing') }, () => (
            <QuickVoicePanel
              state={voice.state}
              level={voice.level}
              isQuiet={voice.isQuiet}
              locale={voice.locale}
              onLocaleChange={voice.setLocale}
              onFinish={voice.finish}
              onCancel={voice.cancel}
              onResume={voice.resume}
              onContinueAsVoiceNote={voice.continueAsVoiceNote}
            />
          ))
          .with({ status: 'planning' }, () => (
            <QuickVoicePanel.Planning state={voice.state} onCancel={voice.cancelPlanning} />
          ))
          .with({ status: 'review' }, ({ plan, isCharged }) => (
            <AddTodoVoiceReview
              plan={plan}
              isCharged={isCharged}
              onApplied={() => {
                onClose();
                if (props.mode === 'create') {
                  props.onSuccess?.();
                }
              }}
              onRestart={voice.restart}
              onTypeInstead={voice.typeInstead}
            />
          ))
          .otherwise(() => (
            <VStack gap={12} testID="todo-add-sheet">
              <QuickVoicePanel.Failed
                state={voice.state}
                isConsentRequired={voice.isConsentRequired}
                onResume={voice.resume}
                onRetryPlanning={voice.retryPlanning}
              />
              <FormField control={methods.control} name="title">
                {({ onChange, value }) => (
                  <BottomSheetInput
                    ref={todoInputRef}
                    autoFocus={!isVoiceHintRequested && !voice.isRestarting}
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

              {/* RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다 */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
              >
                <DateChip onPress={handleDateChipPress} />
                <TimeChip onPress={handleTimeChipPress} />
                {canChangeRepeat && <RepeatChip onPress={handleRepeatChipPress} />}
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
                {props.mode === 'create' && (
                  <>
                    <QuickVoiceInfo />
                    <CoachmarkPopover
                      kind="voice-quick-start"
                      title={tVoice('coach.quickStart.title')}
                      description={tVoice('coach.quickStart.description')}
                      placement="left"
                      align="center"
                      isForced={isVoiceHintForced}
                      onDismiss={() => setIsVoiceHintForced(false)}
                    >
                      <QuickVoiceButton
                        onPress={() => {
                          setIsVoiceHintForced(false);
                          return voice.start();
                        }}
                        testID="todo-quick-voice-button"
                      />
                    </CoachmarkPopover>
                  </>
                )}
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
          ))}
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

type AddTodoVoiceReviewProps = Omit<
  ComponentProps<typeof QuickVoicePanel.Review>,
  'fallbackCategoryId'
>;

/** 고르는 단계. 카드가 쓰는 조회가 실패해도 시트(루트 overlay)가 앱 경계까지 터지지 않게 이 안에서 처리한다 */
function AddTodoVoiceReview(props: AddTodoVoiceReviewProps) {
  const { control } = useFormContext<AddTodoFormValues>();
  const categoryId = useWatch({ control, name: 'categoryId' });

  return (
    <QueryErrorBoundary>
      <Suspense fallback={<QuickVoicePanel.CardsLoading />}>
        <QuickVoicePanel.Review {...props} fallbackCategoryId={categoryId} />
      </Suspense>
    </QueryErrorBoundary>
  );
}
