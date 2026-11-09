import { z } from 'zod';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { releaseIdSchema } from '../domains/whats-new.model';

const whatsNewSourceSchema = z.enum(['auto', 'feed_reentry', 'mypage']);

export type WhatsNewSource = z.output<typeof whatsNewSourceSchema>;

/** 잘못된 값이면 최신 출시를 연다. 들어온 곳을 모르면 메뉴로 친다 */
export const whatsNewParamsSchema = z.object({
  releaseId: releaseIdSchema.catch(() => WhatsNewPolicy.getLatestRelease(RELEASES).id),
  source: whatsNewSourceSchema.catch('mypage'),
});
