export interface InviteJoinedNotification {
  readonly inviterId: string;
  readonly inviteeName: string;
  readonly redemptionId: string;
}

export const INVITE_NOTIFIER = Symbol("INVITE_NOTIFIER");

export interface InviteNotifierPort {
  /** 초대받은 사람이 수락해 친구가 되면 초대한 사람에게 알린다. 커밋 뒤에 호출한다. */
  notifyInviteJoined(notification: InviteJoinedNotification): Promise<void>;
}
