import { CATEGORY_TODO_HANDLINGS, type CategoryTodoHandling } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  Button,
  ChoiceRadio,
  ConfirmDialog,
  H4,
  HStack,
  INQUIRY_SHEET_EXIT,
  ListRow,
  ModalBottomSheet,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  useOverlay,
  useSheetRoute,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Card, PressableFeedback, RadioGroup, Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, Suspense, useEffect, useState } from 'react';
import Animated from 'react-native-reanimated';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { TodoCategoryDeletionPolicy, TodoCategoryPolicy } from '../domains/todo-category.model';
import type {
  TodoCategoryDeletionPreview,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import { useTodoCategoryId } from '../hooks/use-todo-category-id';
import { useDeleteTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import {
  useGetTodoCategoriesQueryOptions,
  useGetTodoCategoryDeletionPreviewQueryOptions,
} from '../queries/todo-category.queries';
import { toTodoCountBucket } from '../utils/todo-category-analytics';
import { CategorySelectInput } from './category-select-input';

const AnimatedCard = Animated.createAnimatedComponent(Card);

// 누를 때 미리 받은 미리보기는 대개 이 안에 와서, 다이얼로그로 끝날 카테고리에 빈 시트가 잠깐 비치지 않는다
const LOADING_SHEET_DELAY_MS = 300;

/**
 * 안의 할 일을 옮길지 함께 지울지 고르고 카테고리를 지운다. 대상은 `/todo-categories/[categoryId]/delete` route에서 읽는다.
 * 옮기거나 지울 할 일·반복이 없거나 마지막 카테고리면 시트 대신 확인 다이얼로그를 띄운다
 */
export function CategoryDeleteBottomSheet() {
  const sheet = useSheetRoute('/settings/category-settings');
  const [categoryId] = useTodoCategoryId();
  const [{ data: categoriesResult }, { data: preview }] = useSuspenseQueries({
    queries: [
      useGetTodoCategoriesQueryOptions(),
      useGetTodoCategoryDeletionPreviewQueryOptions({ categoryId }),
    ],
  });
  // 지운 뒤 목록을 다시 받아도 닫히는 동안 내용을 그대로 둔다
  const category = useRetainedValue(
    TodoCategoryPolicy.findCategory(categoriesResult.categories, categoryId),
  );

  useEffect(() => {
    if (category == null) {
      sheet.close();
    }
  }, [category, sheet]);

  if (category == null) {
    return null;
  }

  if (!TodoCategoryDeletionPolicy.shouldChooseTodoHandling(preview)) {
    return (
      <CategoryDeleteConfirmDialog
        category={category}
        preview={preview}
        isOpen={sheet.isOpen}
        onOpenChange={sheet.onOpenChange}
      />
    );
  }

  return (
    <TodoHandlingBottomSheet
      category={category}
      preview={preview}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
    />
  );
}

/** 미리보기가 늦으면 투명한 route가 아무것도 없이 화면을 막지 않게 같은 모양의 시트를 띄워 닫을 수 있게 한다 */
CategoryDeleteBottomSheet.Loading = function Loading() {
  const sheet = useSheetRoute('/settings/category-settings');
  const [isDelayElapsed, setIsDelayElapsed] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setIsDelayElapsed(true), LOADING_SHEET_DELAY_MS);

    return () => clearTimeout(delayTimer);
  }, []);

  if (!isDelayElapsed) {
    return null;
  }

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <VStack gap={20} accessibilityState={{ busy: true }}>
        <VStack gap={6}>
          <TextSkeleton size="t3" className="w-3/4" />
          <TextSkeleton size="b3" className="w-1/2" />
        </VStack>
        <VStack gap={12}>
          <Skeleton className="h-32 rounded-2xl dark:bg-gray-2" />
          <Skeleton className="h-24 rounded-2xl dark:bg-gray-2" />
        </VStack>
      </VStack>
    </BottomSheet>
  );
};

CategoryDeleteBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const sheet = useSheetRoute('/settings/category-settings');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorFallback reset={reset} onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)} />
    </BottomSheet>
  );
};

interface CategoryDeleteConfirmDialogProps extends Pick<
  ComponentProps<typeof ConfirmDialog>,
  'isOpen' | 'onOpenChange'
> {
  category: TodoCategoryWithCount;
  preview: TodoCategoryDeletionPreview;
}

