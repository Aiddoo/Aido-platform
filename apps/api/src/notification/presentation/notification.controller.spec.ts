/**
 * NotificationController 컨트롤러 단위 테스트
 *
 * @description
 * NotificationController의 엔드포인트 핸들러를 격리 테스트합니다.
 * 컨트롤러는 NotificationFacade만 주입받는다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test notification.controller
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { NotificationFacade } from "../application/facades/notification.facade";
import type { RegisterPushTokenDto } from "./dtos";
import { NotificationController } from "./notification.controller";

describe("NotificationController — 알림 컨트롤러", () => {
	let controller: NotificationController;
	let mockFacade: Mocked<NotificationFacade>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			NotificationController,
		).compile();

		controller = unit;
		mockFacade = unitRef.get(NotificationFacade);
	});

	describe("getUnreadCount", () => {
		it("읽지 않은 알림 수를 반환해야 한다", async () => {
			// Given -읽지 않은 알림이 5개 있을 때
			mockFacade.getUnreadCount.mockResolvedValue(5);

			// When -getUnreadCount를 호출하면
			const result = await controller.getUnreadCount(mockUser);

			// Then -파사드에 userId를 전달하고 unreadCount를 반환해야 한다
			expect(mockFacade.getUnreadCount).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual({ unreadCount: 5 });
		});

		it("읽지 않은 알림이 없으면 0을 반환해야 한다", async () => {
			// Given -읽지 않은 알림이 없을 때
			mockFacade.getUnreadCount.mockResolvedValue(0);

			// When -getUnreadCount를 호출하면
			const result = await controller.getUnreadCount(mockUser);

			// Then -unreadCount가 0이어야 한다
			expect(result).toEqual({ unreadCount: 0 });
		});
	});

	describe("registerToken", () => {
		it("푸시 토큰을 등록하고 성공 응답을 반환해야 한다", async () => {
			// Given -푸시 토큰 등록 DTO가 준비되었을 때
			const dto = {
				token: "ExponentPushToken[xxxxxx]",
				deviceId: "device-abc",
			};
			const tz = "Asia/Seoul";
			const locale = "ko";
			mockFacade.registerPushToken.mockResolvedValue(undefined);

			// When -registerToken을 호출하면
			const result = await controller.registerToken(
				mockUser,
				dto as unknown as RegisterPushTokenDto,
				tz,
				locale,
			);

			// Then -파사드에 올바른 파라미터를 전달하고 성공 응답을 반환해야 한다
			expect(mockFacade.registerPushToken).toHaveBeenCalledWith({
				userId: mockUser.userId,
				token: dto.token,
				deviceId: dto.deviceId,
				timezone: tz,
				locale,
			});
			expect(result).toEqual({
				message: "푸시 토큰이 등록되었습니다.",
				registered: true,
			});
		});
	});

	describe("markAsRead", () => {
		it("단일 알림을 읽음 처리하고 결과를 반환해야 한다", async () => {
			// Given -읽음 처리할 알림 ID가 있을 때
			const notificationId = 42;
			mockFacade.markAsRead.mockResolvedValue(undefined);

			// When -markAsRead를 호출하면
			const result = await controller.markAsRead(mockUser, {
				id: notificationId,
			});

			// Then -파사드에 userId와 id를 전달하고 성공 응답을 반환해야 한다
			expect(mockFacade.markAsRead).toHaveBeenCalledWith(
				mockUser.userId,
				notificationId,
			);
			expect(result).toEqual({
				message: "알림을 읽음 처리했습니다.",
				readCount: 1,
			});
		});
	});

	describe("markAllAsRead", () => {
		it("모든 알림을 읽음 처리하고 결과를 반환해야 한다", async () => {
			// Given -읽지 않은 알림이 3개 있을 때
			mockFacade.markAllAsRead.mockResolvedValue({ count: 3 });

			// When -markAllAsRead를 호출하면
			const result = await controller.markAllAsRead(mockUser);

			// Then -파사드에 userId를 전달하고 처리된 개수를 반환해야 한다
			expect(mockFacade.markAllAsRead).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual({
				message: "모든 알림을 읽음 처리했습니다.",
				readCount: 3,
			});
		});
	});
});
