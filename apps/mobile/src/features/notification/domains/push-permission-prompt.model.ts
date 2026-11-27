import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 계정마다 기기에 남긴 답. 알림 화면과 피드 꺼짐 안내를 닫은 시각이다 */
const pushPermissionPromptSchema = z.object({
  deferredAt: instantSchema.nullable(),
  noticeDismissedAt: instantSchema.nullable(),
});
export type PushPermissionPrompt = z.infer<typeof pushPermissionPromptSchema>;
