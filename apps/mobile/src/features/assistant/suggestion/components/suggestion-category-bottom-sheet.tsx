import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import { RouteBottomSheet, type SheetRouteExit } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { type ComponentProps, useEffect } from 'react';

import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { suggestionParamsSchema } from '../schemas/suggestion-params.schema';

type SuggestionCategoryBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
>;

/** 제안을 받아들일 카테고리를 고르는 시트. 대상은 `/suggestions/[suggestionId]/category` route에서 읽는다. */
export function SuggestionCategoryBottomSheet(props: SuggestionCategoryBottomSheetProps) {
  return (
    <RouteBottomSheet
      {...props}
      fallbackHref="/suggestions"
      loading={<SuggestionCategoryBottomSheet.Loading />}
    >
      {(sheet) =>
        sheet.isOpen && <SuggestionCategoryBottomSheet.AcceptForm onClose={sheet.close} />
      }
    </RouteBottomSheet>
  );
}

SuggestionCategoryBottomSheet.AcceptForm = function AcceptForm({
  onClose,
}: {
  onClose: (next?: SheetRouteExit) => void;
}) {
  const { t } = useTranslation('ai');
  const [{ suggestionId }] = useRouteParams(suggestionParamsSchema);
  const [{ data: suggestions }, { data: categoriesData }] = useSuspenseQueries({
    queries: [useGetSuggestionsQueryOptions(), useGetTodoCategoriesQueryOptions()],
  });
  const suggestion = useRetainedValue(
    suggestions.find((candidate) => candidate.id === suggestionId) ?? null,
  );
  const defaultCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesData.categories,
    suggestion?.suggestedCategoryId ?? null,
  );
  const actOnSuggestionMutation = useMutation(useActOnSuggestionMutationOptions());

  useEffect(() => {
    if (suggestion == null || defaultCategoryId == null) {
      onClose();
    }
  }, [suggestion, defaultCategoryId, onClose]);

  if (suggestion == null || defaultCategoryId == null) {
    return null;
  }

  return (
    <CategorySelectInput
      defaultValue={defaultCategoryId}
      onSubmit={(categoryId) =>
        actOnSuggestionMutation.mutate(
          { suggestionId: suggestion.id, input: { action: 'accept', categoryId } },
          { onSuccess: () => onClose({ type: 'back-then-replace', href: '/feed' }) },
        )
      }
      submitLabel={t('suggestions.category.submit')}
      isLoading={actOnSuggestionMutation.isPending}
    />
  );
};

SuggestionCategoryBottomSheet.Loading = CategorySelectInput.Loading;
