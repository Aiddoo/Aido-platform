import { CategorySelectBottomSheet } from '@src/features/todo/presentations/components/CategorySelectBottomSheet';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';

interface SuggestionCategoryBottomSheetProps {
  suggestionId: number | null;
  suggestedCategoryId?: number | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAccepted: () => void;
}

export function SuggestionCategoryBottomSheet({
  suggestionId,
  suggestedCategoryId,
  isOpen,
  onOpenChange,
  onAccepted,
}: SuggestionCategoryBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const handleSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());

  const firstCategoryId = data.categories[0]?.id ?? 0;
  const defaultCategoryId =
    suggestedCategoryId != null && data.categories.some((c) => c.id === suggestedCategoryId)
      ? suggestedCategoryId
      : firstCategoryId;

  return (
    <CategorySelectBottomSheet
      detached
      bottomInset={insets.bottom || 16}
      className="mx-4"
      backgroundClassName="rounded-[24px]"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      selectedCategoryId={defaultCategoryId}
      onSelect={(categoryId) => {
        if (suggestionId == null) return;
        handleSuggestionMutation.mutate(
          { suggestionId, input: { action: 'accept', categoryId } },
          {
            onSuccess: () => {
              onOpenChange(false);
              onAccepted();
            },
          },
        );
      }}
      submitLabel="생성하기"
      isLoading={handleSuggestionMutation.isPending}
    />
  );
}
