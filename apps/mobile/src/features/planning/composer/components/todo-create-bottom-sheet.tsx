import { TODO_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-params';
import { useCreateRecurringTodoMutationOptions } from '@src/features/planning/todo/queries/todo-series.mutations';
import { useCreateTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import {
  type TodoFormValues,
  todoFormSchema,
} from '@src/features/planning/todo/schemas/todo-form.schema';
import { todoCreateParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { QuickVoiceButton } from '@src/features/voice/components/quick-voice-button';
import { QuickVoiceQuota } from '@src/features/voice/components/quick-voice-quota';
import {
  QuickVoiceFailed,
  QuickVoiceListening,
  QuickVoicePlanning,
  QuickVoiceReview,
} from '@src/features/voice/components/quick-voice-steps';
import { SheetEdgeGlow } from '@src/features/voice/components/sheet-edge-glow';
import { VoiceCapturePolicy } from '@src/features/voice/domains/voice-capture.model';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheet,
  Input,
  TextArea,
  HStack,
  KeyboardBottomSheet,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useConfirmDialog,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Controller,
  type FieldError,
  FormState,
  type RefCallBack,
  useForm,
  Watch,
} from 'react-hook-form';
import { match, P } from 'ts-pattern';

import { useAddTodoQuickVoice } from '../hooks/use-add-todo-quick-voice';
import { useFocusTodoTitle } from '../hooks/use-focus-todo-title';
import { useReopenTodoRepeatPicker } from '../hooks/use-reopen-todo-repeat-picker';
import {
  setTodoComposerChipFields,
  TODO_COMPOSER_CHIP_FIELDS,
  TodoComposerChips,
} from './todo-composer-chips';
import { TodoComposerSubmitButton } from './todo-composer-submit-button';

interface TodoCreateBottomSheetProps {
  onMemoChanged: () => void;
}

/** 기본 카테고리가 폼 기본값을 정하므로, 카테고리를 읽는 동안에는 시트를 띄우지 않아 폼이 열린 뒤 바뀌지 않게 한다. */
export function TodoCreateBottomSheet({ onMemoChanged }: TodoCreateBottomSheetProps) {
  return (
    <QueryErrorBoundary fallback={TodoCreateBottomSheet.Error}>
      <Suspense fallback={null}>
        <TodoCreateBottomSheet.Form onMemoChanged={onMemoChanged} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

TodoCreateBottomSheet.Form = function Form({ onMemoChanged }: TodoCreateBottomSheetProps) {
  const sheet = useSheetRoute('/feed');
  const [date] = useTodoSheetDateKey();
  const [{ categoryId: requestedCategoryId, title, time, startVoice }] =
    useRouteParams(todoCreateParamsSchema);
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const categoryId = TodoCategoryPolicy.findInitialCategoryId(
    categoriesResult.categories,
    requestedCategoryId ?? null,
  );

  useEffect(() => {
    if (categoryId == null) {
      sheet.exit();
    }
  }, [categoryId, sheet]);

  if (categoryId == null) {
    return null;
  }

  return (
    <TodoCreateForm
      defaultValues={{
        title: title ?? '',
        startDate: date,
        endDate: null,
        scheduledTime: time ?? null,
        isAllDay: time == null,
        categoryId,
        visibility: 'PUBLIC',
        repeat: null,
      }}
      isVoiceStartRequested={startVoice != null}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
      onExit={() => sheet.exit()}
      onMemoChanged={onMemoChanged}
    />
  );
};

TodoCreateBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <Result
        title={t('errorBoundary.title')}
        button={
          <QueryErrorActions
            onRetry={reset}
            onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })}
          />
        }
      />
    </BottomSheet>
  );
};

interface TodoCreateFormProps {
  defaultValues: TodoFormValues;
  /** 새 기능 소개처럼 말하기를 권한 화면에서 왔다. 열리면 바로 동의·마이크를 거쳐 듣기 시작한다 */
  isVoiceStartRequested: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  /** 닫기 애니메이션 없이 바로 다른 화면으로 떠날 때(구독 화면 이동) */
  onExit: () => void;
  onMemoChanged: () => void;
}

