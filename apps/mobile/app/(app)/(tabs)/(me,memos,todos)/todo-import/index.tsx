import { TODO_IMPORT_LIMITS, TODO_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { resolveImportTargets } from '@src/features/planning/todo-import/apis/todo-import-target.mapper';
import { toTodoImportSelection } from '@src/features/planning/todo-import/apis/todo-import.mapper';
import { CalendarPermissionPrompt } from '@src/features/planning/todo-import/components/calendar-permission-prompt';
import { CalendarSourceList } from '@src/features/planning/todo-import/components/calendar-source-list';
import { CategoryMappingList } from '@src/features/planning/todo-import/components/category-mapping-list';
import { ImportDateSheet } from '@src/features/planning/todo-import/components/import-date-sheet';
import { ImportEndDateChips } from '@src/features/planning/todo-import/components/import-end-date-chips';
import { LastTodoImportRow } from '@src/features/planning/todo-import/components/last-todo-import-row';
import { MissingCalendarHelp } from '@src/features/planning/todo-import/components/missing-calendar-help';
import { IMPORT_RANGE_PRESETS } from '@src/features/planning/todo-import/constants/todo-import.constants';
import type { TodoImportStep } from '@src/features/planning/todo-import/constants/todo-import.events';
import { TodoImportCollectionPolicy } from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import {
  hasTargetOverCapacity,
  type ImportTarget,
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
import { useNewCategoryNames } from '@src/features/planning/todo-import/hooks/use-new-category-names';
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
import { getCalendarPermissionView } from '@src/features/planning/todo-import/utils/todo-import.view-model';
import { useTrack } from '@src/shared/analytics';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { IS_IOS_APP_ON_MAC } from '@src/shared/infra/device/device-info';
import {
  Box,
  FormStepLayout,
  InlineAlert,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  ReadableContent,
  SettingsListGroup,
  Spacing,
  STACK_BACK_ICON,
  Steps,
  StyledSafeAreaView,
  Text,
  useAppToast,
  useOpenSheet,
  usePaneSizeClass,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type NavigationAction, router, Stack, useNavigation, usePreventRemove } from 'expo-router';
import { Suspense, useDeferredValue, useState } from 'react';
import { type UseFormReturn, useForm, useFormState, useWatch } from 'react-hook-form';
import { isMatching, match } from 'ts-pattern';

type TodoImportStepContexts = Record<TodoImportStep, Record<string, never>>;

const TODO_IMPORT_STEPS = [
  'permission',
  'calendars',
  'categories',
  'options',
] as const satisfies readonly TodoImportStep[];

type TodoImportForm = UseFormReturn<TodoImportFormValues>;

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
      {!isCompact && isPastFirstStep && <Stack.Screen options={{ gestureEnabled: false }} />}

      {/* 단계 글이 점 뒤로 비쳐 보이지 않게 위에 불투명하게 얹는다 */}
      <StyledSafeAreaView edges={['left', 'right']} className="z-10 bg-white px-4 pt-3 pb-1">
        <Steps.Dots
          index={TODO_IMPORT_STEPS.indexOf(stepper.step) - firstStepOrder}
          count={TODO_IMPORT_STEPS.length - firstStepOrder}
        />
      </StyledSafeAreaView>

      <stepper.Render
        permission={() => <PermissionStep onGranted={() => stepper.history.replace('calendars')} />}
        calendars={() => (
          <CalendarsStep form={form} onNext={() => stepper.history.push('categories')} />
        )}
        categories={() => (
          <CategoriesStep form={form} onNext={() => stepper.history.push('options')} />
        )}
        options={() => (
          <OptionsStep
            form={form}
            onStarted={leaveToImport}
            onTargetsRejected={goBackToCategories}
          />
        )}
      />
    </VStack>
  );
}

