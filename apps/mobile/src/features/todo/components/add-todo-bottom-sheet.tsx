import { TODO_LIMITS, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/feature-discovery/hooks/use-my-pending-coachmark';
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
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  ActionChip,
  useConfirmDialog,
  ArrowUpIcon,
  BottomSheetInput,
  BottomSheetTextArea,
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
import { toNullableDate } from '@src/shared/utils/date';
import {
  formatDateKey,
  formatDateKeyCompactRange,
  formatDateKeyLabel,
} from '@src/shared/utils/date-format';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Suspense, useState } from 'react';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { match, P } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { type AddTodoFormValues, addTodoFormSchema } from '../domains/add-todo-form.schema';
import {
  type TodoRepeat,
  TodoRepeatPolicy,
  type TodoUpdateScope,
} from '../domains/todo-repeat.model';
import { shouldReopenRepeatPicker } from '../domains/todo-series.error';
import { TodoPolicy } from '../domains/todo.model';
import { useAddTodoQuickVoice } from '../hooks/use-add-todo-quick-voice';
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
import { TodoScopeSelectContent } from './todo-scope-select-content';
import { TodoTimePickerContent } from './todo-time-picker-content';

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

function toDefaultFormValues(props: AddTodoBottomSheetProps): AddTodoFormValues {
  return match(props)
    .returnType<AddTodoFormValues>()
    .with({ mode: 'edit' }, ({ todo, repeat }) => toTodoEditFormValues(todo, repeat))
    .with({ mode: 'create' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: initialValues?.endDate ?? null,
      scheduledTime: initialValues?.scheduledTime ?? null,
      isAllDay: initialValues?.isAllDay ?? true,
      categoryId,
      visibility: 'PUBLIC',
      repeat: null,
    }))
    .with({ mode: 'convert-memo' }, ({ selectedDate, categoryId, initialValues }) => ({
      title: initialValues?.title ?? '',
      startDate: selectedDate,
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC',
      repeat: null,
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

  const overlay = useOverlay();
  const confirmDialog = useConfirmDialog();
  const focusTitle = () => requestAnimationFrame(() => methods.setFocus('title'));

  // 입력 시트 안에서 내용을 갈아 끼우면 키보드가 내려가는 동안 높이가 튀어 떠 있는 시트로 묻는다
  const selectEditScope = async (
    date: string,
    { isFollowingOnly = false }: { isFollowingOnly?: boolean } = {},
  ) => {
    Keyboard.dismiss();
    const scope = await overlay.openAsync<TodoUpdateScope | null>(
      ({ isOpen: isScopeOpen, close, unmount }) => (
        <ModalBottomSheet isOpen={isScopeOpen} onOpenChange={() => close(null)} onExit={unmount}>
          <TodoScopeSelectContent
            action="edit"
            date={date}
            scopes={isFollowingOnly ? ['THIS_AND_FOLLOWING'] : TODO_UPDATE_SCOPES}
            onChange={(selected) => close(selected === 'ALL' ? null : selected)}
            onBack={() => close(null)}
          />
        </ModalBottomSheet>
      ),
    );
    if (scope == null) {
      focusTitle();
    }
    return scope;
  };

  const createMutation = useMutation(useCreateTodoMutationOptions());
  const updateMutation = useMutation(useUpdateTodoMutationOptions());
  const createRecurringMutation = useMutation(useCreateRecurringTodoMutationOptions());
  const convertMemoMutation = useMutation(useConvertMemoToTodosMutationOptions());

  const { isSubmitting } = useFormState({ control: methods.control });
  const voice = useAddTodoQuickVoice({ methods, onExit });
  useOnScreenBlur(voice.interrupt);
  const isVoiceHintRequested = props.mode === 'create' && props.isVoiceHintForced === true;
  const [isVoiceHintForced, setIsVoiceHintForced] = useState(isVoiceHintRequested);
  const [isVoiceHintPending] = useMyPendingCoachmark('voice-quick-start');
  const hasVoiceHint = props.mode === 'create' && isVoiceHintPending;
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [hasTouchedForm, setHasTouchedForm] = useState(false);

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
                source: 'manual',
              },
              { onSuccess: handleMutationSuccess },
            );
          } else {
            await createMutation.mutateAsync(
              {
                input: {
                  title: values.title,
                  startDate: formatDateKey(values.startDate, getDeviceTimezone()),
                  endDate:
                    values.endDate == null
                      ? undefined
                      : formatDateKey(values.endDate, getDeviceTimezone()),
                  scheduledTime: values.isAllDay ? undefined : values.scheduledTime,
                  isAllDay: values.isAllDay,
                  visibility: values.visibility,
                  categoryId: values.categoryId,
                },
                source: 'manual',
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
        openRepeatPicker();
      }
    }
  });

  const openRepeatPicker = () => {
    Keyboard.dismiss();
    overlay.open(({ isOpen: isPickerOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isPickerOpen}
        onOpenChange={() => close()}
        onCloseStart={focusTitle}
        onExit={unmount}
      >
        <TodoRepeatPickerContent
          value={{
            startDate: methods.getValues('startDate'),
            repeat: methods.getValues('repeat'),
          }}
          onChange={({ startDate, repeat }) => {
            methods.setValue('startDate', startDate);
            methods.setValue('repeat', repeat);
            if (repeat != null) {
              methods.setValue('endDate', null);
            }
            close();
          }}
          onCancel={close}
        />
      </ModalBottomSheet>
    ));
  };

  const isFormStep = voice.state.status === 'idle' || voice.state.status === 'failed';
  const title = useWatch({ control: methods.control, name: 'title' });
  const isSubmitDisabled = title.trim().length === 0 || isSubmitting;

  const confirmDiscardPlan = async () => {
    const isCharged = voice.state.status === 'review' && voice.state.isCharged;
    const shouldDiscard = await confirmDialog.open({
      title: tVoice('review.leaveTitle'),
      description: tVoice(isCharged ? 'review.leaveDescriptionCharged' : 'review.leaveDescription'),
      confirmLabel: tVoice('review.leaveConfirm'),
      cancelLabel: tVoice('review.leaveCancel'),
    });
    if (shouldDiscard) {
      onClose();
    }
  };

  const voiceDismissAction = VoiceCapturePolicy.getDismissAction(voice.state);
  const handleVoiceDismissRequest =
    voiceDismissAction == null
      ? undefined
      : () => {
          match(voiceDismissAction)
            .with('cancel-capture', () => voice.cancel())
            .with('cancel-planning', () => voice.cancelPlanning())
            .with('confirm-discard', () => {
              confirmDiscardPlan().catch(reportUnexpectedError);
            })
            .exhaustive();
        };

  return (
    <FormProvider {...methods}>
      <KeyboardBottomSheet
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        backgroundDecoration={
          voice.state.status === 'listening' && <SheetEdgeGlow level={voice.level} />
        }
        isContentPanEnabled={
          !VoiceCapturePolicy.isActive(voice.state) &&
          voice.state.status !== 'planning' &&
          voice.state.status !== 'review'
        }
        onDismissRequest={handleVoiceDismissRequest}
        footer={
          isFormStep ? (
            <VStack gap={12} onTouchStart={() => setHasTouchedForm(true)}>
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
                      isEnabled={!isTitleFocused}
                      isPassThrough
                      isDismissed={hasTouchedForm}
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
          ) : undefined
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
            <VStack gap={12} testID="todo-add-sheet" onTouchStart={() => setHasTouchedForm(true)}>
              <QuickVoicePanel.Failed
                state={voice.state}
                isConsentRequired={voice.isConsentRequired}
                isTypedTextKept={voice.isTypedTextKept}
                onResume={voice.resume}
                onRetryPlanning={voice.retryPlanning}
              />
              <FormField control={methods.control} name="title">
                {({ onChange, value, ref }, { error }) =>
                  voice.state.status === 'failed' ? (
                    // 들은 글이 길면 한 줄로는 앞이 잘려 고칠 수 없다. 넘치면 칸 안에서 스크롤한다.
                    // maxLength를 주면 Android가 200자 뒤를 지워 들은 글을 잃으므로, 넘으면 저장할 때 알린다
                    <BottomSheetTextArea
                      ref={ref}
                      autoFocus={!voice.isRestarting}
                      placeholder={t('add.placeholder')}
                      value={value}
                      onChange={onChange}
                      isInvalid={error != null}
                      errorMessage={
                        error == null
                          ? undefined
                          : resolveValidationMessage(error, { default: 'todoTitle.tooLong' })
                      }
                      growsWithContent
                      textSize="b3"
                      preserveErrorSpace={false}
                      className="min-h-12 max-h-28"
                      returnKeyType="done"
                      submitBehavior="submit"
                      onFocus={() => setIsTitleFocused(true)}
                      onBlur={() => setIsTitleFocused(false)}
                      onSubmitEditing={() => (isSubmitDisabled ? onClose() : handleSubmitTodo())}
                    />
                  ) : (
                    <BottomSheetInput
                      ref={ref}
                      // 처음 안내는 키보드 없이 띄운다. 키보드 뒤로 잘리거나 첫 탭을 빼앗지 않게 하려는 것이다
                      autoFocus={!isVoiceHintRequested && !hasVoiceHint && !voice.isRestarting}
                      onFocus={() => setIsTitleFocused(true)}
                      onBlur={() => setIsTitleFocused(false)}
                      placeholder={t('add.placeholder')}
                      value={value}
                      onChange={onChange}
                      maxLength={TODO_LIMITS.TITLE_MAX_LENGTH}
                      size="medium"
                      renderErrorMessage={false}
                      returnKeyType="done"
                      onSubmitEditing={() => (isSubmitDisabled ? onClose() : handleSubmitTodo())}
                    />
                  )
                }
              </FormField>

              {/* RN ScrollView는 Android에서 시트 드래그에 가로 제스처를 뺏겨 움직이지 않는다 */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={{ marginHorizontal: -SHEET_CONTENT_PADDING }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING }}
              >
                <DateChip
                  isSeriesOccurrence={
                    props.mode === 'edit' && TodoPolicy.isRecurringTodo(props.todo)
                  }
                />
                <TimeChip />
                {canChangeRepeat && <RepeatChip onPress={openRepeatPicker} />}
                <VisibilityChip />
                {/* 루트 overlay에 그려지므로 칩 조회 실패가 앱 경계까지 올라가지 않게 칩만 숨긴다 */}
                <QueryErrorBoundary fallback={() => null}>
                  <Suspense fallback={null}>
                    <CategoryChip />
                  </Suspense>
                </QueryErrorBoundary>
              </ScrollView>
            </VStack>
          ))}
      </KeyboardBottomSheet>
    </FormProvider>
  );
}

