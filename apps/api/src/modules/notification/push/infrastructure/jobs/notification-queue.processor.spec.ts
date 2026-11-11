import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { NotificationQueueProcessor } from "./notification-queue.processor.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "./notification.queue.js";

function useCase() {
  return { execute: vi.fn<(input?: unknown) => Promise<void>>().mockResolvedValue(undefined) };
}

async function setup() {
  const useCases = {
    sendFollowRequest: useCase(),
    sendFollowAccepted: useCase(),
    sendNudge: useCase(),
    sendCheer: useCase(),
    sendBillingIssue: useCase(),
    sendFriendCompletion: useCase(),
    sendMilestone: useCase(),
    reconcilePushReceipts: useCase(),
  };
  const jobQueue = new InMemoryJobQueue();
  const processor = new NotificationQueueProcessor(
    useCases.sendFollowRequest,
    useCases.sendFollowAccepted,
    useCases.sendNudge,
    useCases.sendCheer,
    useCases.sendBillingIssue,
    useCases.sendFriendCompletion,
    useCases.sendMilestone,
    useCases.reconcilePushReceipts,
    jobQueue,
  );
  await processor.onModuleInit();
  return { ...useCases, jobQueue };
}

describe("NotificationQueueProcessor", () => {
  it("검증된 각 job을 해당 이벤트의 UseCase로 전달한다", async () => {
    // Given
    const units = await setup();
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
    for (const job of [
      { name: NotificationJobName.FOLLOW_NEW, data: followRequest },
      { name: NotificationJobName.FOLLOW_MUTUAL, data: followAccepted },
      { name: NotificationJobName.NUDGE_SENT, data: nudge },
      { name: NotificationJobName.CHEER_SENT, data: cheer },
      { name: NotificationJobName.BILLING_ISSUE, data: billing },
      { name: NotificationJobName.FRIEND_COMPLETED, data: friendCompletion },
      { name: NotificationJobName.MILESTONE_REACHED, data: milestone },
      { name: NotificationJobName.PUSH_RECEIPTS, data: {} },
    ] as const) {
      await units.jobQueue.enqueue(NOTIFICATION_QUEUE, job);
    }

    // When
    await units.jobQueue.drain(NOTIFICATION_QUEUE);

    // Then
    expect(units.sendFollowRequest.execute).toHaveBeenCalledWith(followRequest);
    expect(units.sendFollowAccepted.execute).toHaveBeenCalledWith(followAccepted);
    expect(units.sendNudge.execute).toHaveBeenCalledWith(nudge);
    expect(units.sendCheer.execute).toHaveBeenCalledWith(cheer);
    expect(units.sendBillingIssue.execute).toHaveBeenCalledWith(billing);
    expect(units.sendFriendCompletion.execute).toHaveBeenCalledWith(friendCompletion);
    expect(units.sendMilestone.execute).toHaveBeenCalledWith(milestone);
    expect(units.reconcilePushReceipts.execute).toHaveBeenCalledWith();
  });

  it("잘못된 큐 입력은 Application을 호출하기 전에 거부한다", async () => {
    // Given
    const units = await setup();
    // 저장소에 이미 쌓인 옛 작업처럼 schema를 거치지 않고 넣는다
    units.jobQueue.jobs.push({
      queue: NOTIFICATION_QUEUE.name,
      options: {},
      payload: { name: NotificationJobName.NUDGE_SENT, data: { nudgeId: "invalid" } },
    });

    // When
    const draining = units.jobQueue.drain(NOTIFICATION_QUEUE);

    // Then
    await expect(draining).rejects.toThrow();
    expect(units.sendNudge.execute).not.toHaveBeenCalled();
  });

  it("큐가 재시도할 수 있도록 UseCase 오류를 전파한다", async () => {
    // Given
    const units = await setup();
    units.sendBillingIssue.execute.mockRejectedValue(new Error("temporary failure"));
    await units.jobQueue.enqueue(NOTIFICATION_QUEUE, {
      name: NotificationJobName.BILLING_ISSUE,
      data: { userId: "user-1" },
    });

    // When
    const draining = units.jobQueue.drain(NOTIFICATION_QUEUE);

    // Then
    await expect(draining).rejects.toThrow("temporary failure");
  });

  it("재시도를 다 쓴 이벤트는 다시 보내지 않고 작업 이름만 기록한다", async () => {
    // Given
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const units = await setup();
    await units.jobQueue.enqueue(NOTIFICATION_DEAD_LETTER_QUEUE, {
      name: NotificationJobName.BILLING_ISSUE,
      data: { userId: "u1" },
    });

    // When
    await units.jobQueue.drain(NOTIFICATION_DEAD_LETTER_QUEUE);

    // Then
    expect(units.sendBillingIssue.execute).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith({
      event: "notification.job_dead_lettered",
      jobName: NotificationJobName.BILLING_ISSUE,
    });
  });
});
