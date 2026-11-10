// 큐 payload라 id·이름은 문자열 그대로 싣는다

export interface FollowNewNotification {
  readonly followerId: string;
  readonly followingId: string;
  readonly followerName: string;
}

export interface FollowMutualNotification {
  readonly userId: string;
  readonly friendId: string;
  readonly friendName: string;
}

export interface FirstFriendMilestoneNotification {
  readonly userId: string;
}

// 알림은 커밋 뒤 작업 큐에 넣고 기다리지 않는다
export abstract class FollowNotifierPort {
  abstract notifyFollowNew(payload: FollowNewNotification): void;
  // 친구가 된 사실은 상대에게만 알린다. 수락·초대 입력을 한 사람은 이미 화면에서 결과를 봤다
  abstract notifyFollowMutual(payload: FollowMutualNotification): void;
  abstract notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): void;
}
