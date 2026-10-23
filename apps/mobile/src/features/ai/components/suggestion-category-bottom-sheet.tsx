import { CategorySelectBottomSheet } from '@src/features/todo/components/category-select-bottom-sheet';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
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
      value={defaultCategoryId}
      onChange={async (categoryId) => {
        if (suggestionId == null) {
          return;
        }

        const accepted = await handleSuggestionMutation
          .mutateAsync({ suggestionId, input: { action: 'accept', categoryId } })
          .catch(() => null);

        if (accepted) {
          onOpenChange(false);
          onAccepted();
        }
      }}
      submitLabel={t('suggestions.category.submit')}
    />
  );
}
