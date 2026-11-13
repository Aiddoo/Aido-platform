import { defineRelations } from "drizzle-orm";

import * as schema from "./tables.schema.js";

export const relations = defineRelations(schema, (r) => ({
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id, optional: false }),
  },
  aiReport: {
    user: r.one.user({ from: r.aiReport.userId, to: r.user.id, optional: false }),
  },
  cheer: {
    receiver: r.one.user({
      from: r.cheer.receiverId,
      to: r.user.id,
      optional: false,
      alias: "Cheer_receiverId_fkey",
    }),
    sender: r.one.user({
      from: r.cheer.senderId,
      to: r.user.id,
      optional: false,
      alias: "Cheer_senderId_fkey",
    }),
  },
  dailyCompletion: {
    user: r.one.user({ from: r.dailyCompletion.userId, to: r.user.id, optional: false }),
  },
  follow: {
    follower: r.one.user({
      from: r.follow.followerId,
      to: r.user.id,
      optional: false,
      alias: "Follow_followerId_fkey",
    }),
    following: r.one.user({
      from: r.follow.followingId,
      to: r.user.id,
      optional: false,
      alias: "Follow_followingId_fkey",
    }),
  },
  invite: {
    inviter: r.one.user({ from: r.invite.inviterId, to: r.user.id, optional: false }),
    redemptions: r.many.inviteRedemption(),
  },
  inviteActiveDay: {
    redemption: r.one.inviteRedemption({
      from: r.inviteActiveDay.redemptionId,
      to: r.inviteRedemption.id,
      optional: false,
    }),
  },
  inviteRedemption: {
    invite: r.one.invite({ from: r.inviteRedemption.inviteId, to: r.invite.id }),
    inviter: r.one.user({
      from: r.inviteRedemption.inviterId,
      to: r.user.id,
      alias: "InviteRedemption_inviterId_fkey",
    }),
    invitee: r.one.user({
      from: r.inviteRedemption.inviteeId,
      to: r.user.id,
      optional: false,
      alias: "InviteRedemption_inviteeId_fkey",
    }),
    activeDays: r.many.inviteActiveDay(),
  },
  memo: {
    user: r.one.user({ from: r.memo.userId, to: r.user.id, optional: false }),
  },
  notification: {
    user: r.one.user({ from: r.notification.userId, to: r.user.id, optional: false }),
    pushDispatch: r.one.pushDispatch(),
  },
  nudge: {
    receiver: r.one.user({
      from: r.nudge.receiverId,
      to: r.user.id,
      optional: false,
      alias: "Nudge_receiverId_fkey",
    }),
    sender: r.one.user({
      from: r.nudge.senderId,
      to: r.user.id,
      optional: false,
      alias: "Nudge_senderId_fkey",
    }),
    todo: r.one.todo({ from: r.nudge.todoId, to: r.todo.id, optional: false }),
  },
  premiumGrant: {
    user: r.one.user({ from: r.premiumGrant.userId, to: r.user.id, optional: false }),
  },
  pushDeliveryAttempt: {
    dispatch: r.one.pushDispatch({
      from: r.pushDeliveryAttempt.dispatchId,
      to: r.pushDispatch.id,
      optional: false,
    }),
    pushToken: r.one.pushToken({
      from: r.pushDeliveryAttempt.pushTokenId,
      to: r.pushToken.id,
      optional: false,
    }),
  },
  pushDispatch: {
    notification: r.one.notification({
      from: r.pushDispatch.notificationId,
      to: r.notification.id,
      optional: false,
    }),
    user: r.one.user({ from: r.pushDispatch.userId, to: r.user.id, optional: false }),
    attempts: r.many.pushDeliveryAttempt(),
    outbox: r.one.pushDispatchOutbox(),
    rateLimitReservations: r.many.pushRateLimitReservation(),
  },
  pushDispatchOutbox: {
    dispatch: r.one.pushDispatch({
      from: r.pushDispatchOutbox.dispatchId,
      to: r.pushDispatch.id,
      optional: false,
    }),
  },
  pushRateLimitReservation: {
    dispatch: r.one.pushDispatch({
      from: r.pushRateLimitReservation.dispatchId,
      to: r.pushDispatch.id,
      optional: false,
    }),
  },
  pushDevice: {
    user: r.one.user({ from: r.pushDevice.userId, to: r.user.id, optional: false }),
  },
  pushToken: {
    user: r.one.user({ from: r.pushToken.userId, to: r.user.id, optional: false }),
    deliveryAttempts: r.many.pushDeliveryAttempt(),
  },
  recurringSuggestion: {
    user: r.one.user({ from: r.recurringSuggestion.userId, to: r.user.id, optional: false }),
  },
  reminderNudge: {
    receiver: r.one.user({
      from: r.reminderNudge.receiverId,
      to: r.user.id,
      optional: false,
      alias: "ReminderNudge_receiverId_fkey",
    }),
    sender: r.one.user({
      from: r.reminderNudge.senderId,
      to: r.user.id,
      optional: false,
      alias: "ReminderNudge_senderId_fkey",
    }),
  },
  resourceBonus: {
    user: r.one.user({ from: r.resourceBonus.userId, to: r.user.id, optional: false }),
  },
  retentionExperimentAssignment: {
    user: r.one.user({
      from: r.retentionExperimentAssignment.userId,
      to: r.user.id,
      optional: false,
    }),
    result: r.one.retentionExperimentResult(),
    stages: r.many.retentionExperimentStage(),
  },
  retentionExperimentResult: {
    assignment: r.one.retentionExperimentAssignment({
      from: r.retentionExperimentResult.assignmentId,
      to: r.retentionExperimentAssignment.id,
      optional: false,
    }),
  },
  retentionExperimentStage: {
    assignment: r.one.retentionExperimentAssignment({
      from: r.retentionExperimentStage.assignmentId,
      to: r.retentionExperimentAssignment.id,
      optional: false,
    }),
  },
  rewardGrant: {
    recipient: r.one.user({ from: r.rewardGrant.recipientId, to: r.user.id, optional: false }),
  },
  securityLog: {
    user: r.one.user({ from: r.securityLog.userId, to: r.user.id }),
  },
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id, optional: false }),
  },
  subscription: {
    user: r.one.user({ from: r.subscription.userId, to: r.user.id, optional: false }),
  },
  todo: {
    category: r.one.todoCategory({
      from: r.todo.categoryId,
      to: r.todoCategory.id,
      optional: false,
    }),
    user: r.one.user({ from: r.todo.userId, to: r.user.id, optional: false }),
    nudges: r.many.nudge(),
    comments: r.many.todoComment(),
    items: r.many.todoItem(),
    views: r.many.todoView(),
    series: r.one.todoSeries({ from: r.todo.seriesId, to: r.todoSeries.id }),
  },
  todoCategory: {
    user: r.one.user({ from: r.todoCategory.userId, to: r.user.id, optional: false }),
    todos: r.many.todo(),
  },
  todoComment: {
    author: r.one.user({ from: r.todoComment.authorId, to: r.user.id, optional: false }),
    parent: r.one.todoComment({
      from: r.todoComment.parentId,
      to: r.todoComment.id,
      alias: "TodoComment_parentId_fkey",
    }),
    replyTo: r.one.todoComment({
      from: r.todoComment.replyToCommentId,
      to: r.todoComment.id,
      alias: "TodoComment_replyToCommentId_fkey",
    }),
    todo: r.one.todo({ from: r.todoComment.todoId, to: r.todo.id, optional: false }),
    likes: r.many.todoCommentLike(),
    children: r.many.todoComment({ alias: "TodoComment_parentId_fkey" }),
    replies: r.many.todoComment({ alias: "TodoComment_replyToCommentId_fkey" }),
  },
  todoCommentLike: {
    comment: r.one.todoComment({
      from: r.todoCommentLike.commentId,
      to: r.todoComment.id,
      optional: false,
    }),
    user: r.one.user({ from: r.todoCommentLike.userId, to: r.user.id, optional: false }),
  },
  todoItem: {
    todo: r.one.todo({ from: r.todoItem.todoId, to: r.todo.id, optional: false }),
  },
  todoView: {
    todo: r.one.todo({ from: r.todoView.todoId, to: r.todo.id, optional: false }),
    viewer: r.one.user({ from: r.todoView.viewerId, to: r.user.id, optional: false }),
  },
  user: {
    accounts: r.many.account(),
    aiReports: r.many.aiReport(),
    dailyCompletions: r.many.dailyCompletion(),
    memos: r.many.memo(),
    notifications: r.many.notification(),
    pushDispatches: r.many.pushDispatch(),
    pushDevices: r.many.pushDevice(),
    pushTokens: r.many.pushToken(),
    recurringSuggestions: r.many.recurringSuggestion(),
    retentionAssignments: r.many.retentionExperimentAssignment(),
    securityLogs: r.many.securityLog(),
    sessions: r.many.session(),
    subscriptions: r.many.subscription(),
    todos: r.many.todo(),
    todoCategories: r.many.todoCategory(),
    authoredTodoComments: r.many.todoComment(),
    todoCommentLikes: r.many.todoCommentLike(),
    todoViews: r.many.todoView(),
    activityDays: r.many.userActivityDay(),
    consent: r.one.userConsent(),
    location: r.one.userLocation(),
    preference: r.one.userPreference(),
    profile: r.one.userProfile(),
    verifications: r.many.verification(),
    weeklyAchievements: r.many.weeklyAchievement(),
    receivedCheers: r.many.cheer({ alias: "Cheer_receiverId_fkey" }),
    sentCheers: r.many.cheer({ alias: "Cheer_senderId_fkey" }),
    following: r.many.follow({ alias: "Follow_followerId_fkey" }),
    followers: r.many.follow({ alias: "Follow_followingId_fkey" }),
    receivedNudges: r.many.nudge({ alias: "Nudge_receiverId_fkey" }),
    sentNudges: r.many.nudge({ alias: "Nudge_senderId_fkey" }),
    receivedRemindNudges: r.many.reminderNudge({ alias: "ReminderNudge_receiverId_fkey" }),
    sentRemindNudges: r.many.reminderNudge({ alias: "ReminderNudge_senderId_fkey" }),
    invites: r.many.invite(),
    inviterRedemptions: r.many.inviteRedemption({ alias: "InviteRedemption_inviterId_fkey" }),
    inviteeRedemption: r.one.inviteRedemption({ alias: "InviteRedemption_inviteeId_fkey" }),
    rewardGrants: r.many.rewardGrant(),
    premiumGrants: r.many.premiumGrant(),
    resourceBonuses: r.many.resourceBonus(),
    initiatedBlocks: r.many.userBlock({ alias: "UserBlock_blockerId_fkey" }),
    receivedBlocks: r.many.userBlock({ alias: "UserBlock_blockedId_fkey" }),
    filedReports: r.many.userReport({ alias: "UserReport_reporterId_fkey" }),
    receivedReports: r.many.userReport({ alias: "UserReport_targetUserId_fkey" }),
  },
  userActivityDay: {
    user: r.one.user({ from: r.userActivityDay.userId, to: r.user.id, optional: false }),
  },
  userBlock: {
    blocker: r.one.user({
      from: r.userBlock.blockerId,
      to: r.user.id,
      optional: false,
      alias: "UserBlock_blockerId_fkey",
    }),
    blocked: r.one.user({
      from: r.userBlock.blockedId,
      to: r.user.id,
      optional: false,
      alias: "UserBlock_blockedId_fkey",
    }),
  },
  userConsent: {
    user: r.one.user({ from: r.userConsent.userId, to: r.user.id, optional: false }),
  },
  userLocation: {
    user: r.one.user({ from: r.userLocation.userId, to: r.user.id, optional: false }),
  },
  userPreference: {
    user: r.one.user({ from: r.userPreference.userId, to: r.user.id, optional: false }),
  },
  userProfile: {
    user: r.one.user({ from: r.userProfile.userId, to: r.user.id, optional: false }),
  },
  userReport: {
    reporter: r.one.user({
      from: r.userReport.reporterId,
      to: r.user.id,
      optional: false,
      alias: "UserReport_reporterId_fkey",
    }),
    targetUser: r.one.user({
      from: r.userReport.targetUserId,
      to: r.user.id,
      optional: false,
      alias: "UserReport_targetUserId_fkey",
    }),
  },
  verification: {
    user: r.one.user({ from: r.verification.userId, to: r.user.id, optional: false }),
  },
  weeklyAchievement: {
    user: r.one.user({ from: r.weeklyAchievement.userId, to: r.user.id, optional: false }),
  },
}));
