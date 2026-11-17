import {
  type FirstFriendMilestoneNotification,
  type FollowMutualNotification,
  type FollowNewNotification,
  FriendshipNotifierPort,
} from "#api/modules/social/friendships/application/ports/friendship-notifier.port";

// 비교하기 쉽게 id VO를 값으로 풀어 남긴다
export class RecordingFriendshipNotifier extends FriendshipNotifierPort {
  readonly newRequests: { followerId: string; followingId: string; followerName: string }[] = [];
  readonly mutual: { userId: string; friendId: string; friendName: string }[] = [];
  readonly milestones: { userId: string }[] = [];

  async notifyFollowNew(payload: FollowNewNotification): Promise<void> {
    this.newRequests.push({
      followerId: payload.followerId.value,
      followingId: payload.followingId.value,
      followerName: payload.followerName,
    });
  }

  async notifyFollowMutual(payload: FollowMutualNotification): Promise<void> {
    this.mutual.push({
      userId: payload.userId.value,
      friendId: payload.friendId.value,
      friendName: payload.friendName,
    });
  }

  async notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): Promise<void> {
    this.milestones.push({ userId: payload.userId.value });
  }
}
