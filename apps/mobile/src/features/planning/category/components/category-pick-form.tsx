import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, CheckIcon, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { PressableFeedback, RadioGroup, Skeleton } from 'heroui-native';
import { useState } from 'react';

import { type FilterTodoCategory, TodoCategoryPolicy } from '../domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';

const LOADING_ROW_COUNT = 3;

interface CategoryPickFormProps {
  /** 처음 선택된 카테고리. 시트 안에서 고른 값은 제출할 때 onSubmit으로 전달한다. */
  defaultValue: number;
  onSubmit: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
  isLoading?: boolean;
  /** 보일 카테고리. 지우는 카테고리의 할 일을 옮길 곳을 고를 때 옮길 수 있는 곳만 남긴다 */
  filters?: FilterTodoCategory;
}

export function CategoryPickForm({
  defaultValue,
  onSubmit,
  submitLabel,
  isLoading = false,
  filters,
}: CategoryPickFormProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const {
    data: { categories },
  } = useSuspenseQuery(useGetTodoCategoriesQueryOptions({ filters }));
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultValue);

  return (
    <VStack gap={20}>
      <Text size="b3" weight="semibold">
        {t('category.select')}
      </Text>

      {/* 하나만 고르는 목록이라 스크린 리더에 라디오와 선택 상태로 알린다. 눌림 면은 그대로 둔다 */}
      <RadioGroup
        value={String(selectedCategoryId)}
        onValueChange={(value) => {
          const category = categories.find(({ id }) => String(id) === value);
          if (category != null) {
            setSelectedCategoryId(category.id);
          }
        }}
        className="gap-2"
      >
        {categories.map((category) => (
          <RadioGroup.Item
            key={category.id}
            value={String(category.id)}
            isDisabled={TodoCategoryPolicy.isOptimisticCategory(category)}
            asChild
          >
            {({ isSelected, isDisabled }) => (
              <PressableFeedback
                testID={`category-select-option-${category.id}`}
                accessibilityLabel={category.name}
                isDisabled={isDisabled}
                // RadioGroup.Item(asChild)의 radio-group__item(가로 줄·가운데·양끝·gap-3)을 덮어 행이 폭을 채운다
                className="flex-col items-stretch justify-start gap-0 rounded-xl"
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
                      <CheckIcon
                        width={fontScaledSize(18)}
                        height={fontScaledSize(18)}
                        colorClassName="text-main"
                      />
                    ) : undefined
                  }
                  horizontalPadding="medium"
                  className="rounded-xl bg-gray-1 dark:bg-gray-2"
                />
              </PressableFeedback>
            )}
          </RadioGroup.Item>
        ))}
      </RadioGroup>

      <Button
        size="large"
        testID="category-select-submit"
        onPress={() => onSubmit(selectedCategoryId)}
        isLoading={isLoading}
      >
        {submitLabel}
      </Button>
    </VStack>
  );
}

CategoryPickForm.Loading = function Loading() {
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
            className="rounded-xl bg-gray-1 dark:bg-gray-2"
          />
        ))}
      </VStack>
      <Skeleton className="h-12 w-full rounded-lg" />
    </VStack>
  );
};
