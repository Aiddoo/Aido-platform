import { z } from 'zod';

import { deviceTimezoneSchema } from '../domains/device-timezone.model';

export const savedDeviceTimezoneSchema = z.object({
  userId: z.string(),
  deviceTimezone: deviceTimezoneSchema,
});
