import { SuggestionCategoryBottomSheet } from '@src/features/ai/components/suggestion-category-bottom-sheet';
import { suggestionSheetParamsSchema } from '@src/features/ai/hooks/use-suggestion-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SuggestionCategorySheetRoute() {
  const params = suggestionSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/suggestions" />;
  }

  return (
    <SheetRouteScreen>
      <SuggestionCategoryBottomSheet />
    </SheetRouteScreen>
  );
}
