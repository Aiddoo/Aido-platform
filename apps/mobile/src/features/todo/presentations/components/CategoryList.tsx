import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useReorderTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-reorder-todo-category-mutation-options';
import {
  Box,
  EditIcon,
  HStack,
  ListRow,
  Text,
  TrashIcon,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useResolveClassNames } from 'uniwind';
import { useDraggableReorderList } from '../hooks/use-draggable-reorder-list';
import { CategoryDeleteDialog } from './CategoryDeleteDialog';
import { CategoryEditBottomSheet } from './CategoryEditBottomSheet';

export const CategoryList = () => {
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

  return (
    <DraggableFlatList
      data={draggableCategories}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator activeScale={1.015}>
          <PressableFeedback
            onLongPress={reorderMutation.isPending ? undefined : drag}
            isDisabled={isActive}
            className={cn(isActive && 'bg-gray-1 rounded-xl')}
          >
            <ListRow
              left={<Box className="size-2 rounded-full" style={{ backgroundColor: item.color }} />}
              contents={
                <Text size="b3" weight="medium">
                  {item.name}
                </Text>
              }
              right={
                <HStack align="center" gap={4}>
                  <PressableFeedback onPress={() => openEditSheet(item)} className="p-1">
                    <EditIcon width={18} height={18} colorClassName="text-gray-6" />
                  </PressableFeedback>
                  <PressableFeedback onPress={() => openDeleteDialog(item)} className="p-1">
                    <TrashIcon width={18} height={18} colorClassName="text-gray-6" />
                  </PressableFeedback>
                </HStack>
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
};

CategoryList.Loading = function Loading() {
  return (
    <VStack gap={8} className="bg-white rounded-2xl p-2">
      {times(2).map((i) => (
        <ListRow
          key={`category-loading-${i}`}
          left={<Skeleton className="size-5 rounded" />}
          contents={
            <HStack align="center" gap={8}>
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-20 rounded" />
            </HStack>
          }
          right={
            <HStack align="center" gap={4}>
              <Skeleton className="size-5 rounded" />
              <Skeleton className="size-5 rounded" />
            </HStack>
          }
          horizontalPadding="medium"
        />
      ))}
    </VStack>
  );
};
