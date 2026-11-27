import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import {
  TodoScheduleChips,
  type TodoScheduleChipsValue,
} from '@src/features/planning/todo/components/todo-schedule-chips';
import { TodoScheduleSummary } from '@src/features/planning/todo/components/todo-schedule-summary';
import { TodoSchedulePolicy } from '@src/features/planning/todo/domains/todo-schedule.model';
import {
  getVisibility,
  isPrivateVisibility,
} from '@src/features/planning/todo/domains/todo-visibility.model';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  Button,
  EditIcon,
  HintPopoverContent,
  HStack,
  InfoIcon,
  Input,
  KeyboardBottomSheet,
  QueryErrorBoundary,
  QueryErrorFallback,
  Result,
  ScrollFade,
  Text,
  TextSkeleton,
  useOpenKeyboardSheet,
  VStack,
} from '@src/shared/ui';
import { getTouchTargetInset } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Popover, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import { Controller, FormState, useForm, Watch } from 'react-hook-form';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { match } from 'ts-pattern';

import {
  PlanReviewDraftPolicy,
  type SelectablePlannedAction,
} from '../domains/plan-review-draft.model';
import { getPlannedCategoryId, PlannedActionPolicy } from '../domains/planned-action.model';
import { type VoicePlan, VoicePlanPolicy } from '../domains/voice-plan.model';
import {
  planTodoEditFormSchema,
  type PlanTodoFormValues,
} from '../schemas/plan-review-form.schema';
import { getPlanActionGroups } from '../utils/plan-action-group.view-model';
import { getPlanHeadline } from '../utils/plan-headline.view-model';

const LOADING_ROW_COUNT = 3;
const DUPLICATE_ICON_SIZE = 13;
const GUIDE_AI_ICON_SIZE = 14;
const GUIDE_INFO_ICON_SIZE = 16;
const EDIT_ICON_SIZE = 16;
/** 체크와 카드 사이 간격. 체크의 터치 여백과 같아 두 누름 영역이 겹치지 않는다 */
const SELECT_GAP = 12;
/** 체크 칸(`Checkbox`의 size-5) */
const SELECT_CHECKBOX_SIZE = 20;
const SELECT_HIT_SLOP = getTouchTargetInset(SELECT_CHECKBOX_SIZE);
/** 고르지 않은 카드의 글자. 카드 면 위에서 라이트·다크 모두 4.5:1 이상이라 흐려도 읽힌다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-8 dark:text-gray-6';
/** 다크 시트 면이 gray-1이라 시트 안 카드는 한 단계 밝힌다 */
const TODO_CARD_CLASS_NAME = {
  screen: 'bg-gray-1',
  sheet: 'bg-gray-1 dark:bg-gray-2',
} as const satisfies Record<NonNullable<PlanReviewProps['surface']>, string>;

type PlanMemoFormValues = Extract<SelectablePlannedAction, { type: 'create-memo' }>;

interface PlanReviewProps {
  /** 고르는 중인 카드. 폼을 가진 쪽이 `actions` 칸을 `Watch`로 잇는다 */
  value: readonly SelectablePlannedAction[];
  /** 카드 하나를 고쳤다. 폼을 가진 쪽이 그 자리(`actions.${index}`)만 써 다른 카드의 변경을 덮지 않는다 */
  onItemChange: (index: number, action: SelectablePlannedAction) => void;
  plan: VoicePlan;
  fallbackCategoryId: number;
  /** 계획을 만들 때 횟수를 썼는지. false면 빈 결과에서 "횟수는 차감되지 않았어요"를 보여 준다 */
  isCharged?: boolean;
  surface?: 'screen' | 'sheet';
  secondaryAction?: ReactNode;
  /** 폼이 보낼 수 있는 값인지. 제목을 비운 카드가 있으면 false다 */
  isValid: boolean;
  /** 저장을 보내는 중이거나, 저장해 시트가 내려가고 화면이 바뀌는 중이다 */
  isApplying: boolean;
  onApplyPress: () => void;
  className?: string;
  /** 시트 안에서 높이를 묶을 때 쓴다 */
  style?: StyleProp<ViewStyle>;
}

