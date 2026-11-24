import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
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
import { MissingCalendarHelp } from '@src/features/planning/todo-import/components/missing-calendar-help';
import { IMPORT_RANGE_PRESETS } from '@src/features/planning/todo-import/constants/todo-import.constants';
import type { TodoImportStep } from '@src/features/planning/todo-import/constants/todo-import.events';
import { TodoImportCollectionPolicy } from '@src/features/planning/todo-import/domains/todo-import-collection.model';
import type { ImportTarget } from '@src/features/planning/todo-import/domains/todo-import-target.model';
import {
  findActiveTodoImportId,
  findRejectedTargets,
  type TodoImportTargetRejection,
} from '@src/features/planning/todo-import/domains/todo-import.error';
import {
  findLastAllowedDate,
  getRangeEndDate,
} from '@src/features/planning/todo-import/domains/todo-import.model';
import {
  useGetCalendarPermissionQueryOptions,
  useGetImportCollectionsQueryOptions,
} from '@src/features/planning/todo-import/queries/todo-import-source.queries';
import { useStartTodoImportMutationOptions } from '@src/features/planning/todo-import/queries/todo-import.mutations';
import {
  todoImportFormSchema,
  type TodoImportFormValues,
} from '@src/features/planning/todo-import/schemas/todo-import-form.schema';
import { useTrack } from '@src/shared/analytics';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FormStepLayout,
  InlineAlert,
  KeyboardAdaptiveButton,
  ListRow,
  QueryErrorBoundary,
  ReadableContent,
  SettingsListGroup,
  Spacing,
  Steps,
  Text,
  useAppToast,
  useOpenSheet,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { sumBy } from 'es-toolkit';
import { router, Stack } from 'expo-router';
import { Suspense } from 'react';
import { type UseFormReturn, useForm, useFormState, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';

type TodoImportStepContexts = Record<TodoImportStep, Record<string, never>>;

type TodoImportForm = UseFormReturn<TodoImportFormValues>;

export default function TodoImportSetupScreen() {
  const { t } = useTranslation('todoImport');

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('titles.setup') }} />

      <ReadableContent flex={1}>
        <QueryErrorBoundary fallback={CalendarPermissionPrompt.Error}>
          <Suspense fallback={<CalendarPermissionPrompt.Loading />}>
            <TodoImportSetup />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </Box>
  );
}

function TodoImportSetup() {
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();
  const { data: permission } = useSuspenseQuery(useGetCalendarPermissionQueryOptions());
  // 이미 허용한 기기는 안내를 건너뛴다. 단계는 URL로 복원하지 않는다
  const stepper = useStepper<TodoImportStepContexts>({
    id: 'todo-import',
    initial: { step: permission.status === 'granted' ? 'calendars' : 'permission' },
    onStepChange: ({ step }) => trackEvent('todo_import_step_viewed', { step }),
  });
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

  const stepCount = stepper.historySteps[0]?.step === 'permission' ? 4 : 3;
  const goBackToCategories = () => {
    const index = stepper.historySteps.findIndex((entry) => entry.step === 'categories');
    if (0 <= index && index < stepper.index) {
      stepper.history.go(index - stepper.index);
    }
  };

  return (
    <VStack flex={1}>
      <Box className="px-4 pt-3">
        <Steps.Dots index={stepper.index} count={stepCount} />
      </Box>

      <stepper.Render
        permission={() => <PermissionStep onGranted={() => stepper.history.push('calendars')} />}
        calendars={() => (
          <CalendarsStep form={form} onNext={() => stepper.history.push('categories')} />
        )}
        categories={() => (
          <CategoriesStep form={form} onNext={() => stepper.history.push('options')} />
        )}
        options={() => <OptionsStep form={form} onTargetsRejected={goBackToCategories} />}
      />
    </VStack>
  );
}

