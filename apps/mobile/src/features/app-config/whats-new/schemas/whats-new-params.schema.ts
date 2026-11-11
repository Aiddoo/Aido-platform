import { z } from 'zod';

import { TOUR_RELEASE_IDS } from '../constants/whats-new.constants';
import { tourReleaseIdSchema } from '../domains/whats-new.model';

const whatsNewSourceSchema = z.enum(['auto', 'feed_reentry', 'mypage']);

export type WhatsNewSource = z.output<typeof whatsNewSourceSchema>;

/** 소개가 없는 출시나 잘못된 값이면 최신 소개를 연다. 들어온 곳을 모르면 메뉴로 친다 */
export const whatsNewParamsSchema = z.object({
  releaseId: tourReleaseIdSchema.catch(TOUR_RELEASE_IDS[0]),
  source: whatsNewSourceSchema.catch('mypage'),
});
