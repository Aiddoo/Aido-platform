import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";
import type {
	AdminNotificationQueuePort,
	EnqueueSendOptions,
	NotificationChannel,
} from "../../application/ports/admin-notification-queue.port";
import type { AdminNotification } from "../../domain/value-objects/admin-notification-message.vo";
import {
	ADMIN_NOTIFICATION_JOB_OPTS,
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "../queue/admin-notification-queue.constants";

/**
 * BullMQ 관리자 알림 큐 어댑터.
 *
 * 조립된 관리자 알림을 SEND 잡으로 등록한다.
 */
@Injectable()
export class BullmqAdminNotificationQueueAdapter
	implements AdminNotificationQueuePort
{
	constructor(
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly queue: Queue<AdminNotificationJobData>,
	) {}

	async enqueueSend(
		channel: NotificationChannel,
		notification: AdminNotification,
		options?: EnqueueSendOptions,
	): Promise<void> {
		const opts = options?.jobId
			? { ...ADMIN_NOTIFICATION_JOB_OPTS, jobId: options.jobId }
			: ADMIN_NOTIFICATION_JOB_OPTS;

		await this.queue.add(
			AdminNotificationJobName.SEND,
			{ channel, notification } satisfies AdminNotificationSendData,
			opts,
		);
	}
}
