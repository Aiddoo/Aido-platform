import { invitePreviewInviterSchema } from '@aido/api';
import { z } from 'zod';

// 로그인 전에도 보이는 초대한 사람 공개 프로필. 이름과 고양이 프로필만 쓴다(태그는 공개하지 않는다)
const InvitePreviewSchema = z.object({
  inviter: invitePreviewInviterSchema.pick({ name: true, profileImage: true }),
});

export type InvitePreview = z.output<typeof InvitePreviewSchema>;
