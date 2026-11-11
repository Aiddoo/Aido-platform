import { TODO_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { shouldReopenRepeatPicker } from '@src/features/planning/todo/domains/todo-series.error';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { todoCreateParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { QuickVoiceButton } from '@src/features/voice/components/quick-voice/quick-voice-button';
import { QuickVoiceInfo } from '@src/features/voice/components/quick-voice/quick-voice-info';
import {
  QuickVoiceCardsLoading,
  QuickVoiceFailed,
  QuickVoiceListening,
  QuickVoicePlanning,
  QuickVoiceReview,
} from '@src/features/voice/components/quick-voice/quick-voice-panel';
import { SheetEdgeGlow } from '@src/features/voice/components/visualizers/sheet-edge-glow';
import { VoiceCapturePolicy } from '@src/features/voice/domains/voice-capture.model';
import { fromDate, toDate, toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheet,
  BottomSheetInput,
  BottomSheetTextArea,
  HStack,
  INQUIRY_SHEET_EXIT,
  KeyboardBottomSheet,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useConfirmDialog,
  useOverlay,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { match, P } from 'ts-pattern';

import { useAddTodoQuickVoice } from '../hooks/use-add-todo-quick-voice';
import {
  useCreateRecurringTodoMutationOptions,
  useCreateTodoMutationOptions,
} from '../queries/todo-composer.mutations';
import { type AddTodoFormValues, addTodoFormSchema } from '../schemas/add-todo-form.schema';
import {
  openTodoRepeatPicker,
  TodoComposerChips,
  TodoComposerSubmitButton,
} from './todo-composer-fields';

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
  const categoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesResult.categories,
    requestedCategoryId,
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
        startDate: fromDate(toDate(date)),
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
          <QueryErrorActions onRetry={reset} onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)} />
        }
      />
    </BottomSheet>
  );
};

interface TodoCreateFormProps {
  defaultValues: AddTodoFormValues;
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
  const { t } = useTranslation('todo');
  const { t: tVoice } = useTranslation('voice');
  const { timeZone } = useDateFormatContext();
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const overlay = useOverlay();
  const confirmDialog = useConfirmDialog();

  const form = useForm({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues,
  });
  const { isSubmitting } = useFormState({ control: form.control });
  const title = useWatch({ control: form.control, name: 'title' });
  // 한도 아래로 지워도 칸을 바꾸지 않는다. 다시 마운트되면 커서와 키보드가 튄다
  const [hasExceededTitleLimit, setHasExceededTitleLimit] = useState(false);
  if (!hasExceededTitleLimit && title.length > TODO_LIMITS.TITLE_MAX_LENGTH) {
    setHasExceededTitleLimit(true);
  }

  const createTodo = useMutation(useCreateTodoMutationOptions());
  const createRecurringTodo = useMutation(useCreateRecurringTodoMutationOptions());

  const voice = useAddTodoQuickVoice({ form, onExit });
  useOnScreenBlur(voice.interrupt);
  const [isVoiceHintPending] = useMyPendingCoachmark('voice-quick-start');
  const { type: aiParseQuotaType } = useQuotaStatus('AI_PARSE');
  // 이번 달 AI를 다 썼으면 말로 하라고 권하지 않는다. 직접 입력은 계속 된다
  const canSuggestVoice = aiParseQuotaType !== 'used-up';
  const isVoiceHintShown = canSuggestVoice && isVoiceHintPending;
  const hasStartedRequestedVoiceRef = useRef(false);
  const startRequestedVoice = useEffectEvent(() => {
    voice.start().catch(reportUnexpectedError);
  });
  // 시트가 다 열린 뒤 한 번만 시작한다. 동의·마이크를 거절하면 시트에 남아 마이크로 다시 시도한다
  useEffect(() => {
    if (!isVoiceStartRequested || !isOpen || hasStartedRequestedVoiceRef.current) {
      return;
    }
    hasStartedRequestedVoiceRef.current = true;
    startRequestedVoice();
  }, [isVoiceStartRequested, isOpen]);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [hasTouchedForm, setHasTouchedForm] = useState(false);

  const submitTodo = form.handleSubmit(async (values) => {
    const common = {
      title: values.title,
      startDate: toDateKey(values.startDate, timeZone),
      scheduledTime: values.isAllDay ? undefined : values.scheduledTime,
      isAllDay: values.isAllDay,
      visibility: values.visibility,
      categoryId: values.categoryId,
    };

    try {
      if (values.repeat != null) {
        await createRecurringTodo.mutateAsync(
          { input: { ...common, repeat: values.repeat } },
          { onSuccess: onClose },
        );
      } else {
        await createTodo.mutateAsync(
          {
            input: {
              ...common,
              endDate: values.endDate == null ? undefined : toDateKey(values.endDate, timeZone),
            },
          },
          { onSuccess: onClose },
        );
      }
    } catch (error) {
      // 안내는 mutation 토스트가 맡고 시트와 입력값은 그대로 남긴다. 루트 overlay에서는 경계로 보내면 앱 전체가 내려간다
      if (shouldReopenRepeatPicker(error)) {
        openTodoRepeatPicker(overlay, form);
      }
    }
  });

