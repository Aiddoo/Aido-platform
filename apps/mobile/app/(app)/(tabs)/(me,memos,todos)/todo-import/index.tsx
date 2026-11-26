import { zodResolver } from '@hookform/resolvers/zod';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { toTodoImportSelection } from '@src/features/planning/todo-import/apis/todo-import.mapper';
import { CalendarPermissionPrompt } from '@src/features/planning/todo-import/components/calendar-permission-prompt';
import { CalendarSelectionSummary } from '@src/features/planning/todo-import/components/calendar-selection-summary';
import { CalendarSourceList } from '@src/features/planning/todo-import/components/calendar-source-list';
import { CategoryMappingList } from '@src/features/planning/todo-import/components/category-mapping-list';
import { ConfirmCalendarSelectionButton } from '@src/features/planning/todo-import/components/confirm-calendar-selection-button';
import { ConfirmImportPlanButton } from '@src/features/planning/todo-import/components/confirm-import-plan-button';
import { ImportDestinationInput } from '@src/features/planning/todo-import/components/import-destination-input';
import { ImportEndDateChips } from '@src/features/planning/todo-import/components/import-end-date-chips';
import { ImportHintButton } from '@src/features/planning/todo-import/components/import-hint-button';
import { ImportPlacementSummary } from '@src/features/planning/todo-import/components/import-placement-summary';
import { ImportRangeInput } from '@src/features/planning/todo-import/components/import-range-input';
import { ImportSourceList } from '@src/features/planning/todo-import/components/import-source-list';
import { LastTodoImportRow } from '@src/features/planning/todo-import/components/last-todo-import-row';
import { MissingCalendarHelp } from '@src/features/planning/todo-import/components/missing-calendar-help';
import type { TodoImportStep } from '@src/features/planning/todo-import/constants/todo-import.events';
import type { TodoImportCollection } from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import {
  type TodoImportCategoryMode,
  type TodoImportPlan,
  TodoImportPlanPolicy,
} from '@src/features/planning/todo-import/domains/todo-import-plan.model';
import { createDefaultTodoImportRange } from '@src/features/planning/todo-import/domains/todo-import-range.model';
import type { TodoImportTarget } from '@src/features/planning/todo-import/domains/todo-import-target.model';
import {
  getTodoImportStartFailure,
  toRejectedTargetErrors,
} from '@src/features/planning/todo-import/domains/todo-import.error';
import { useFormatTargetRejection } from '@src/features/planning/todo-import/hooks/use-format-target-rejection';
import { findCachedActiveTodoImport } from '@src/features/planning/todo-import/queries/todo-import-cache';
import { useGetCalendarPermissionQueryOptions } from '@src/features/planning/todo-import/queries/todo-import-source.queries';
import {
  useRequestCalendarPermissionMutationOptions,
  useStartTodoImportMutationOptions,
} from '@src/features/planning/todo-import/queries/todo-import.mutations';
import {
  todoImportFormSchema,
  type TodoImportFormValues,
} from '@src/features/planning/todo-import/schemas/todo-import-form.schema';
import { getCalendarPermissionView } from '@src/features/planning/todo-import/utils/todo-import.view-model';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Stepper, useStepper } from '@src/shared/hooks/use-stepper';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  CategoryDuoIcon,
  FormStepLayout,
  HStack,
  InlineAlert,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  QueryErrorFallback,
  ReadableContent,
  SettingsListGroup,
  Spacing,
  STACK_BACK_ICON,
  Steps,
  StyledSafeAreaView,
  Text,
  TextButton,
  useAppToast,
  usePaneSizeClass,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import {
  type NavigationAction,
  Redirect,
  Stack,
  useNavigation,
  usePreventRemove,
  useRouter,
} from 'expo-router';
import { type ReactNode, Suspense, useDeferredValue, useState } from 'react';
import {
  Controller,
  FormState,
  type UseFormReturn,
  useController,
  useForm,
  useFormState,
  useWatch,
} from 'react-hook-form';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { isMatching, match, P } from 'ts-pattern';

