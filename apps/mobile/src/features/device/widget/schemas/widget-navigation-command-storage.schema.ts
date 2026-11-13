import { fromEpochMs, instantSchema, toEpochMs, toInstant } from '@src/shared/date/instant';
import { z } from 'zod';

import { widgetNavigationCommandSchema } from '../domains/widget-navigation.model';

/** ECMAScript Date가 나타내는 가장 늦은 순간. 넘는 값은 순간으로 바꿀 수 없는 깨진 값이다 */
const MAX_DATE_EPOCH_MS = 8.64e15;

/** 출시한 앱이 쓴 저장 모양이라 만든 시각은 에포크 ms 숫자로 두고, 읽고 쓸 때 Instant와 바꾼다 */
export const widgetNavigationCommandStorageSchema = widgetNavigationCommandSchema.extend({
  createdAt: z.codec(z.int().nonnegative().max(MAX_DATE_EPOCH_MS), instantSchema, {
    decode: fromEpochMs,
    encode: (value) => toEpochMs(toInstant(value)),
  }),
});
