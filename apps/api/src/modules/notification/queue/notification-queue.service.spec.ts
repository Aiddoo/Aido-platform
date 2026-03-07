import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";

import {
	NOTIFICATION_QUEUE,
	NotificationJobName,
} from "./notification-queue.constants";
import { NotificationQueueService } from "./notification-queue.service";

// =============================================================================
// Tests
// =============================================================================

describe("NotificationQueueService", () => {
	let service: NotificationQueueService;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const mockQueue = {
			add: jest.fn().mockResolvedValue(undefined),
		};

		const { unit, unitRef } = await TestBed.solitary(NotificationQueueService)
			.mock(getQueueToken(NOTIFICATION_QUEUE))
			.impl(() => mockQueue)
			.compile();

		service = unit;
		queue = unitRef.get(getQueueToken(NOTIFICATION_QUEUE));
	});

	// =========================================================================
	// enqueueFollowNew
	// =========================================================================

	describe("enqueueFollowNew", () => {
		it("follow-new 잡을 큐에 등록한다", async () => {
			// Given
			const payload = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};

			// When
			service.enqueueFollowNew(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				NotificationJobName.FOLLOW_NEW,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};

			// When & Then — 에러 전파 없음
			service.enqueueFollowNew(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// enqueueFollowMutual
	// =========================================================================

	describe("enqueueFollowMutual", () => {
		it("follow-mutual 잡을 큐에 등록한다", async () => {
			// Given
			const payload = {
				userId: "user-1",
				friendId: "user-2",
				friendName: "친구 유저",
			};

			// When
			service.enqueueFollowMutual(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				NotificationJobName.FOLLOW_MUTUAL,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload = {
				userId: "user-1",
				friendId: "user-2",
				friendName: "친구 유저",
			};

			// When & Then
			service.enqueueFollowMutual(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// enqueueNudgeSent
	// =========================================================================

	describe("enqueueNudgeSent", () => {
		it("nudge-sent 잡을 큐에 등록한다", async () => {
			// Given
			const payload = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
				todoId: 10,
				todoTitle: "운동하기",
				message: "빨리 해!",
			};

			// When
			service.enqueueNudgeSent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				NotificationJobName.NUDGE_SENT,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
			};

			// When & Then
			service.enqueueNudgeSent(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// enqueueCheerSent
	// =========================================================================

	describe("enqueueCheerSent", () => {
		it("cheer-sent 잡을 큐에 등록한다", async () => {
			// Given
			const payload = {
				cheerId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
				message: "화이팅!",
			};

			// When
			service.enqueueCheerSent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				NotificationJobName.CHEER_SENT,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload = {
				cheerId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
			};

			// When & Then
			service.enqueueCheerSent(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// enqueueBillingIssue
	// =========================================================================

	describe("enqueueBillingIssue", () => {
		it("billing-issue 잡을 큐에 등록한다", async () => {
			// Given
			const payload = { userId: "user-1" };

			// When
			service.enqueueBillingIssue(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				NotificationJobName.BILLING_ISSUE,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload = { userId: "user-1" };

			// When & Then
			service.enqueueBillingIssue(payload);
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