type TodoImportStepContexts = Record<TodoImportStep, Record<string, never>>;
type TodoImportForm = UseFormReturn<TodoImportFormValues>;

const TODO_IMPORT_STEPS = [
  'permission',
  'calendars',
  'categories',
  'options',
] as const satisfies readonly TodoImportStep[];

const MODE_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(ReduceMotion.System);
const DOWN_ARROW_SIZE = 20;

export default function TodoImportSetupScreen() {
  const { t } = useTranslation('todoImport');
  const queryClient = useQueryClient();
  // 들어올 때 이미 아는 진행 중인 가져오기가 있으면 그 화면을 보인다. 모르면 시작할 때 서버가 알려 준다
  const [activeImport] = useState(() => findCachedActiveTodoImport(queryClient));

  if (activeImport != null) {
    return (
      <Redirect
        href={{ pathname: '/todo-import/[importId]', params: { importId: activeImport.id } }}
      />
    );
  }

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('titles.setup') }} />

      <ReadableContent flex={1}>
        <QueryErrorBoundary fallback={CalendarPermissionPrompt.Error}>
          {/* 첫 단계를 고르는 권한은 기기 안에서 바로 읽혀, 권한 안내 모양의 자리를 모든 사용자에게 번쩍이지 않는다 */}
          <Suspense fallback={null}>
            <TodoImportSetup />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </Box>
  );
}

function TodoImportSetup() {
  const { t } = useTranslation('common');
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();

  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());

  // 이미 허용한 기기는 안내를 건너뛴다. 단계는 URL로 복원하지 않는다
  const [firstStep] = useState<TodoImportStep>(() =>
    permission.status === 'granted' ? 'calendars' : 'permission',
  );
  const stepper = useStepper<TodoImportStepContexts>({
    id: 'todo-import',
    initial: { step: firstStep },
    onStepChange: ({ step }) => trackEvent('todo_import_step_viewed', { step }),
  });
  // 칸은 단계 컴포넌트가 구독해, 값이 바뀌어도 단계 조립은 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(todoImportFormSchema),
    defaultValues: {
      range: createDefaultTodoImportRange(todayKey),
      collectionKeys: null,
      collections: [],
      categoryMode: 'single',
      singleTarget: null,
      targets: {},
      timeMode: 'TIME',
      visibility: 'PRIVATE',
    },
    mode: 'onChange',
  });
  const { isPastFirstStep, isSwipeBackEnabled, leaveToImport } = useStepBackNavigation(stepper);
  const handleStepBack = useSingleTap(() => stepper.history.back());

  return (
    <VStack flex={1}>
      {/* 숨긴 항목도 iOS 기본 뒤로 가기를 가려, 첫 단계에서는 툴바를 그리지 않는다 */}
      {isPastFirstStep && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon={STACK_BACK_ICON}
            accessibilityLabel={t('actions.back')}
            onPress={handleStepBack}
          />
        </Stack.Toolbar>
      )}
      {/* Stack.Screen은 내려갈 때 옵션을 되돌리지 않아, 첫 단계로 돌아오면 다시 켜도록 늘 그린다 */}
      <Stack.Screen options={{ gestureEnabled: isSwipeBackEnabled }} />

      <stepper.Render
        permission={({ step, history }) => (
          <PermissionStep
            progress={<StepDots step={step} firstStep={firstStep} />}
            onGranted={() => history.replace('calendars')}
          />
        )}
        calendars={({ step, history }) => (
          <CalendarsStep
            form={form}
            progress={<StepDots step={step} firstStep={firstStep} />}
            onNext={() => history.push('categories')}
          />
        )}
        categories={({ step, history }) => (
          <CategoriesStep
            form={form}
            progress={<StepDots step={step} firstStep={firstStep} />}
            onNext={() => history.push('options')}
          />
        )}
        options={({ step, history }) => (
          <OptionsStep
            form={form}
            progress={<StepDots step={step} firstStep={firstStep} />}
            onStarted={(importId) => {
              // 시작을 기다리는 사이 떠났으면 돌아와 다시 누를 수 있게 고른 값은 두고 제출 상태만 푼다
              if (!leaveToImport(importId)) {
                form.reset(form.getValues(), { keepDefaultValues: true });
              }
            }}
            onTargetsRejected={() => history.backTo('categories')}
          />
        )}
      />
    </VStack>
  );
}

