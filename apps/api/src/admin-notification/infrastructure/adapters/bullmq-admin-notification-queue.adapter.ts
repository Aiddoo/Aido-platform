import { Inject, Injectable } from "@nestjs/common";

import {
	type EnqueueJobOptions,
	JOB_RUNTIME,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";

import type {
	AdminNotificationQueuePort,
	EnqueueSendOptions,
	NotificationChannel,
} from "../../application/ports/admin-notification-queue.port";
import type { AdminNotification } from "../../domain/value-objects/admin-notification-message.vo";
import {
	ADMIN_NOTIFICATION_JOB_POLICY,
	ADMIN_NOTIFICATION_QUEUE,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "../queue/admin-notification-queue.constants";

/**
 * BullMQ 관리자 알림 큐 어댑터.
 *
 * 조립된 관리자 알림을 SEND 잡으로 등록한다.
 */
@Injectable()
export class BullmqAdminNotificationQueueAdapter implements AdminNotificationQueuePort {
	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	async enqueueSend(
		channel: NotificationChannel,
		notification: AdminNotification,
		options?: EnqueueSendOptions,
	): Promise<void> {
		const jobOptions: EnqueueJobOptions =
			options?.jobId === undefined
				? ADMIN_NOTIFICATION_JOB_POLICY
				: { ...ADMIN_NOTIFICATION_JOB_POLICY, idempotencyKey: options.jobId };
		await this.runtime.enqueue(
			ADMIN_NOTIFICATION_QUEUE,
			{
				name: AdminNotificationJobName.SEND,
				data: { channel, notification } satisfies AdminNotificationSendData,
			},
			jobOptions,
		);
	}
}
