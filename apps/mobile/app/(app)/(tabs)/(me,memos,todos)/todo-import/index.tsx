import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { toNewCategoryTarget } from '@src/features/planning/todo-import/apis/todo-import-target.mapper';
import { toTodoImportSelection } from '@src/features/planning/todo-import/apis/todo-import.mapper';
import { CalendarPermissionPrompt } from '@src/features/planning/todo-import/components/calendar-permission-prompt';
import { CalendarSourceList } from '@src/features/planning/todo-import/components/calendar-source-list';
import { CategoryMappingList } from '@src/features/planning/todo-import/components/category-mapping-list';
import { ImportDateSheet } from '@src/features/planning/todo-import/components/import-date-sheet';
import { ImportDestinationButton } from '@src/features/planning/todo-import/components/import-destination-button';
import { ImportEndDateChips } from '@src/features/planning/todo-import/components/import-end-date-chips';
import { ImportHintButton } from '@src/features/planning/todo-import/components/import-hint-button';
import { ImportPlacementSummary } from '@src/features/planning/todo-import/components/import-placement-summary';
import { ImportSourceList } from '@src/features/planning/todo-import/components/import-source-list';
import { LastTodoImportRow } from '@src/features/planning/todo-import/components/last-todo-import-row';
import { MissingCalendarHelp } from '@src/features/planning/todo-import/components/missing-calendar-help';
import { IMPORT_RANGE_PRESETS } from '@src/features/planning/todo-import/constants/todo-import.constants';
import type { TodoImportStep } from '@src/features/planning/todo-import/constants/todo-import.events';
import {
  type ImportCollection,
  TodoImportCollectionPolicy,
} from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import {
  getDefaultTarget,
  type ImportTarget,
  resolveCategoryMode,
  resolveImportTargets,
  type TodoImportCategoryMode,
  TodoImportTargetPolicy,
} from '@src/features/planning/todo-import/domains/todo-import-target.model';
import {
  calculateRemainingCapacity,
  findActiveTodoImportId,
  findRejectedTargets,
  type TodoImportTargetRejection,
} from '@src/features/planning/todo-import/domains/todo-import.error';
import {
  findLastAllowedDate,
  getRangeEndDate,
} from '@src/features/planning/todo-import/domains/todo-import.model';
import { useFormatImportTargetName } from '@src/features/planning/todo-import/hooks/use-format-import-target-name';
import { useNewCategoryNames } from '@src/features/planning/todo-import/hooks/use-new-category-names';
import { useOpenCategoryTargetSheet } from '@src/features/planning/todo-import/hooks/use-open-category-target-sheet';
import {
  useGetCalendarPermissionQueryOptions,
  useGetImportCollectionsQueryOptions,
} from '@src/features/planning/todo-import/queries/todo-import-source.queries';
import {
  useRequestCalendarPermissionMutationOptions,
  useStartTodoImportMutationOptions,
} from '@src/features/planning/todo-import/queries/todo-import.mutations';
import {
  todoImportFormSchema,
  type TodoImportFormValues,
} from '@src/features/planning/todo-import/schemas/todo-import-form.schema';
import {
  findTargetAppearance,
  getCalendarPermissionView,
} from '@src/features/planning/todo-import/utils/todo-import.view-model';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { IS_IOS_APP_ON_MAC } from '@src/shared/infra/device/device-info';
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
  type QueryErrorFallbackProps,
  ReadableContent,
  SettingsListGroup,
  Spacing,
  STACK_BACK_ICON,
  Steps,
  StyledSafeAreaView,
  Text,
  TextButton,
  useAppToast,
  useOpenSheet,
  usePaneSizeClass,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, usePrefetchQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type NavigationAction, router, Stack, useNavigation, usePreventRemove } from 'expo-router';
import { type ReactNode, Suspense, useDeferredValue, useState } from 'react';
import { type UseFormReturn, useForm, useFormState, useWatch } from 'react-hook-form';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { isMatching, match } from 'ts-pattern';

type TodoImportStepContexts = Record<TodoImportStep, Record<string, never>>;

const TODO_IMPORT_STEPS = [
  'permission',
  'calendars',
  'categories',
  'options',
] as const satisfies readonly TodoImportStep[];

type TodoImportForm = UseFormReturn<TodoImportFormValues>;

const MODE_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(ReduceMotion.System);
const DOWN_ARROW_SIZE = 20;

