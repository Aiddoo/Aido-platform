import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";

import type { SubscriptionEventPayload } from "@/modules/subscription/events/subscription.events";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import {
	ADMIN_NOTIFICATION_QUEUE,
	AdminNotificationJobName,
} from "./admin-notification-queue.constants";
import { AdminNotificationQueueService } from "./admin-notification-queue.service";

// =============================================================================
// Tests
// =============================================================================

describe("AdminNotificationQueueService", () => {
	let service: AdminNotificationQueueService;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const mockQueue = {
			add: jest.fn().mockResolvedValue(undefined),
		};

		const { unit, unitRef } = await TestBed.solitary(
			AdminNotificationQueueService,
		)
			.mock(getQueueToken(ADMIN_NOTIFICATION_QUEUE))
			.impl(() => mockQueue)
			.compile();

		service = unit;
		queue = unitRef.get(getQueueToken(ADMIN_NOTIFICATION_QUEUE));
	});

	// =========================================================================
	// enqueueUserRegistered
	// =========================================================================

	describe("enqueueUserRegistered", () => {
		it("잡을 큐에 등록한다", async () => {
			// Given
			const payload: UserRegisteredEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				provider: "apple",
				registeredAt: "2026-03-07T12:00:00.000Z",
			};

			// When
			service.enqueueUserRegistered(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({ channel: "admin" }),
				expect.any(Object),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload: UserRegisteredEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				provider: "apple",
				registeredAt: "2026-03-07T12:00:00.000Z",
			};

			// When & Then — 에러 전파 없음
			service.enqueueUserRegistered(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// enqueueSubscriptionEvent
	// =========================================================================

	describe("enqueueSubscriptionEvent", () => {
		it("잡을 큐에 등록한다", async () => {
			// Given
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
				store: "APP_STORE",
			};

			// When
			service.enqueueSubscriptionEvent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({ channel: "payment" }),
				expect.any(Object),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
			};

			// When & Then — 에러 전파 없음
			service.enqueueSubscriptionEvent(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});
});

// =============================================================================
// Helpers
// =============================================================================

function flushPromises(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}
