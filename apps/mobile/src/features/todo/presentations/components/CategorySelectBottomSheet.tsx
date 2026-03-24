import type { TodoCategory } from '@src/features/todo/models/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { BottomSheet, Box, Button, CheckIcon, ListRow, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

interface CategorySelectBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
  submitLabel: string;
  isLoading?: boolean;
}

export function CategorySelectBottomSheet({
  isOpen,
  onOpenChange,
  selectedCategoryId,
  onSelect,
  submitLabel,
  isLoading = false,
}: CategorySelectBottomSheetProps) {
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {isOpen && (
        <CategorySelectContent
          categories={data.categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          submitLabel={submitLabel}
          isLoading={isLoading}
        />
      )}
    </BottomSheet>
  );
}

interface CategorySelectContentProps {
  categories: TodoCategory[];
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
  submitLabel: string;
  isLoading: boolean;
}

function CategorySelectContent({
  categories,
  selectedCategoryId,
  onSelect,
  submitLabel,
  isLoading,
}: CategorySelectContentProps) {
  const [localCategoryId, setLocalCategoryId] = useState(selectedCategoryId);

  return (
    <VStack gap={20}>
      <Text size="b3" weight="semibold">
        카테고리 선택
      </Text>

      <VStack gap={8}>
        {categories.map((category) => {
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
                className="bg-gray-1 rounded-xl"
              />
            </PressableFeedback>
          );
        })}
      </VStack>

      <Button size="large" onPress={() => onSelect(localCategoryId)} isLoading={isLoading}>
        {submitLabel}
      </Button>
    </VStack>
  );
}