interface PermissionStepProps {
  progress: ReactNode;
  onGranted: () => void;
}

function PermissionStep({ progress, onGranted }: PermissionStepProps) {
  const { t } = useTranslation('todoImport');
  const appSettings = useOpenAppSettings();

  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());

  const request = useMutation(useRequestCalendarPermissionMutationOptions());

  const view = getCalendarPermissionView(permission, request.data ?? null);

  // 열 때는 상태만 읽고 "계속"을 눌러야 시스템 창을 띄운다
  const handleContinue = () => {
    request
      .mutateAsync()
      .then((answered) => {
        if (answered.status === 'granted') {
          onGranted();
        }
      })
      // 실패 안내는 mutation의 meta.errorFeedback이 맡는다
      .catch(noop);
  };

  return (
    <FormStepLayout
      testID="todo-import-step-permission"
      title={t('permission.title')}
      progress={progress}
      footer={match({ view, canOpenSettings: appSettings.canOpen })
        .with({ view: 'ask' }, () => (
          <KeyboardAdaptiveButton isLoading={request.isPending} onPress={handleContinue}>
            {t('permission.continue')}
          </KeyboardAdaptiveButton>
        ))
        // 거절한 뒤에는 다시 조르지 않고 설정 열기만 둔다
        .with({ view: P.union('denied', 'blocked'), canOpenSettings: true }, () => (
          <KeyboardAdaptiveButton onPress={appSettings.open}>
            {t('permission.openSettings')}
          </KeyboardAdaptiveButton>
        ))
        // 설정 화면이 없는 기기는 글로 가는 길만 보인다
        .with({ view: P.union('denied', 'blocked'), canOpenSettings: false }, () => null)
        .exhaustive()}
    >
      <CalendarPermissionPrompt view={view} />
    </FormStepLayout>
  );
}

interface FormStepProps {
  form: TodoImportForm;
  progress: ReactNode;
  onNext: () => void;
}

