import { type BeforeApplicationShutdown, Injectable, Logger } from "@nestjs/common";

import type { CreateNotificationData } from "../../application/ports/notification-data";
import type { PushDispatcherPort } from "../../application/ports/push-dispatcher.port";
import type { PushDeliveryItem } from "../../application/types/push-delivery.types";
import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case";

const MAX_DRAIN_ROUNDS = 25;
const DRAIN_TIMEOUT_MS = 15_000;

/**
 * 기존 동기 호출부를 await 가능한 전달 use case에 연결하는 in-process 호환 어댑터.
 * 전달 정책은 소유하지 않고 task 추적·종료 대기만 담당한다.
 */
@Injectable()
export class InProcessPushDispatcherAdapter
	implements PushDispatcherPort, BeforeApplicationShutdown
{
	readonly #logger = new Logger(InProcessPushDispatcherAdapter.name);
	readonly #pendingDeliveryTasks = new Set<Promise<void>>();

	constructor(private readonly deliverPushNotifications: DeliverPushNotificationsUseCase) {}

	fireAndForgetPush(data: CreateNotificationData, notificationId: number): void {
		const deliveryTask = this.deliverPushNotifications
			.execute({
				mode: "single",
				item: { data, notificationId },
			})
			.catch((error: unknown) => {
				this.#logger.error(
					`Failed to send push notification: userId=${data.userId}, error=${error}`,
				);
			});
		this.#trackDeliveryTask(deliveryTask);
	}

	fireAndForgetBatchPush(items: readonly PushDeliveryItem[]): void {
		const deliveryTask = this.deliverPushNotifications
			.execute({ mode: "batch", items })
			.catch((error: unknown) => {
				this.#logger.error(`Failed to send batch push notifications: error=${error}`);
			});
		this.#trackDeliveryTask(deliveryTask);
	}

	async drainPendingPushes(timeoutMs: number = DRAIN_TIMEOUT_MS): Promise<void> {
		if (this.#pendingDeliveryTasks.size === 0) return;

		this.#logger.log(
			`Waiting for ${this.#pendingDeliveryTasks.size} pending push delivery task(s)...`,
		);

		let timeout: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<never>((_resolve, reject) => {
			timeout = setTimeout(() => {
				reject(
					new Error(
						`Push drain exceeded ${timeoutMs}ms — ${this.#pendingDeliveryTasks.size}건이 정착하지 않았다`,
					),
				);
			}, timeoutMs);
			timeout.unref?.();
		});

		try {
			await Promise.race([this.#settlePendingDeliveryTasks(), deadline]);
			this.#logger.log("All pending push delivery tasks completed");
		} finally {
			clearTimeout(timeout);
		}
	}

	async beforeApplicationShutdown(): Promise<void> {
		try {
			await this.drainPendingPushes();
		} catch (error) {
			this.#logger.warn(`Shutting down with pending pushes unresolved: ${error}`);
		}
	}

	#trackDeliveryTask(task: Promise<void>): void {
		this.#pendingDeliveryTasks.add(task);
		task.finally(() => this.#pendingDeliveryTasks.delete(task));
	}

	async #settlePendingDeliveryTasks(): Promise<void> {
		for (let round = 0; round < MAX_DRAIN_ROUNDS; round += 1) {
			await Promise.allSettled([...this.#pendingDeliveryTasks]);
			if (this.#pendingDeliveryTasks.size === 0) return;
		}

		throw new Error(
			`Push drain exceeded ${MAX_DRAIN_ROUNDS} rounds — ${this.#pendingDeliveryTasks.size}건이 남아 발송 연쇄 루프가 의심된다`,
		);
	}
}
