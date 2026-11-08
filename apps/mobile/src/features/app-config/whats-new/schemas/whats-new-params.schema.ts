import { z } from 'zod';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { releaseIdSchema } from '../domains/whats-new.model';

const whatsNewSourceSchema = z.enum(['auto', 'feed_reentry', 'mypage']);

export type WhatsNewSource = z.output<typeof whatsNewSourceSchema>;

export const whatsNewParamsSchema = z.object({
  releaseId: releaseIdSchema.catch(() => WhatsNewPolicy.getLatestRelease(RELEASES).id),
  source: whatsNewSourceSchema.catch('mypage'),
});
