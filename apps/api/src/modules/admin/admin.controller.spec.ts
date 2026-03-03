/**
 * AdminController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import type { BroadcastNotificationDto, TargetedNotificationDto } from "./dtos";

describe("AdminController", () => {
	let controller: AdminController;
	let mockAdminService: Mocked<AdminService>;

	const mockUser: CurrentUserPayload = {
		userId: "admin-123",
		email: "admin@example.com",
		sessionId: "session-123",
		role: "ADMIN",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AdminController).compile();

		controller = unit;
		mockAdminService = unitRef.get(AdminService);
	});

	describe("broadcastNotification", () => {
		it("전체 알림 발송 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given: 전체 알림 발송 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				title: "공지사항",
				body: "서비스 점검 안내",
				targetFilter: "ALL",
			} as unknown as BroadcastNotificationDto;
			const serviceResult = {
				successCount: 100,
				failCount: 2,
				totalTargets: 102,
			};
			mockAdminService.broadcastNotification.mockResolvedValue(serviceResult);

			// When: broadcastNotification을 호출하면
			const result = await controller.broadcastNotification(mockUser, dto);

			// Then: 서비스에 DTO를 전달하고 결과를 반환해야 한다
			expect(mockAdminService.broadcastNotification).toHaveBeenCalledWith(dto);
			expect(result).toEqual(serviceResult);
		});
	});

	describe("sendTargetedNotification", () => {
		it("특정 사용자 알림 발송 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given: 특정 사용자 알림 발송 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				title: "개별 알림",
				body: "할 일을 완료해보세요!",
				userIds: ["user-1", "user-2", "user-3"],
			} as unknown as TargetedNotificationDto;
			const serviceResult = {
				successCount: 3,
				failCount: 0,
				totalTargets: 3,
			};
			mockAdminService.sendTargetedNotification.mockResolvedValue(
				serviceResult,
			);

			// When: sendTargetedNotification을 호출하면
			const result = await controller.sendTargetedNotification(mockUser, dto);

			// Then: 서비스에 DTO를 전달하고 결과를 반환해야 한다
			expect(mockAdminService.sendTargetedNotification).toHaveBeenCalledWith(
				dto,
			);
			expect(result).toEqual(serviceResult);
		});
	});
});
