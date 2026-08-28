import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import { ReconcilePushReceiptsUseCase } from "../../application/use-cases/reconcile-push-receipts/reconcile-push-receipts.use-case";
import { SendBillingIssueNotificationUseCase } from "../../application/use-cases/send-billing-issue-notification/send-billing-issue-notification.use-case";
import { SendCheerNotificationUseCase } from "../../application/use-cases/send-cheer-notification/send-cheer-notification.use-case";
import { SendFollowAcceptedNotificationUseCase } from "../../application/use-cases/send-follow-accepted-notification/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotificationUseCase } from "../../application/use-cases/send-follow-request-notification/send-follow-request-notification.use-case";
import { SendFriendCompletionNotificationsUseCase } from "../../application/use-cases/send-friend-completion-notifications/send-friend-completion-notifications.use-case";
import { SendMilestoneNotificationUseCase } from "../../application/use-cases/send-milestone-notification/send-milestone-notification.use-case";
import { SendNudgeNotificationUseCase } from "../../application/use-cases/send-nudge-notification/send-nudge-notification.use-case";
import {
	NOTIFICATION_LEGACY_QUEUE,
	NOTIFICATION_QUEUE,
	NotificationJobName,
} from "./notification-queue.constants";
import { NotificationQueueProcessor } from "./notification-queue.processor";

describe("NotificationQueueProcessor", () => {
	let processor: NotificationQueueProcessor;
	let sendFollowRequest: Mocked<SendFollowRequestNotificationUseCase>;
	let sendFollowAccepted: Mocked<SendFollowAcceptedNotificationUseCase>;
	let sendNudge: Mocked<SendNudgeNotificationUseCase>;
	let sendCheer: Mocked<SendCheerNotificationUseCase>;
	let sendBillingIssue: Mocked<SendBillingIssueNotificationUseCase>;
	let sendFriendCompletion: Mocked<SendFriendCompletionNotificationsUseCase>;
	let sendMilestone: Mocked<SendMilestoneNotificationUseCase>;
	let reconcilePushReceipts: Mocked<ReconcilePushReceiptsUseCase>;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(NotificationQueueProcessor)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({
				start: jest.fn(),
				stop: jest.fn(),
				enqueue: jest.fn(),
				schedule: jest.fn(),
				unschedule: jest.fn(),
				cancel: jest.fn(),
				work: jest.fn().mockResolvedValue(undefined),
				health: jest.fn(),
			}))
			.compile();
		processor = unit;
		sendFollowRequest = unitRef.get(SendFollowRequestNotificationUseCase);
		sendFollowAccepted = unitRef.get(SendFollowAcceptedNotificationUseCase);
		sendNudge = unitRef.get(SendNudgeNotificationUseCase);
		sendCheer = unitRef.get(SendCheerNotificationUseCase);
		sendBillingIssue = unitRef.get(SendBillingIssueNotificationUseCase);
		sendFriendCompletion = unitRef.get(SendFriendCompletionNotificationsUseCase);
		sendMilestone = unitRef.get(SendMilestoneNotificationUseCase);
		reconcilePushReceipts = unitRef.get(ReconcilePushReceiptsUseCase);
		runtime = unitRef.get(JOB_RUNTIME);
	});

	it("routes every validated job to its event use case", async () => {
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

	it("rejects malformed transport input before invoking application code", async () => {
		await expect(
			processor.process({ name: NotificationJobName.NUDGE_SENT, data: { nudgeId: "invalid" } }),
		).rejects.toThrow();

		expect(sendNudge.execute).not.toHaveBeenCalled();
	});

	it("propagates use-case errors so the runtime can retry", async () => {
		sendBillingIssue.execute.mockRejectedValue(new Error("temporary failure"));

		await expect(
			processor.process({
				name: NotificationJobName.BILLING_ISSUE,
				data: { userId: "user-1" },
			}),
		).rejects.toThrow("temporary failure");
	});

	it("registers versioned and legacy workers with their compatible envelopes", async () => {
		await processor.onModuleInit();

		expect(runtime.work).toHaveBeenNthCalledWith(
			1,
			NOTIFICATION_QUEUE,
			expect.any(Function),
			expect.any(Object),
		);
		expect(runtime.work).toHaveBeenNthCalledWith(
			2,
			NOTIFICATION_LEGACY_QUEUE,
			expect.any(Function),
			expect.any(Object),
		);

		const currentWorker = runtime.work.mock.calls[0]?.[1];
		const legacyWorker = runtime.work.mock.calls[1]?.[1];
		await currentWorker?.([
			{
				id: "current-1",
				name: NOTIFICATION_QUEUE,
				data: { name: NotificationJobName.BILLING_ISSUE, data: { userId: "u1" } },
				attempt: 0,
			},
		]);
		await legacyWorker?.([
			{
				id: "legacy-1",
				name: NotificationJobName.BILLING_ISSUE,
				data: { userId: "u2" },
				attempt: 0,
			},
		]);

		expect(sendBillingIssue.execute).toHaveBeenNthCalledWith(1, { userId: "u1" });
		expect(sendBillingIssue.execute).toHaveBeenNthCalledWith(2, { userId: "u2" });
	});
});
