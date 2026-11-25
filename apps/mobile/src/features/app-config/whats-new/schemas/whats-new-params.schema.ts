import { z } from 'zod';

import { tourReleaseIdOrLatestSchema } from '../domains/whats-new.model';

const whatsNewSourceSchema = z.enum(['auto', 'feed_reentry', 'mypage']);

export type WhatsNewSource = z.output<typeof whatsNewSourceSchema>;

/** 들어온 곳을 모르면 메뉴로 친다 */
export const whatsNewParamsSchema = z.object({
  releaseId: tourReleaseIdOrLatestSchema,
  source: whatsNewSourceSchema.catch('mypage'),
});
