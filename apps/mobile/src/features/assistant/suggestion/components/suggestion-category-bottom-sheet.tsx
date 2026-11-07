import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  type SheetRouteExit,
  useSheetRoute,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useHandleSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { suggestionParamsSchema } from '../schemas/suggestion-params.schema';

type SuggestionCategoryBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 제안을 받아들일 카테고리를 고르는 시트. 대상은 `/suggestions/[suggestionId]/category` route에서 읽는다. */
export function SuggestionCategoryBottomSheet(props: SuggestionCategoryBottomSheetProps) {
  const sheet = useSheetRoute('/suggestions');

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary
          fallback={(fallbackProps) => (
            <SuggestionCategoryBottomSheet.Error
              {...fallbackProps}
              onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
            />
          )}
        >
          <Suspense fallback={<SuggestionCategoryBottomSheet.Loading />}>
            <SuggestionCategoryBottomSheet.AcceptForm onClose={sheet.close} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
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
    suggestion?.suggestedCategoryId,
  );
  const handleSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());

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
      value={defaultCategoryId}
      onChange={(categoryId) =>
        handleSuggestionMutation.mutate(
          { suggestionId: suggestion.id, input: { action: 'accept', categoryId } },
          { onSuccess: () => onClose({ type: 'back-then-replace', href: '/feed' }) },
        )
      }
      submitLabel={t('suggestions.category.submit')}
      isLoading={handleSuggestionMutation.isPending}
    />
  );
};

SuggestionCategoryBottomSheet.Loading = CategorySelectInput.Loading;

SuggestionCategoryBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<QueryErrorActions onRetry={reset} onInquiry={onInquiry} />}
    />
  );
};
