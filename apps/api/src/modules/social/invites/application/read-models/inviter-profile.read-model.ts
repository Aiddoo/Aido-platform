// 로그인 전에도 보이는 초대한 사람 공개 프로필
export interface InviterProfile {
  readonly userId: string;
  readonly name: string | null;
  readonly userTag: string;
  readonly profileImage: string | null;
}

// 미리보기·수락이 코드로 읽는 초대. 수락 판정은 ACTIVE인지만 본다
export interface InviteWithInviterReadModel {
  readonly inviteId: string;
  readonly inviterId: string;
  readonly isActive: boolean;
  readonly inviter: InviterProfile;
}
