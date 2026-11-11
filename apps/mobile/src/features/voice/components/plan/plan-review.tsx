import { useIdGenerator } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import {
  TodoCheckbox,
  TodoLabel,
  TodoTitleLine,
} from '@src/features/planning/todo/components/todo-row';
import { isPrivateVisibility } from '@src/features/planning/todo/domains/todo.model';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  Button,
  EditIcon,
  HintPopoverContent,
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
import { range } from 'es-toolkit';
import { Popover, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, Suspense, useRef, useState } from 'react';
import { type UseFormReturn, useFieldArray, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { PlanRequestPolicy } from '../../domains/plan-request.model';
import {
  getPlanActionGroups,
  sortPlanActionsByGroup,
  type VoicePlan,
  VoicePlanPolicy,
} from '../../domains/voice-plan.model';
import { isPlanKeyConflictError, isSourceMemoMissingError } from '../../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../../queries/voice.mutations';
import { type PlanReviewFormValues } from '../../schemas/plan-review-form.schema';
import { toPlanSelection, toPlannedActions } from '../../utils/plan-review-draft';
import { getPlanTodoSubtitle } from '../../utils/plan-todo-subtitle.view-model';
import { PlanTodoEditBottomSheet } from './plan-todo-edit-bottom-sheet';

const LOADING_ROW_COUNT = 3;
const DUPLICATE_ICON_SIZE = 13;
const GUIDE_AI_ICON_SIZE = 14;
const GUIDE_INFO_ICON_SIZE = 16;
const EDIT_ICON_SIZE = 16;
/** 체크와 카드 사이 간격. 체크의 터치 여백과 같아 두 누름 영역이 겹치지 않는다 */
const SELECT_GAP = 12;
/** 체크(20)를 44로 넓히는 터치 여백 */
const SELECT_HIT_SLOP = SELECT_GAP;
/** 고르지 않은 카드의 글자. 카드 면 위에서 라이트·다크 모두 4.5:1 이상이라 흐려도 읽힌다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-8 dark:text-gray-6';
/** 다크 시트 면이 gray-1이라 시트 안 카드는 한 단계 밝힌다 */
const TODO_CARD_CLASS_NAME = {
  screen: 'bg-gray-1',
  sheet: 'bg-gray-1 dark:bg-gray-2',
} as const satisfies Record<NonNullable<PlanReviewProps['surface']>, string>;

interface PlanApplyRequest {
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
  const { control } = form;
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
  const planApply = usePlanApply({
    form,
    plan,
    fallbackCategoryId,
    requestStore,
    onSaved,
    onMemoChanged,
    onApplied,
    onSourceMissing,
  });

  const selection = toPlanSelection({ actions });
  const todoCount = VoicePlanPolicy.getSelectedTodoCount(plan, selection);
  const canApply = VoicePlanPolicy.canApplyPlan(plan, selection);
  const headline = VoicePlanPolicy.getHeadline(plan, selection);
  const ScrollFade = surface === 'sheet' ? SheetScrollShadow : ScreenScrollShadow;

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
      <VStack gap={4} className="pb-4">
        <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
          {match(headline)
            .with({ kind: 'todos' }, ({ count }) => t('voicePlan:plan.title', { count }))
            .with({ kind: 'memo' }, () => t('voicePlan:plan.titleMemoOnly'))
            .with({ kind: 'already-added' }, () => t('voicePlan:plan.titleAlreadyAdded'))
            .exhaustive()}
        </Text>
        <PlanReview.Guide />
        {plan.omittedTodoCount > 0 && (
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('voicePlan:plan.omitted', { count: plan.omittedTodoCount })}
          </Text>
        )}
      </VStack>

      <ScrollFade className="shrink grow">
        <ScrollView
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <VStack gap={8}>
            {getPlanActionGroups(actions, fallbackCategoryId).map((group) => (
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
                      surface={surface}
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
            isLoading={planApply.isPending}
            onPress={() => planApply.apply()}
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

type UsePlanApplyOptions = Pick<
  PlanReviewProps,
  | 'form'
  | 'plan'
  | 'fallbackCategoryId'
  | 'requestStore'
  | 'onSaved'
  | 'onMemoChanged'
  | 'onApplied'
  | 'onSourceMissing'
>;

/** 고른 카드를 저장한다. 같은 카드를 다시 보내도 두 번 저장되지 않게 요청 키를 기억한다 */
function usePlanApply({
  form,
  plan,
  fallbackCategoryId,
  requestStore,
  onSaved,
  onMemoChanged,
  onApplied,
  onSourceMissing,
}: UsePlanApplyOptions) {
  const idGenerator = useIdGenerator();
  const applyMutation = useMutation(useApplyActionPlanMutationOptions({ onSaved, onMemoChanged }));
  const memoryRequestRef = useRef<PlanApplyRequest | null>(null);

  const apply = () =>
    form.handleSubmit((values) => {
      const selected = sortPlanActionsByGroup(
        VoicePlanPolicy.getSelectedActions(
          { ...plan, actions: toPlannedActions(values) },
          toPlanSelection(values),
        ),
        fallbackCategoryId,
      );
      const input = { source: plan.source, actions: selected, fallbackCategoryId };
      const previous = requestStore == null ? memoryRequestRef.current : requestStore.find();
      // 같은 카드를 다시 보내면 처음 키를 다시 써 두 번 저장되지 않고, 고쳐서 보내면 새 키를 쓴다
      const prepared = PlanRequestPolicy.preparePlanRequest({
        previous: previous == null ? null : { ...previous, input },
        input,
        createIdempotencyKey: idGenerator.create,
      });
      const rememberRequest = (request: PlanApplyRequest | null) => {
        memoryRequestRef.current = request;
        requestStore?.save(request);
      };
      rememberRequest({
        idempotencyKey: prepared.idempotencyKey,
        fingerprint: prepared.fingerprint,
      });

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
            if (isPlanKeyConflictError(error)) {
              rememberRequest(null);
            }
            if (isSourceMemoMissingError(error)) {
              onSourceMissing?.();
            }
          },
        },
      );
    })();

  return { apply, isPending: applyMutation.isPending };
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
          <TextSkeleton size="e2" className="w-1/2" />
        </VStack>
        <VStack gap={8}>
          {range(LOADING_ROW_COUNT).map((index) => (
            <HStack key={index} gap={SELECT_GAP} align="center">
              <Skeleton className="size-5 rounded-md" />
              <Box className={cn('flex-1 rounded-2xl px-4 py-3', TODO_CARD_CLASS_NAME.screen)}>
                <TextSkeleton size="b3" className="w-3/4" />
              </Box>
            </HStack>
          ))}
        </VStack>
      </VStack>
      <Box className="pt-3">
        <Skeleton className="h-14 w-full rounded-xl" />
      </Box>
    </VStack>
  );
};

