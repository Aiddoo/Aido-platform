import { z } from 'zod';

import { deviceTimezoneSchema } from '../domains/device-timezone.model';

export const deviceTimezoneStorageSchema = z.object({
  userId: z.string(),
  deviceTimezone: deviceTimezoneSchema,
});
