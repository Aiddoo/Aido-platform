import { invitePreviewInviterSchema } from '@aido/api';
import { z } from 'zod';

// 로그인 전에도 보이는 초대한 사람 공개 프로필. 이름과 고양이 프로필만 쓴다(태그는 공개하지 않는다)
const InvitePreviewSchema = z.object({
  inviter: invitePreviewInviterSchema.pick({ name: true, profileImage: true }),
});

export type InvitePreview = z.output<typeof InvitePreviewSchema>;

/** 이름을 정하지 않은 사용자는 태그로 부른다(로그인한 사이에서만 태그를 안다) */
export function toDisplayName({ name, userTag }: { name: string | null; userTag: string }) {
  return name ?? userTag;
}

export const InvitePreviewPolicy = {
  /** 이름을 정하지 않은 초대한 사람은 화면이 넘긴 대체 호칭으로 부른다 */
  inviterName(preview: InvitePreview, unnamedLabel: string) {
    return preview.inviter.name ?? unnamedLabel;
  },
};
