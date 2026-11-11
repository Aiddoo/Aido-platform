import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/**
 * 기능 키 → 그 기능의 프리미엄 안내를 마지막으로 닫은 로컬 날짜 key. 계정마다 한 칸이다.
 * 앱이 모르는 기능 키가 있어도 나머지를 읽게 키는 문자열로 받는다
 */
export const upsellDismissalStoredValue = defineStoredValue({
  key: (userId: string) => `aido_upsell_dismissed_v1:${userId}`,
  schema: storedJsonSchema(z.record(z.string(), z.iso.date())),
  fallback: {},
});
