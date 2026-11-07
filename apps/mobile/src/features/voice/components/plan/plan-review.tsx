import { useIdGenerator } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { SubTodoIndent } from '@src/features/planning/todo/components/sub-todo-indent';
import {
  TodoCheckbox,
  TodoLabel,
  TodoProgress,
  TodoRow,
  TodoTitleLine,
} from '@src/features/planning/todo/components/todo-row';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { formatRepeatSummary } from '@src/features/planning/todo/utils/format-repeat-summary';
import { getPlanHeadline } from '@src/features/voice/utils/plan-headline.view-model';
import {
  formatDateKeyLabel,
  formatDateKeyRange,
  formatTimeOfDay,
} from '@src/shared/date/date-format';
import { parseHour, parseMinute } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  InfoIcon,
  QueryErrorBoundary,
  Result,
  ScreenScrollShadow,
  SheetScrollShadow,
  Text,
  TextSkeleton,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { compact, range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, Suspense, useRef } from 'react';
import { type UseFormReturn, useFieldArray, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match, P } from 'ts-pattern';

import { PlanRequestPolicy } from '../../domains/plan-request.model';
import { PlanReviewPolicy } from '../../domains/plan-review.model';
import { VoicePlanPolicy } from '../../domains/voice-plan.model';
import { isSourceMemoMissingError } from '../../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../../queries/voice.mutations';
import { type PlanReviewFormValues } from '../../schemas/plan-review-form.schema';
import { type VoicePlan } from '../../schemas/voice-plan.schema';
import { PlanTodoEditSheet } from './plan-todo-edit-sheet';

const LOADING_ROW_COUNT = 3;
const DUPLICATE_ICON_SIZE = 13;
/** 체크(20)를 44로 넓히는 터치 여백. 행의 글자까지 먹지 않게 행 간격(12)과 같다 */
const SELECT_HIT_SLOP = 12;
/** 고르지 않은 행의 제목. 라이트 4.5:1, 다크 6:1 이상이라 흐려도 읽힌다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-7 dark:text-gray-5';

export interface PlanApplyRequest {
  idempotencyKey: string;
  fingerprint: string;
}

interface PlanApplyRequestStore {
  find: () => PlanApplyRequest | null;
  save: (request: PlanApplyRequest | null) => void;
}

interface PlanReviewProps extends Pick<ComponentProps<typeof VStack>, 'className' | 'style'> {
  form: UseFormReturn<PlanReviewFormValues>;
  plan: VoicePlan;
  fallbackCategoryId: number;
  /** 계획을 만들 때 횟수를 썼는지. false면 빈 결과에서 "횟수는 차감되지 않았어요"를 보여 준다 */
  isCharged?: boolean;
  surface?: 'screen' | 'sheet';
  secondaryAction?: ReactNode;
  /** 저장 요청의 키를 화면 밖에 남길 곳. 없으면 이 화면이 떠 있는 동안만 기억한다 */
  requestStore?: PlanApplyRequestStore;
  /** 저장이 끝났다. 화면이 내려간 뒤에 응답이 와도 불리므로 저장 표시를 여기서 남긴다 */
  onSaved?: (saved: { todoCount: number }) => void;
  /** 메모가 생기거나 원본 메모가 사라졌다. 메모 목록은 메모를 아는 쪽이 다시 읽는다 */
  onMemoChanged: () => void;
  /** 화면이 떠 있을 때 저장이 끝났다. 초안 정리와 화면 닫기는 화면이 맡는다 */
  onApplied?: () => void;
  onSourceMissing?: () => void;
}

