import type { ReorderTodoCategoryInput } from '@aido/validators';
import type { TodoCategoryWithCount } from '@src/features/todo/models/todo-category.model';
import { getTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { reorderTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/reorder-todo-category-mutation-options';
import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DragIcon, EditIcon, TrashIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useEffect, useState } from 'react';
import type { DragEndParams } from 'react-native-draggable-flatlist';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { CategoryDeleteDialog } from './CategoryDeleteDialog';
import { CategoryEditBottomSheet } from './CategoryEditBottomSheet';

export const CategoryList = () => {
  const editOverlay = useOverlay();
  const deleteOverlay = useOverlay();
  const { data } = useSuspenseQuery(getTodoCategoriesQueryOptions());
  const reorderMutation = useMutation(reorderTodoCategoryMutationOptions());
  const [categories, setCategories] = useState(data.categories);

  useEffect(() => {
    setCategories(data.categories);
  }, [data.categories]);

  const openEditSheet = (category: TodoCategoryWithCount) => {
    editOverlay.open(({ isOpen, close, exit }) => (
      <CategoryEditBottomSheet
        isOpen={isOpen}
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

  const handleDragEnd = ({
    data: reorderedData,
    from,
    to,
  }: DragEndParams<TodoCategoryWithCount>) => {
    if (from === to) return;

    const movedCategory = reorderedData[to];
    if (!movedCategory) return;

    setCategories(reorderedData);

    let input: ReorderTodoCategoryInput;

    if (to === 0) {
      const target = reorderedData[1];

      if (!target) return;
      input = { position: 'before', targetCategoryId: target.id };
    } else {
      const target = reorderedData[to - 1];

      if (!target) return;
      input = { targetCategoryId: target.id, position: 'after' };
    }

    reorderMutation.mutate({ id: movedCategory.id, input });
  };

  return (
    <DraggableFlatList
      data={categories}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator>
          <ListRow
            left={
              <PressableFeedback onPressIn={drag} isDisabled={isActive}>
                <DragIcon width={18} height={18} colorClassName="text-gray-6" />
              </PressableFeedback>
            }
            contents={
              <HStack align="center" gap={8}>
                <Box className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                <Text size="b3" weight="medium">
                  {item.name}
                </Text>
              </HStack>
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
        </ScaleDecorator>
      )}
      onDragEnd={handleDragEnd}
      containerStyle={{ backgroundColor: 'white', borderRadius: 16, padding: 8 }}
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
