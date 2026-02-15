/**
 * TodoListener 단위 테스트 (Suites + GWT 패턴)
 *
 * 알림 중복 방지 로직을 검증합니다.
 * - DAILY_COMPLETE: 하루에 1회만 발송 (Transaction + DB unique constraint)
 * - FRIEND_COMPLETED: 같은 친구에 대해 하루에 1회만 발송 (배치)
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";

import { NotificationService } from "../notification.service";
import { TodoListener } from "./todo.listener";

jest.mock("@/common/date/utils/date.util", () => ({
	getUserToday: jest.fn(() => new Date("2026-02-06T00:00:00.000Z")),
}));

describe("TodoListener", () => {
	let listener: TodoListener;
	let notificationService: Mocked<NotificationService>;
	let database: Mocked<DatabaseService>;

	// Mock database transaction passthrough
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let mockDatabase: any;

	beforeEach(async () => {
		mockDatabase = {
			$transaction: jest.fn((callback: (tx: unknown) => unknown) =>
				callback(mockDatabase),
			),
		};

		const { unit, unitRef } = await TestBed.solitary(TodoListener).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;

		// DatabaseService.$transaction passthrough mock 설정
		database.$transaction.mockImplementation((callback) =>
			callback(mockDatabase),
		);
	});

	// ============================================
	// handleTodoAllCompleted
	// ============================================

	describe("handleTodoAllCompleted", () => {
		const payload = {
			userId: "user-1",
			completedCount: 3,
			timezone: "Asia/Seoul",
		};

		it("오늘 첫 전체 완료 시 DAILY_COMPLETE 알림을 발송한다", async () => {
			// Given: 오늘 DAILY_COMPLETE 알림이 없음
			notificationService.existsNotification.mockResolvedValue(false);
			notificationService.createAndSend.mockResolvedValue({} as any);

			// When
			await listener.handleTodoAllCompleted(payload);

			// Then: 트랜잭션 내에서 알림 발송됨
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "DAILY_COMPLETE",
					notificationDate: new Date("2026-02-06T00:00:00.000Z"),
				}),
				expect.anything(), // tx
			);
		});

		it("오늘 이미 DAILY_COMPLETE를 발송했으면 중복 발송하지 않는다", async () => {
			// Given: 오늘 이미 DAILY_COMPLETE 알림이 존재
			notificationService.existsNotification.mockResolvedValue(true);

			// When
			await listener.handleTodoAllCompleted(payload);

			// Then: 알림 발송 안됨
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 위반 시 중복으로 간주하고 조용히 무시한다", async () => {
			// Given: existsNotification은 false지만 createAndSend에서 P2002 발생 (레이스 컨디션)
			notificationService.existsNotification.mockResolvedValue(false);
			notificationService.createAndSend.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["userId", "type", "notificationDate"] },
					clientVersion: "7.0.0",
				}),
			);

			// When & Then: 에러가 throw되지 않음
			await expect(
				listener.handleTodoAllCompleted(payload),
			).resolves.toBeUndefined();
		});

		it("트랜잭션 내에서 중복 체크가 수행된다", async () => {
			// Given
			notificationService.existsNotification.mockResolvedValue(false);
			notificationService.createAndSend.mockResolvedValue({} as any);

			// When
			await listener.handleTodoAllCompleted(payload);

			// Then: existsNotification에 tx가 전달됨
			expect(notificationService.existsNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "DAILY_COMPLETE",
				}),
				expect.anything(), // tx
			);
		});
	});

	// ============================================
	// handleFriendCompleted
	// ============================================

	describe("handleFriendCompleted", () => {
		const payload = {
			friendId: "friend-1",
			friendName: "김철수",
			notifyUserIds: ["user-1", "user-2", "user-3"],
			timezone: "Asia/Seoul",
		};

		it("오늘 첫 친구 완료 시 모든 친구에게 알림을 발송한다", async () => {
			// Given: 아무도 아직 알림을 받지 않음
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(),
			);
			notificationService.createAndSendBatch.mockResolvedValue({ count: 3 });

			// When
			await listener.handleFriendCompleted(payload);

			// Then: 3명 모두에게 발송 (트랜잭션 내)
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "user-1",
						type: "FRIEND_COMPLETED",
						notificationDate: new Date("2026-02-06T00:00:00.000Z"),
					}),
					expect.objectContaining({
						userId: "user-2",
						type: "FRIEND_COMPLETED",
					}),
					expect.objectContaining({
						userId: "user-3",
						type: "FRIEND_COMPLETED",
					}),
				]),
				expect.anything(), // tx
			);
		});

		it("이미 알림을 받은 유저는 제외하고 발송한다", async () => {
			// Given: user-1은 이미 알림을 받음
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(["user-1"]),
			);
			notificationService.createAndSendBatch.mockResolvedValue({ count: 2 });

			// When
			await listener.handleFriendCompleted(payload);

			// Then: user-2, user-3에게만 발송
			const batchArg =
				notificationService.createAndSendBatch.mock.calls[0]?.[0] ?? [];
			expect(batchArg).toHaveLength(2);
			expect(batchArg.map((n: any) => n.userId)).toEqual(["user-2", "user-3"]);
		});

		it("모든 유저가 이미 알림을 받았으면 발송하지 않는다", async () => {
			// Given: 모든 유저가 이미 알림을 받음
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(["user-1", "user-2", "user-3"]),
			);

			// When
			await listener.handleFriendCompleted(payload);

			// Then: 발송 안됨
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		});

		it("알림 대상이 없으면 중복 체크도 하지 않는다", async () => {
			// Given: 알림 대상이 빈 배열
			const emptyPayload = {
				friendId: "friend-1",
				friendName: "김철수",
				notifyUserIds: [] as string[],
				timezone: "Asia/Seoul",
			};

			// When
			await listener.handleFriendCompleted(emptyPayload);

			// Then: DB 조회도, 알림 발송도 하지 않음
			expect(
				notificationService.findAlreadyNotifiedUserIds,
			).not.toHaveBeenCalled();
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 위반 시 중복으로 간주하고 조용히 무시한다", async () => {
			// Given: findAlreadyNotifiedUserIds는 빈 Set이지만 createAndSendBatch에서 P2002 발생
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(),
			);
			notificationService.createAndSendBatch.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: {
						target: ["userId", "type", "friendId", "notificationDate"],
					},
					clientVersion: "7.0.0",
				}),
			);

			// When & Then: 에러가 throw되지 않음
			await expect(
				listener.handleFriendCompleted(payload),
			).resolves.toBeUndefined();
		});
	});

	// ============================================
	// handleTodoReminder
	// ============================================

	describe("handleTodoReminder", () => {
		const payload = {
			userId: "user-1",
			todoId: 42,
			todoTitle: "보고서 작성",
			minutesUntilDue: 30,
		};

		it("TODO_REMINDER 알림을 createAndSend로 생성한다", async () => {
			// Given
			notificationService.createAndSend.mockResolvedValue({} as any);

			// When
			await listener.handleTodoReminder(payload);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "TODO_REMINDER",
					todoId: 42,
				}),
			);
		});

		it("알림 생성 실패 시 에러를 잡아 로깅한다", async () => {
			// Given
			notificationService.createAndSend.mockRejectedValue(
				new Error("DB error"),
			);

			// When / Then
			await expect(listener.handleTodoReminder(payload)).resolves.not.toThrow();
		});
	});
});
