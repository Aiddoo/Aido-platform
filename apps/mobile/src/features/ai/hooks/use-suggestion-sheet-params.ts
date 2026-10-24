import { suggestionIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const suggestionSheetParamsSchema = z.object({
  suggestionId: routeIntegerStringSchema.pipe(suggestionIdParamSchema.shape.id),
});

export function useSuggestionSheetParams() {
  return suggestionSheetParamsSchema.parse(useLocalSearchParams());
}
