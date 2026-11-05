import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { CategoryHeaderPill } from '@src/features/todo/components/category-header-pill';
import { SubTodoIndent } from '@src/features/todo/components/sub-todo-indent';
import {
  TodoCheckbox,
  TodoLabel,
  TodoProgress,
  TodoRow,
} from '@src/features/todo/components/todo-row';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { formatRepeatSummary } from '@src/features/todo/utils/format-repeat-summary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DocsIcon,
  HStack,
  LockIcon,
  QueryErrorBoundary,
  Result,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatDateKey,
  formatDateKeyLabel,
  formatDateKeyRange,
  formatTimeOfDay,
} from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Checkbox } from 'heroui-native';
import { type ReactNode, Suspense, useRef } from 'react';
import {
  FormProvider,
  type UseFormReturn,
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { match } from 'ts-pattern';

import { PlanRequestPolicy, preparePlanRequest } from '../../domains/plan-request.model';
import {
  type PlanReviewFormValues,
  toPlanSelection,
  toPlannedActions,
} from '../../domains/plan-review-form.schema';
import { isDuplicateAction, type VoicePlan, VoicePlanPolicy } from '../../domains/voice-plan.model';
import { isSourceMemoMissingError } from '../../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../../queries/use-apply-action-plan-mutation-options';
import {
  getPlanTodoSubtitle,
  parseScheduledTime,
  shouldShowPlanDate,
} from '../../utils/view-models/plan-todo.view-model';
import { PlanTodoEditSheet } from './plan-todo-edit-sheet';

/** 저장 요청의 멱등 키와 내용 지문 */
export interface PlanApplyRequest {
  idempotencyKey: string;
  fingerprint: string;
}

interface PlanApplyRequestStore {
  find: () => PlanApplyRequest | null;
  save: (request: PlanApplyRequest | null) => void;
}

interface PlanReviewProps {
  /** 폼은 화면이 소유한다. `createPlanReviewFormValues`로 만든 값으로 화면이 `useForm`을 만들어 넘긴다 */
  form: UseFormReturn<PlanReviewFormValues>;
  plan: VoicePlan;
  /** 카테고리를 고르지 못한 할 일이 들어갈 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  /** 계획을 만들 때 횟수를 썼는지. false면 빈 결과에서 "횟수는 차감되지 않았어요"를 보여 준다 */
  isCharged?: boolean;
  /** 추가 버튼 왼쪽에 둘 보조 동작(예: 다시 말하기). 카드가 없으면 안내 아래에 둔다 */
  secondaryAction?: ReactNode;
  /** 저장 요청의 키를 화면 밖에 남길 곳. 없으면 이 화면이 떠 있는 동안만 기억한다 */
  requestStore?: PlanApplyRequestStore;
  /** 저장이 끝났다. 화면이 내려간 뒤에 응답이 와도 불리므로 저장 표시를 여기서 남긴다 */
  onSaved?: () => void;
  /** 화면이 떠 있을 때 저장이 끝났다. 초안 정리와 화면 닫기는 화면이 맡는다 */
  onApplied?: () => void;
  /** 메모에서 만든 계획의 원본 메모가 이미 없다. 초안을 버리고 떠나는 일은 화면이 맡는다 */
  onSourceMissing?: () => void;
}

/**
 * 계획 카드 검토. 카드는 실제 할 일 목록 행을 그대로 쓰고 오른쪽에 추가할지 고르는 동그라미만 더한다.
 * 행을 누르면 할 일 추가 시트와 같은 칩·바텀시트로 고친다. 저장은 고른 카드만 보낸다.
 */
export function PlanReview({
  form,
  plan,
  fallbackCategoryId,
  isCharged = true,
  secondaryAction,
  requestStore,
  onSaved,
  onApplied,
  onSourceMissing,
}: PlanReviewProps) {
  const { t } = useTranslation(['voicePlan', 'subscription']);
  const { control, handleSubmit } = form;
  const { fields } = useFieldArray({ control, name: 'actions' });
  // 폼 전체가 아니라 목록을 다시 그릴 때 필요한 값만 구독한다. 카드 제목을 고치는 동안 화면 전체를 다시 그리지 않는다
  const actions = useWatch({
    control,
    name: 'actions',
    compute: (values) =>
      values.map((action) => ({
        actionId: action.actionId,
        isSelected: action.isSelected,
        ...(action.type === 'create-todo'
          ? { type: action.type, categoryId: action.categoryId }
          : { type: action.type }),
      })),
  });
  const { isValid } = useFormState({ control });
  const applyMutation = useMutation(useApplyActionPlanMutationOptions({ onSaved }));
  const memoryRequestRef = useRef<PlanApplyRequest | null>(null);

  const selection = toPlanSelection({ actions });
  const todoCount = VoicePlanPolicy.countSelectedTodos(plan, selection);
  const canApply = VoicePlanPolicy.canApplyPlan(plan, selection);
  const headline = VoicePlanPolicy.getPlanHeadline(plan, selection);

  const handleApply = handleSubmit((values) => {
    const selected = VoicePlanPolicy.sortPlanActionsByGroup(
      VoicePlanPolicy.getSelectedActions(
        { ...plan, actions: toPlannedActions(values) },
        toPlanSelection(values),
      ),
      fallbackCategoryId,
    );
    const input = { source: plan.source, actions: selected, fallbackCategoryId };
    const previous = requestStore == null ? memoryRequestRef.current : requestStore.find();
    // 같은 카드를 다시 보내면 처음 키를 다시 써 두 번 저장되지 않고, 고쳐서 보내면 새 키를 쓴다
    const prepared = preparePlanRequest({
      previous: previous == null ? null : { ...previous, input },
      input,
      createIdempotencyKey: randomUUID,
    });
    const rememberRequest = (request: PlanApplyRequest | null) => {
      memoryRequestRef.current = request;
      requestStore?.save(request);
    };
    rememberRequest({ idempotencyKey: prepared.idempotencyKey, fingerprint: prepared.fingerprint });

    applyMutation.mutate(
      {
        source: plan.source,
        sourceMemoId: plan.sourceMemoId,
        actions: selected,
        fallbackCategoryId,
        skippedCount: values.actions.length - selected.length,
        idempotencyKey: prepared.idempotencyKey,
      },
      {
        onSuccess: () => {
          memoryRequestRef.current = null;
          onApplied?.();
        },
        // 같은 키로 다른 내용을 보낸 경우처럼 키를 바꿔야 하면 다음에 새 키로 보낸다. 고친 카드는 그대로 남는다
        onError: (error) => {
          if (PlanRequestPolicy.getAfterFailure(prepared, error) == null) {
            rememberRequest(null);
          }
          if (isSourceMemoMissingError(error)) {
            onSourceMissing?.();
          }
        },
      },
    );
  });

  if (fields.length === 0) {
    return (
      <Result
        title={t('voicePlan:plan.empty')}
        description={isCharged ? undefined : t('subscription:gate.notCharged')}
        button={secondaryAction}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <VStack gap={16}>
        <VStack gap={4}>
          <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
            {match(headline)
              .with({ kind: 'todos' }, ({ count }) => t('voicePlan:plan.title', { count }))
              .with({ kind: 'memo' }, () => t('voicePlan:plan.titleMemoOnly'))
              .with({ kind: 'already-added' }, () => t('voicePlan:plan.titleAlreadyAdded'))
              .exhaustive()}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('voicePlan:plan.hint')}
          </Text>
          {plan.omittedTodoCount > 0 && (
            <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
              {t('voicePlan:plan.omitted', { count: plan.omittedTodoCount })}
            </Text>
          )}
        </VStack>

        <VStack gap={8}>
          {VoicePlanPolicy.getPlanActionGroups(actions, fallbackCategoryId).map((group) => (
            <VStack key={group.categoryId ?? 'memo'} gap={8}>
              {group.categoryId != null && (
                <PlanReview.CategoryHeader categoryId={group.categoryId} />
              )}
              {group.indexes.map((index) =>
                group.categoryId == null ? (
                  <PlanReview.MemoRow key={fields[index]?.id} index={index} />
                ) : (
                  <PlanReview.TodoRow
                    key={fields[index]?.id}
                    index={index}
                    fallbackCategoryId={fallbackCategoryId}
                  />
                ),
              )}
            </VStack>
          ))}
        </VStack>

        <HStack gap={8}>
          {secondaryAction}
          <Box className="flex-1">
            <Button
              isDisabled={!canApply || !isValid}
              isLoading={applyMutation.isPending}
              onPress={() => handleApply()}
              testID="plan-review-apply"
            >
              {match({ todoCount, canApply })
                .with({ canApply: false }, () => t('voicePlan:plan.applyNothing'))
                .with({ todoCount: 0 }, () => t('voicePlan:plan.applyMemo'))
                .otherwise(() => t('voicePlan:plan.apply', { count: todoCount }))}
            </Button>
          </Box>
        </HStack>
      </VStack>
    </FormProvider>
  );
}

PlanReview.CategoryHeader = function CategoryHeader({ categoryId }: { categoryId: number }) {
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = categoriesResult.categories.find((candidate) => candidate.id === categoryId);

  if (category == null) {
    return null;
  }
  return <CategoryHeaderPill label={category.name} color={category.color} />;
};

/** 오른쪽 "추가할지" 동그라미. 꺼진 행은 흐리게 보인다 */
function SelectCircle({
  isSelected,
  onSelectedChange,
  label,
}: {
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  label: string;
}) {
  return (
    <Checkbox
      accessibilityLabel={label}
      className="size-6 rounded-full border border-main shadow-none"
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
    />
  );
}

PlanReview.TodoRow = function PlanTodoRow({
  index,
  fallbackCategoryId,
}: {
  index: number;
  fallbackCategoryId: number;
}) {
  const { t } = useTranslation('voicePlan');
  const form = useFormContext<PlanReviewFormValues>();
  const overlay = useOverlay();
  const todo = useWatch({ control: form.control, name: `actions.${index}` });
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  if (todo.type !== 'create-todo') {
    return null;
  }

  const startDateKey = formatDateKey(todo.startDate, getDeviceTimezone());
  const dateLabel =
    todo.endDate == null
      ? shouldShowPlanDate({ hasRepeat: todo.repeat != null, startDateKey, todayKey })
        ? formatDateKeyLabel(startDateKey, 'monthDay', dateFormatContext)
        : null
      : formatDateKeyRange(
          startDateKey,
          formatDateKey(todo.endDate, getDeviceTimezone()),
          dateFormatContext,
        );
  const subtitle = getPlanTodoSubtitle({
    dateLabel,
    timeLabel:
      todo.scheduledTime == null
        ? null
        : formatTimeOfDay(
            parseScheduledTime(todo.scheduledTime),
            preference.timeFormat,
            dateFormatContext,
          ),
    repeatLabel: todo.repeat == null ? null : formatRepeatSummary(todo.repeat, dateFormatContext),
  });
  const isDuplicate = isDuplicateAction(todo);

  const handlePress = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={null}>
          <PlanTodoEditSheet
            todo={todo}
            fallbackCategoryId={fallbackCategoryId}
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
            onConfirm={(edited) => {
              form.setValue(`actions.${index}`, edited, {
                shouldDirty: true,
                shouldValidate: true,
              });
              close();
              exit();
            }}
          />
        </Suspense>
      </QueryErrorBoundary>
    ));
  };

  return (
    <TodoRow
      className={cn(!todo.isSelected && 'opacity-50')}
      onPress={handlePress}
      left={
        <TodoCheckbox
          accessibilityLabel={todo.title}
          isSelected={false}
          onSelectedChange={undefined}
        />
      }
      top={
        <HStack gap={4} align="center">
          <TodoLabel isChecked={false}>{todo.title}</TodoLabel>
          {todo.visibility === 'PRIVATE' && (
            <LockIcon width={14} height={14} colorClassName="text-gray-5" />
          )}
          {isDuplicate && (
            <Box className="rounded-md bg-gray-2 px-2 py-1">
              <Text size="e1" shade={6} maxLines={1}>
                {t('plan.duplicate')}
              </Text>
            </Box>
          )}
        </HStack>
      }
      middle={
        subtitle == null ? undefined : (
          <Text size="e1" shade={6}>
            {subtitle}
          </Text>
        )
      }
      bottom={
        todo.items.length > 0 ? <TodoProgress value={0} total={todo.items.length} /> : undefined
      }
      right={
        <SelectCircle
          label={t('plan.select', { title: todo.title })}
          isSelected={todo.isSelected}
          onSelectedChange={(isSelected) =>
            form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
          }
        />
      }
    >
      {todo.items.length > 0 && (
        <SubTodoIndent>
          {todo.items.map((item, itemIndex) => (
            <TodoRow
              key={itemIndex}
              className={cn(!todo.isSelected && 'opacity-50')}
              left={
                <TodoCheckbox
                  accessibilityLabel={item.title}
                  isSelected={false}
                  onSelectedChange={undefined}
                />
              }
              top={<TodoLabel isChecked={false}>{item.title}</TodoLabel>}
            />
          ))}
        </SubTodoIndent>
      )}
    </TodoRow>
  );
};

PlanReview.MemoRow = function PlanMemoRow({ index }: { index: number }) {
  const { t } = useTranslation('voicePlan');
  const form = useFormContext<PlanReviewFormValues>();
  const memo = useWatch({ control: form.control, name: `actions.${index}` });

  if (memo.type !== 'create-memo') {
    return null;
  }

  const label = memo.title === '' ? memo.content : memo.title;

  return (
    <TodoRow
      className={cn(!memo.isSelected && 'opacity-50')}
      left={<DocsIcon width={20} height={20} colorClassName="text-gray-6" />}
      top={
        <TodoLabel isChecked={false} maxLines={1}>
          {label}
        </TodoLabel>
      }
      middle={
        <Text size="e1" shade={6}>
          {t('plan.memoCaption')}
        </Text>
      }
      right={
        <SelectCircle
          label={t('plan.select', { title: label })}
          isSelected={memo.isSelected}
          onSelectedChange={(isSelected) =>
            form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
          }
        />
      }
    />
  );
};
