import { SuggestionCategoryBottomSheet } from '@src/features/assistant/suggestion/components/suggestion-category-bottom-sheet';
import { suggestionParamsSchema } from '@src/features/assistant/suggestion/schemas/suggestion-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function SuggestionCategorySheetRoute() {
  const route = useRouteParamsOrRedirect(suggestionParamsSchema, { fallbackHref: '/suggestions' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <SuggestionCategoryBottomSheet />
    </SheetRouteScreen>
  );
}