  const isFormStep = VoiceCapturePolicy.isManualInput(voice.state);
  const isSubmitDisabled = title.trim().length === 0 || isSubmitting;

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다
  const handleTitleSubmit = () => {
    if (isSubmitting) {
      return;
    }
    if (title.trim().length === 0) {
      onClose();

      return;
    }
    submitTodo();
  };

  const confirmDiscardPlan = async () => {
    const isCharged = VoiceCapturePolicy.isChargedReview(voice.state);
    const shouldDiscard = await confirmDialog.openAsync({
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
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backgroundDecoration={
        voice.state.status === 'listening' && <SheetEdgeGlow level={voice.level} />
      }
      enableContentPanningGesture={isFormStep}
      onDismissRequest={handleVoiceDismissRequest}
    >
      {match(voice.state)
        .with({ status: P.union('preparing', 'listening', 'paused', 'finalizing') }, () => (
          <QuickVoiceListening
            state={voice.state}
            level={voice.level}
            isQuiet={voice.isQuiet}
            locale={voice.locale}
            onLocaleChange={voice.changeLocale}
            onFinish={voice.finish}
            onCancel={voice.cancel}
            onResume={voice.resume}
            onContinueAsVoiceNote={voice.continueAsVoiceNote}
          />
        ))
        .with({ status: 'planning' }, () => (
          <QuickVoicePlanning transcript={voice.state.transcript} onCancel={voice.cancelPlanning} />
        ))
        .with({ status: 'review' }, ({ plan, isCharged }) => (
          <TodoCreateVoiceReview
            form={form}
            plan={plan}
            isCharged={isCharged}
            onMemoChanged={onMemoChanged}
            onApplied={onClose}
            onRestart={voice.restart}
            onTypeInstead={voice.typeInstead}
          />
        ))
        .otherwise(() => (
          <VStack gap={12} testID="todo-add-sheet" onTouchStart={() => setHasTouchedForm(true)}>
            <QuickVoiceFailed
              state={voice.state}
              isConsentRequired={voice.isConsentRequired}
              isTypedTextKept={voice.isTypedTextKept}
              onResume={voice.resume}
              onRetryPlanning={voice.retryPlanning}
            />

            <Controller
              control={form.control}
              name="title"
              render={({ field: { onChange, value, ref }, fieldState: { error } }) =>
                voice.state.status === 'failed' || hasExceededTitleLimit ? (
                  // 넘친 글은 한 줄 칸으로 돌아가지 않고 칸 안에서 스크롤한다. maxLength는 Android가 200자 뒤를 지워 쓰지 않는다
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
                    onSubmitEditing={handleTitleSubmit}
                  />
                ) : (
                  <BottomSheetInput
                    ref={ref}
                    // 처음 안내는 키보드 없이 띄운다. 키보드 뒤로 잘리거나 첫 탭을 빼앗지 않게 하려는 것이다
                    autoFocus={!isVoiceHintShown && !isVoiceStartRequested && !voice.isRestarting}
                    onFocus={() => setIsTitleFocused(true)}
                    onBlur={() => setIsTitleFocused(false)}
                    placeholder={t('add.placeholder')}
                    value={value}
                    onChange={onChange}
                    maxLength={TODO_LIMITS.TITLE_MAX_LENGTH}
                    size="medium"
                    renderErrorMessage={false}
                    returnKeyType="done"
                    onSubmitEditing={handleTitleSubmit}
                    testID="todo-add-title-input"
                  />
                )
              }
            />

            <TodoComposerChips form={form} />

            <Separator thickness={1} className="bg-gray-2" />

            <HStack gap={8} align="center" justify="end">
              <QuickVoiceInfo />
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
                <QuickVoiceButton onPress={() => voice.start()} testID="todo-quick-voice-button" />
              </CoachmarkPopover>
              <TodoComposerSubmitButton
                isDisabled={isSubmitDisabled}
                isSubmitting={isSubmitting}
                onPress={() => submitTodo()}
                testID="todo-add-submit"
              />
            </HStack>
          </VStack>
        ))}
    </KeyboardBottomSheet>
  );
}

type TodoCreateVoiceReviewProps = Omit<
  ComponentProps<typeof QuickVoiceReview>,
  'fallbackCategoryId'
> & { form: UseFormReturn<AddTodoFormValues> };

/** 고르는 단계. 카드가 쓰는 조회가 실패해도 시트(루트 overlay)가 앱 경계까지 터지지 않게 이 안에서 처리한다 */
function TodoCreateVoiceReview({ form, ...props }: TodoCreateVoiceReviewProps) {
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });

  return (
    <QueryErrorBoundary>
      <Suspense fallback={<QuickVoiceCardsLoading />}>
        <QuickVoiceReview {...props} fallbackCategoryId={categoryId} />
      </Suspense>
    </QueryErrorBoundary>
  );
}