PlanReview.Guide = function Guide() {
  const { t } = useTranslation('voicePlan');
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback
          onPress={() => setIsOpen(true)}
          className="self-start"
          accessibilityRole="button"
          accessibilityLabel={t('plan.guide.label')}
          testID="plan-review-guide"
        >
          <HStack gap={4} align="center">
            <AiFilledIcon
              width={fontScaledSize(GUIDE_AI_ICON_SIZE)}
              height={fontScaledSize(GUIDE_AI_ICON_SIZE)}
              colorClassName="text-main"
            />
            <Text size="e2" weight="medium" shade={6} className="shrink">
              {t('plan.guide.label')}
            </Text>
            <InfoIcon
              width={fontScaledSize(GUIDE_INFO_ICON_SIZE)}
              height={fontScaledSize(GUIDE_INFO_ICON_SIZE)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <HintPopoverContent
        Icon={AiFilledIcon}
        title={t('plan.guide.title')}
        placement="bottom"
        align="start"
      >
        <VStack gap={8}>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('plan.guide.description')}
          </Text>
          <Separator thickness={1} className="bg-border" />
          <Text size="b4" shade={7} lineBreakStrategyIOS="hangul-word">
            {t('plan.guide.note')}
          </Text>
        </VStack>
      </HintPopoverContent>
    </Popover>
  );
};

