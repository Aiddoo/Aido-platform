import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useReorderTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-reorder-todo-category-mutation-options';
import { Box, Button, HStack, ListRow, MenuIcon, Text, useOverlay, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import * as Haptics from 'expo-haptics';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useCallback } from 'react';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';
import { useDraggableReorderList } from '../hooks/use-draggable-reorder-list';
import { CategoryDeleteDialog } from './CategoryDeleteDialog';
import { CategoryEditBottomSheet } from './CategoryEditBottomSheet';

export type CategoryListMode = 'edit' | 'reorder';

interface CategoryListProps {
  mode: CategoryListMode;
}

export function CategoryList({ mode }: CategoryListProps) {
  const editOverlay = useOverlay();
  const deleteOverlay = useOverlay();
  const containerBgStyle = useResolveClassNames('bg-white');
  const { data, dataUpdatedAt } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const reorderMutation = useMutation(useReorderTodoCategoryMutationOptions());
  const { items: draggableCategories, onDragEnd } = useDraggableReorderList({
    items: data.categories,
    updatedAt: dataUpdatedAt,
    isPending: reorderMutation.isPending,
    onReorder: ({ movedItemId, targetId, position }) => {
      reorderMutation.mutate({
        id: movedItemId,
        input: { targetCategoryId: targetId, position },
      });
    },
  });

  const openEditSheet = (category: TodoCategoryWithCount) => {
    editOverlay.open(({ isOpen, close, exit }) => (
      <CategoryEditBottomSheet
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        category={category}
      />
    ));
  };

  const openDeleteDialog = (category: TodoCategoryWithCount) => {
    deleteOverlay.open(({ isOpen, close, exit }) => (
      <CategoryDeleteDialog
        categoryId={category.id}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      />
    ));
  };

  const handleDrag = (drag: () => void) => () => {
    if (mode !== 'reorder' || reorderMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  };

  const handlePlaceholderIndexChange = useCallback((index: number) => {
    if (index >= 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  return (
    <DraggableFlatList
      data={draggableCategories}
      keyExtractor={(item) => String(item.id)}
      onPlaceholderIndexChange={handlePlaceholderIndexChange}
      renderItem={({
        item,
        drag,
        isActive,
      }: {
        item: TodoCategoryWithCount;
        drag: () => void;
        isActive: boolean;
      }) => (
        <ScaleDecorator activeScale={mode === 'reorder' ? 1.02 : 1}>
          <PressableFeedback
            onLongPress={mode === 'reorder' ? handleDrag(drag) : undefined}
            isDisabled={isActive}
            className={cn('rounded-xl', isActive && 'bg-white shadow-md shadow-black/10')}
          >
            <ListRow
              left={<Box className="size-2 rounded-full" style={{ backgroundColor: item.color }} />}
              contents={
                <Text size="b3" weight="medium">
                  {item.name}
                </Text>
              }
              right={
                <Animated.View
                  key={mode}
                  entering={FadeIn.duration(250)}
                  className="h-9 justify-center"
                >
                  {match(mode)
                    .with('edit', () => (
                      <HStack align="center" gap={4}>
                        <Button
                          variant="weak"
                          color="dark"
                          size="small"
                          display="inline"
                          onPress={() => openEditSheet(item)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="weak"
                          color="danger"
                          size="small"
                          display="inline"
                          onPress={() => openDeleteDialog(item)}
                        >
                          삭제
                        </Button>
                      </HStack>
                    ))
                    .with('reorder', () => (
                      <MenuIcon
                        width={fontScaledSize(18)}
                        height={fontScaledSize(18)}
                        colorClassName="text-gray-5"
                      />
                    ))
                    .exhaustive()}
                </Animated.View>
              }
              horizontalPadding="medium"
            />
          </PressableFeedback>
        </ScaleDecorator>
      )}
      onDragEnd={onDragEnd}
      containerStyle={{ ...containerBgStyle, borderRadius: 16, padding: 8 }}
    />
  );
}

CategoryList.Loading = function Loading() {
  return (
    <VStack gap={8} className="bg-white rounded-2xl p-2">
      {times(2).map((i) => (
        <ListRow
          key={`category-loading-${i}`}
          left={<Skeleton className="size-2 rounded-full" />}
          contents={<Skeleton className="h-4 w-20 rounded" />}
          right={<Skeleton className="size-5 rounded" />}
          horizontalPadding="medium"
        />
      ))}
    </VStack>
  );
};
