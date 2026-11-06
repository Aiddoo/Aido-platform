import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/todo/queries/get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, CheckIcon, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';

const LOADING_ROW_COUNT = 3;

interface CategorySelectInputProps {
  /** 처음 선택된 카테고리. 시트 안에서 고른 값은 제출할 때 onChange로 전달한다. */
  value: number;
  onChange: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
  isLoading?: boolean;
}

export function CategorySelectInput({
  value,
  onChange,
  submitLabel,
  isLoading = false,
}: CategorySelectInputProps) {
  const { t } = useTranslation('todo');
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const [localCategoryId, setLocalCategoryId] = useState(value);

  return (
    <VStack gap={20}>
      <Text size="b3" weight="semibold">
        {t('category.select')}
      </Text>

      <VStack gap={8}>
        {categoriesResult.categories.map((category) => {
          const isSelected = localCategoryId === category.id;

          return (
            <PressableFeedback
              key={category.id}
              onPress={() => setLocalCategoryId(category.id)}
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

      <Button size="large" onPress={() => onChange(localCategoryId)} isLoading={isLoading}>
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
        {times(LOADING_ROW_COUNT, (index) => (
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