export function PlanReview({
  form,
  plan,
  fallbackCategoryId,
  isCharged = true,
  surface = 'screen',
  secondaryAction,
  requestStore,
  onSaved,
  onMemoChanged,
  onApplied,
  onSourceMissing,
  className,
  style,
}: PlanReviewProps) {
  const { t } = useTranslation(['voicePlan', 'subscription']);
  const idGenerator = useIdGenerator();
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
        ...(VoicePlanPolicy.isTodoAction(action)
          ? { type: action.type, categoryId: action.categoryId }
          : { type: action.type }),
      })),
  });
  const { isValid } = useFormState({ control });
  const applyMutation = useMutation(useApplyActionPlanMutationOptions({ onSaved, onMemoChanged }));
  const memoryRequestRef = useRef<PlanApplyRequest | null>(null);

  const selection = PlanReviewPolicy.toPlanSelection({ actions });
  const todoCount = VoicePlanPolicy.countSelectedTodos(plan, selection);
  const canApply = VoicePlanPolicy.canApplyPlan(plan, selection);
  const headline = getPlanHeadline(plan, selection);
  const ScrollFade = surface === 'sheet' ? SheetScrollShadow : ScreenScrollShadow;

  const handleApply = handleSubmit((values) => {
    const selected = VoicePlanPolicy.sortPlanActionsByGroup(
      VoicePlanPolicy.getSelectedActions(
        { ...plan, actions: PlanReviewPolicy.toPlannedActions(values) },
        PlanReviewPolicy.toPlanSelection(values),
      ),
      fallbackCategoryId,
    );
    const input = { source: plan.source, actions: selected, fallbackCategoryId };
    const previous = requestStore == null ? memoryRequestRef.current : requestStore.find();
    // 같은 카드를 다시 보내면 처음 키를 다시 써 두 번 저장되지 않고, 고쳐서 보내면 새 키를 쓴다
    const prepared = PlanRequestPolicy.prepare({
      previous: previous == null ? null : { ...previous, input },
      input,
      createIdempotencyKey: idGenerator.create,
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
    <VStack className={className} style={style}>
      <ScrollFade className="shrink grow">
        <ScrollView
          contentContainerClassName="gap-4 pb-4"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
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
                    <PlanReview.MemoRow key={fields[index]?.id} form={form} index={index} />
                  ) : (
                    <PlanReview.TodoRow
                      key={fields[index]?.id}
                      form={form}
                      index={index}
                      fallbackCategoryId={fallbackCategoryId}
                    />
                  ),
                )}
              </VStack>
            ))}
          </VStack>
        </ScrollView>
      </ScrollFade>

      <HStack gap={8} className="pt-3">
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
  );
}

PlanReview.Loading = function Loading({
  className,
  style,
}: Pick<PlanReviewProps, 'className' | 'style'>) {
  return (
    <VStack className={className} style={style}>
      <VStack flex={1} gap={16}>
        <VStack gap={4}>
          <TextSkeleton size="t3" className="w-2/3" />
          <TextSkeleton size="b4" className="w-full" />
        </VStack>
        <VStack gap={8}>
          {range(LOADING_ROW_COUNT).map((index) => (
            <TodoRow
              key={index}
              left={<Skeleton className="size-5 rounded-md" />}
              top={<TextSkeleton size="b3" className="w-3/4" />}
            />
          ))}
        </VStack>
      </VStack>
      <Box className="pt-3">
        <Skeleton className="h-14 w-full rounded-xl" />
      </Box>
    </VStack>
  );
};

PlanReview.CategoryHeader = function CategoryHeader({ categoryId }: { categoryId: number }) {
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = categoriesResult.categories.find((candidate) => candidate.id === categoryId);

  if (category == null) {
    return null;
  }
  return <CategoryHeaderPill label={category.name} color={category.color} />;
};