function CalendarsStep({ form, progress, onNext }: FormStepProps) {
  const { t } = useTranslation(['todoImport', 'common']);

  const { field: range } = useController({ control: form.control, name: 'range' });
  const { field: collectionKeys } = useController({
    control: form.control,
    name: 'collectionKeys',
  });
  // 기간을 바꿔 다시 읽는 동안 앞 목록을 흐리게 두고 스켈레톤으로 바꾸지 않는다
  const listedStartDate = useDeferredValue(range.value.startDate);
  const listedEndDate = useDeferredValue(range.value.endDate);

  const isListStale =
    listedStartDate !== range.value.startDate || listedEndDate !== range.value.endDate;

  // 고른 캘린더(일정 수 포함)를 고정해 다음 단계와 시작 요청이 화면에 보인 수 그대로 쓴다
  const confirmSelection = (selected: TodoImportCollection[]) => {
    form.setValue('collections', selected, { shouldDirty: true });
    onNext();
  };

  return (
    <FormStepLayout
      testID="todo-import-step-calendars"
      title={t('calendars.title')}
      progress={progress}
      footer={
        // 위 간격은 스크롤에 잘린 목록 끝과 요약 글을 떼어 놓는다
        <VStack className="gap-2 pt-3">
          {/* 버튼이 왜 꺼졌는지 목록 끝까지 내리지 않아도 버튼 바로 위에서 보인다 */}
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            <CalendarSelectionSummary
              startDate={listedStartDate}
              endDate={listedEndDate}
              value={collectionKeys.value}
            />
          </StyledSafeAreaView>
          <ConfirmCalendarSelectionButton
            testID="todo-import-next"
            startDate={listedStartDate}
            endDate={listedEndDate}
            value={collectionKeys.value}
            // 기간을 바꿔 다시 읽는 동안에는 앞 목록의 수로 넘기지 않는다
            isDisabled={isListStale}
            onConfirm={confirmSelection}
          >
            {t('common:actions.continue')}
          </ConfirmCalendarSelectionButton>
        </VStack>
      }
    >
      {/* 지난 가져오기가 없으면 줄도 간격도 없다 */}
      <LastTodoImportRow className="mb-5" />

      <WordWrapText size="b3" shade={6}>
        {t('calendars.description')}
      </WordWrapText>

      <Spacing size={20} />

      <FieldTitle>{t('range.title')}</FieldTitle>
      <Spacing size={8} />
      <ImportRangeInput value={range.value} onChange={range.onChange} />
      <Spacing size={12} />
      {/* 기간 안내를 읽지 못해도 서버가 시작할 때 기간을 다시 확인해 칩만 숨긴다 */}
      <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
        <Suspense fallback={<ImportEndDateChips.Loading />}>
          <ImportEndDateChips
            value={range.value}
            onChange={range.onChange}
            accessibilityLabel={t('range.title')}
          />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={24} />

      <FieldTitle>{t('calendars.listTitle')}</FieldTitle>
      <Spacing size={8} />
      <Box className={cn(isListStale && 'opacity-50')}>
        <QueryErrorBoundary
          fallback={CalendarSourceList.Error}
          resetKeys={[listedStartDate, listedEndDate]}
        >
          <Suspense fallback={<CalendarSourceList.Loading />}>
            <CalendarSourceList
              startDate={listedStartDate}
              endDate={listedEndDate}
              value={collectionKeys.value}
              onChange={collectionKeys.onChange}
            />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
      <Spacing size={8} />
      <Box className="self-center">
        <MissingCalendarHelp />
      </Box>
    </FormStepLayout>
  );
}

