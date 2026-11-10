/** 초대 기능 플래그. 꺼져 있으면 초대 기능 전체를 INVITE_2105로 막고 지급은 원장에만 남긴다. */
export abstract class InviteConfigPort {
  abstract readonly isEnabled: boolean;
}
