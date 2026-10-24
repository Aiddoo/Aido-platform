import { CategorySelectInput } from '@src/features/todo/components/category-select-input';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Box,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  type SheetRouteExit,
  useSheetRoute,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useSuggestionSheetParams } from '../hooks/use-suggestion-sheet-params';
import { useGetSuggestionsQueryOptions } from '../queries/get-suggestions-query-options';
import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';
import {
  findSheetSuggestion,
  resolveSuggestionCategoryId,
} from '../utils/view-models/suggestion-category.view-model';

const SUGGESTIONS_HREF = '/suggestions';

type SuggestionCategoryBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 제안을 받아들일 카테고리를 고르는 시트. 대상은 `/suggestions/[suggestionId]/category` route에서 읽는다. */
export function SuggestionCategoryBottomSheet(props: SuggestionCategoryBottomSheetProps) {
  const sheet = useSheetRoute(SUGGESTIONS_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary fallback={SuggestionCategoryBottomSheet.Error}>
          <Suspense fallback={<SuggestionCategoryBottomSheet.Loading />}>
            <SuggestionCategoryBottomSheet.Content onClose={sheet.close} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

SuggestionCategoryBottomSheet.Content = function Content({
  onClose,
}: {
  onClose: (next?: SheetRouteExit) => void;
}) {
  const { t } = useTranslation('ai');
  const { suggestionId } = useSuggestionSheetParams();
  const [{ data: suggestions }, { data: categoriesData }] = useSuspenseQueries({
    queries: [useGetSuggestionsQueryOptions(), useGetTodoCategoriesQueryOptions()],
  });
  const suggestion = useRetainedValue(findSheetSuggestion(suggestions, suggestionId));
  const defaultCategoryId = resolveSuggestionCategoryId(
    suggestion?.suggestedCategoryId,
    categoriesData.categories,
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
      onChange={async (categoryId) => {
        const accepted = await handleSuggestionMutation
          .mutateAsync({ suggestionId: suggestion.id, input: { action: 'accept', categoryId } })
          .catch(() => null);

        if (accepted) {
          onClose({ type: 'back-then-replace', href: '/feed' });
        }
      }}
      submitLabel={t('suggestions.category.submit')}
      isPending={handleSuggestionMutation.isPending}
    />
  );
};

SuggestionCategoryBottomSheet.Loading = function Loading() {
  return (
    <Box py={24} className="items-center">
      <Spinner />
    </Box>
  );
};

SuggestionCategoryBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};