function CategoriesStep({ form, progress, onNext }: FormStepProps) {
  const { t } = useTranslation(['todoImport', 'common']);
  const fontScaledSize = useFontScaledSize();

  const [collections, categoryMode, singleTarget, targets] = useWatch({
    control: form.control,
    name: ['collections', 'categoryMode', 'singleTarget', 'targets'],
  });
  const errorMessages = useTargetErrorMessages(form, collections);

  const [isModeSwitched, setIsModeSwitched] = useState(false);

  const plan: TodoImportPlan = { collections, categoryMode, singleTarget, targets };
  const hasRejectedTargets = 0 < Object.keys(errorMessages).length;
  // 처음 그릴 때(앞 단계에서 돌아올 때 포함)는 그대로 두고, 넣는 방법을 바꿀 때만 스며들듯 바뀐다
  const modeEntering = isModeSwitched ? MODE_ENTERING : undefined;
  const downArrowSize = fontScaledSize(DOWN_ARROW_SIZE);

  // 캘린더마다 고른 값은 한 곳에 넣는 동안에도 폼에 남아 다시 나누면 돌아온다
  const switchMode = (nextMode: TodoImportCategoryMode) => {
    setIsModeSwitched(true);
    form.setValue('categoryMode', nextMode, { shouldDirty: true });
  };

  // 서버가 거절한 표시는 그곳을 바꾸면 지운다
  const chooseDestination = (target: TodoImportTarget) => {
    form.clearErrors('targets');
    form.setValue('singleTarget', target, { shouldDirty: true });
  };

  // 다른 캘린더의 표시는 그 캘린더를 바꿀 때까지 남기고, 같은 곳을 다시 고른 캘린더의 표시도 남긴다
  const chooseCollectionTarget = (collectionKey: string, target: TodoImportTarget) => {
    const chosenTargets = form.getValues('targets');
    if (chosenTargets[collectionKey] !== target) {
      form.clearErrors(`targets.${collectionKey}`);
    }
    form.setValue('targets', { ...chosenTargets, [collectionKey]: target }, { shouldDirty: true });
  };

  // 처음 넣을 곳을 고른 값으로 고정해 옵션 단계와 시작 요청이 화면에 보인 곳 그대로 보낸다
  const confirmPlan = (destination: TodoImportTarget) => {
    form.setValue('singleTarget', destination, { shouldDirty: true });
    onNext();
  };

  return (
    <FormStepLayout
      testID="todo-import-step-categories"
      title={t('categories.title')}
      progress={progress}
      footer={
        <VStack className="gap-2 pt-3">
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            {/* 넣을 곳 카드·캘린더 줄이 같은 조회의 오류와 다시 시도를 보여 요약 자리는 비운다 */}
            <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
              <Suspense fallback={<ImportPlacementSummary.Loading className="self-center" />}>
                <ImportPlacementSummary plan={plan} />
              </Suspense>
            </QueryErrorBoundary>
          </StyledSafeAreaView>
          <ConfirmImportPlanButton testID="todo-import-next" plan={plan} onConfirm={confirmPlan}>
            {t('common:actions.continue')}
          </ConfirmImportPlanButton>
        </VStack>
      }
    >
      <WordWrapText size="b3" shade={6}>
        {t('categories.description')}
      </WordWrapText>
      {hasRejectedTargets && (
        <>
          <Spacing size={12} />
          <InlineAlert status="danger" title={t('categories.rejected.summary')} />
        </>
      )}

      {match(TodoImportPlanPolicy.getCategoryMode(plan))
        .with('single', () => (
          <Animated.View key="single" entering={modeEntering}>
            <Spacing size={24} />

            <HStack align="center" gap={6}>
              <FieldTitle>{t('categories.sourceLabel')}</FieldTitle>
              <ImportHintButton
                label={t('categories.sourceHintLabel')}
                description={t('categories.sourceHint', {
                  missingHelp: t('calendars.missingHelp.open'),
                })}
              />
            </HStack>
            <Spacing size={8} />
            <ImportSourceList collections={plan.collections} />

            <Spacing size={8} />
            <Box
              className="rotate-90 items-center self-center"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <ArrowRightIcon
                width={downArrowSize}
                height={downArrowSize}
                colorClassName="text-gray-5"
              />
            </Box>
            <Spacing size={8} />

            <HStack align="center" gap={6}>
              <FieldTitle>{t('categories.destinationLabel')}</FieldTitle>
              <ImportHintButton
                label={t('categories.destinationHintLabel')}
                description={t('categories.destinationHint')}
              />
            </HStack>
            <Spacing size={8} />
            <QueryErrorBoundary fallback={ImportDestinationInput.Error}>
              <Suspense fallback={<ImportDestinationInput.Loading />}>
                {/* 처음 한 번 넣을 곳을 짚는다. 누름은 아래 카드로 넘겨 첫 탭이 안내만 닫지 않는다 */}
                <CoachmarkPopover
                  kind="todo-import-destination"
                  description={t('categories.coachmark')}
                  Icon={CategoryDuoIcon}
                  placement="bottom"
                  align="center"
                  avoidCollisions
                  isPassThrough
                >
                  <ImportDestinationInput
                    plan={plan}
                    errorMessage={Object.values(errorMessages)[0] ?? null}
                    onChange={chooseDestination}
                  />
                </CoachmarkPopover>
              </Suspense>
            </QueryErrorBoundary>

            {TodoImportPlanPolicy.canSplit(plan) && (
              <>
                <Spacing size={12} />
                <TextButton
                  variant="arrow"
                  className="self-start"
                  onPress={() => switchMode('separate')}
                >
                  {t('categories.splitLink')}
                </TextButton>
              </>
            )}
          </Animated.View>
        ))
        .with('separate', () => (
          <Animated.View key="separate" entering={modeEntering}>
            <Spacing size={24} />

            <HStack align="center" justify="between" gap={12} className="flex-wrap">
              <FieldTitle>{t('categories.separate.title')}</FieldTitle>
              <TextButton onPress={() => switchMode('single')}>
                {t('categories.separate.joinAll')}
              </TextButton>
            </HStack>
            <Spacing size={8} />
            <QueryErrorBoundary fallback={CategoryMappingList.Error}>
              <Suspense
                fallback={<CategoryMappingList.Loading rowCount={plan.collections.length} />}
              >
                <CategoryMappingList
                  plan={plan}
                  errorMessages={errorMessages}
                  onItemChange={chooseCollectionTarget}
                />
                <Spacing size={8} />
                <CategoryMappingList.Note plan={plan} />
              </Suspense>
            </QueryErrorBoundary>
          </Animated.View>
        ))
        .exhaustive()}
    </FormStepLayout>
  );
}