export function PlanReview({
  value,
  onItemChange,
  plan,
  fallbackCategoryId,
  isCharged = true,
  surface = 'screen',
  secondaryAction,
  isValid,
  isApplying,
  onApplyPress,
  className,
  style,
}: PlanReviewProps) {
  const { t } = useTranslation(['voicePlan', 'subscription']);

  const selection = PlanReviewDraftPolicy.getSelection(value);
  const todoCount = VoicePlanPolicy.getSelectedTodoCount(plan, selection);
  const canApply = VoicePlanPolicy.canApplyPlan(plan, selection);
  const headline = getPlanHeadline(plan, selection);

  if (value.length === 0) {
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
      <VStack className="gap-1 pb-4">
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

      <ScrollFade surface={surface} className="shrink grow">
        <ScrollView
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <VStack gap={8}>
            {getPlanActionGroups(value, fallbackCategoryId).map((group) => (
              <VStack key={group.categoryId ?? 'memo'} gap={8}>
                {group.categoryId != null && (
                  <PlanReview.CategoryHeader categoryId={group.categoryId} />
                )}
                {group.indexes.flatMap((index) =>
                  value.slice(index, index + 1).map((action) =>
                    match(action)
                      .with({ type: 'create-todo' }, (todo) => (
                        <PlanReview.TodoItem
                          key={todo.actionId}
                          todo={todo}
                          // 묶어 보여도 고친 값은 그 카드의 자리에 넣는다
                          onChange={(next) => onItemChange(index, next)}
                          fallbackCategoryId={fallbackCategoryId}
                          surface={surface}
                        />
                      ))
                      .with({ type: 'create-memo' }, (memo) => (
                        <PlanReview.MemoItem
                          key={memo.actionId}
                          memo={memo}
                          onChange={(next) => onItemChange(index, next)}
                        />
                      ))
                      .exhaustive(),
                  ),
                )}
              </VStack>
            ))}
          </VStack>
        </ScrollView>
      </ScrollFade>

      <HStack className="gap-2 pt-3">
        {secondaryAction}
        <Box className="flex-1">
          <Button
            isDisabled={!canApply || !isValid}
            isLoading={isApplying}
            onPress={onApplyPress}
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
      <VStack className="gap-4" flex={1}>
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
  return <CategoryHeaderPill label={category.name} color={category.color} className="self-start" />;
};

interface PlanReviewTodoItemProps {
  todo: PlanTodoFormValues;
  onChange: (todo: PlanTodoFormValues) => void;
  fallbackCategoryId: number;
  surface: NonNullable<PlanReviewProps['surface']>;
}

PlanReview.TodoItem = function TodoItem({
  todo,
  onChange,
  fallbackCategoryId,
  surface,
}: PlanReviewTodoItemProps) {
  const { t } = useTranslation('voicePlan');
  const openKeyboardSheet = useOpenKeyboardSheet();
  const fontScaledSize = useFontScaledSize();

  const isDuplicate = PlannedActionPolicy.isDuplicateAction(todo);
  const unselectedClassName = !todo.isSelected && UNSELECTED_TITLE_CLASS_NAME;

  const handlePress = () =>
    openKeyboardSheet(({ isOpen, onOpenChange }) => (
      // 안쪽 조회는 칩마다 자기 경계가 받아 여기는 렌더 오류만 닿는다. 루트 overlay라 앱 경계까지 올리지 않는다
      <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
        <PlanTodoEditBottomSheet
          todo={todo}
          fallbackCategoryId={fallbackCategoryId}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          onConfirm={(edited) => {
            onChange(edited);
            onOpenChange(false);
          }}
        />
      </QueryErrorBoundary>
    ));

  return (
    <HStack gap={SELECT_GAP} align="center">
      <TodoRow.Checkbox
        accessibilityLabel={t('plan.select', { title: todo.title })}
        hitSlop={SELECT_HIT_SLOP}
        isSelected={todo.isSelected}
        onSelectedChange={(isSelected) => onChange({ ...todo, isSelected })}
      />
      <PressableFeedback
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityHint={t('plan.editHint')}
        className={cn('flex-1 rounded-2xl px-4 py-3', TODO_CARD_CLASS_NAME[surface])}
      >
        <HStack gap={12} align="center">
          <VStack flex={1} gap={2}>
            <TodoRow.TitleLine
              label={
                <TodoRow.Label
                  isCompleted={false}
                  lineBreakStrategyIOS="hangul-word"
                  className={cn('flex-1', unselectedClassName)}
                >
                  {todo.title}
                </TodoRow.Label>
              }
              isPrivate={isPrivateVisibility(todo.visibility)}
            />
            <TodoScheduleSummary value={todo} size="e1" shade={6} />
            {isDuplicate && (
              <HStack className="gap-1" align="center">
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
              <VStack className="mt-1 gap-0.5 border-l border-gray-3 pl-3">
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

interface PlanReviewMemoItemProps {
  memo: PlanMemoFormValues;
  onChange: (memo: PlanMemoFormValues) => void;
}

PlanReview.MemoItem = function MemoItem({ memo, onChange }: PlanReviewMemoItemProps) {
  const { t } = useTranslation('voicePlan');
  const label = memo.title === '' ? memo.content : memo.title;

  return (
    <HStack gap={SELECT_GAP} align="center">
      <TodoRow.Checkbox
        accessibilityLabel={t('plan.select', { title: label })}
        hitSlop={SELECT_HIT_SLOP}
        isSelected={memo.isSelected}
        onSelectedChange={(isSelected) => onChange({ ...memo, isSelected })}
      />
      <VStack flex={1} gap={2} className="px-4 py-3">
        <TodoRow.Label
          isCompleted={false}
          numberOfLines={1}
          className={cn(!memo.isSelected && UNSELECTED_TITLE_CLASS_NAME)}
        >
          {label}
        </TodoRow.Label>
        <Text size="e1" shade={6}>
          {t('plan.memoCaption')}
        </Text>
      </VStack>
    </HStack>
  );
};

interface PlanTodoEditBottomSheetProps {
  todo: PlanTodoFormValues;
  fallbackCategoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (todo: PlanTodoFormValues) => void;
}

/** 카드 하나를 고치는 시트. 확인을 누르기 전에는 목록과 초안에 반영하지 않는다 */
function PlanTodoEditBottomSheet({
  todo,
  fallbackCategoryId,
  isOpen,
  onOpenChange,
  onConfirm,
}: PlanTodoEditBottomSheetProps) {
  const { t } = useTranslation('voicePlan');
  const form = useForm({
    resolver: zodResolver(planTodoEditFormSchema),
    defaultValues: { todo },
    mode: 'onChange',
  });
  const submitTodo = form.handleSubmit((values) => onConfirm(values.todo));

  return (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      footer={
        <VStack gap={12}>
          <Watch
            control={form.control}
            name="todo"
            render={(editing) => (
              <PlanTodoScheduleChips
                value={editing}
                fallbackCategoryId={fallbackCategoryId}
                // 칩이 바꾼 칸은 그릴 때의 값이 아니라 지금 폼 값에 얹는다. 제목을 치는 중에 칩을 바꿔도 친 글자가 남는다
                onChange={(next, previous) =>
                  form.setValue('todo', withScheduleChips(form.getValues('todo'), previous, next), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            )}
          />

          <FormState
            control={form.control}
            render={({ isValid }) => (
              <Button
                isDisabled={!isValid}
                onPress={() => submitTodo()}
                testID="plan-todo-edit-confirm"
              >
                {t('edit.confirm')}
              </Button>
            )}
          />
        </VStack>
      }
    >
      <Controller
        control={form.control}
        name="todo.title"
        render={({ field: { value, onChange } }) => (
          <Input
            accessibilityLabel={t('edit.titleLabel')}
            value={value}
            onChange={onChange}
            maxLength={ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH}
            size="medium"
            renderErrorMessage={false}
            returnKeyType="done"
            onSubmitEditing={() => submitTodo()}
          />
        )}
      />
    </KeyboardBottomSheet>
  );
}

interface PlanTodoScheduleChipsProps {
  value: PlanTodoFormValues;
  /** 칩 값이 바뀌었다. 바뀐 칸만 옮길 수 있게 앞의 칩 값도 함께 준다 */
  onChange: (next: TodoScheduleChipsValue, previous: TodoScheduleChipsValue) => void;
  fallbackCategoryId: number;
}

/** 할 일 작성과 같은 일정 칩. 계획 카드는 종일을 시각 null로, 정하지 않은 공개 범위·카테고리를 null로 둔다 */
function PlanTodoScheduleChips({
  value,
  onChange,
  fallbackCategoryId,
}: PlanTodoScheduleChipsProps) {
  const chips: TodoScheduleChipsValue = {
    startDate: value.startDate,
    endDate: value.endDate,
    scheduledTime: value.scheduledTime,
    isAllDay: value.scheduledTime == null,
    repeat: value.repeat,
    visibility: getVisibility(value.visibility),
    categoryId: getPlannedCategoryId(value.categoryId, fallbackCategoryId),
  };

  return <TodoScheduleChips value={chips} onChange={(next) => onChange(next, chips)} />;
}

// 칩이 바꾼 칸만 옮긴다. 정하지 않은 공개 범위·카테고리(null)는 직접 고르기 전까지 그대로 둔다
function withScheduleChips(
  todo: PlanTodoFormValues,
  previous: TodoScheduleChipsValue,
  next: TodoScheduleChipsValue,
): PlanTodoFormValues {
  return {
    ...todo,
    startDate: next.startDate,
    endDate: next.endDate,
    scheduledTime: TodoSchedulePolicy.findScheduledTime(next),
    repeat: next.repeat,
    visibility: next.visibility === previous.visibility ? todo.visibility : next.visibility,
    categoryId: next.categoryId === previous.categoryId ? todo.categoryId : next.categoryId,
  };
}
