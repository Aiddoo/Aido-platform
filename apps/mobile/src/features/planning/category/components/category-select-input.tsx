import { useTranslation } from '@src/shared/i18n';
import { Box, Button, CheckIcon, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';

import { TodoCategoryPolicy } from '../domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';

const LOADING_ROW_COUNT = 3;

interface CategorySelectInputProps {
  /** 처음 선택된 카테고리. 시트 안에서 고른 값은 제출할 때 onSubmit으로 전달한다. */
  defaultValue: number;
  onSubmit: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
  isLoading?: boolean;
  /** 고를 수 없는 카테고리(지우는 카테고리의 할 일을 옮길 곳을 고를 때 그 카테고리) */
  excludedCategoryId?: number;
}

export function CategorySelectInput({
  defaultValue,
  onSubmit,
  submitLabel,
  isLoading = false,
  excludedCategoryId,
}: CategorySelectInputProps) {
  const { t } = useTranslation('todo');
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const [localCategoryId, setLocalCategoryId] = useState(defaultValue);
  const excludedCategory =
    excludedCategoryId == null
      ? null
      : TodoCategoryPolicy.findCategory(categoriesResult.categories, excludedCategoryId);
  const categories =
    excludedCategory == null
      ? categoriesResult.categories
      : TodoCategoryPolicy.getMoveTargets(excludedCategory, categoriesResult.categories);

  return (
    <VStack gap={20}>
      <Text size="b3" weight="semibold">
        {t('category.select')}
      </Text>

      <VStack gap={8}>
        {categories.map((category) => {
          const isSelected = localCategoryId === category.id;

          return (
            <PressableFeedback
              key={category.id}
              testID={`category-select-option-${category.id}`}
              accessibilityRole="button"
              accessibilityLabel={category.name}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setLocalCategoryId(category.id)}
              isDisabled={TodoCategoryPolicy.isOptimisticCategory(category)}
              className="rounded-xl"
            >
              <PressableFeedback.Highlight className="rounded-xl" />
              <ListRow
                left={
                  <Box
                    className="size-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                }
                contents={<Text size="b3">{category.name}</Text>}
                right={
                  isSelected ? (
                    <CheckIcon width={18} height={18} colorClassName="text-main" />
                  ) : undefined
                }
                horizontalPadding="medium"
                className="bg-gray-1 rounded-xl dark:bg-gray-2"
              />
            </PressableFeedback>
          );
        })}
      </VStack>

      <Button
        size="large"
        testID="category-select-submit"
        onPress={() => onSubmit(localCategoryId)}
        isLoading={isLoading}
      >
        {submitLabel}
      </Button>
    </VStack>
  );
}

CategorySelectInput.Loading = function Loading() {
  return (
    <VStack gap={20}>
      <TextSkeleton size="b3" className="w-24" />
      <VStack gap={8}>
        {range(LOADING_ROW_COUNT).map((index) => (
          <ListRow
            key={index}
            left={<Skeleton className="size-2 rounded-full" />}
            contents={<TextSkeleton size="b3" className="w-24" />}
            horizontalPadding="medium"
            className="bg-gray-1 rounded-xl dark:bg-gray-2"
          />
        ))}
      </VStack>
      <Skeleton className="h-12 w-full rounded-lg" />
    </VStack>
  );
};
