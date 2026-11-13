import {
  type FirstFriendMilestoneNotification,
  type FollowMutualNotification,
  type FollowNewNotification,
  FollowNotifierPort,
} from "#api/modules/social/friends/application/ports/follow-notifier.port";

export class RecordingFollowNotifier extends FollowNotifierPort {
  readonly newRequests: FollowNewNotification[] = [];
  readonly mutual: FollowMutualNotification[] = [];
  readonly milestones: FirstFriendMilestoneNotification[] = [];

  async notifyFollowNew(payload: FollowNewNotification): Promise<void> {
    this.newRequests.push({ ...payload });
  }

  async notifyFollowMutual(payload: FollowMutualNotification): Promise<void> {
    this.mutual.push({ ...payload });
  }

  async notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): Promise<void> {
    this.milestones.push({ ...payload });
  }
}
