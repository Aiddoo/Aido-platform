import { suggestionIdParamSchema } from '@aido/api/contracts/ai/v1';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { SUGGESTION_ACTION_SOURCES } from '../constants/suggestion.events';

export const suggestionParamsSchema = z.object({
  suggestionId: routeIntegerStringSchema.pipe(suggestionIdParamSchema.shape.id),
});

/** 수락 시트를 연 곳. 없으면 제안 화면이다 */
export const suggestionSourceParamSchema = z.object({
  source: z.enum(SUGGESTION_ACTION_SOURCES).catch('suggestions_screen'),
});
