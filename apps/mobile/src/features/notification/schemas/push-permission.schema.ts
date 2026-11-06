import { pushDeviceResponseSchema } from '@aido/api';
import { z } from 'zod';

const pushPermissionSchema = pushDeviceResponseSchema.shape.permission;
export type PushPermission = z.infer<typeof pushPermissionSchema>;

const pushDeviceSchema = pushDeviceResponseSchema
  .pick({ permission: true, hasActiveToken: true })
  .extend({
    reportedAt: z.date(),
  });

/** 서버가 저장한 이 기기의 상태 */
export type PushDevice = z.infer<typeof pushDeviceSchema>;