function TodoCreateForm({
  defaultValues,
  isVoiceStartRequested,
  isOpen,
  onOpenChange,
  onClose,
  onExit,
  onMemoChanged,
}: TodoCreateFormProps) {
  const { t } = useTranslation(['todo', 'common']);
  const { t: tVoice } = useTranslation('voice');
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const confirmDialog = useConfirmDialog();

  const [isVoiceHintPending] = useMyPendingCoachmark('voice-quick-start');
  const { type: aiParseQuotaType } = useQuotaStatus('AI_PARSE');

  const form = useForm({
    resolver: zodResolver(todoFormSchema),
    defaultValues,
  });
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [hasTouchedForm, setHasTouchedForm] = useState(false);
  const hasStartedRequestedVoiceRef = useRef(false);

  const createTodo = useMutation(useCreateTodoMutationOptions());
  const createRecurringTodo = useMutation(useCreateRecurringTodoMutationOptions());
  const focusTitle = useFocusTodoTitle(form.setFocus);
  const reopenRepeatPicker = useReopenTodoRepeatPicker({
    getValues: form.getValues,
    setValue: form.setValue,
    focusTitle,
  });
  const [voice, voiceControls] = useAddTodoQuickVoice({
    getTitle: () => form.getValues('title'),
    onTitleChange: (title) =>
      form.setValue('title', title, { shouldDirty: true, shouldValidate: true }),
    onExit,
  });
  const startRequestedVoice = useEffectEvent(() => {
    voiceControls.start().catch(reportUnexpectedError);
  });

  // 이번 달 AI를 다 썼으면 말로 하라고 권하지 않는다. 직접 입력은 계속 된다
  const canSuggestVoice = aiParseQuotaType !== 'used-up';
  const isVoiceHintShown = canSuggestVoice && isVoiceHintPending;
  const isFormStep = VoiceCapturePolicy.isManualInput(voice.state);
  const voiceDismissAction = VoiceCapturePolicy.findDismissAction(voice.state);

  useOnScreenBlur(voiceControls.interrupt);
  // 시트가 다 열린 뒤 한 번만 시작한다. 동의·마이크를 거절하면 시트에 남아 마이크로 다시 시도한다
  useEffect(() => {
    if (!isVoiceStartRequested || !isOpen || hasStartedRequestedVoiceRef.current) {
      return;
    }
    hasStartedRequestedVoiceRef.current = true;
    startRequestedVoice();
  }, [isVoiceStartRequested, isOpen]);

  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const submitTodo = form.handleSubmit(async (values) => {
    const { repeat } = values;
    if (repeat == null) {
      await createTodo.mutateAsync({ values }, { onSuccess: onClose });

      return;
    }
    await createRecurringTodo.mutateAsync(
      { values: { ...values, repeat } },
      { onSuccess: onClose },
    );
  });

  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 할 일을 하나 더 만든다
  const handleSavePress = useSingleTap(() => {
    submitTodo().catch((error: unknown) => {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        reopenRepeatPicker().catch(reportUnexpectedError);
      }
    });
  });

  // 저장 중이거나 저장해 닫히는 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다
  const handleTitleSubmit = (title: string, isSubmitLocked: boolean) => {
    if (isSubmitLocked) {
      return;
    }
    if (title.trim().length === 0) {
      onClose();

      return;
    }
    handleSavePress();
  };

  const confirmDiscardPlan = async () => {
    const isCharged = VoiceCapturePolicy.isChargedReview(voice.state);
    const shouldDiscard = await confirmDialog.openAsync({
      title: tVoice('review.leaveTitle'),
      description: tVoice(isCharged ? 'review.leaveDescriptionCharged' : 'review.leaveDescription'),
      confirmLabel: t('common:actions.close'),
      cancelLabel: tVoice('review.leaveCancel'),
    });
    if (shouldDiscard) {
      onClose();
    }
  };

  const handleVoiceDismissRequest =
    voiceDismissAction == null
      ? undefined
      : () => {
          match(voiceDismissAction)
            .with('cancel-capture', () => voiceControls.cancel())
            .with('cancel-planning', () => voiceControls.cancelPlanning())
            .with('confirm-discard', () => {
              confirmDiscardPlan().catch(reportUnexpectedError);
            })
            .exhaustive();
        };

  return (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backgroundDecoration={
        voice.state.status === 'listening' && <SheetEdgeGlow level={voice.level} />
      }
      isDraggable={isFormStep}
      onDismissRequest={handleVoiceDismissRequest}
    >
      {match(voice.state)
        .with({ status: P.union('preparing', 'listening', 'paused', 'finalizing') }, () => (
          <QuickVoiceListening
            state={voice.state}
            level={voice.level}
            isQuiet={voice.isQuiet}
            locale={voice.locale}
            onLocaleChange={voiceControls.changeLocale}
            onFinish={voiceControls.finish}
            onCancel={voiceControls.cancel}
            onResume={voiceControls.resume}
            onContinueAsVoiceNote={() => {
              voiceControls.continueAsVoiceNote().catch(reportUnexpectedError);
            }}
          />
        ))
        .with({ status: 'planning' }, () => (
          <QuickVoicePlanning
            transcript={voice.state.transcript}
            onCancel={voiceControls.cancelPlanning}
          />
        ))
        .with({ status: 'review' }, ({ plan, isCharged }) => (
          // 고르는 단계. 카드가 쓰는 조회가 실패해도 시트(루트 overlay)가 앱 경계까지 터지지 않게 이 안에서 처리한다
          <QueryErrorBoundary fallback={QuickVoiceReview.Error}>
            <Suspense fallback={<QuickVoiceReview.Loading />}>
              <Watch
                control={form.control}
                name="categoryId"
                render={(categoryId) => (
                  <QuickVoiceReview
                    plan={plan}
                    isCharged={isCharged}
                    fallbackCategoryId={categoryId}
                    onMemoChanged={onMemoChanged}
                    onApplied={onClose}
                    onRestart={() => {
                      voiceControls.restart().catch(reportUnexpectedError);
                    }}
                    onTypeInstead={voiceControls.typeInstead}
                  />
                )}
              />
            </Suspense>
          </QueryErrorBoundary>
        ))
        .with({ status: P.union('idle', 'failed') }, () => (
          <VStack gap={12} testID="todo-add-sheet" onTouchStart={() => setHasTouchedForm(true)}>
            <QuickVoiceFailed
              state={voice.state}
              isConsentRequired={voice.isConsentRequired}
              isTypedTextKept={voice.isTypedTextKept}
              onResume={voiceControls.resume}
              onRetryPlanning={voiceControls.retryPlanning}
            />

            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState, formState: { isSubmitting, isSubmitSuccessful } }) => (
                <TitleInput
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error}
                  isVoiceFailed={voice.state.status === 'failed'}
                  // 처음 안내는 키보드 없이 띄운다. 키보드 뒤로 잘리거나 첫 탭을 빼앗지 않게 하려는 것이다
                  isAutoFocusDeferred={isVoiceHintShown || isVoiceStartRequested}
                  isVoiceRestarting={voice.isRestarting}
                  onFocusChange={setIsTitleFocused}
                  onSubmitEditing={() =>
                    handleTitleSubmit(
                      field.value,
                      // 저장하면 시트가 내려가는 동안에도 같은 제목이 남아 있다. 그동안 다시 보내지 않는다
                      isSubmitting || isSubmitSuccessful,
                    )
                  }
                  onRevalidate={() => {
                    form.trigger('title').catch(reportUnexpectedError);
                  }}
                />
              )}
            />

            <Watch
              control={form.control}
              name={TODO_COMPOSER_CHIP_FIELDS}
              render={([
                startDate,
                endDate,
                scheduledTime,
                isAllDay,
                repeat,
                visibility,
                categoryId,
              ]) => (
                <TodoComposerChips
                  value={{
                    startDate,
                    endDate,
                    scheduledTime,
                    isAllDay,
                    repeat,
                    visibility,
                    categoryId,
                  }}
                  onChange={(next) => setTodoComposerChipFields(form.setValue, next)}
                  onPickerCloseStart={focusTitle}
                />
              )}
            />

            <Separator thickness={1} className="bg-gray-2" />

            <HStack gap={8} align="center" justify="end">
              <QuickVoiceQuota />
              <CoachmarkPopover
                kind="voice-quick-start"
                title={tVoice('coach.quickStart.title')}
                description={tVoice('coach.quickStart.description')}
                placement="left"
                align="center"
                isEnabled={canSuggestVoice && !isTitleFocused}
                isPassThrough
                isDismissed={hasTouchedForm}
              >
                <QuickVoiceButton
                  onPress={() => {
                    voiceControls.start().catch(reportUnexpectedError);
                  }}
                  testID="todo-quick-voice-button"
                />
              </CoachmarkPopover>
              <FormState
                control={form.control}
                render={({ isValid, isSubmitting, isSubmitSuccessful }) => (
                  <TodoComposerSubmitButton
                    isDisabled={!isValid || isSubmitting || isSubmitSuccessful}
                    isSubmitting={isSubmitting || isSubmitSuccessful}
                    onPress={() => handleSavePress()}
                    testID="todo-add-submit"
                  />
                )}
              />
            </HStack>
          </VStack>
        ))
        .exhaustive()}
    </KeyboardBottomSheet>
  );
}

