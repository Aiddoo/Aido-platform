import { FlashList } from '@shopify/flash-list';
import { ReorderCoachmark } from '@src/features/device/coachmark/components/reorder-coachmark';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  ListRow,
  MenuIcon,
  Text,
  TextSkeleton,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { useResolveClassNames } from 'uniwind';

import { TodoCategoryPolicy } from '../domains/todo-category.model';
import { useReorderTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';
import type { TodoCategoryWithCount } from '../schemas/todo-category.schema';
import { CategoryDeleteDialog } from './category-delete-dialog';

/** 고치기·지우기 탭의 목록 */
export function CategoryList() {
  const containerBgStyle = useResolveClassNames('bg-gray-1');
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <FlashList
      data={data.categories}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <CategoryList.EditItem category={item} />}
      style={{ ...containerBgStyle, borderRadius: 16, padding: 8 }}
    />
  );
}

/** 순서 탭의 목록. 길게 눌러 옮긴다 */
CategoryList.Reorder = function Reorder() {
  const containerBgStyle = useResolveClassNames('bg-gray-1');
  const { data, dataUpdatedAt } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const reorderCategory = useMutation(useReorderTodoCategoryMutationOptions());
  const reorderableList = useReorderableList({
    items: data.categories,
    updatedAt: dataUpdatedAt,
    isPending: reorderCategory.isPending,
    getItemId: (category) => category.id,
    onReorder: ({ instruction: { movedId, targetId, position } }) => {
      reorderCategory.mutate({
        id: movedId,
        input: { targetCategoryId: targetId, position },
      });
    },
  });

  return (
    <ReorderableList
      {...reorderableList}
      shouldUpdateActiveItem
      // 목록 위에 나타나면 행이 통째로 밀려 누르려던 곳이 움직인다. 나타나고 닫혀도 행은 그 자리다
      ListFooterComponent={
        TodoCategoryPolicy.canReorderCategories(reorderableList.data) ? (
          <Box className="pt-2">
            <ReorderCoachmark kind="category" />
          </Box>
        ) : undefined
      }
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <CategoryList.ReorderItem category={item} />}
      style={{ ...containerBgStyle, borderRadius: 16, padding: 8 }}
    />
  );
};

interface CategoryRowProps {
  category: TodoCategoryWithCount;
  right: ReactNode;
}

function CategoryRow({ category, right }: CategoryRowProps) {
  return (
    <ListRow
      left={<Box className="size-2 rounded-full" style={{ backgroundColor: category.color }} />}
      contents={
        <Text size="b3" weight="medium">
          {category.name}
        </Text>
      }
      right={
        <Animated.View entering={FadeIn.duration(250)} className="h-9 justify-center">
          {right}
        </Animated.View>
      }
      horizontalPadding="medium"
      verticalPadding="medium"
    />
  );
}

interface CategoryListItemProps {
  category: TodoCategoryWithCount;
}

CategoryList.EditItem = function EditItem({ category }: CategoryListItemProps) {
  const { t } = useTranslation('common');
  const push = useSingleTap(router.push);
  const deleteOverlay = useOverlay();
  const isOptimistic = TodoCategoryPolicy.isOptimisticCategory(category);

  const openDeleteDialog = () => {
    deleteOverlay.open(({ isOpen, close, unmount }) => (
      <CategoryDeleteDialog
        categoryId={category.id}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            unmount();
          }
        }}
      />
    ));
  };

  return (
    <Box className="rounded-xl">
      <CategoryRow
        category={category}
        right={
          <HStack align="center" gap={4}>
            <Button
              variant="weak"
              color="dark"
              size="small"
              display="inline"
              isDisabled={isOptimistic}
              onPress={() =>
                push({
                  pathname: '/todo-categories/[categoryId]/edit',
                  params: { categoryId: category.id },
                })
              }
            >
              {t('actions.edit')}
            </Button>
            <Button
              variant="weak"
              color="danger"
              size="small"
              display="inline"
              isDisabled={isOptimistic}
              onPress={openDeleteDialog}
            >
              {t('actions.delete')}
            </Button>
          </HStack>
        }
      />
    </Box>
  );
};

CategoryList.ReorderItem = function ReorderItem({ category }: CategoryListItemProps) {
  const fontScaledSize = useFontScaledSize();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <PressableFeedback
      onLongPress={drag}
      isDisabled={isActive || TodoCategoryPolicy.isOptimisticCategory(category)}
      className={cn('rounded-xl', isActive && 'bg-white shadow-md shadow-black/10')}
    >
      <CategoryRow
        category={category}
        right={
          <MenuIcon
            width={fontScaledSize(18)}
            height={fontScaledSize(18)}
            colorClassName="text-gray-5"
          />
        }
      />
    </PressableFeedback>
  );
};

CategoryList.Loading = function Loading() {
  return (
    <VStack className="bg-gray-1 rounded-2xl p-2">
      {range(2).map((index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-2 rounded-full dark:bg-gray-2" />}
          contents={<TextSkeleton size="b3" className="w-20" />}
          right={
            <Box className="h-9 justify-center">
              <Skeleton className="h-8 w-12 rounded-xl dark:bg-gray-2" />
            </Box>
          }
          horizontalPadding="medium"
          verticalPadding="medium"
        />
      ))}
    </VStack>
  );
};