/** 지우는 동안 다이얼로그를 그대로 두고 삭제 버튼만 불러오는 중으로 바꾼다. 실패하면 mutation이 토스트로 한 번 알리고 다이얼로그는 남는다 */
function CategoryDeleteConfirmDialog({
  category,
  preview,
  isOpen,
  onOpenChange,
}: CategoryDeleteConfirmDialogProps) {
  const { t } = useTranslation(['todo', 'common']);
  const deleteCategory = useMutation(useDeleteTodoCategoryMutationOptions());
  const isDeletePending = deleteCategory.isPending;
  const deletionRequest = TodoCategoryDeletionPolicy.toDeletionRequest(preview, null);

  // 지우는 중에 바깥 탭·뒤로 가기로 닫으면 결과가 토스트로만 남아 끝날 때까지 닫지 않는다
  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen && isDeletePending) {
      return;
    }
    onOpenChange(nextIsOpen);
  };

  const handleDelete = () => {
    if (deletionRequest == null || isDeletePending) {
      return;
    }
    deleteCategory.mutate(
      { id: category.id, deletion: deletionRequest },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={
        <ConfirmDialog.Title>
          {t('categoryDelete.title', { name: category.name })}
        </ConfirmDialog.Title>
      }
      description={
        <ConfirmDialog.Description>
          {TodoCategoryDeletionPolicy.canDelete(preview)
            ? t('categoryDelete.description')
            : t('categoryDelete.lastCategory')}
        </ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton
          isDisabled={isDeletePending}
          onPress={() => onOpenChange(false)}
        >
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID="category-delete-confirm"
          color="danger"
          isDisabled={deletionRequest == null}
          isLoading={isDeletePending}
          onPress={handleDelete}
        >
          {t('common:actions.delete')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

interface TodoHandlingBottomSheetProps extends Pick<
  ComponentProps<typeof BottomSheet>,
  'isOpen' | 'onOpenChange'
> {
  category: TodoCategoryWithCount;
  preview: TodoCategoryDeletionPreview;
  onClose: () => void;
}

/** 지우는 동안에도 끌어내리거나 뒤로 가면 닫힌다. 요청은 이어지고 결과는 mutation이 토스트로 알린다 */
function TodoHandlingBottomSheet({
  category,
  preview,
  isOpen,
  onOpenChange,
  onClose,
}: TodoHandlingBottomSheetProps) {
  const { t } = useTranslation(['todo', 'common']);
  const { trackEvent } = useTrack();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const deleteCategory = useMutation(useDeleteTodoCategoryMutationOptions());
  const isDeletePending = deleteCategory.isPending;
  const [todoHandling, setTodoHandling] = useState<CategoryTodoHandling>('move');
  const [pickedMoveTargetCategoryId, setPickedMoveTargetCategoryId] = useState<number | null>(null);
  // 서버 id가 없는 임시 행으로는 옮길 수 없다
  const moveTarget = TodoCategoryPolicy.findMoveTarget(
    category,
    categoriesResult.categories.filter(
      (candidate) => !TodoCategoryPolicy.isOptimisticCategory(candidate),
    ),
    pickedMoveTargetCategoryId,
  );
  const deletionRequest = TodoCategoryDeletionPolicy.toDeletionRequest(preview, {
    todoHandling,
    moveToCategoryId: moveTarget?.id ?? null,
  });
  const isDeletingTodos = todoHandling === 'delete';
  const todoCountBucket = toTodoCountBucket(preview.todoCount);
  const hasSeries = preview.activeSeriesCount > 0;

  useEffect(() => {
    trackEvent('category_delete_sheet_viewed', {
      todo_count_bucket: todoCountBucket,
      has_series: hasSeries,
    });
  }, [trackEvent, todoCountBucket, hasSeries]);

  // 닫힘 애니메이션이 끝난 뒤에 온다. 지우는 중이거나 지운 뒤 닫힌 것은 취소가 아니다
  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen && !isDeletePending && !deleteCategory.isSuccess) {
      trackEvent('category_delete_cancelled', { todo_count_bucket: todoCountBucket });
    }
    onOpenChange?.(nextIsOpen);
  };

  const handleTodoHandlingChange = (value: string) => {
    const nextTodoHandling = CATEGORY_TODO_HANDLINGS.find((handling) => handling === value);
    if (nextTodoHandling != null) {
      setTodoHandling(nextTodoHandling);
    }
  };

  const handleMoveTargetChange = (categoryId: number) => {
    setPickedMoveTargetCategoryId(categoryId);
    setTodoHandling('move');
  };

  const handleDelete = () => {
    if (deletionRequest == null || isDeletePending) {
      return;
    }
    deleteCategory.mutate({ id: category.id, deletion: deletionRequest }, { onSuccess: onClose });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      footer={
        <DeleteActions
          cancel={
            <Button
              variant="weak"
              color="dark"
              size="large"
              display="full"
              isDisabled={isDeletePending}
              onPress={onClose}
            >
              {t('common:actions.cancel')}
            </Button>
          }
          submit={
            <Button
              testID="category-delete-submit"
              color={isDeletingTodos ? 'danger' : 'primary'}
              size="large"
              display="full"
              isDisabled={deletionRequest == null}
              isLoading={isDeletePending}
              onPress={handleDelete}
            >
              {isDeletingTodos
                ? t('categoryDelete.deleteAll.submit')
                : t('categoryDelete.move.submit')}
            </Button>
          }
        />
      }
    >
      <VStack gap={20} testID="category-delete-sheet">
        <VStack gap={6}>
          <H4 lineBreakStrategyIOS="hangul-word">
            {t('categoryDelete.title', { name: category.name })}
          </H4>
          <DeletionSummaryText
            todoCount={preview.todoCount}
            completedTodoCount={preview.completedTodoCount}
            activeSeriesCount={preview.activeSeriesCount}
          />
        </VStack>

        <RadioGroup
          value={todoHandling}
          onValueChange={handleTodoHandlingChange}
          isDisabled={isDeletePending}
          className="gap-3"
        >
          <TodoHandlingCard isSelected={todoHandling === 'move'}>
            <TodoHandlingOption
              value="move"
              title={t('categoryDelete.move.title')}
              description={t('categoryDelete.move.description')}
            />
            {moveTarget != null && (
              <MoveTargetRow
                deletingCategoryId={category.id}
                moveTargetCategoryId={moveTarget.id}
                onMoveTargetChange={handleMoveTargetChange}
                isDisabled={isDeletePending}
              />
            )}
          </TodoHandlingCard>

          <TodoHandlingCard isSelected={isDeletingTodos} isDanger>
            <TodoHandlingOption
              isDanger
              value="delete"
              title={t('categoryDelete.deleteAll.title')}
              description={
                TodoCategoryDeletionPolicy.shouldWarnHistoryLoss(preview)
                  ? t('categoryDelete.deleteAll.descriptionWithHistory')
                  : t('categoryDelete.deleteAll.description')
              }
            />
          </TodoHandlingCard>
        </RadioGroup>
      </VStack>
    </BottomSheet>
  );
}

type DeletionSummaryTextProps = Pick<
  TodoCategoryDeletionPreview,
  'todoCount' | 'completedTodoCount' | 'activeSeriesCount'
>;

/** 0인 개수는 문장에서 뺀다 */
function DeletionSummaryText({
  todoCount,
  completedTodoCount,
  activeSeriesCount,
}: DeletionSummaryTextProps) {
  const { t } = useTranslation('todo');
  const todos =
    completedTodoCount > 0
      ? t('categoryDelete.part.todoWithCompleted', {
          count: todoCount,
          completedCount: completedTodoCount,
        })
      : t('categoryDelete.part.todo', { count: todoCount });
  const series = t('categoryDelete.part.series', { count: activeSeriesCount });
  const summary = match({ hasTodos: todoCount > 0, hasSeries: activeSeriesCount > 0 })
    .with({ hasTodos: true, hasSeries: true }, () =>
      t('categoryDelete.summary.two', { first: todos, second: series }),
    )
    .with({ hasTodos: true, hasSeries: false }, () =>
      t('categoryDelete.summary.one', { items: todos }),
    )
    .with({ hasTodos: false }, () => t('categoryDelete.summary.one', { items: series }))
    .exhaustive();

  return (
    <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
      {summary}
    </Text>
  );
}

interface TodoHandlingCardProps extends Omit<ComponentProps<typeof Card>, 'style'> {
  isSelected: boolean;
  isDanger?: boolean;
}

/** 고른 처리의 테두리만 UI 스레드 CSS 전환으로 바꾼다(요금제 고르기와 같은 모양). 옮길 곳 행이 라디오 누름 안에 겹치지 않게 카드가 둘을 나란히 담는다 */
function TodoHandlingCard({
  isSelected,
  isDanger = false,
  className,
  ...props
}: TodoHandlingCardProps) {
  const { color: selectedBorderColor } = useResolveClassNames(
    isDanger ? 'text-error' : 'text-main',
  );
  const { color: idleBorderColor } = useResolveClassNames('text-gray-2');

  return (
    <AnimatedCard
      {...props}
      className={cn('gap-3 border-2 bg-white dark:bg-gray-2', className)}
      style={{
        borderColor: isSelected ? selectedBorderColor : idleBorderColor,
        transitionProperty: 'borderColor',
        transitionDuration: ANIMATION.durationMs.fast,
        transitionTimingFunction: ANIMATION.easing.easeOut,
      }}
    />
  );
}

interface TodoHandlingOptionProps extends Omit<
  ComponentProps<typeof RadioGroup.Item>,
  'children' | 'value'
> {
  value: CategoryTodoHandling;
  title: string;
  description: string;
  isDanger?: boolean;
}

function TodoHandlingOption({
  value,
  title,
  description,
  isDanger = false,
  ...props
}: TodoHandlingOptionProps) {
  return (
    <RadioGroup.Item value={value} testID={`category-delete-handling-${value}`} {...props}>
      <VStack gap={4} className="flex-1">
        <HStack align="center" gap={12}>
          <Box className="flex-1">
            <Text
              size="b2"
              weight="semibold"
              tone={isDanger ? 'danger' : 'neutral'}
              lineBreakStrategyIOS="hangul-word"
            >
              {title}
            </Text>
          </Box>
          <ChoiceRadio />
        </HStack>
        <WordWrapText size="b4" shade={6}>
          {description}
        </WordWrapText>
      </VStack>
    </RadioGroup.Item>
  );
}

interface MoveTargetRowProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  deletingCategoryId: number;
  moveTargetCategoryId: number;
  onMoveTargetChange: (categoryId: number) => void;
}

/** 할 일 작성기의 카테고리 고르기처럼 시트 위 시트에서 바꾼다 */
function MoveTargetRow({
  deletingCategoryId,
  moveTargetCategoryId,
  onMoveTargetChange,
  className,
  ...props
}: MoveTargetRowProps) {
  const { t } = useTranslation(['todo', 'common']);
  const overlay = useOverlay();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const moveTarget = TodoCategoryPolicy.findCategory(
    categoriesResult.categories,
    moveTargetCategoryId,
  );

  if (moveTarget == null) {
    return null;
  }

  const openMoveTargetPicker = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <ModalBottomSheet isOpen={isOpen} onOpenChange={() => close()} onExit={unmount}>
        <QueryErrorBoundary>
          <Suspense fallback={<CategorySelectInput.Loading />}>
            <CategorySelectInput
              defaultValue={moveTargetCategoryId}
              excludedCategoryId={deletingCategoryId}
              submitLabel={t('common:actions.confirm')}
              onSubmit={(categoryId) => {
                onMoveTargetChange(categoryId);
                close();
              }}
            />
          </Suspense>
        </QueryErrorBoundary>
      </ModalBottomSheet>
    ));
  };

  return (
    <PressableFeedback
      testID="category-delete-move-target"
      accessibilityRole="button"
      accessibilityLabel={t('categoryDelete.move.target', { name: moveTarget.name })}
      className={cn('rounded-xl', className)}
      onPress={openMoveTargetPicker}
      {...props}
    >
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        left={<Box className="size-2 rounded-full" style={{ backgroundColor: moveTarget.color }} />}
        contents={
          <Text size="b3" weight="medium" numberOfLines={1}>
            {moveTarget.name}
          </Text>
        }
        right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-6" />}
        horizontalPadding="medium"
        className="rounded-xl bg-gray-1 dark:bg-gray-3"
      />
    </PressableFeedback>
  );
}

/** 가장 큰 글자에서는 나란히 두면 라벨이 잘려 세로로 쌓고 삭제를 위에 둔다(AI 동의 시트와 같다) */
function DeleteActions({ cancel, submit }: { cancel: ReactNode; submit: ReactNode }) {
  const { fontScale } = useFontScale();

  if (fontScale === 'xlarge') {
    return (
      <VStack gap={8}>
        {submit}
        {cancel}
      </VStack>
    );
  }

  return (
    <HStack gap={8}>
      <Box className="flex-1">{cancel}</Box>
      <Box className="flex-1">{submit}</Box>
    </HStack>
  );
}
