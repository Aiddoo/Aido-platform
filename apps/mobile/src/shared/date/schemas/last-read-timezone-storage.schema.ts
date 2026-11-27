import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 계정이 아니라 기기의 값이라 로그아웃·계정 전환에도 남는다(계정마다 보고한 값은 알림 쪽 aido_device_timezone_v1) */
export const lastReadTimezoneStoredValue = defineStoredValue({
  key: 'aido_last_read_timezone_v1',
  schema: z.string().min(1),
  fallback: null,
});
