/**
 * AdminController 단위 테스트
 *
 * 컨트롤러의 DTO→UseCase 입력 매핑과 결과 반환을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import { BroadcastNotificationUseCase } from "../application/use-cases/broadcast-notification/broadcast-notification.use-case";
import { SendTargetedNotificationUseCase } from "../application/use-cases/send-targeted-notification/send-targeted-notification.use-case";
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
	let broadcastNotificationUseCase: Mocked<BroadcastNotificationUseCase>;
	let sendTargetedNotificationUseCase: Mocked<SendTargetedNotificationUseCase>;

	const mockUser: CurrentUserPayload = {
		userId: "admin-123",
		email: "admin@example.com",
		sessionId: "session-123",
		role: "ADMIN",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AdminController).compile();

		controller = unit;
		broadcastNotificationUseCase = unitRef.get(BroadcastNotificationUseCase);
		sendTargetedNotificationUseCase = unitRef.get(
			SendTargetedNotificationUseCase,
		);
	});

	describe("broadcastNotification", () => {
		it("전체 알림 발송 요청을 UseCase에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 전체 알림 발송 DTO와 Facade 응답이 준비되었을 때
			const dto = makeBroadcastDto();
			const facadeResult = {
				successCount: 100,
				failCount: 2,
				totalTargets: 102,
			};
			broadcastNotificationUseCase.execute.mockResolvedValue(facadeResult);

			// When - broadcastNotification을 호출하면
			const result = await controller.broadcastNotification(mockUser, dto);

			// Then - 필드를 펼쳐 Facade에 전달하고 결과를 반환해야 한다
			expect(broadcastNotificationUseCase.execute).toHaveBeenCalledWith({
				title: dto.title,
				body: dto.body,
				targetFilter: dto.targetFilter,
				action: dto.action,
				force: dto.force,
			});
			expect(result).toEqual(facadeResult);
		});
	});

	describe("sendTargetedNotification", () => {
		it("특정 사용자 알림 발송 요청을 UseCase에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 특정 사용자 알림 발송 DTO와 Facade 응답이 준비되었을 때
			const dto = makeTargetedDto();
			const facadeResult = {
				successCount: 3,
				failCount: 0,
				totalTargets: 3,
			};
			sendTargetedNotificationUseCase.execute.mockResolvedValue(facadeResult);

			// When - sendTargetedNotification을 호출하면
			const result = await controller.sendTargetedNotification(mockUser, dto);

			// Then - 필드를 펼쳐 Facade에 전달하고 결과를 반환해야 한다
			expect(sendTargetedNotificationUseCase.execute).toHaveBeenCalledWith({
				title: dto.title,
				body: dto.body,
				userIds: dto.userIds,
				action: dto.action,
				force: dto.force,
			});
			expect(result).toEqual(facadeResult);
		});
	});
});
