/**
 * AdminController 단위 테스트
 *
 * 컨트롤러는 AdminFacade에만 위임한다. DTO→인자 매핑과 결과 반환을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import { AdminFacade } from "../application/facades/admin.facade";
import { AdminController } from "./admin.controller";
import type { BroadcastNotificationDto, TargetedNotificationDto } from "./dtos";

function makeBroadcastDto(
	overrides: Partial<BroadcastNotificationDto> = {},
): BroadcastNotificationDto {
	return {
		title: "공지사항",
		body: "서비스 점검 안내",
		targetFilter: "ALL",
		force: false,
		...overrides,
	};
}

function makeTargetedDto(
	overrides: Partial<TargetedNotificationDto> = {},
): TargetedNotificationDto {
	return {
		title: "개별 알림",
		body: "할 일을 완료해보세요!",
		userIds: ["user-1", "user-2", "user-3"],
		force: false,
		...overrides,
	};
}

describe("AdminController — 관리자 컨트롤러", () => {
	let controller: AdminController;
	let mockFacade: Mocked<AdminFacade>;

	const mockUser: CurrentUserPayload = {
		userId: "admin-123",
		email: "admin@example.com",
		sessionId: "session-123",
		role: "ADMIN",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AdminController).compile();

		controller = unit;
		mockFacade = unitRef.get(AdminFacade);
	});

	describe("broadcastNotification", () => {
		it("전체 알림 발송 요청을 Facade에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 전체 알림 발송 DTO와 Facade 응답이 준비되었을 때
			const dto = makeBroadcastDto();
			const facadeResult = {
				successCount: 100,
				failCount: 2,
				totalTargets: 102,
			};
			mockFacade.broadcastNotification.mockResolvedValue(facadeResult);

			// When - broadcastNotification을 호출하면
			const result = await controller.broadcastNotification(mockUser, dto);

			// Then - 필드를 펼쳐 Facade에 전달하고 결과를 반환해야 한다
			expect(mockFacade.broadcastNotification).toHaveBeenCalledWith(
				dto.title,
				dto.body,
				dto.targetFilter,
				dto.action,
				dto.force,
			);
			expect(result).toEqual(facadeResult);
		});
	});

	describe("sendTargetedNotification", () => {
		it("특정 사용자 알림 발송 요청을 Facade에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 특정 사용자 알림 발송 DTO와 Facade 응답이 준비되었을 때
			const dto = makeTargetedDto();
			const facadeResult = {
				successCount: 3,
				failCount: 0,
				totalTargets: 3,
			};
			mockFacade.sendTargetedNotification.mockResolvedValue(facadeResult);

			// When - sendTargetedNotification을 호출하면
			const result = await controller.sendTargetedNotification(mockUser, dto);

			// Then - 필드를 펼쳐 Facade에 전달하고 결과를 반환해야 한다
			expect(mockFacade.sendTargetedNotification).toHaveBeenCalledWith(
				dto.title,
				dto.body,
				dto.userIds,
				dto.action,
				dto.force,
			);
			expect(result).toEqual(facadeResult);
		});
	});
});
