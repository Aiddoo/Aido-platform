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
  QueryErrorFallback,
  SettingsListGroup,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Fragment, type ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { TodoCategoryPolicy } from '../domains/todo-category.model';
import type { TodoCategoryWithCount } from '../domains/todo-category.model';
import { prefetchDeletionPreview } from '../queries/todo-category-cache';
import { useReorderTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import {
  useGetTodoCategoriesQueryOptions,
  useGetTodoCategoryDeletionPreviewQueryOptions,
} from '../queries/todo-category.queries';

/** 카드 안에 그리는 행만 둔다. 카드와 제목은 화면이 감싼다 */
export function CategoryList() {
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <FlashList
      data={data.categories}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <CategoryList.EditItem category={item} />}
      ItemSeparatorComponent={SettingsListGroup.Separator}
    />
  );
}

/** 길게 눌러 옮긴다. 끌어 올린 행이 구분선을 끌고 다니지 않게 구분선 없이 그린다 */
CategoryList.Reorder = function Reorder() {
  const { data, dataUpdatedAt } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const reorderCategory = useMutation(useReorderTodoCategoryMutationOptions());
  const reorderableList = useReorderableList({
    items: data.categories,
    updatedAt: dataUpdatedAt,
    isPending: reorderCategory.isPending,
    getItemId: (category) => category.id,
    isOptimistic: TodoCategoryPolicy.isOptimisticCategory,
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
        TodoCategoryPolicy.canReorder(reorderableList.data) ? (
          <Box className="px-2 pt-2">
            <ReorderCoachmark kind="category" />
          </Box>
        ) : undefined
      }
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <CategoryList.ReorderItem category={item} />}
    />
  );
};

interface CategoryRowProps {
  category: TodoCategoryWithCount;
  right: ReactNode;
}

function CategoryRow({ category, right }: CategoryRowProps) {
  const { t } = useTranslation('settings');

  return (
    <ListRow
      left={<Box className="size-2 rounded-full" style={{ backgroundColor: category.color }} />}
      contents={
        <VStack gap={2}>
          <Text size="b2" shade={8} numberOfLines={1}>
            {category.name}
          </Text>
          <Text size="b4" shade={6}>
            {t('categorySettings.todoCount', { count: category.todoCount })}
          </Text>
        </VStack>
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
  const queryClient = useQueryClient();
  const deletionPreviewOptions = useGetTodoCategoryDeletionPreviewQueryOptions({
    categoryId: category.id,
  });
  const isOptimistic = TodoCategoryPolicy.isOptimisticCategory(category);

  // 시트가 미리보기를 기다리지 않게 route로 넘어가는 동안 받는다
  const handleDeletePress = useSingleTap(() => {
    prefetchDeletionPreview(queryClient, deletionPreviewOptions);
    router.push({
      pathname: '/todo-categories/[categoryId]/delete',
      params: { categoryId: category.id },
    });
  });

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
              onPress={handleDeletePress}
              testID={`category-delete-${category.id}`}
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

// 목록 카드 안에서 기본 오류 안내를 그대로 그린다. SettingsListGroup.Error는 카드를 한 번 더 감싼다
CategoryList.Error = QueryErrorFallback;

CategoryList.Loading = function Loading() {
  return (
    <>
      {range(2).map((index) => (
        <Fragment key={index}>
          {index > 0 && <SettingsListGroup.Separator />}
          <ListRow
            left={<Skeleton className="size-2 rounded-full dark:bg-gray-2" />}
            contents={
              <VStack gap={2}>
                <TextSkeleton size="b2" className="w-20" />
                <TextSkeleton size="b4" className="w-12" />
              </VStack>
            }
            right={
              <Box className="h-9 justify-center">
                <Skeleton className="h-8 w-12 rounded-xl dark:bg-gray-2" />
              </Box>
            }
            horizontalPadding="medium"
            verticalPadding="medium"
          />
        </Fragment>
      ))}
    </>
  );
};
