import { SuggestionCategoryBottomSheet } from '@src/features/assistant/suggestion/components/suggestion-category-bottom-sheet';
import { suggestionParamsSchema } from '@src/features/assistant/suggestion/schemas/suggestion-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SuggestionCategorySheetRoute() {
  const params = suggestionParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/suggestions" />;
  }

  return (
    <SheetRouteScreen>
      <SuggestionCategoryBottomSheet />
    </SheetRouteScreen>
  );
}
