import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";

import { JOB_RUNTIME, type JobData, type JobRuntimePort } from "@/shared/application/ports";

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
	NOTIFICATION_WORKER_POLICY,
	NotificationJobName,
	NotificationRuntimeJobSchema,
} from "./notification-queue.constants";

function assertUnreachableJob(job: never): never {
	throw new Error(`Unhandled notification job: ${JSON.stringify(job)}`);
}

/** Queue adapter: validates transport input and routes it to application use cases. */
@Injectable()
export class NotificationQueueProcessor implements OnModuleInit {
	constructor(
		private readonly sendFollowRequest: SendFollowRequestNotificationUseCase,
		private readonly sendFollowAccepted: SendFollowAcceptedNotificationUseCase,
		private readonly sendNudge: SendNudgeNotificationUseCase,
		private readonly sendCheer: SendCheerNotificationUseCase,
		private readonly sendBillingIssue: SendBillingIssueNotificationUseCase,
		private readonly sendFriendCompletion: SendFriendCompletionNotificationsUseCase,
		private readonly sendMilestone: SendMilestoneNotificationUseCase,
		private readonly reconcilePushReceipts: ReconcilePushReceiptsUseCase,
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;

		await this.runtime.work<JobData>(
			NOTIFICATION_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			NOTIFICATION_WORKER_POLICY,
		);
		await this.runtime.work<JobData>(
			NOTIFICATION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) {
					await this.process({ name: job.name, data: job.data });
				}
			},
			NOTIFICATION_WORKER_POLICY,
		);
	}

	async process(untrustedJob: unknown): Promise<void> {
		const job = NotificationRuntimeJobSchema.parse(untrustedJob);

		switch (job.name) {
			case NotificationJobName.FOLLOW_NEW:
				return this.sendFollowRequest.execute(job.data);
			case NotificationJobName.FOLLOW_MUTUAL:
				return this.sendFollowAccepted.execute(job.data);
			case NotificationJobName.NUDGE_SENT:
				return this.sendNudge.execute(job.data);
			case NotificationJobName.CHEER_SENT:
				return this.sendCheer.execute(job.data);
			case NotificationJobName.BILLING_ISSUE:
				return this.sendBillingIssue.execute(job.data);
			case NotificationJobName.FRIEND_COMPLETED:
				return this.sendFriendCompletion.execute(job.data);
			case NotificationJobName.MILESTONE_REACHED:
				return this.sendMilestone.execute(job.data);
			case NotificationJobName.PUSH_RECEIPTS:
				return this.reconcilePushReceipts.execute();
		}

		return assertUnreachableJob(job);
	}
}
