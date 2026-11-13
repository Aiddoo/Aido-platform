import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

// 로그인 전에도 보이는 초대한 사람 공개 프로필. 태그는 공개하지 않는다
export const invitePreviewSchema = z.object({
  inviter: userSummarySchema.pick({ name: true, profileImage: true }),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