interface OptionsStepProps {
  form: TodoImportForm;
  progress: ReactNode;
  onStarted: (importId: string) => void;
  onTargetsRejected: () => void;
}

function OptionsStep({ form, progress, onStarted, onTargetsRejected }: OptionsStepProps) {
  const { t } = useTranslation('todoImport');
  const toast = useAppToast();
  const accountId = useMyAccountId();
  const calendarImportGate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const formatTargetRejection = useFormatTargetRejection();

  const startImport = useMutation(useStartTodoImportMutationOptions());

  // 실패는 RHF가 실패로 알아 다시 누를 수 있게 handleSubmit 밖 호출부에서 받는다
  const submitImport = form.handleSubmit(async (values) => {
    if (accountId == null) {
      return;
    }
    const { todoImport, isRangeAdjusted } = await startImport.mutateAsync({
      accountId,
      selection: toTodoImportSelection(values),
      untitledTitle: t('untitledEvent'),
    });
    if (isRangeAdjusted) {
      toast.toast(t('toasts.rangeAdjusted'));
    }
    onStarted(todoImport.id);
  });

  const handleStartError = (error: unknown) => {
    match(getTodoImportStartFailure(error))
      .with({ kind: 'alreadyActive' }, ({ importId }) => onStarted(importId))
      .with({ kind: 'planLimit' }, () => {
        calendarImportGate.promptIfBlockedError(error);
      })
      .with({ kind: 'targetsRejected' }, ({ rejections }) => {
        const rejectedTargets = toRejectedTargetErrors(
          toTodoImportSelection(form.getValues()),
          rejections,
        );
        for (const { collectionKey, rejection } of rejectedTargets) {
          form.setError(`targets.${collectionKey}`, {
            type: 'server',
            message: formatTargetRejection(rejection),
          });
        }
        onTargetsRejected();
      })
      // 그 밖의 실패는 mutation이 알린다
      .with({ kind: 'other' }, noop)
      .exhaustive();
  };

  const handleImportPress = useSingleTap(() => {
    submitImport().catch(handleStartError);
  });

  return (
    <FormStepLayout
      testID="todo-import-step-options"
      title={t('options.title')}
      progress={progress}
      footer={
        <VStack gap={8}>
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            <WordWrapText size="b4" shade={6} align="center">
              {t('options.disclosure')}
            </WordWrapText>
          </StyledSafeAreaView>
          <FormState
            control={form.control}
            render={({ isSubmitSuccessful }) => (
              <KeyboardAdaptiveButton
                testID="todo-import-start"
                // 시작하면 진행 화면으로 바뀌는 동안에도 같은 값이 남는다. 그동안 다시 시작하지 않는다
                isLoading={startImport.isPending || isSubmitSuccessful}
                isDisabled={accountId == null}
                onPress={handleImportPress}
              >
                {t('options.import')}
              </KeyboardAdaptiveButton>
            )}
          />
        </VStack>
      }
    >
      <SettingsListGroup>
        <Controller
          control={form.control}
          name="timeMode"
          render={({ field }) => (
            <SettingsListGroup.Toggle
              label={t('options.includeTime')}
              description={t('options.includeTimeDescription')}
              isSelected={field.value === 'TIME'}
              onSelectedChange={(isSelected) => field.onChange(isSelected ? 'TIME' : 'DATE_ONLY')}
            />
          )}
        />
        <SettingsListGroup.Separator />
        <Controller
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <SettingsListGroup.Toggle
              label={t('options.shareWithFriends')}
              description={t('options.shareWithFriendsDescription')}
              isSelected={field.value === 'PUBLIC'}
              onSelectedChange={(isSelected) => field.onChange(isSelected ? 'PUBLIC' : 'PRIVATE')}
            />
          )}
        />
      </SettingsListGroup>
    </FormStepLayout>
  );
}

