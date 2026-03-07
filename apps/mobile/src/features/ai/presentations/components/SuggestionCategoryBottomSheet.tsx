import { zodResolver } from '@hookform/resolvers/zod';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { Box, Button, CheckIcon, ListRow, Text, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { BottomSheet, PressableFeedback } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';

const categorySelectSchema = z.object({
  categoryId: z.number().int().positive(),
});
type CategorySelectForm = z.infer<typeof categorySelectSchema>;

interface SuggestionCategoryBottomSheetProps {
  suggestionId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAccepted: () => void;
}

export function SuggestionCategoryBottomSheet({
  suggestionId,
  isOpen,
  onOpenChange,
  onAccepted,
}: SuggestionCategoryBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const handleSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());

  const { control, handleSubmit } = useForm<CategorySelectForm>({
    resolver: zodResolver(categorySelectSchema),
    defaultValues: {
      // biome-ignore lint/style/noNonNullAssertion: 서버 원칙상 카테고리는 항상 1개 이상 존재
      categoryId: data.categories[0]!.id,
    },
  });

  const onSubmit = handleSubmit((formData) => {
    handleSuggestionMutation.mutate(
      {
        suggestionId,
        input: {
          action: 'accept',
          categoryId: formData.categoryId,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onAccepted();
        },
      },
    );
  });

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          enableDynamicSizing
          detached
          bottomInset={insets.bottom || 16}
          className="mx-4"
          backgroundClassName="rounded-[24px]"
        >
          <VStack gap={20}>
            <BottomSheet.Title>
              <Text size="b3" weight="semibold">
                카테고리 선택
              </Text>
            </BottomSheet.Title>

            <Controller
              control={control}
              name="categoryId"
              render={({ field: { value, onChange } }) => (
                <VStack gap={8}>
                  {data.categories.map((category) => {
                    const isSelected = value === category.id;

                    return (
                      <PressableFeedback
                        key={category.id}
                        onPress={() => onChange(category.id)}
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
              )}
            />

            <Button size="large" onPress={onSubmit} isLoading={handleSuggestionMutation.isPending}>
              생성하기
            </Button>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