function PermissionStep({ onGranted }: { onGranted: () => void }) {
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
      footer={match(view)
        .with('ask', () => (
          <KeyboardAdaptiveButton isLoading={request.isPending} onPress={handleContinue}>
            {t('common:actions.continue')}
          </KeyboardAdaptiveButton>
        ))
        .with('denied', () => null)
        // Mac(Designed for iPad)은 앱 설정 화면이 열리지 않아 글로 가는 길만 보인다
        .with('blocked', () =>
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

function CalendarsStep({ form, onNext }: { form: TodoImportForm; onNext: () => void }) {
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
      footer={
        <VStack gap={8}>
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

function CategoriesStep({ form, onNext }: { form: TodoImportForm; onNext: () => void }) {
  const { t } = useTranslation(['todoImport', 'common']);
  const [collections] = useWatch({ control: form.control, name: ['collections'] });
  const [targets, setTargets] = useCollectionTargets(form);
  const errorMessages = useTargetErrorMessages(form, collections);
  const hasRejectedTargets = Object.keys(errorMessages).length > 0;
  const { data: categoriesResult } = useQuery(useGetTodoCategoriesQueryOptions());
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const newCategoryNames = useNewCategoryNames();

  // 목록이 보이는 연결과 같은 규칙으로 고른다. 받기 전에는 null이다
  const resolvedTargets =
    categoriesResult == null || snapshot == null
      ? null
      : resolveImportTargets(collections, targets, {
          categories: categoriesResult.categories,
          remainingCategorySlots: EntitlementPolicy.findRemainingCount(snapshot, 'TODO_CATEGORY'),
          palette: CATEGORY_COLORS,
          names: newCategoryNames,
        });
  const mayRunOutOfRoom =
    resolvedTargets != null &&
    categoriesResult != null &&
    hasTargetOverCapacity(collections, resolvedTargets, categoriesResult.categories);

  const handleNext = () => {
    if (resolvedTargets == null) {
      return;
    }
    // 기본 연결을 고른 값으로 고정해 옵션 단계와 시작 요청이 화면에 보인 연결 그대로 보낸다
    setTargets(resolvedTargets);
    onNext();
  };

  return (
    <FormStepLayout
      title={t('categories.title')}
      footer={
        <VStack gap={8}>
          {/* 넘쳐도 가져오기는 막지 않는다. 서버가 가까운 날짜부터 넣고 나머지를 건너뛴다 */}
          {mayRunOutOfRoom && (
            <StyledSafeAreaView edges={['left', 'right']} className="px-4">
              <InlineAlert
                status="warning"
                title={t('categories.capacityWarning.title')}
                description={t('categories.capacityWarning.description', {
                  limit: TODO_LIMITS.MAX_PER_CATEGORY,
                })}
              />
            </StyledSafeAreaView>
          )}
          <KeyboardAdaptiveButton isDisabled={resolvedTargets == null} onPress={handleNext}>
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

      <Spacing size={20} />

      <QueryErrorBoundary fallback={CategoryMappingList.Error}>
        <Suspense fallback={<CategoryMappingList.Loading rowCount={collections.length} />}>
          <CategoryMappingList
            collections={collections}
            value={targets}
            onValueChange={setTargets}
            errorMessages={errorMessages}
          />
        </Suspense>
      </QueryErrorBoundary>
    </FormStepLayout>
  );
}

function OptionsStep({
  form,
  onStarted,
  onTargetsRejected,
}: {
  form: TodoImportForm;
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
      selection: toTodoImportSelection(values, values.targets),
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
          accessibilityRole="switch"
          accessibilityState={{ checked: timeMode === 'TIME' }}
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Toggle
          label={t('options.shareWithFriends')}
          description={t('options.shareWithFriendsDescription')}
          isSelected={visibility === 'PUBLIC'}
          onSelectedChange={(isSelected) =>
            setImportOptions({ visibility: isSelected ? 'PUBLIC' : 'PRIVATE' })
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: visibility === 'PUBLIC' }}
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

function useCollectionTargets(form: TodoImportForm) {
  const [targets] = useWatch({ control: form.control, name: ['targets'] });
  // 서버가 거절한 다른 캘린더의 표시는 그 캘린더를 바꿀 때까지 남긴다
  const setTargets = (next: Record<string, ImportTarget>) => {
    for (const [collectionKey, target] of Object.entries(next)) {
      if (targets[collectionKey] !== target) {
        form.clearErrors(`targets.${collectionKey}`);
      }
    }
    form.setValue('targets', next, { shouldDirty: true });
  };

  return [targets, setTargets] as const;
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
  const selection = toTodoImportSelection(values, values.targets);
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
