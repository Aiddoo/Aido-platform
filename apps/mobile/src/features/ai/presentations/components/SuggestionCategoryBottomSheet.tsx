import { CategorySelectBottomSheet } from '@src/features/todo/presentations/components/CategorySelectBottomSheet';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

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
  const { t } = useTranslation('ai');
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const handleSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());

  const firstCategoryId = data.categories[0]?.id;
  const defaultCategoryId =
    suggestedCategoryId != null && data.categories.some((c) => c.id === suggestedCategoryId)
      ? suggestedCategoryId
      : firstCategoryId;

  if (defaultCategoryId == null) {
    return null;
  }

  return (
    <CategorySelectBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      selectedCategoryId={defaultCategoryId}
      onSelect={(categoryId) => {
        if (suggestionId == null) {
          return;
        }

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
      submitLabel={t('suggestions.category.submit')}
      isLoading={handleSuggestionMutation.isPending}
    />
  );
}