PlanReview.TodoRow = function PlanTodoRow({
  form,
  index,
  fallbackCategoryId,
}: {
  form: UseFormReturn<PlanReviewFormValues>;
  index: number;
  fallbackCategoryId: number;
}) {
  const { t } = useTranslation('voicePlan');
  const overlay = useOverlay();
  const todo = useWatch({ control: form.control, name: `actions.${index}` });
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();

  if (!VoicePlanPolicy.isTodoAction(todo)) {
    return null;
  }

  const dateLabel = match(todo)
    .with({ endDate: P.nonNullable }, ({ startDate, endDate }) =>
      formatDateKeyRange(startDate, endDate, dateFormatContext),
    )
    // 반복은 시작일보다 반복 규칙이 중요해 날짜를 숨기고, 오늘 할 일도 날짜를 보이지 않는다
    .when(
      ({ repeat, startDate }) => repeat == null && startDate !== todayKey,
      ({ startDate }) => formatDateKeyLabel(startDate, 'monthDay', dateFormatContext),
    )
    .otherwise(() => null);
  const timeLabel =
    todo.scheduledTime == null
      ? null
      : formatTimeOfDay(
          { hour: parseHour(todo.scheduledTime), minute: parseMinute(todo.scheduledTime) },
          preference.timeFormat,
          dateFormatContext,
        );
  const repeatLabel =
    todo.repeat == null ? null : formatRepeatSummary(todo.repeat, dateFormatContext);
  const subtitleParts = compact([dateLabel, timeLabel, repeatLabel]);
  const subtitle = subtitleParts.length === 0 ? null : subtitleParts.join(' · ');
  const isDuplicate = VoicePlanPolicy.isDuplicateAction(todo);

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <QueryErrorBoundary fallback={() => null}>
        {/* 카테고리와 설정을 읽은 뒤에야 시트가 올라온다. 닫힌 시트라 밀릴 화면이 없고 조회는 이 화면에서 이미 받아 둔 캐시다 */}
        <Suspense fallback={null}>
          <PlanTodoEditSheet
            todo={todo}
            fallbackCategoryId={fallbackCategoryId}
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                unmount();
              }
            }}
            onConfirm={(edited) => {
              form.setValue(`actions.${index}`, edited, {
                shouldDirty: true,
                shouldValidate: true,
              });
              close();
              unmount();
            }}
          />
        </Suspense>
      </QueryErrorBoundary>
    ));
  };

  return (
    <TodoRow
      onPress={handlePress}
      left={
        <TodoCheckbox
          accessibilityLabel={t('plan.select', { title: todo.title })}
          hitSlop={SELECT_HIT_SLOP}
          isSelected={todo.isSelected}
          onSelectedChange={(isSelected) =>
            form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
          }
        />
      }
      top={
        <TodoTitleLine
          label={
            <TodoLabel
              isChecked={false}
              lineBreakStrategyIOS="hangul-word"
              className={cn('flex-1', !todo.isSelected && UNSELECTED_TITLE_CLASS_NAME)}
            >
              {todo.title}
            </TodoLabel>
          }
          isPrivate={TodoPolicy.isPrivate(todo)}
        />
      }
      middle={
        (subtitle != null || isDuplicate) && (
          <VStack gap={2}>
            {subtitle != null && (
              <Text size="e1" shade={6}>
                {subtitle}
              </Text>
            )}
            {isDuplicate && (
              <HStack gap={4} align="center">
                <InfoIcon
                  width={fontScaledSize(DUPLICATE_ICON_SIZE)}
                  height={fontScaledSize(DUPLICATE_ICON_SIZE)}
                  colorClassName="text-gray-7"
                />
                <Text size="e1" shade={7} className="shrink">
                  {t('plan.duplicate')}
                </Text>
              </HStack>
            )}
          </VStack>
        )
      }
      bottom={
        todo.items.length > 0 ? <TodoProgress value={0} total={todo.items.length} /> : undefined
      }
    >
      {todo.items.length > 0 && (
        <SubTodoIndent>
          {todo.items.map((item, itemIndex) => (
            <TodoRow
              key={itemIndex}
              top={
                <TodoLabel
                  isChecked={false}
                  lineBreakStrategyIOS="hangul-word"
                  className={cn(!todo.isSelected && UNSELECTED_TITLE_CLASS_NAME)}
                >
                  {item.title}
                </TodoLabel>
              }
            />
          ))}
        </SubTodoIndent>
      )}
    </TodoRow>
  );
};

PlanReview.MemoRow = function PlanMemoRow({
  form,
  index,
}: {
  form: UseFormReturn<PlanReviewFormValues>;
  index: number;
}) {
  const { t } = useTranslation('voicePlan');
  const memo = useWatch({ control: form.control, name: `actions.${index}` });

  if (VoicePlanPolicy.isTodoAction(memo)) {
    return null;
  }

  const label = memo.title === '' ? memo.content : memo.title;

  return (
    <TodoRow
      left={
        <TodoCheckbox
          accessibilityLabel={t('plan.select', { title: label })}
          hitSlop={SELECT_HIT_SLOP}
          isSelected={memo.isSelected}
          onSelectedChange={(isSelected) =>
            form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
          }
        />
      }
      top={
        <TodoLabel
          isChecked={false}
          maxLines={1}
          className={cn(!memo.isSelected && UNSELECTED_TITLE_CLASS_NAME)}
        >
          {label}
        </TodoLabel>
      }
      middle={
        <Text size="e1" shade={6}>
          {t('plan.memoCaption')}
        </Text>
      }
    />
  );
};
