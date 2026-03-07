import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";
import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type NotificationJobData,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";
import { NotificationQueueProcessor } from "./notification-queue.processor";

// =============================================================================
// Helpers
// =============================================================================

function createMockJob<T extends NotificationJobData>(
	name: string,
	data: T,
): Job<T> {
	return { name, data, id: `job-${name}` } as unknown as Job<T>;
}

// =============================================================================
// Tests
// =============================================================================

describe("NotificationQueueProcessor", () => {
	let processor: NotificationQueueProcessor;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			NotificationQueueProcessor,
		).compile();

		processor = unit;
		notificationService = unitRef.get(NotificationService);
	});

	// =========================================================================
	// follow-new
	// =========================================================================

	describe("follow-new", () => {
		it("FOLLOW_NEW 타입으로 createAndSendWithDedup을 호출한다", async () => {
			// Given
			const data: FollowNewJobData = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_NEW, data);
			const message = NotificationMessageBuilder.followNew("테스트 유저");

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				friendId: "user-1",
			});
		});

		it("실패 시 에러를 throw하지 않는다 (소셜 알림)", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);
			const data: FollowNewJobData = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_NEW, data);

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// follow-mutual
	// =========================================================================

	describe("follow-mutual", () => {
		it("FOLLOW_ACCEPTED 타입으로 createAndSendWithDedup을 호출한다", async () => {
			// Given
			const data: FollowMutualJobData = {
				userId: "user-1",
				friendId: "user-2",
				friendName: "친구 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_MUTUAL, data);
			const message = NotificationMessageBuilder.followAccepted("친구 유저");

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-1",
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				friendId: "user-2",
			});
		});

		it("실패 시 에러를 throw하지 않는다 (소셜 알림)", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);
			const data: FollowMutualJobData = {
				userId: "user-1",
				friendId: "user-2",
				friendName: "친구 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_MUTUAL, data);

			// When & Then
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// nudge-sent
	// =========================================================================

	describe("nudge-sent", () => {
		it("메시지 없이 NUDGE_RECEIVED 알림을 생성한다", async () => {
			// Given
			const data: NudgeSentJobData = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
				todoId: 10,
			};
			const job = createMockJob(NotificationJobName.NUDGE_SENT, data);
			const message = NotificationMessageBuilder.nudgeReceived(
				"보낸 유저",
				undefined,
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				nudgeId: 1,
				friendId: "user-1",
				todoId: 10,
				metadata: undefined,
			});
		});

		it("메시지가 있으면 metadata에 포함한다", async () => {
			// Given
			const data: NudgeSentJobData = {
				nudgeId: 2,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
				message: "빨리 해!",
			};
			const job = createMockJob(NotificationJobName.NUDGE_SENT, data);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { message: "빨리 해!" },
				}),
			);
		});

		it("실패 시 에러를 throw하지 않는다 (소셜 알림)", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);
			const data: NudgeSentJobData = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
			};
			const job = createMockJob(NotificationJobName.NUDGE_SENT, data);

			// When & Then
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// cheer-sent
	// =========================================================================

	describe("cheer-sent", () => {
		it("메시지가 있으면 CHEER_RECEIVED 알림에 metadata를 포함한다", async () => {
			// Given
			const data: CheerSentJobData = {
				cheerId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
				message: "화이팅!",
			};
			const job = createMockJob(NotificationJobName.CHEER_SENT, data);
			const message = NotificationMessageBuilder.cheerReceived(
				"응원 유저",
				"화이팅!",
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: 1,
				friendId: "user-1",
				metadata: { message: "화이팅!" },
			});
		});

		it("메시지가 없으면 기본 응원 메시지를 사용한다", async () => {
			// Given
			const data: CheerSentJobData = {
				cheerId: 2,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
			};
			const job = createMockJob(NotificationJobName.CHEER_SENT, data);
			const message = NotificationMessageBuilder.cheerReceived(
				"응원 유저",
				undefined,
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: 2,
				friendId: "user-1",
				metadata: undefined,
			});
		});

		it("실패 시 에러를 throw하지 않는다 (소셜 알림)", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);
			const data: CheerSentJobData = {
				cheerId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
			};
			const job = createMockJob(NotificationJobName.CHEER_SENT, data);

			// When & Then
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

	// =========================================================================
	// billing-issue
	// =========================================================================

	describe("billing-issue", () => {
		it("SYSTEM_NOTICE 타입으로 createAndSend를 호출한다", async () => {
			// Given
			const data: BillingIssueJobData = { userId: "user-1" };
			const job = createMockJob(NotificationJobName.BILLING_ISSUE, data);
			const message = NotificationMessageBuilder.billingIssue();

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledWith({
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});
		});

		it("실패 시 에러를 re-throw한다 (BullMQ 재시도 대상)", async () => {
			// Given
			notificationService.createAndSend.mockRejectedValue(
				new Error("DB error"),
			);
			const data: BillingIssueJobData = { userId: "user-1" };
			const job = createMockJob(NotificationJobName.BILLING_ISSUE, data);

			// When & Then — 에러 전파됨 (재시도 활용)
			await expect(processor.process(job)).rejects.toThrow("DB error");
		});
	});

	// =========================================================================
	// unknown job
	// =========================================================================

	describe("unknown job", () => {
		it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
			// Given
			const job = createMockJob("unknown-job", {} as NotificationJobData);

			// When & Then — 에러 없이 처리
			await expect(processor.process(job)).resolves.not.toThrow();
			expect(notificationService.createAndSendWithDedup).not.toHaveBeenCalled();
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});
	});
});
