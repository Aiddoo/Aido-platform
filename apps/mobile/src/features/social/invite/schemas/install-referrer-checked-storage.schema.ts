import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 설치 referrer는 앱을 지우기 전까지 그대로 남아서 처음 실행 때 한 번만 읽는다 */
export const installReferrerCheckedStoredValue = defineStoredValue({
  key: 'aido_install_referrer_checked_v1',
  schema: z.literal('1'),
  fallback: null,
});
