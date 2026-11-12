import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { marketingPushPromptStateSchema } from '../domains/marketing-push-prompt.model';

/** 시각으로 읽을 수 없는 값은 null로 바꿔 다시 제안하게 한다 */
export const marketingPushPromptStorageSchema = marketingPushPromptStateSchema.extend({
  dismissedAt: instantSchema.nullable().catch(null),
});

/** 1.14.x까지 기기 하나에 남긴 JSON. 로그인한 계정으로 한 번 옮기고 지운다. 1.16.0에서 지운다 */
export const legacyMarketingPushPromptStorageSchema = z.object({
  lastPromptedAt: instantSchema.nullable().catch(null),
});
