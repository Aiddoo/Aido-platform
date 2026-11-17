import { z } from 'zod';

import { storeReviewStateSchema } from '../domains/store-review.model';

/** 기기에 쓰는 모양. 앱 모양과 칸이 같고 버전만 붙는다. 디스크 형식은 바꾸지 않는다 */
export const storeReviewStorageSchema = storeReviewStateSchema.extend({
  version: z.literal(2),
});
