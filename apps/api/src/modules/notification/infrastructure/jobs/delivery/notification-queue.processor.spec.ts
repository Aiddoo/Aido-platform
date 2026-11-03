import { Logger } from "@nestjs/common";
import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import { ReconcilePushReceipts } from "../../../application/use-cases/delivery/reconcile-push-receipts.use-case.js";
import { SendBillingIssueNotification } from "../../../application/use-cases/delivery/send-billing-issue-notification.use-case.js";
import { SendCheerNotification } from "../../../application/use-cases/delivery/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotification } from "../../../application/use-cases/delivery/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotification } from "../../../application/use-cases/delivery/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotifications } from "../../../application/use-cases/delivery/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotification } from "../../../application/use-cases/delivery/send-milestone-notification.use-case.js";
import { SendNudgeNotification } from "../../../application/use-cases/delivery/send-nudge-notification.use-case.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NotificationJobName,
} from "./notification-queue.constants.js";
import { NotificationQueueProcessor } from "./notification-queue.processor.js";

describe("NotificationQueueProcessor", () => {
  let processor: NotificationQueueProcessor;
  let sendFollowRequest: Mocked<SendFollowRequestNotification>;
  let sendFollowAccepted: Mocked<SendFollowAcceptedNotification>;
  let sendNudge: Mocked<SendNudgeNotification>;
  let sendCheer: Mocked<SendCheerNotification>;
  let sendBillingIssue: Mocked<SendBillingIssueNotification>;
  let sendFriendCompletion: Mocked<SendFriendCompletionNotifications>;
  let sendMilestone: Mocked<SendMilestoneNotification>;
  let reconcilePushReceipts: Mocked<ReconcilePushReceipts>;
  let runtime: Mocked<JobRuntimePort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(NotificationQueueProcessor)
      .mock<JobRuntimePort>(JOB_RUNTIME)
      .impl(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        enqueue: vi.fn(),
        schedule: vi.fn(),
        unschedule: vi.fn(),
        cancel: vi.fn(),
        work: vi.fn().mockResolvedValue(undefined),
        health: vi.fn(),
      }))
      .compile();
    processor = unit;
    sendFollowRequest = unitRef.get(SendFollowRequestNotification);
    sendFollowAccepted = unitRef.get(SendFollowAcceptedNotification);
    sendNudge = unitRef.get(SendNudgeNotification);
    sendCheer = unitRef.get(SendCheerNotification);
    sendBillingIssue = unitRef.get(SendBillingIssueNotification);
    sendFriendCompletion = unitRef.get(SendFriendCompletionNotifications);
    sendMilestone = unitRef.get(SendMilestoneNotification);
    reconcilePushReceipts = unitRef.get(ReconcilePushReceipts);
    runtime = unitRef.get(JOB_RUNTIME);
  });

  it("검증된 각 job을 해당 이벤트의 UseCase로 전달한다", async () => {
    const followRequest = { followerId: "1", followingId: "2", followerName: "A" };
    const followAccepted = { userId: "1", friendId: "2", friendName: "B" };
    const nudge = { nudgeId: 1, senderId: "1", receiverId: "2", senderName: "A" };
    const cheer = { cheerId: 1, senderId: "1", receiverId: "2", senderName: "A" };
    const billing = { userId: "1" };
    const friendCompletion = {
      friendId: "1",
      friendName: "A",
      notifyUserIds: ["2"],
      timezone: "Asia/Seoul",
    };
    const milestone = { userId: "1", milestone: "COUNT_10" as const };

    await processor.process({ name: NotificationJobName.FOLLOW_NEW, data: followRequest });
    await processor.process({ name: NotificationJobName.FOLLOW_MUTUAL, data: followAccepted });
    await processor.process({ name: NotificationJobName.NUDGE_SENT, data: nudge });
    await processor.process({ name: NotificationJobName.CHEER_SENT, data: cheer });
    await processor.process({ name: NotificationJobName.BILLING_ISSUE, data: billing });
    await processor.process({
      name: NotificationJobName.FRIEND_COMPLETED,
      data: friendCompletion,
    });
    await processor.process({ name: NotificationJobName.MILESTONE_REACHED, data: milestone });
    await processor.process({ name: NotificationJobName.PUSH_RECEIPTS, data: {} });

    expect(sendFollowRequest.execute).toHaveBeenCalledWith(followRequest);
    expect(sendFollowAccepted.execute).toHaveBeenCalledWith(followAccepted);
    expect(sendNudge.execute).toHaveBeenCalledWith(nudge);
    expect(sendCheer.execute).toHaveBeenCalledWith(cheer);
    expect(sendBillingIssue.execute).toHaveBeenCalledWith(billing);
    expect(sendFriendCompletion.execute).toHaveBeenCalledWith(friendCompletion);
    expect(sendMilestone.execute).toHaveBeenCalledWith(milestone);
    expect(reconcilePushReceipts.execute).toHaveBeenCalledWith();
  });

  it("잘못된 큐 입력은 Application을 호출하기 전에 거부한다", async () => {
    await expect(
      processor.process({ name: NotificationJobName.NUDGE_SENT, data: { nudgeId: "invalid" } }),
    ).rejects.toThrow();

    expect(sendNudge.execute).not.toHaveBeenCalled();
  });

  it("runtime이 재시도할 수 있도록 UseCase 오류를 전파한다", async () => {
    sendBillingIssue.execute.mockRejectedValue(new Error("temporary failure"));

    await expect(
      processor.process({
        name: NotificationJobName.BILLING_ISSUE,
        data: { userId: "user-1" },
      }),
    ).rejects.toThrow("temporary failure");
  });

  it("재시도를 다 쓴 이벤트는 다시 보내지 않고 작업 이름만 기록한다", async () => {
    // Given
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    await processor.onModuleInit();
    const deadLetterWorker = runtime.work.mock.calls.find(
      ([queue]) => queue === NOTIFICATION_DEAD_LETTER_QUEUE,
    )?.[1];

    // When
    await deadLetterWorker?.([
      {
        id: "dead-1",
        name: NOTIFICATION_DEAD_LETTER_QUEUE,
        data: { name: NotificationJobName.BILLING_ISSUE, data: { userId: "u1" } },
        attempt: 1,
      },
    ]);

    // Then
    expect(sendBillingIssue.execute).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith({
      event: "notification.job_dead_lettered",
      jobName: NotificationJobName.BILLING_ISSUE,
    });
  });
});
