import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/**
 * 기기에서 마지막으로 읽은 시간대 이름. 기기가 시간대를 한 번 못 읽어도 계산과 서버 보고가 이 값으로 이어진다.
 * 계정이 아니라 기기의 값이라 로그아웃·계정 전환에도 남는다(계정마다 보고한 값은 알림 쪽 aido_device_timezone_v1)
 */
export const lastReadTimezoneStoredValue = defineStoredValue({
  key: 'aido_last_read_timezone_v1',
  schema: z.string().min(1),
  fallback: null,
});
