import { instantSchema } from '@src/shared/date/instant';

import { marketingPushPromptStateSchema } from '../domains/marketing-push-prompt.model';

/** 시각으로 읽을 수 없는 값은 null로 바꿔 다시 제안하게 한다 */
export const marketingPushPromptStorageSchema = marketingPushPromptStateSchema.extend({
  dismissedAt: instantSchema.nullable().catch(null),
});