PlanReview.CategoryHeader = function CategoryHeader({ categoryId }: { categoryId: number }) {
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = TodoCategoryPolicy.findCategory(categoriesResult.categories, categoryId);

  if (category == null) {
    return null;
  }
  return <CategoryHeaderPill label={category.name} color={category.color} />;
};

PlanReview.TodoRow = function TodoRow({
  form,
  index,
  fallbackCategoryId,
  surface,
}: {
  form: UseFormReturn<PlanReviewFormValues>;
  index: number;
  fallbackCategoryId: number;
  surface: NonNullable<PlanReviewProps['surface']>;
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

  const subtitle = getPlanTodoSubtitle(todo, {
    todayKey,
    timeFormat: preference.timeFormat,
    dateFormatContext,
  });
  const isDuplicate = VoicePlanPolicy.isDuplicateAction(todo);
  const unselectedClassName = !todo.isSelected && UNSELECTED_TITLE_CLASS_NAME;

  const handlePress = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <QueryErrorBoundary fallback={() => null}>
        {/* 카테고리와 설정을 읽은 뒤에야 시트가 올라온다. 닫힌 시트라 밀릴 화면이 없고 조회는 이 화면에서 이미 받아 둔 캐시다 */}
        <Suspense fallback={null}>
          <PlanTodoEditBottomSheet
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
    <HStack gap={SELECT_GAP} align="center">
      <TodoCheckbox
        accessibilityLabel={t('plan.select', { title: todo.title })}
        hitSlop={SELECT_HIT_SLOP}
        isSelected={todo.isSelected}
        onSelectedChange={(isSelected) =>
          form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
        }
      />
      <PressableFeedback
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityHint={t('plan.editHint')}
        className={cn('flex-1 rounded-2xl px-4 py-3', TODO_CARD_CLASS_NAME[surface])}
      >
        <HStack gap={12} align="center">
          <VStack flex={1} gap={2}>
            <TodoTitleLine
              label={
                <TodoLabel
                  isCompleted={false}
                  lineBreakStrategyIOS="hangul-word"
                  className={cn('flex-1', unselectedClassName)}
                >
                  {todo.title}
                </TodoLabel>
              }
              isPrivate={isPrivateVisibility(todo.visibility)}
            />
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
            {todo.items.length > 0 && (
              <VStack gap={2} className="mt-1 border-l border-gray-3 pl-3">
                {todo.items.map((item, itemIndex) => (
                  <Text
                    key={itemIndex}
                    size="b4"
                    shade={7}
                    lineBreakStrategyIOS="hangul-word"
                    className={cn(unselectedClassName)}
                  >
                    {item.title}
                  </Text>
                ))}
              </VStack>
            )}
          </VStack>
          <EditIcon
            width={fontScaledSize(EDIT_ICON_SIZE)}
            height={fontScaledSize(EDIT_ICON_SIZE)}
            colorClassName="text-main"
          />
        </HStack>
        <PressableFeedback.Highlight className="rounded-2xl" />
      </PressableFeedback>
    </HStack>
  );
};

PlanReview.MemoRow = function MemoRow({
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
    <HStack gap={SELECT_GAP} align="center">
      <TodoCheckbox
        accessibilityLabel={t('plan.select', { title: label })}
        hitSlop={SELECT_HIT_SLOP}
        isSelected={memo.isSelected}
        onSelectedChange={(isSelected) =>
          form.setValue(`actions.${index}.isSelected`, isSelected, { shouldDirty: true })
        }
      />
      <VStack flex={1} gap={2} className="px-4 py-3">
        <TodoLabel
          isCompleted={false}
          numberOfLines={1}
          className={cn(!memo.isSelected && UNSELECTED_TITLE_CLASS_NAME)}
        >
          {label}
        </TodoLabel>
        <Text size="e1" shade={6}>
          {t('plan.memoCaption')}
        </Text>
      </VStack>
    </HStack>
  );
};