interface StepProps {
  form: TodoImportForm;
  /** 단계 제목 위 진행 점 */
  progress: ReactNode;
}

export default function TodoImportSetupScreen() {
  const { t } = useTranslation('todoImport');

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
  const navigation = useNavigation();
  const isCompact = usePaneSizeClass() === 'compact';
  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());
  // 이미 허용한 기기는 안내를 건너뛴다. 단계는 URL로 복원하지 않는다
  const [initialStep] = useState<TodoImportStep>(() =>
    permission.status === 'granted' ? 'calendars' : 'permission',
  );
  const stepper = useStepper<TodoImportStepContexts>({
    id: 'todo-import',
    initial: { step: initialStep },
    onStepChange: ({ step }) => trackEvent('todo_import_step_viewed', { step }),
  });
  const [isLeaving, setIsLeaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(todoImportFormSchema),
    defaultValues: {
      startDate: todayKey,
      endDate: getRangeEndDate(todayKey, IMPORT_RANGE_PRESETS.month),
      collectionKeys: null,
      collections: [],
      targets: {},
      categoryMode: 'single',
      singleTarget: null,
      timeMode: 'TIME',
      visibility: 'PRIVATE',
    },
    mode: 'onChange',
  });

  const isPastFirstStep = stepper.index > 0;
  const firstStepOrder = TODO_IMPORT_STEPS.indexOf(initialStep);
  // 휴대폰의 헤더 뒤로 가기·iOS 밀어서 뒤로 가기는 화면을 닫지 않고 앞 단계로 돌아가 고른 값을 지킨다.
  // 넓은 화면은 메뉴가 상세를 걷어 내며 바꾸므로 막지 않고, 밀어서 닫기만 끈다
  const disablePrevention = usePreventRemove(
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
  const handleStepBack = useSingleTap(() => stepper.history.back());

  // 시작을 기다리는 사이 떠났으면 보던 화면 위로 끌고 가지 않는다. 진행 중인 가져오기는 메뉴 행이 알린다
  const leaveToImport = (importId: string) => {
    if (!navigation.isFocused()) {
      return;
    }
    setIsLeaving(true);
    disablePrevention();
    router.replace({ pathname: '/todo-import/[importId]', params: { importId } });
  };
  // 점은 단계 제목 위 같은 흐름에 둬 넓은 화면·큰 글자에서도 제목과 겹치지 않는다
  const progress = (
    <Steps.Dots
      index={TODO_IMPORT_STEPS.indexOf(stepper.step) - firstStepOrder}
      count={TODO_IMPORT_STEPS.length - firstStepOrder}
    />
  );
  const goBackToCategories = () => {
    const index = stepper.historySteps.findIndex((entry) => entry.step === 'categories');
    if (0 <= index && index < stepper.index) {
      stepper.history.go(index - stepper.index);
    }
  };

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
      <Stack.Screen options={{ gestureEnabled: isCompact || !isPastFirstStep }} />

      <stepper.Render
        permission={() => (
          <PermissionStep
            progress={progress}
            onGranted={() => stepper.history.replace('calendars')}
          />
        )}
        calendars={() => (
          <CalendarsStep
            form={form}
            progress={progress}
            onNext={() => stepper.history.push('categories')}
          />
        )}
        categories={() => (
          <QueryErrorBoundary
            fallback={(props) => <CategoriesStep.Error {...props} progress={progress} />}
          >
            <Suspense fallback={<CategoriesStep.Loading progress={progress} />}>
              <CategoriesStep
                form={form}
                progress={progress}
                onNext={() => stepper.history.push('options')}
              />
            </Suspense>
          </QueryErrorBoundary>
        )}
        options={() => (
          <OptionsStep
            form={form}
            progress={progress}
            onStarted={leaveToImport}
            onTargetsRejected={goBackToCategories}
          />
        )}
      />
    </VStack>
  );
}

