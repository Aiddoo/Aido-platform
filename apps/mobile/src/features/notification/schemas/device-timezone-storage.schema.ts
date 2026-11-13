import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { deviceTimezoneSchema } from '../domains/device-timezone.model';

/** 이 기기에서 쓰는 계정 하나의 마지막 시간대. 다른 계정이 남긴 값은 없는 것으로 읽는다 */
export const deviceTimezoneStoredValue = defineStoredValue({
  key: 'aido_device_timezone_v1',
  schema: storedJsonSchema(
    z.object({
      userId: z.string(),
      deviceTimezone: deviceTimezoneSchema,
    }),
  ),
  fallback: null,
});
