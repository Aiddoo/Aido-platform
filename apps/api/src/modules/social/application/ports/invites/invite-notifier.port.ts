export interface InviteJoinedNotification {
  readonly inviterId: string;
  readonly inviteeName: string;
  readonly redemptionId: string;
}

export interface InviteRewardedNotification {
  readonly recipientId: string;
  readonly redemptionId: string;
  readonly premiumDays: number;
  readonly friendSlots: number;
}

export interface InviteProgressNotification {
  readonly inviterId: string;
  readonly inviteeName: string;
  readonly redemptionId: string;
}

export interface InviteQualifyReminderNotification {
  readonly inviteeId: string;
  readonly inviterName: string;
  readonly redemptionId: string;
}

export const INVITE_NOTIFIER = Symbol("INVITE_NOTIFIER");

export interface InviteNotifierPort {
  /** 초대받은 사람이 수락해 친구가 되면 초대한 사람에게 알린다. 커밋 뒤에 호출한다. */
  notifyInviteJoined(notification: InviteJoinedNotification): Promise<void>;
  /** 보상이 적용되면 받는 사람마다 수락 한 건에 한 번 알린다. */
  notifyInviteRewarded(notification: InviteRewardedNotification): Promise<void>;
  /** 초대받은 사람의 첫 활동일을 초대한 사람에게 알린다. 커밋 뒤에 호출한다. */
  notifyInviteProgress(notification: InviteProgressNotification): Promise<void>;
  /**
   * 하루만 더 하면 사용 시작인 초대받은 사람에게 알린다. 활성 UoW 안에서 부르면 알림 기록이 발송 표시와
   * 함께 커밋되고 푸시는 커밋 뒤에 나간다.
   */
  notifyQualifyReminder(notification: InviteQualifyReminderNotification): Promise<void>;
  /** 참여 유도 알림은 야간에 보내지 않으므로 발신자가 미룰 수 있게 야간인지 묻는다. */
  isInQuietHours(userId: string, at: Date): Promise<boolean>;
}
