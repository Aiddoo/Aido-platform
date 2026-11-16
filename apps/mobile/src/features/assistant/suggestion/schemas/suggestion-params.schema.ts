import { suggestionIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const suggestionParamsSchema = z.object({
  suggestionId: routeIntegerStringSchema.pipe(suggestionIdParamSchema.shape.id),
});

/** 수락 시트를 연 곳. 없으면 제안 화면이다 */
export const suggestionSourceParamSchema = z.object({
  source: z.enum(['suggestions_screen', 'report_preview']).catch('suggestions_screen'),
});
