/**
 * TodoListener 단위 테스트 (Suites + GWT 패턴)
 *
 * 알림 중복 방지 로직을 검증합니다.
 * - DAILY_COMPLETE: 하루에 1회만 발송
 * - FRIEND_COMPLETED: 같은 친구에 대해 하루에 1회만 발송 (배치)
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationRepository } from "../notification.repository";
import { NotificationService } from "../notification.service";
import { TodoListener } from "./todo.listener";

jest.mock("@/common/date/utils/date.util", () => ({
	startOfDay: jest.fn(() => new Date("2026-02-06T00:00:00.000Z")),
}));

describe("TodoListener", () => {
	let listener: TodoListener;
	let notificationService: Mocked<NotificationService>;
	let notificationRepository: Mocked<NotificationRepository>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(TodoListener).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
		notificationRepository = unitRef.get(
			NotificationRepository,
		) as unknown as Mocked<NotificationRepository>;
	});

	// ============================================
	// handleTodoAllCompleted
	// ============================================

	describe("handleTodoAllCompleted", () => {
		const payload = { userId: "user-1", completedCount: 3 };

		it("오늘 첫 전체 완료 시 DAILY_COMPLETE 알림을 발송한다", async () => {
			// Given: 오늘 DAILY_COMPLETE 알림이 없음
			notificationRepository.existsNotification.mockResolvedValue(false);
			notificationService.createAndSend.mockResolvedValue({} as any);

			// When
			await listener.handleTodoAllCompleted(payload);

			// Then: 알림 발송됨
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "DAILY_COMPLETE",
				}),
			);
		});

		it("오늘 이미 DAILY_COMPLETE를 발송했으면 중복 발송하지 않는다", async () => {
			// Given: 오늘 이미 DAILY_COMPLETE 알림이 존재
			notificationRepository.existsNotification.mockResolvedValue(true);

			// When
			await listener.handleTodoAllCompleted(payload);

			// Then: 알림 발송 안됨
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
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
		};

		it("오늘 첫 친구 완료 시 모든 친구에게 알림을 발송한다", async () => {
			// Given: 아무도 아직 알림을 받지 않음
			notificationRepository.findAlreadyNotifiedUserIds.mockResolvedValue(
				new Set(),
			);
			notificationService.createAndSendBatch.mockResolvedValue({ count: 3 });

			// When
			await listener.handleFriendCompleted(payload);

			// Then: 3명 모두에게 발송
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "user-1",
						type: "FRIEND_COMPLETED",
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
			);
		});

		it("이미 알림을 받은 유저는 제외하고 발송한다", async () => {
			// Given: user-1은 이미 알림을 받음
			notificationRepository.findAlreadyNotifiedUserIds.mockResolvedValue(
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
			notificationRepository.findAlreadyNotifiedUserIds.mockResolvedValue(
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
			};

			// When
			await listener.handleFriendCompleted(emptyPayload);

			// Then: DB 조회도, 알림 발송도 하지 않음
			expect(
				notificationRepository.findAlreadyNotifiedUserIds,
			).not.toHaveBeenCalled();
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		});
	});
});
