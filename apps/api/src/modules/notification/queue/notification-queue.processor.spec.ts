/**
 * NotificationQueueProcessor 잡/프로세서 단위 테스트
 *
 * @description
 * NotificationQueueProcessor의 비동기 작업 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test notification-queue.processor
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";
import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	type NotificationJobData,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";
import { NotificationQueueProcessor } from "./notification-queue.processor";

function createMockJob<T extends NotificationJobData>(
	name: string,
	data: T,
): Job<T> {
	return { name, data, id: `job-${name}` } as unknown as Job<T>;
}

describe("NotificationQueueProcessor — 알림 큐 프로세서", () => {
	let processor: NotificationQueueProcessor;
	let notificationService: Mocked<NotificationService>;
	let database: Mocked<DatabaseService>;

	beforeEach(async () => {
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } = await TestBed.solitary(
			NotificationQueueProcessor,
		).compile();

		processor = unit;
		notificationService = unitRef.get(NotificationService);
		database = unitRef.get(DatabaseService);
		database.userPreference.findUnique.mockResolvedValue(null as never);
		database.userPreference.findMany.mockResolvedValue([] as never);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

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

	describe("nudge-sent", () => {
		it("메시지 없이 NUDGE_RECEIVED 알림을 생성한다", async () => {
			// Given
			const data: NudgeSentJobData = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
				todoId: 10,
				todoTitle: "밥먹기",
			};
			const job = createMockJob(NotificationJobName.NUDGE_SENT, data);
			const message = NotificationMessageBuilder.nudgeReceived(
				"보낸 유저",
				"밥먹기",
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
				todoTitle: "운동하기",
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

	describe("friend-completed", () => {
		const friendCompletedData: FriendCompletedJobData = {
			friendId: "friend-1",
			friendName: "완료 친구",
			notifyUserIds: ["user-1", "user-2"],
			timezone: "Asia/Seoul",
		};

		it("대상 유저들에게 FRIEND_COMPLETED 알림을 배치 생성한다", async () => {
			// Given
			const job = createMockJob(
				NotificationJobName.FRIEND_COMPLETED,
				friendCompletedData,
			);
			database.$transaction.mockImplementation((fn) => fn(database as never));
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(),
			);
			notificationService.createAndSendBatch.mockResolvedValue({ count: 2 });

			const message = NotificationMessageBuilder.friendCompleted("완료 친구");

			// When
			await processor.process(job);

			// Then
			expect(
				notificationService.findAlreadyNotifiedUserIds,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userIds: ["user-1", "user-2"],
					type: "FRIEND_COMPLETED",
					friendId: "friend-1",
				}),
				database,
			);
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "user-1",
						type: "FRIEND_COMPLETED",
						title: message.title,
						body: message.body,
						friendId: "friend-1",
					}),
					expect.objectContaining({
						userId: "user-2",
						type: "FRIEND_COMPLETED",
					}),
				]),
				database,
			);
		});

		it("이미 알림 받은 유저는 필터링한다", async () => {
			// Given
			const job = createMockJob(
				NotificationJobName.FRIEND_COMPLETED,
				friendCompletedData,
			);
			database.$transaction.mockImplementation((fn) => fn(database as never));
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(["user-1"]),
			);
			notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
				[
					expect.objectContaining({
						userId: "user-2",
						type: "FRIEND_COMPLETED",
					}),
				],
				database,
			);
		});

		it("전원 이미 받은 경우 생성하지 않는다", async () => {
			// Given
			const job = createMockJob(
				NotificationJobName.FRIEND_COMPLETED,
				friendCompletedData,
			);
			database.$transaction.mockImplementation((fn) => fn(database as never));
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(["user-1", "user-2"]),
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		});

		it("빈 notifyUserIds는 즉시 리턴한다", async () => {
			// Given
			const data: FriendCompletedJobData = {
				...friendCompletedData,
				notifyUserIds: [],
			};
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, data);

			// When
			await processor.process(job);

			// Then
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 시 graceful skip한다", async () => {
			// Given
			const job = createMockJob(
				NotificationJobName.FRIEND_COMPLETED,
				friendCompletedData,
			);
			const prismaError = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint failed",
				{ code: "P2002", clientVersion: "5.0.0" },
			);
			database.$transaction.mockRejectedValue(prismaError);

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).resolves.not.toThrow();
		});

		it("일반 에러 시 throw하지 않는다 (소셜 알림)", async () => {
			// Given
			const job = createMockJob(
				NotificationJobName.FRIEND_COMPLETED,
				friendCompletedData,
			);
			database.$transaction.mockRejectedValue(new Error("DB error"));

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

	describe("milestone-reached", () => {
		const milestoneData: MilestoneReachedJobData = {
			userId: "user-milestone",
			milestone: "COUNT_10",
		};

		it("마일스톤 알림을 발송한다", async () => {
			// Given - 기존 마일스톤 알림 없음
			(database.notification.findFirst as jest.Mock).mockResolvedValue(null);
			notificationService.createAndSend.mockResolvedValue(null);

			const job = createMockJob(
				NotificationJobName.MILESTONE_REACHED,
				milestoneData,
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-milestone",
					type: "WEEKLY_ACHIEVEMENT",
					metadata: { milestone: "COUNT_10" },
				}),
			);
		});

		it("이미 달성한 마일스톤은 스킵한다", async () => {
			// Given - 기존 마일스톤 알림 존재
			(database.notification.findFirst as jest.Mock).mockResolvedValue({
				id: 1,
				userId: "user-milestone",
			});

			const job = createMockJob(
				NotificationJobName.MILESTONE_REACHED,
				milestoneData,
			);

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("에러 발생 시 로깅만 하고 throw하지 않는다", async () => {
			// Given
			(database.notification.findFirst as jest.Mock).mockResolvedValue(null);
			notificationService.createAndSend.mockRejectedValue(
				new Error("DB error"),
			);

			const job = createMockJob(
				NotificationJobName.MILESTONE_REACHED,
				milestoneData,
			);

			// When & Then — 에러 throw 없음
			await expect(processor.process(job)).resolves.not.toThrow();
		});
	});

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
