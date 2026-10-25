import { SuggestionCategoryBottomSheet } from '@src/features/ai/components/suggestion-category-bottom-sheet';
import { suggestionScreenParamsSchema } from '@src/features/ai/hooks/use-suggestion-screen-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SuggestionCategorySheetRoute() {
  const params = suggestionScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/suggestions" />;
  }

  return (
    <SheetRouteScreen>
      <SuggestionCategoryBottomSheet />
    </SheetRouteScreen>
  );
}