function PermissionStep({ progress, onGranted }: { progress: ReactNode; onGranted: () => void }) {
  const { t } = useTranslation(['todoImport', 'common']);
  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());
  const request = useMutation(useRequestCalendarPermissionMutationOptions());
  const openSettings = useOpenAppSettings();

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
      .catch(noop);
  };

  return (
    <FormStepLayout
      title={t('permission.title')}
      progress={progress}
      footer={match(view)
        .with('ask', () => (
          <KeyboardAdaptiveButton isLoading={request.isPending} onPress={handleContinue}>
            {t('permission.continue')}
          </KeyboardAdaptiveButton>
        ))
        // 거절한 뒤에는 다시 조르지 않고 설정 열기만 둔다. Mac(Designed for iPad)은 앱 설정 화면이 열리지 않아
        // 글로 가는 길만 보인다
        .with('denied', 'blocked', () =>
          IS_IOS_APP_ON_MAC ? null : (
            <KeyboardAdaptiveButton onPress={openSettings}>
              {t('permission.openSettings')}
            </KeyboardAdaptiveButton>
          ),
        )
        .exhaustive()}
    >
      <CalendarPermissionPrompt view={view} />
    </FormStepLayout>
  );
}

function CalendarsStep({ form, progress, onNext }: StepProps & { onNext: () => void }) {
  const { t } = useTranslation(['todoImport', 'common']);
  const openSheet = useOpenSheet();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const [range, setRange] = useImportRange(form);
  const [collectionKeys, setCollectionKeys] = useSelectedCollectionKeys(form);
  // 기간을 바꿔 다시 읽는 동안 앞 목록을 흐리게 두고 스켈레톤으로 바꾸지 않는다
  const listStartDate = useDeferredValue(range.startDate);
  const listEndDate = useDeferredValue(range.endDate);
  const { data: collections } = useQuery(
    useGetImportCollectionsQueryOptions({ startDate: listStartDate, endDate: listEndDate }),
  );
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  const horizonDays =
    snapshot == null ? null : EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);
  const isListStale = listStartDate !== range.startDate || listEndDate !== range.endDate;
  const selected = TodoImportCollectionPolicy.getSelectedCollections(
    collections ?? [],
    collectionKeys,
  );
  const isOverLimit = TodoImportCollectionPolicy.isOverImportLimit(selected);
  const formatDate = (dateKey: DateKey) =>
    formatYearAwareDateKeyLabel(dateKey, todayKey, dateFormatContext);

  const openDateSheet = ({
    title,
    value,
    minimum,
  }: {
    title: string;
    value: DateKey;
    minimum: DateKey;
  }) =>
    openSheet<DateKey>((close) => (
      <ImportDateSheet
        title={title}
        value={value}
        onChange={close}
        minimum={minimum}
        maximum={lastAllowedDate}
      />
    ));

  const handleStartPress = async () => {
    const startDate = await openDateSheet({
      title: t('range.start'),
      value: range.startDate,
      minimum: todayKey,
    });
    if (startDate != null) {
      setRange({ startDate, endDate: range.endDate < startDate ? startDate : range.endDate });
    }
  };

  const handleEndPress = async () => {
    const endDate = await openDateSheet({
      title: t('range.end'),
      value: range.endDate,
      minimum: range.startDate,
    });
    if (endDate != null) {
      setRange({ ...range, endDate });
    }
  };

  const handleNext = () => {
    form.setValue('collections', selected, { shouldDirty: true });
    onNext();
  };

  return (
    <FormStepLayout
      title={t('calendars.title')}
      progress={progress}
      footer={
        // 위 간격은 스크롤에 잘린 목록 끝과 요약 글을 떼어 놓는다
        <VStack className="gap-2 pt-3">
          {/* 버튼이 왜 꺼졌는지 목록 끝까지 내리지 않아도 버튼 바로 위에서 보인다 */}
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            {isOverLimit ? (
              <InlineAlert
                status="danger"
                title={t('calendars.tooMany', { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT })}
              />
            ) : (
              <VStack gap={2}>
                <Text size="b4" shade={6} align="center" className="tabular-nums">
                  {t('calendars.selectedCount', {
                    count: TodoImportCollectionPolicy.calculateItemCount(selected),
                  })}
                </Text>
                {/* 더 고를 수 없어 막힌 캘린더 줄의 이유 */}
                {TodoImportCollectionPolicy.isAtCollectionLimit(selected) && (
                  <Text size="b4" shade={6} align="center">
                    {t('calendars.collectionLimit', { limit: TODO_IMPORT_LIMITS.MAX_COLLECTIONS })}
                  </Text>
                )}
              </VStack>
            )}
          </StyledSafeAreaView>
          <KeyboardAdaptiveButton
            isDisabled={selected.length === 0 || isOverLimit || isListStale}
            onPress={handleNext}
          >
            {t('common:actions.continue')}
          </KeyboardAdaptiveButton>
        </VStack>
      }
    >
      <LastTodoImportRow className="mb-5" />

      <WordWrapText size="b3" shade={6}>
        {t('calendars.description')}
      </WordWrapText>

      <Spacing size={20} />

      <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
        {t('range.title')}
      </Text>
      <Spacing size={8} />
      <SettingsListGroup>
        <SettingsListGroup.Item
          label={t('range.start')}
          value={<SettingsListGroup.Value>{formatDate(range.startDate)}</SettingsListGroup.Value>}
          accessibilityLabel={`${t('range.start')}, ${formatDate(range.startDate)}`}
          onPress={handleStartPress}
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item
          label={t('range.end')}
          value={<SettingsListGroup.Value>{formatDate(range.endDate)}</SettingsListGroup.Value>}
          accessibilityLabel={`${t('range.end')}, ${formatDate(range.endDate)}`}
          onPress={handleEndPress}
        />
      </SettingsListGroup>
      <Spacing size={12} />
      <QueryErrorBoundary fallback={ImportEndDateChips.Error}>
        <Suspense fallback={<ImportEndDateChips.Loading />}>
          <ImportEndDateChips
            startDate={range.startDate}
            value={range.endDate}
            onValueChange={(endDate) => setRange({ ...range, endDate })}
            accessibilityLabel={t('range.title')}
          />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={24} />

      <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
        {t('calendars.listTitle')}
      </Text>
      <Spacing size={8} />
      <Box className={cn(isListStale && 'opacity-50')}>
        <QueryErrorBoundary
          fallback={CalendarSourceList.Error}
          resetKeys={[listStartDate, listEndDate]}
        >
          <Suspense fallback={<CalendarSourceList.Loading />}>
            <CalendarSourceList
              startDate={listStartDate}
              endDate={listEndDate}
              value={collectionKeys}
              onValueChange={setCollectionKeys}
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

function CategoriesStep({ form, progress, onNext }: StepProps & { onNext: () => void }) {
  const { t } = useTranslation(['todoImport', 'common']);
  const fontScaledSize = useFontScaledSize();
  const [collections] = useWatch({ control: form.control, name: ['collections'] });
  const [{ categoryMode, singleTarget, targets }, setTargetChoice] = useTargetChoice(form);
  const errorMessages = useTargetErrorMessages(form, collections);
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  // 넣을 곳 시트가 기다리지 않고 바로 올라오도록 요금제(새 카테고리 자리)를 미리 받아 둔다
  usePrefetchQuery(useGetEntitlementsQueryOptions());
  const names = useNewCategoryNames();
  const formatTargetName = useFormatImportTargetName();
  const openTargetSheet = useOpenCategoryTargetSheet();
  const [isModeSwitched, setIsModeSwitched] = useState(false);

  const { categories } = categoriesResult;
  const defaultTarget = getDefaultTarget(
    categories,
    toNewCategoryTarget(null, { palette: CATEGORY_COLORS, names }),
  );
  const destination = singleTarget ?? defaultTarget;
  const mode = resolveCategoryMode(collections, categoryMode);
  const assignedTargets = resolveImportTargets(
    collections,
    { categoryMode, singleTarget, targets },
    defaultTarget,
  );
  // 고른 카테고리를 그사이 삭제했으면 다시 고를 때까지 넘기지 않는다
  const hasMissingTarget = Object.values(assignedTargets).some((target) =>
    TodoImportTargetPolicy.isMissingCategory(target, categories),
  );
  const hasRejectedTargets = Object.keys(errorMessages).length > 0;
  const canSplit = 1 < collections.length;
  const [firstCollection] = collections;
  // 처음 그릴 때(앞 단계에서 돌아올 때 포함)는 그대로 두고, 넣는 방법을 바꿀 때만 스며들듯 바뀐다
  const modeEntering = isModeSwitched ? MODE_ENTERING : undefined;
  const downArrowSize = fontScaledSize(DOWN_ARROW_SIZE);

  const switchMode = (nextMode: TodoImportCategoryMode) => {
    setIsModeSwitched(true);
    setTargetChoice({ categoryMode: nextMode });
  };

  const openDestinationSheet = () => {
    if (firstCollection == null) {
      return;
    }
    openTargetSheet({
      subject: canSplit
        ? { kind: 'allCalendars', collections }
        : { kind: 'calendar', collection: firstCollection },
      current: destination,
      otherTargets: [],
      onChoose: (target) => setTargetChoice({ singleTarget: target }),
    });
  };

  const openCalendarSheet = (collection: ImportCollection) => {
    const current = assignedTargets[collection.collectionKey];
    if (current == null) {
      return;
    }
    openTargetSheet({
      subject: { kind: 'calendar', collection },
      current,
      otherTargets: collections.flatMap(({ collectionKey }) => {
        const target = assignedTargets[collectionKey];
        return collectionKey === collection.collectionKey || target == null ? [] : [target];
      }),
      onChoose: (target) =>
        setTargetChoice({
          targets: { ...form.getValues('targets'), [collection.collectionKey]: target },
        }),
    });
  };

  const handleNext = () => {
    // 처음 넣을 곳을 고른 값으로 고정해 옵션 단계와 시작 요청이 화면에 보인 곳 그대로 보낸다
    form.setValue('singleTarget', destination, { shouldDirty: true });
    onNext();
  };

  return (
    <FormStepLayout
      title={t('categories.title')}
      progress={progress}
      footer={
        <VStack className="gap-2 pt-3">
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            <QueryErrorBoundary fallback={ImportPlacementSummary.Error}>
              <Suspense fallback={<ImportPlacementSummary.Loading />}>
                <ImportPlacementSummary
                  collections={collections}
                  targets={assignedTargets}
                  destination={destination}
                  mode={mode}
                />
              </Suspense>
            </QueryErrorBoundary>
          </StyledSafeAreaView>
          <KeyboardAdaptiveButton isDisabled={hasMissingTarget} onPress={handleNext}>
            {t('common:actions.continue')}
          </KeyboardAdaptiveButton>
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

      {/* 고른 값은 폼에 남아 넣는 방법을 다시 바꾸면 돌아온다 */}
      {match(mode)
        .with('single', () => (
          <Animated.View key="single" entering={modeEntering}>
            <Spacing size={24} />

            <HStack align="center" gap={6}>
              <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
                {t('categories.sourceLabel')}
              </Text>
              <ImportHintButton
                label={t('categories.sourceHintLabel')}
                description={t('categories.sourceHint', {
                  missingHelp: t('calendars.missingHelp.open'),
                })}
              />
            </HStack>
            <Spacing size={8} />
            <ImportSourceList collections={collections} />

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
              <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
                {t('categories.destinationLabel')}
              </Text>
              <ImportHintButton
                label={t('categories.destinationHintLabel')}
                description={t('categories.destinationHint')}
              />
            </HStack>
            <Spacing size={8} />
            <QueryErrorBoundary fallback={ImportDestinationButton.Error}>
              <Suspense fallback={<ImportDestinationButton.Loading />}>
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
                  <ImportDestinationButton
                    target={destination}
                    collections={collections}
                    errorMessage={Object.values(errorMessages)[0] ?? null}
                    onPress={openDestinationSheet}
                  />
                </CoachmarkPopover>
              </Suspense>
            </QueryErrorBoundary>

            {canSplit && (
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
              <Text size="b2" weight="semibold" shade={9} accessibilityRole="header">
                {t('categories.separate.title')}
              </Text>
              <TextButton onPress={() => switchMode('single')}>
                {t('categories.separate.joinAll')}
              </TextButton>
            </HStack>
            <Spacing size={8} />
            <QueryErrorBoundary fallback={CategoryMappingList.Error}>
              <Suspense fallback={<CategoryMappingList.Loading rowCount={collections.length} />}>
                <CategoryMappingList
                  collections={collections}
                  targets={assignedTargets}
                  errorMessages={errorMessages}
                  onItemPress={openCalendarSheet}
                />
              </Suspense>
            </QueryErrorBoundary>
            <Spacing size={8} />
            <WordWrapText size="b4" shade={6}>
              {t('categories.separate.note', {
                // 문장 안에서는 "새 · " 표시 없이 이름만 쓴다
                name: findTargetAppearance(destination, categories)?.name ?? formatTargetName(null),
              })}
            </WordWrapText>
          </Animated.View>
        ))
        .exhaustive()}
    </FormStepLayout>
  );
}

/** 받은 뒤와 같은 제목·설명·넣을 곳 카드 자리 */
CategoriesStep.Loading = function Loading({ progress }: Pick<StepProps, 'progress'>) {
  const { t } = useTranslation(['todoImport', 'common']);

  return (
    <FormStepLayout
      title={t('categories.title')}
      progress={progress}
      footer={
        <KeyboardAdaptiveButton isDisabled>{t('common:actions.continue')}</KeyboardAdaptiveButton>
      }
    >
      <WordWrapText size="b3" shade={6}>
        {t('categories.description')}
      </WordWrapText>
      <Spacing size={24} />
      <ImportDestinationButton.Loading />
    </FormStepLayout>
  );
};

/** 아이두 카테고리를 읽지 못하면 넣을 곳을 고를 수 없어 이 단계 안에서 다시 시도한다 */
CategoriesStep.Error = function ErrorFallback({
  progress,
  reset,
}: Pick<StepProps, 'progress'> & QueryErrorFallbackProps) {
  const { t } = useTranslation(['todoImport', 'common']);

  return (
    <FormStepLayout
      title={t('categories.title')}
      progress={progress}
      footer={
        <KeyboardAdaptiveButton isDisabled>{t('common:actions.continue')}</KeyboardAdaptiveButton>
      }
    >
      <QueryErrorFallback.Inline
        message={t('categories.loadFailed')}
        reset={reset}
        className="rounded-2xl bg-gray-1 px-4 py-3"
      />
    </FormStepLayout>
  );
};

function OptionsStep({
  form,
  progress,
  onStarted,
  onTargetsRejected,
}: StepProps & {
  onStarted: (importId: string) => void;
  onTargetsRejected: () => void;
}) {
  const { t } = useTranslation('todoImport');
  const toast = useAppToast();
  const accountId = useMyAccountId();
  const calendarImportGate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const [{ timeMode, visibility }, setImportOptions] = useImportOptions(form);
  const startImport = useMutation(useStartTodoImportMutationOptions());

  // 실패는 RHF가 실패로 알아 다시 누를 수 있게 handleSubmit 밖 호출부에서 받는다
  const saveImport = form.handleSubmit(async (values) => {
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
    const activeImportId = findActiveTodoImportId(error);
    if (activeImportId != null) {
      onStarted(activeImportId);
      return;
    }
    if (calendarImportGate.promptIfBlockedError(error)) {
      return;
    }
    const rejections = findRejectedTargets(error);
    if (rejections.length > 0) {
      showRejectedTargets(form, rejections, toRejectionMessage);
      onTargetsRejected();
    }
  };

  const toRejectionMessage = (rejection: TodoImportTargetRejection) =>
    match(rejection.reason)
      .with('CAPACITY', () =>
        t('categories.rejected.capacity', {
          expected: rejection.expected ?? 0,
          count: calculateRemainingCapacity(rejection),
        }),
      )
      .with('CATEGORY_NAME_TAKEN', () => t('categories.rejected.nameTaken'))
      .with('CATEGORY_NOT_FOUND', () => t('categories.rejected.notFound'))
      .exhaustive();

  const handleImportPress = useSingleTap(() => {
    saveImport().catch(handleStartError);
  });

  return (
    <FormStepLayout
      title={t('options.title')}
      progress={progress}
      footer={
        <VStack gap={8}>
          <StyledSafeAreaView edges={['left', 'right']} className="px-4">
            <WordWrapText size="b4" shade={6} align="center">
              {t('options.disclosure')}
            </WordWrapText>
          </StyledSafeAreaView>
          <KeyboardAdaptiveButton
            isLoading={startImport.isPending}
            isDisabled={accountId == null}
            onPress={handleImportPress}
          >
            {t('options.import')}
          </KeyboardAdaptiveButton>
        </VStack>
      }
    >
      <SettingsListGroup>
        <SettingsListGroup.Toggle
          label={t('options.includeTime')}
          description={t('options.includeTimeDescription')}
          isSelected={timeMode === 'TIME'}
          onSelectedChange={(isSelected) =>
            setImportOptions({ timeMode: isSelected ? 'TIME' : 'DATE_ONLY' })
          }
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Toggle
          label={t('options.shareWithFriends')}
          description={t('options.shareWithFriendsDescription')}
          isSelected={visibility === 'PUBLIC'}
          onSelectedChange={(isSelected) =>
            setImportOptions({ visibility: isSelected ? 'PUBLIC' : 'PRIVATE' })
          }
        />
      </SettingsListGroup>
    </FormStepLayout>
  );
}

function useImportRange(form: TodoImportForm) {
  const [startDate, endDate] = useWatch({ control: form.control, name: ['startDate', 'endDate'] });
  const setRange = (range: { startDate: DateKey; endDate: DateKey }) => {
    form.setValue('startDate', range.startDate, { shouldDirty: true, shouldValidate: true });
    form.setValue('endDate', range.endDate, { shouldDirty: true, shouldValidate: true });
  };

  return [{ startDate, endDate }, setRange] as const;
}

function useSelectedCollectionKeys(form: TodoImportForm) {
  const [collectionKeys] = useWatch({ control: form.control, name: ['collectionKeys'] });
  const setCollectionKeys = (keys: string[]) =>
    form.setValue('collectionKeys', keys, { shouldDirty: true });

  return [collectionKeys, setCollectionKeys] as const;
}

function useTargetChoice(form: TodoImportForm) {
  const [categoryMode, singleTarget, targets] = useWatch({
    control: form.control,
    name: ['categoryMode', 'singleTarget', 'targets'],
  });
  // 서버가 거절한 표시는 그곳을 바꾸면 지운다. 다른 캘린더의 표시는 그 캘린더를 바꿀 때까지 남긴다.
  // 캘린더마다 고른 값은 한 곳에 넣는 동안에도 남겨 다시 나누면 돌아온다
  const setTargetChoice = (choice: {
    categoryMode?: TodoImportCategoryMode;
    singleTarget?: ImportTarget;
    targets?: Record<string, ImportTarget>;
  }) => {
    if (choice.categoryMode != null) {
      form.setValue('categoryMode', choice.categoryMode, { shouldDirty: true });
    }
    if (choice.singleTarget != null) {
      form.clearErrors('targets');
      form.setValue('singleTarget', choice.singleTarget, { shouldDirty: true });
    }
    if (choice.targets != null) {
      const previous = form.getValues('targets');
      for (const [collectionKey, target] of Object.entries(choice.targets)) {
        if (previous[collectionKey] !== target) {
          form.clearErrors(`targets.${collectionKey}`);
        }
      }
      form.setValue('targets', choice.targets, { shouldDirty: true });
    }
  };

  return [{ categoryMode, singleTarget, targets }, setTargetChoice] as const;
}

function useImportOptions(form: TodoImportForm) {
  const [timeMode, visibility] = useWatch({
    control: form.control,
    name: ['timeMode', 'visibility'],
  });
  const setImportOptions = (
    options: Partial<Pick<TodoImportFormValues, 'timeMode' | 'visibility'>>,
  ) => {
    if (options.timeMode != null) {
      form.setValue('timeMode', options.timeMode, { shouldDirty: true });
    }
    if (options.visibility != null) {
      form.setValue('visibility', options.visibility, { shouldDirty: true });
    }
  };

  return [{ timeMode, visibility }, setImportOptions] as const;
}

function useTargetErrorMessages(
  form: TodoImportForm,
  collections: TodoImportFormValues['collections'],
) {
  const { errors } = useFormState({ control: form.control, name: 'targets' });

  return Object.fromEntries(
    collections.flatMap(({ collectionKey }) => {
      const message = errors.targets?.[collectionKey]?.message;
      return message == null ? [] : [[collectionKey, message]];
    }),
  );
}

function showRejectedTargets(
  form: TodoImportForm,
  rejections: readonly TodoImportTargetRejection[],
  toMessage: (rejection: TodoImportTargetRejection) => string,
) {
  const values = form.getValues();
  const selection = toTodoImportSelection(values);
  for (const rejection of rejections) {
    const message = toMessage(rejection);
    for (const collection of selection.collections) {
      if (collection.targetKey === rejection.targetKey) {
        form.setError(`targets.${collection.collectionKey}`, { type: 'server', message });
      }
    }
  }
}

/** 헤더 뒤로 가기와 iOS 밀어서 뒤로 가기는 한 칸 pop이다. 탭 다시 누르기·메뉴 이동은 그대로 보낸다 */
function isSingleStepBack(action: NavigationAction) {
  return (
    isMatching({ type: 'GO_BACK' }, action) ||
    isMatching({ type: 'POP', payload: { count: 1 } }, action)
  );
}