interface TitleInputProps {
  ref: RefCallBack;
  value: string;
  onChange: (title: string) => void;
  error: FieldError | undefined;
  isVoiceFailed: boolean;
  isAutoFocusDeferred: boolean;
  isVoiceRestarting: boolean;
  onFocusChange: (isFocused: boolean) => void;
  onSubmitEditing: () => void;
  onRevalidate: () => void;
}

/** 한도를 넘기면 여러 줄 칸으로 바꾼다. 넘긴 상태는 이 칸만 기억해 글자를 칠 때 시트가 다시 그려지지 않는다 */
function TitleInput({
  ref,
  value,
  onChange,
  error,
  isVoiceFailed,
  isAutoFocusDeferred,
  isVoiceRestarting,
  onFocusChange,
  onSubmitEditing,
  onRevalidate,
}: TitleInputProps) {
  const { t } = useTranslation('todo');
  // 한도 아래로 지워도 칸을 바꾸지 않는다. 다시 마운트되면 커서와 키보드가 튄다
  const [hasExceededTitleLimit, setHasExceededTitleLimit] = useState(false);
  if (!hasExceededTitleLimit && value.length > TODO_LIMITS.TITLE_MAX_LENGTH) {
    setHasExceededTitleLimit(true);
  }
  const revalidate = useEffectEvent(onRevalidate);

  // 한도를 넘긴 뒤로는 글자를 고칠 때마다 다시 검사해 저장이 꺼진 이유를 칸 아래에 바로 보인다
  useEffect(() => {
    if (hasExceededTitleLimit) {
      revalidate();
    }
  }, [hasExceededTitleLimit, value]);

  if (isVoiceFailed || hasExceededTitleLimit) {
    return (
      // 넘친 글은 한 줄 칸으로 돌아가지 않고 칸 안에서 스크롤한다. maxLength는 Android가 200자 뒤를 지워 쓰지 않는다
      <TextArea
        ref={ref}
        autoFocus={!isVoiceRestarting}
        placeholder={t('add.placeholder')}
        value={value}
        onChange={onChange}
        isInvalid={error?.type === 'too_big'}
        errorMessage={
          error?.type === 'too_big'
            ? resolveValidationMessage(error, { default: 'todoTitle.tooLong' })
            : undefined
        }
        shouldGrowWithContent
        textSize="b3"
        shouldPreserveErrorSpace={false}
        className="max-h-28 min-h-12"
        returnKeyType="done"
        submitBehavior="submit"
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onSubmitEditing={onSubmitEditing}
      />
    );
  }

  return (
    <Input
      ref={ref}
      autoFocus={!isAutoFocusDeferred && !isVoiceRestarting}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      placeholder={t('add.placeholder')}
      value={value}
      onChange={onChange}
      maxLength={TODO_LIMITS.TITLE_MAX_LENGTH}
      size="medium"
      renderErrorMessage={false}
      returnKeyType="done"
      onSubmitEditing={onSubmitEditing}
      testID="todo-add-title-input"
    />
  );
}
