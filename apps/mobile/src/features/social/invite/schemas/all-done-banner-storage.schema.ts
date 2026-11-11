import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** "오늘은 그만 보기"를 누른 날짜 key. 계정마다 한 칸이고 날이 바뀌면 덮어쓴다 */
export const allDoneBannerStoredValue = defineStoredValue({
  key: (userId: string) => `aido_invite_all_done_banner_dismissed_v1:${userId}`,
  schema: z.iso.date(),
  fallback: null,
});
