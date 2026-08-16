import type { TodoCategory } from '@src/features/todo/models/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheet, Box, Button, CheckIcon, ListRow, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

interface CategorySelectBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedCategoryId: number;
  onSelect: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
}

export function CategorySelectBottomSheet({
  isOpen,
  onOpenChange,
  selectedCategoryId,
  onSelect,
  submitLabel,
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
        />
      )}
    </BottomSheet>
  );
}

interface CategorySelectContentProps {
  categories: TodoCategory[];
  selectedCategoryId: number;
  onSelect: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
}

export function CategorySelectContent({
  categories,
  selectedCategoryId,
  onSelect,
  submitLabel,
}: CategorySelectContentProps) {
  const { t } = useTranslation('todo');
  const [localCategoryId, setLocalCategoryId] = useState(selectedCategoryId);

  // 보내는 동안의 상태는 이 시트가 스스로 안다 — 오버레이는 열릴 때의 화면을 스냅샷으로
  // 들고 있어서, 밖에서 넘긴 진행 중 플래그는 갱신되지 않고 얼어붙는다.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      await onSelect(localCategoryId);
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <Button size="large" onPress={submit} isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </VStack>
  );
}