interface StepDotsProps {
  step: TodoImportStep;
  firstStep: TodoImportStep;
}

// 점은 단계 제목 위 같은 흐름에 둬 넓은 화면·큰 글자에서도 제목과 겹치지 않는다
function StepDots({ step, firstStep }: StepDotsProps) {
  const firstStepOrder = TODO_IMPORT_STEPS.indexOf(firstStep);

  return (
    <Steps.Dots
      index={TODO_IMPORT_STEPS.indexOf(step) - firstStepOrder}
      count={TODO_IMPORT_STEPS.length - firstStepOrder}
    />
  );
}

interface FieldTitleProps {
  children: string;
}

function FieldTitle({ children }: FieldTitleProps) {
  return (
    <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
      {children}
    </Text>
  );
}

interface StepBackNavigation {
  isPastFirstStep: boolean;
  isSwipeBackEnabled: boolean;
  /** 진행 화면으로 바꿨으면 true, 기다리는 사이 떠나 바꾸지 않았으면 false다 */
  leaveToImport: (importId: string) => boolean;
}

function useStepBackNavigation(stepper: Stepper<TodoImportStepContexts>): StepBackNavigation {
  const router = useRouter();
  const navigation = useNavigation();
  const isCompact = usePaneSizeClass() === 'compact';
  const [isLeaving, setIsLeaving] = useState(false);

  const isPastFirstStep = 0 < stepper.index;
  // 휴대폰의 뒤로 가기는 화면을 닫지 않고 앞 단계로 돌아가 고른 값을 지킨다. 넓은 화면은 밀어서 닫기만 끈다
  const allowRemove = usePreventRemove(
    isCompact && isPastFirstStep && !isLeaving,
    ({ data, repeat }) => {
      if (isSingleStepBack(data.action)) {
        stepper.history.back();
        return;
      }
      setIsLeaving(true);
      repeat();
    },
  );

  // 시작을 기다리는 사이 떠났으면 보던 화면 위로 끌고 가지 않는다. 진행 중인 가져오기는 메뉴 행이 알린다
  const leaveToImport = (importId: string) => {
    if (!navigation.isFocused()) {
      return false;
    }
    setIsLeaving(true);
    allowRemove();
    router.replace({ pathname: '/todo-import/[importId]', params: { importId } });
    return true;
  };

  return { isPastFirstStep, isSwipeBackEnabled: isCompact || !isPastFirstStep, leaveToImport };
}

function useTargetErrorMessages(
  form: TodoImportForm,
  collections: readonly TodoImportCollection[],
): Record<string, string> {
  const { errors } = useFormState({ control: form.control, name: 'targets' });

  return Object.fromEntries(
    collections.flatMap(({ collectionKey }) => {
      const message = errors.targets?.[collectionKey]?.message;
      return message == null ? [] : [[collectionKey, message]];
    }),
  );
}

// 헤더 뒤로 가기와 iOS 밀어서 뒤로 가기는 한 칸 pop이다. 탭 다시 누르기·메뉴 이동은 그대로 보낸다
function isSingleStepBack(action: NavigationAction) {
  return (
    isMatching({ type: 'GO_BACK' }, action) ||
    isMatching({ type: 'POP', payload: { count: 1 } }, action)
  );
}
