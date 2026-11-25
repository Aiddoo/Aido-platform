import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { pushPermissionSchema } from './push-permission.model';

/** 서버가 마지막으로 받은 이 기기의 알림 권한과 토큰 상태 */
const pushDeviceSchema = z.object({
  permission: pushPermissionSchema,
  hasActiveToken: z.boolean(),
  reportedAt: instantSchema,
});
export type PushDevice = z.infer<typeof pushDeviceSchema>;
