import { ReorderCoachmark } from '@src/features/device/coachmark/components/reorder-coachmark';
import { useReorderTodoCategoryMutationOptions } from '@src/features/planning/category/queries/todo-category.mutations';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import type { TodoCategoryWithCount } from '@src/features/planning/category/schemas/todo-category.schema';
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
import Animated, { FadeIn } from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { CategoryDeleteDialog } from './category-delete-dialog';

type CategoryListMode = 'edit' | 'reorder';

interface CategoryListProps {
  mode: CategoryListMode;
}

export function CategoryList({ mode }: CategoryListProps) {
  const containerBgStyle = useResolveClassNames('bg-gray-1');
  const { data, dataUpdatedAt } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const reorderMutation = useMutation(useReorderTodoCategoryMutationOptions());
  const reorderableList = useReorderableList({
    items: data.categories,
    updatedAt: dataUpdatedAt,
    isPending: reorderMutation.isPending,
    getItemId: (category) => category.id,
    onReorder: ({ instruction: { movedId, targetId, position } }) => {
      reorderMutation.mutate({
        id: movedId,
        input: { targetCategoryId: targetId, position },
      });
    },
  });

  return (
    <ReorderableList
      {...reorderableList}
      dragEnabled={reorderableList.dragEnabled && mode === 'reorder'}
      shouldUpdateActiveItem
      ListHeaderComponent={
        mode === 'reorder' && reorderableList.data.length >= 2 ? (
          <Box className="pb-2">
            <ReorderCoachmark kind="category" />
          </Box>
        ) : undefined
      }
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <CategoryList.Item category={item} mode={mode} />}
      style={{ ...containerBgStyle, borderRadius: 16, padding: 8 }}
    />
  );
}

interface CategoryListItemProps {
  category: TodoCategoryWithCount;
  mode: CategoryListProps['mode'];
}

CategoryList.Item = function Item({ category, mode }: CategoryListItemProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('common');
  const push = useSingleTap(router.push);
  const deleteOverlay = useOverlay();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

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
    <PressableFeedback
      onLongPress={mode === 'reorder' ? drag : undefined}
      isDisabled={isActive}
      className={cn('rounded-xl', isActive && 'bg-white shadow-md shadow-black/10')}
    >
      <ListRow
        left={<Box className="size-2 rounded-full" style={{ backgroundColor: category.color }} />}
        contents={
          <Text size="b3" weight="medium">
            {category.name}
          </Text>
        }
        right={
          <Animated.View key={mode} entering={FadeIn.duration(250)} className="h-9 justify-center">
            {match(mode)
              .with('edit', () => (
                <HStack align="center" gap={4}>
                  <Button
                    variant="weak"
                    color="dark"
                    size="small"
                    display="inline"
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
                    onPress={() => openDeleteDialog()}
                  >
                    {t('actions.delete')}
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
        verticalPadding="medium"
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
