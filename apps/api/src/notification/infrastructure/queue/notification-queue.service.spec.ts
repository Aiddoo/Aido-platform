/**
 * NotificationQueueService 모듈 단위 테스트
 *
 * @description
 * NotificationQueueService 모듈의 DI 구성을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test notification-queue.service
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";

import { NOTIFICATION_QUEUE, NotificationJobName } from "./notification-queue.constants";
import { NotificationQueueService } from "./notification-queue.service";

describe("NotificationQueueService — 알림 큐 서비스", () => {
	let service: NotificationQueueService;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const mockRuntime = {
			start: jest.fn(),
			stop: jest.fn(),
			enqueue: jest.fn().mockResolvedValue("job-1"),
			schedule: jest.fn(),
			cancel: jest.fn(),
			work: jest.fn(),
			health: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(NotificationQueueService)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => mockRuntime)
			.compile();

		service = unit;
		runtime = unitRef.get(JOB_RUNTIME);
	});

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
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.FOLLOW_NEW, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
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
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.FOLLOW_MUTUAL, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
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
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.NUDGE_SENT, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
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
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.CHEER_SENT, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
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

	describe("enqueueBillingIssue", () => {
		it("billing-issue 잡을 큐에 등록한다", async () => {
			// Given
			const payload = { userId: "user-1" };

			// When
			service.enqueueBillingIssue(payload);
			await flushPromises();

			// Then
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.BILLING_ISSUE, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
			const payload = { userId: "user-1" };

			// When & Then
			service.enqueueBillingIssue(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	describe("enqueueFriendCompleted", () => {
		it("friend-completed 잡을 큐에 등록한다", async () => {
			// Given
			const payload = {
				friendId: "friend-1",
				friendName: "완료 친구",
				notifyUserIds: ["user-1", "user-2"],
				timezone: "Asia/Seoul",
			};

			// When
			service.enqueueFriendCompleted(payload);
			await flushPromises();

			// Then
			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.FRIEND_COMPLETED, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			runtime.enqueue.mockRejectedValue(new Error("Redis connection error"));
			const payload = {
				friendId: "friend-1",
				friendName: "완료 친구",
				notifyUserIds: ["user-1"],
				timezone: "Asia/Seoul",
			};

			// When & Then
			service.enqueueFriendCompleted(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	describe("enqueueMilestoneReached", () => {
		it("milestone-reached 잡을 기존 payload와 정책으로 등록한다", async () => {
			const payload = { userId: "user-1", milestone: "COUNT_10" as const };

			service.enqueueMilestoneReached(payload);
			await flushPromises();

			expect(runtime.enqueue).toHaveBeenCalledWith(
				NOTIFICATION_QUEUE,
				{ name: NotificationJobName.MILESTONE_REACHED, data: payload },
				expect.objectContaining({ retryLimit: 2 }),
			);
		});

		it("큐 등록 실패를 외부 void 호환 경계에서 관찰한다", async () => {
			runtime.enqueue.mockRejectedValue(new Error("runtime unavailable"));

			service.enqueueMilestoneReached({ userId: "user-1", milestone: "COUNT_10" });

			await expect(flushPromises()).resolves.toBeUndefined();
		});
	});
});
