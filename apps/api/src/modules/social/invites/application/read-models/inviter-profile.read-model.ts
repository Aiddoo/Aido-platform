import type { Invite } from "../../domain/invite.aggregate.js";

/** 로그인 전에도 보이는 초대한 사람 공개 프로필 */
export interface InviterProfile {
  readonly userId: string;
  readonly name: string | null;
  readonly userTag: string;
  readonly profileImage: string | null;
}

export interface InviteWithInviter {
  readonly invite: Invite;
  readonly inviter: InviterProfile;
}