function PermissionStep({ onGranted }: { onGranted: () => void }) {
  const { t } = useTranslation('todoImport');

  return (
    <FormStepLayout title={t('permission.title')}>
      <QueryErrorBoundary fallback={CalendarPermissionPrompt.Error}>
        <Suspense fallback={<CalendarPermissionPrompt.Loading />}>
          <CalendarPermissionPrompt onGranted={onGranted} />
        </Suspense>
      </QueryErrorBoundary>
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
  const { data: collections } = useQuery(useGetImportCollectionsQueryOptions(range));
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  const horizonDays =
    snapshot == null ? null : EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);
  const selected = TodoImportCollectionPolicy.getSelectedCollections(
    collections ?? [],
    collectionKeys,
  );
  const selectedItemCount = sumBy(selected, (collection) => collection.itemCount);
  const isOverLimit = TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT < selectedItemCount;
  const formatDate = (dateKey: DateKey) =>
    formatYearAwareDateKeyLabel(dateKey, todayKey, dateFormatContext);

  const openDateSheet = (value: DateKey, minimum: DateKey) =>
    openSheet<DateKey>((close) => (
      <ImportDateSheet value={value} onChange={close} minimum={minimum} maximum={lastAllowedDate} />
    ));

  const handleStartPress = async () => {
    const startDate = await openDateSheet(range.startDate, todayKey);
    if (startDate != null) {
      setRange({ startDate, endDate: range.endDate < startDate ? startDate : range.endDate });
    }
  };

  const handleEndPress = async () => {
    const endDate = await openDateSheet(range.endDate, range.startDate);
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
        <KeyboardAdaptiveButton
          isDisabled={selected.length === 0 || isOverLimit}
          onPress={handleNext}
        >
          {t('common:actions.continue')}
        </KeyboardAdaptiveButton>
      }
    >
      <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
        {t('calendars.description')}
      </Text>

      <Spacing size={20} />

      <Text size="b2" weight="semibold" shade={9}>
        {t('range.title')}
      </Text>
      <Spacing size={8} />
      <SettingsListGroup>
        <ListRow
          horizontalPadding="medium"
          verticalPadding="large"
          onPress={handleStartPress}
          accessibilityLabel={`${t('range.start')}, ${formatDate(range.startDate)}`}
          contents={
            <Text size="b2" shade={8}>
              {t('range.start')}
            </Text>
          }
          right={<SettingsListGroup.Value>{formatDate(range.startDate)}</SettingsListGroup.Value>}
        />
        <SettingsListGroup.Separator />
        <ListRow
          horizontalPadding="medium"
          verticalPadding="large"
          onPress={handleEndPress}
          accessibilityLabel={`${t('range.end')}, ${formatDate(range.endDate)}`}
          contents={
            <Text size="b2" shade={8}>
              {t('range.end')}
            </Text>
          }
          right={<SettingsListGroup.Value>{formatDate(range.endDate)}</SettingsListGroup.Value>}
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

      <Text size="b2" weight="semibold" shade={9}>
        {t('calendars.listTitle')}
      </Text>
      <Spacing size={8} />
      <QueryErrorBoundary
        fallback={CalendarSourceList.Error}
        resetKeys={[range.startDate, range.endDate]}
      >
        <Suspense fallback={<CalendarSourceList.Loading />}>
          <CalendarSourceList
            startDate={range.startDate}
            endDate={range.endDate}
            value={collectionKeys}
            onValueChange={setCollectionKeys}
          />
        </Suspense>
      </QueryErrorBoundary>
      <Spacing size={8} />
      <Box className="self-center">
        <MissingCalendarHelp />
      </Box>

      {isOverLimit && (
        <>
          <Spacing size={12} />
          <InlineAlert
            status="danger"
            title={t('calendars.tooMany', { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT })}
          />
        </>
      )}
    </FormStepLayout>
  );
}

function CategoriesStep({ form, onNext }: { form: TodoImportForm; onNext: () => void }) {
  const { t } = useTranslation(['todoImport', 'common']);
  const [collections] = useWatch({ control: form.control, name: ['collections'] });
  const [targets, setTargets] = useCollectionTargets(form);
  const errorMessages = useTargetErrorMessages(form, collections);
  const { data: categoriesResult } = useQuery(useGetTodoCategoriesQueryOptions());
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  const handleNext = () => {
    if (categoriesResult == null || snapshot == null) {
      return;
    }
    // 기본 연결을 고른 값으로 고정해 옵션 단계와 시작 요청이 화면에 보인 연결 그대로 보낸다
    setTargets(
      resolveImportTargets(collections, targets, {
        categories: categoriesResult.categories,
        remainingCategorySlots: EntitlementPolicy.findRemainingCount(snapshot, 'TODO_CATEGORY'),
        palette: CATEGORY_COLORS,
        fallbackName: t('categories.fallbackName'),
      }),
    );
    onNext();
  };

  return (
    <FormStepLayout
      title={t('categories.title')}
      footer={
        <KeyboardAdaptiveButton
          isDisabled={categoriesResult == null || snapshot == null}
          onPress={handleNext}
        >
          {t('common:actions.continue')}
        </KeyboardAdaptiveButton>
      }
    >
      <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
        {t('categories.description')}
      </Text>

      <Spacing size={20} />

      <QueryErrorBoundary fallback={CategoryMappingList.Error}>
        <Suspense fallback={<CategoryMappingList.Loading />}>
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
  onTargetsRejected,
}: {
  form: TodoImportForm;
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
    router.replace({ pathname: '/todo-import/[importId]', params: { importId: todoImport.id } });
  });

  const handleStartError = (error: unknown) => {
    const activeImportId = findActiveTodoImportId(error);
    if (activeImportId != null) {
      router.replace({ pathname: '/todo-import/[importId]', params: { importId: activeImportId } });
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
          count: Math.max((rejection.limit ?? 0) - (rejection.current ?? 0), 0),
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
          <Text
            size="b4"
            shade={6}
            align="center"
            className="px-4"
            lineBreakStrategyIOS="hangul-word"
          >
            {t('options.disclosure')}
          </Text>
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
  const setTargets = (next: Record<string, ImportTarget>) => {
    form.clearErrors('targets');
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
