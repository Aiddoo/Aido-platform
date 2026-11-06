import { pushDeviceResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import type { z } from 'zod';

const pushPermissionSchema = pushDeviceResponseSchema.shape.permission;
export type PushPermission = z.infer<typeof pushPermissionSchema>;

const pushDeviceSchema = pushDeviceResponseSchema
  .pick({ permission: true, hasActiveToken: true })
  .extend({
    reportedAt: instantSchema,
  });

/** 서버가 저장한 이 기기의 상태 */
export type PushDevice = z.infer<typeof pushDeviceSchema>;
