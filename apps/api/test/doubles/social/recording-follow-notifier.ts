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

  notifyFollowNew(payload: FollowNewNotification): void {
    this.newRequests.push({ ...payload });
  }

  notifyFollowMutual(payload: FollowMutualNotification): void {
    this.mutual.push({ ...payload });
  }

  notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): void {
    this.milestones.push({ ...payload });
  }
}