function DateChip({ isSeriesOccurrence }: { isSeriesOccurrence: boolean }) {
  const { t } = useTranslation('common');
  const overlay = useOverlay();
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { control, getValues, setFocus, setValue } = useFormContext<AddTodoFormValues>();
  const [startDate, endDate] = useWatch({ control, name: ['startDate', 'endDate'] });
  const startDateKey = formatDateKey(startDate, getDeviceTimezone());
  const endDateKey = endDate == null ? null : formatDateKey(endDate, getDeviceTimezone());
  const singleDayLabel =
    startDateKey === todayDateKey
      ? t('dateSections.today')
      : formatDateKeyLabel(startDateKey, 'monthDay', dateFormatContext);

  const applyStartDate = (nextStartDate: Date) => {
    const repeat = getValues('repeat');
    // 반복 회차의 날짜 이동은 이 회차에만 적용되므로 규칙은 그대로 둔다
    if (repeat != null && !isSeriesOccurrence) {
      setValue(
        'repeat',
        TodoRepeatPolicy.withRepeatStartDate(
          repeat,
          toDeviceDateKey(startDate),
          toDeviceDateKey(nextStartDate),
        ),
      );
    }
    // 여러 날 할 일은 기간을 유지한 채 옮긴다. 날짜 변경 시트와 같은 규칙이고, 끝 날짜보다 뒤를 골라도 시작이 끝을 넘지 않는다
    const nextEndDate = TodoPolicy.getShiftedEndDate(
      {
        startDate: toDeviceDateKey(startDate),
        endDate: endDate == null ? null : toDeviceDateKey(endDate),
      },
      toDeviceDateKey(nextStartDate),
    );
    setValue('startDate', nextStartDate);
    setValue('endDate', toNullableDate(nextEndDate));
  };

  const handlePress = () => {
    Keyboard.dismiss();
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <TodoDatePickerContent
          value={startDate}
          onChange={(nextStartDate) => {
            applyStartDate(nextStartDate);
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
        endDateKey == null || endDateKey === startDateKey
          ? singleDayLabel
          : formatDateKeyCompactRange(startDateKey, endDateKey, dateFormatContext)
      }
      isActive
      onPress={handlePress}
    />
  );
}

function TimeChip() {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { control, setFocus, setValue } = useFormContext<AddTodoFormValues>();
  const [startDate, scheduledTime, isAllDay] = useWatch({
    control,
    name: ['startDate', 'scheduledTime', 'isAllDay'],
  });
  const displayedTime = isAllDay ? null : scheduledTime;

  const handlePress = () => {
    Keyboard.dismiss();
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet
        hasFixedHeader
        isOpen={isOpen}
        onOpenChange={() => close()}
        onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
        onExit={unmount}
      >
        <QueryErrorBoundary>
          <Suspense fallback={<TodoTimePickerContent.Loading />}>
            <TodoTimePickerContent
              date={startDate}
              value={{ scheduledTime, isAllDay }}
              onChange={(nextTime) => {
                setValue('scheduledTime', nextTime.scheduledTime);
                setValue('isAllDay', nextTime.isAllDay);
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
          colorClassName={displayedTime == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={displayedTime ?? t('chip.allDay')}
      isActive={displayedTime != null}
      onPress={handlePress}
    />
  );
}

function RepeatChip({ onPress }: Pick<ComponentProps<typeof ActionChip>, 'onPress'>) {
  const { t } = useTranslation('todo');
  const dateFormatContext = useDateFormatContext();
  const { control } = useFormContext<AddTodoFormValues>();
  const repeat = useWatch({ control, name: 'repeat' });

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
      onPress={onPress}
    />
  );
}

function VisibilityChip() {
  const { t } = useTranslation('todo');
  const { control } = useFormContext<AddTodoFormValues>();

  return (
    <FormField control={control} name="visibility">
      {({ value, onChange }) => {
        const isPrivate = value === 'PRIVATE';

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
            onPress={() => onChange(isPrivate ? 'PUBLIC' : 'PRIVATE')}
          />
        );
      }}
    </FormField>
  );
}

function CategoryChip() {
  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const { control, setFocus } = useFormContext<AddTodoFormValues>();
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <FormField control={control} name="categoryId">
      {({ value: categoryId, onChange }) => {
        const category = categories.find(({ id }) => id === categoryId);

        return (
          <ActionChip
            icon={
              <Box
                className={cn('size-2 rounded-full', category == null && 'bg-gray-5')}
                style={category == null ? undefined : { backgroundColor: category.color }}
              />
            }
            label={category?.name ?? t('chip.category')}
            onPress={() => {
              Keyboard.dismiss();
              overlay.open(({ isOpen, close, unmount }) => (
                <ModalBottomSheet
                  isOpen={isOpen}
                  onOpenChange={() => close()}
                  onCloseStart={() => requestAnimationFrame(() => setFocus('title'))}
                  onExit={unmount}
                >
                  <QueryErrorBoundary>
                    <Suspense fallback={<CategorySelectInput.Loading />}>
                      <CategorySelectInput
                        value={categoryId}
                        onChange={(nextCategoryId) => {
                          onChange(nextCategoryId);
                          close();
                        }}
                        submitLabel={t('add.submit')}
                      />
                    </Suspense>
                  </QueryErrorBoundary>
                </ModalBottomSheet>
              ));
            }}
          />
        );
      }}
    </FormField>
  );
}

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
