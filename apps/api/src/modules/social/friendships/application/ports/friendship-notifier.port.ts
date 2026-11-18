import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 메서드 이름은 알림 종류(FOLLOW_NEW·FOLLOW_MUTUAL)다
export interface FollowNewNotification {
  readonly followerId: UserId;
  readonly followingId: UserId;
  readonly followerName: string;
}

export interface FollowMutualNotification {
  readonly userId: UserId;
  readonly friendId: UserId;
  readonly friendName: string;
}

export interface FirstFriendMilestoneNotification {
  readonly userId: UserId;
}

// 친구 관계를 바꾼 트랜잭션 안에서 알림 작업을 넣어 함께 커밋한다
export abstract class FriendshipNotifierPort {
  abstract notifyFollowNew(payload: FollowNewNotification): Promise<void>;
  // 친구가 된 사실은 상대에게만 알린다. 수락·초대 입력을 한 사람은 이미 화면에서 결과를 봤다
  abstract notifyFollowMutual(payload: FollowMutualNotification): Promise<void>;
  abstract notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): Promise<void>;
}
