import { CategoryPickForm } from '@src/features/planning/category/components/category-pick-form';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { RouteBottomSheet, type SheetRouteExit } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { type ComponentProps, useEffect } from 'react';

import { usePromptSuggestionLimit } from '../hooks/use-prompt-suggestion-limit';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import {
  suggestionParamsSchema,
  suggestionSourceParamSchema,
} from '../schemas/suggestion-params.schema';

type SuggestionCategoryBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
>;

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
  const [{ source }] = useRouteParams(suggestionSourceParamSchema);
  const [{ data: list }, { data: categoriesData }] = useSuspenseQueries({
    queries: [useGetSuggestionsQueryOptions(), useGetTodoCategoriesQueryOptions()],
  });
  const suggestion = useRetainedValue(
    list.suggestions.find((candidate) => candidate.id === suggestionId) ?? null,
  );
  const defaultCategoryId = TodoCategoryPolicy.findInitialCategoryId(
    categoriesData.categories,
    suggestion?.suggestedCategoryId ?? null,
  );
  const promptSuggestionLimit = usePromptSuggestionLimit();
  // 한도 안내는 mutation 단계에 건다. 호출 단계 콜백은 응답 전에 시트가 내려가면 불리지 않는다
  const actOnSuggestion = useMutation({
    ...useActOnSuggestionMutationOptions(),
    onError: promptSuggestionLimit,
  });
  // isPending은 다시 그린 뒤에야 켜져 같은 프레임의 두 번째 누름이 수락을 한 번 더 보낸다
  const handleSubmit = useSingleTap((acceptedSuggestionId: number, categoryId: number) =>
    actOnSuggestion.mutate(
      { suggestionId: acceptedSuggestionId, input: { action: 'accept', categoryId }, source },
      { onSuccess: () => onClose({ type: 'dismiss-to', href: '/feed' }) },
    ),
  );

  useEffect(() => {
    if (suggestion == null || defaultCategoryId == null) {
      onClose();
    }
  }, [suggestion, defaultCategoryId, onClose]);

  if (suggestion == null || defaultCategoryId == null) {
    return null;
  }

  return (
    <CategoryPickForm
      defaultValue={defaultCategoryId}
      onSubmit={(categoryId) => handleSubmit(suggestion.id, categoryId)}
      submitLabel={t('suggestions.item.make')}
      isLoading={actOnSuggestion.isPending}
    />
  );
};

SuggestionCategoryBottomSheet.Loading = CategoryPickForm.Loading;
