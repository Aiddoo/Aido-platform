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
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asMock, createMockJob, createMockPrisma, type MockPrismaClient } from "@test/mocks";
import { createUnitOfWorkMock } from "@test/mocks/ports";

import { Prisma } from "@/generated/prisma/client";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { NotificationBatchDispatcher } from "../../application/dispatchers/notification-batch.dispatcher";
import { NotificationSender } from "../../application/senders/notification.sender";
import {
	createBillingIssueNotificationMessage,
	createCheerReceivedNotificationMessage,
	createFollowAcceptedNotificationMessage,
	createFollowRequestNotificationMessage,
	createNudgeReceivedNotificationMessage,
} from "../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/services/transactional-notification-campaign";
import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";
import { NotificationQueueProcessor } from "./notification-queue.processor";

describe("NotificationQueueProcessor — 알림 큐 프로세서", () => {
	let processor: NotificationQueueProcessor;
	let notification: Mocked<NotificationSender>;
	let batchDispatcher: Mocked<NotificationBatchDispatcher>;
	let uow: UnitOfWorkPort;
	let db: MockPrismaClient;

	beforeEach(async () => {
		// UNIT_OF_WORK — run이 콜백을 즉시 실행하는 passthrough mock
		uow = createUnitOfWorkMock();
		// CLS 트랜잭션 스텁 — tx가 항상 Prisma mock을 반환
		db = createMockPrisma();

		const { unit, unitRef } = await TestBed.solitary(NotificationQueueProcessor)
			.mock(UNIT_OF_WORK)
			.impl(() => uow)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();

		processor = unit;
		notification = unitRef.get(NotificationSender);
		batchDispatcher = unitRef.get(NotificationBatchDispatcher);
		notification.getUserLocale.mockResolvedValue("ko");
		batchDispatcher.persistBatch.mockImplementation(async (sourceData) => ({
			count: sourceData.length,
			items: [],
			sourceData,
		}));
		db.userPreference.findMany.mockResolvedValue([]);
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_REQUEST,
				recipientId: data.followingId,
				occurrenceKey: `${data.followerId}:${data.followingId}`,
			};
			const message = createFollowRequestNotificationMessage({
				senderName: data.followerName,
				locale: "ko",
				variantContext,
			});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				friendId: "user-1",
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});
		});

		it("같은 친구 요청 잡을 재시도하면 같은 variant를 사용한다", async () => {
			// Given
			const data: FollowNewJobData = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_NEW, data);

			// When
			await processor.process(job);
			await processor.process(job);

			// Then
			const first = notification.createAndSendWithDedup.mock.calls[0]?.[0];
			const retried = notification.createAndSendWithDedup.mock.calls[1]?.[0];
			expect(first?.variantId).toBeDefined();
			expect(retried?.variantId).toBe(first?.variantId);
			expect(retried?.title).toBe(first?.title);
			expect(retried?.body).toBe(first?.body);
		});

		it("실패 시 에러를 재전파해 BullMQ 재시도를 유도한다", async () => {
			// Given
			notification.createAndSendWithDedup.mockRejectedValue(new Error("DB error"));
			const data: FollowNewJobData = {
				followerId: "user-1",
				followingId: "user-2",
				followerName: "테스트 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_NEW, data);

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).rejects.toThrow("DB error");
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
				recipientId: data.userId,
				occurrenceKey: `${data.friendId}:${data.userId}`,
			};
			const message = createFollowAcceptedNotificationMessage({
				senderName: data.friendName,
				locale: "ko",
				variantContext,
			});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-1",
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				friendId: "user-2",
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});
		});

		it("실패 시 에러를 재전파해 BullMQ 재시도를 유도한다", async () => {
			// Given
			notification.createAndSendWithDedup.mockRejectedValue(new Error("DB error"));
			const data: FollowMutualJobData = {
				userId: "user-1",
				friendId: "user-2",
				friendName: "친구 유저",
			};
			const job = createMockJob(NotificationJobName.FOLLOW_MUTUAL, data);

			// When & Then
			await expect(processor.process(job)).rejects.toThrow("DB error");
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
				recipientId: data.receiverId,
				occurrenceKey: String(data.nudgeId),
			};
			const message = createNudgeReceivedNotificationMessage({
				senderName: data.senderName,
				todoTitle: data.todoTitle,
				locale: "ko",
				variantContext,
			});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				nudgeId: 1,
				friendId: "user-1",
				todoId: 10,
				metadata: undefined,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
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
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { message: "빨리 해!" },
					campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
					variantId: expect.stringMatching(/^nudge_received_v1\./),
				}),
			);
		});

		it("실패 시 에러를 재전파해 BullMQ 재시도를 유도한다", async () => {
			// Given
			notification.createAndSendWithDedup.mockRejectedValue(new Error("DB error"));
			const data: NudgeSentJobData = {
				nudgeId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "보낸 유저",
			};
			const job = createMockJob(NotificationJobName.NUDGE_SENT, data);

			// When & Then
			await expect(processor.process(job)).rejects.toThrow("DB error");
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
				recipientId: data.receiverId,
				occurrenceKey: String(data.cheerId),
			};
			const message = createCheerReceivedNotificationMessage({
				senderName: data.senderName,
				message: data.message,
				locale: "ko",
				variantContext,
			});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: 1,
				friendId: "user-1",
				metadata: { message: "화이팅!" },
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
				recipientId: data.receiverId,
				occurrenceKey: String(data.cheerId),
			};
			const message = createCheerReceivedNotificationMessage({
				senderName: data.senderName,
				locale: "ko",
				variantContext,
			});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSendWithDedup).toHaveBeenCalledWith({
				userId: "user-2",
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: 2,
				friendId: "user-1",
				metadata: undefined,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});
		});

		it("실패 시 에러를 재전파해 BullMQ 재시도를 유도한다", async () => {
			// Given
			notification.createAndSendWithDedup.mockRejectedValue(new Error("DB error"));
			const data: CheerSentJobData = {
				cheerId: 1,
				senderId: "user-1",
				receiverId: "user-2",
				senderName: "응원 유저",
			};
			const job = createMockJob(NotificationJobName.CHEER_SENT, data);

			// When & Then
			await expect(processor.process(job)).rejects.toThrow("DB error");
		});
	});

	describe("billing-issue", () => {
		it("SYSTEM_NOTICE 타입으로 createAndSend를 호출한다", async () => {
			// Given
			const data: BillingIssueJobData = { userId: "user-1" };
			const job = createMockJob(NotificationJobName.BILLING_ISSUE, data);
			const message = createBillingIssueNotificationMessage({});

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSend).toHaveBeenCalledWith({
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});
		});

		it("실패 시 에러를 re-throw한다 (BullMQ 재시도 대상)", async () => {
			// Given
			notification.createAndSend.mockRejectedValue(new Error("DB error"));
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
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, friendCompletedData);
			notification.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());

			// When
			await processor.process(job);

			// Then
			expect(notification.findAlreadyNotifiedUserIds).toHaveBeenCalledWith(
				expect.objectContaining({
					userIds: ["user-1", "user-2"],
					type: "FRIEND_COMPLETED",
					friendId: "friend-1",
				}),
			);
			expect(batchDispatcher.persistBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "user-1",
						type: "FRIEND_COMPLETED",
						friendId: "friend-1",
						campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
						variantId: expect.stringMatching(/^friend_completed_v1\./),
					}),
					expect.objectContaining({
						userId: "user-2",
						type: "FRIEND_COMPLETED",
						campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
						variantId: expect.stringMatching(/^friend_completed_v1\./),
					}),
				]),
			);
			expect(batchDispatcher.dispatchPersistedBatch).toHaveBeenCalledWith(
				expect.objectContaining({ count: 2 }),
			);
		});

		it("이미 알림 받은 유저는 필터링한다", async () => {
			// Given
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, friendCompletedData);
			notification.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));
			// When
			await processor.process(job);

			// Then
			expect(batchDispatcher.persistBatch).toHaveBeenCalledWith([
				expect.objectContaining({
					userId: "user-2",
					type: "FRIEND_COMPLETED",
				}),
			]);
			expect(batchDispatcher.dispatchPersistedBatch).toHaveBeenCalledWith(
				expect.objectContaining({ count: 1 }),
			);
		});

		it("전원 이미 받은 경우 생성하지 않는다", async () => {
			// Given
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, friendCompletedData);
			notification.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1", "user-2"]));

			// When
			await processor.process(job);

			// Then
			expect(batchDispatcher.persistBatch).not.toHaveBeenCalled();
			expect(batchDispatcher.dispatchPersistedBatch).not.toHaveBeenCalled();
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
			expect(uow.run).not.toHaveBeenCalled();
			expect(batchDispatcher.persistBatch).not.toHaveBeenCalled();
			expect(batchDispatcher.dispatchPersistedBatch).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 시 graceful skip한다", async () => {
			// Given
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, friendCompletedData);
			const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			jest.mocked(uow.run).mockRejectedValue(prismaError);

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).resolves.not.toThrow();
		});

		it("일반 에러 시 재전파해 BullMQ 재시도를 유도한다", async () => {
			// Given
			const job = createMockJob(NotificationJobName.FRIEND_COMPLETED, friendCompletedData);
			jest.mocked(uow.run).mockRejectedValue(new Error("DB error"));

			// When & Then — 에러 전파 없음
			await expect(processor.process(job)).rejects.toThrow("DB error");
		});
	});

	describe("milestone-reached", () => {
		const milestoneData: MilestoneReachedJobData = {
			userId: "user-milestone",
			milestone: "COUNT_10",
		};

		it("마일스톤 알림을 발송한다", async () => {
			// Given - 기존 마일스톤 알림 없음
			asMock(db.notification.findFirst).mockResolvedValue(null);
			notification.createAndSend.mockResolvedValue(null);

			const job = createMockJob(NotificationJobName.MILESTONE_REACHED, milestoneData);

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-milestone",
					type: "WEEKLY_ACHIEVEMENT",
					metadata: { milestone: "COUNT_10" },
				}),
			);
		});

		it("이미 달성한 마일스톤은 스킵한다", async () => {
			// Given - 기존 마일스톤 알림 존재
			asMock(db.notification.findFirst).mockResolvedValue({
				id: 1,
				userId: "user-milestone",
			});

			const job = createMockJob(NotificationJobName.MILESTONE_REACHED, milestoneData);

			// When
			await processor.process(job);

			// Then
			expect(notification.createAndSend).not.toHaveBeenCalled();
		});

		it("에러 발생 시 로깅 후 재전파한다", async () => {
			// Given
			asMock(db.notification.findFirst).mockResolvedValue(null);
			notification.createAndSend.mockRejectedValue(new Error("DB error"));

			const job = createMockJob(NotificationJobName.MILESTONE_REACHED, milestoneData);

			// When & Then — 에러 throw 없음
			await expect(processor.process(job)).rejects.toThrow("DB error");
		});
	});
});
