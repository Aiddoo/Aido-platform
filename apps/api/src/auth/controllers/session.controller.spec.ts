/**
 * SessionController 단위 테스트
 *
 * @description
 * 세션 컨트롤러의 활성 세션 목록 조회, 세션 종료 엔드포인트를 검증한다.
 * 현재 세션 표시(isCurrent), 서비스 위임을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test session.controller.spec.ts
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Request } from "express";

import type { CurrentUserPayload } from "@/auth/decorators";

import { AuthService } from "../services/auth.service";
import { SessionController } from "./session.controller";

describe("SessionController — 세션 컨트롤러", () => {
	let controller: SessionController;
	let mockAuthService: Mocked<AuthService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockRequest = {
		ip: "127.0.0.1",
		headers: {
			"user-agent": "TestAgent/1.0",
			"x-device-name": "iPhone 15",
			"x-device-type": "mobile",
		},
	} as unknown as Request;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(SessionController).compile();

		controller = unit;
		mockAuthService = unitRef.get(AuthService);
	});

	describe("getSessions", () => {
		it("활성 세션 목록을 서비스에서 조회하고 현재 세션 표시를 추가하여 반환해야 한다", async () => {
			// Given -활성 세션 목록 서비스 응답이 준비되었을 때
			const sessions = [
				{
					id: "session-123",
					deviceName: null,
					deviceType: null,
					ipAddress: "127.0.0.1",
					userAgent: "TestAgent/1.0",
					lastActiveAt: "2026-03-01T10:00:00.000Z",
					createdAt: "2026-03-01T09:00:00.000Z",
					isCurrent: false,
				},
				{
					id: "session-456",
					deviceName: null,
					deviceType: null,
					ipAddress: "192.168.1.1",
					userAgent: "OtherAgent/2.0",
					lastActiveAt: "2026-02-28T15:00:00.000Z",
					createdAt: "2026-02-28T14:00:00.000Z",
					isCurrent: false,
				},
			];
			mockAuthService.getActiveSessions.mockResolvedValue(sessions);

			// When -getSessions를 호출하면
			const result = await controller.getSessions(mockUser);

			// Then -서비스에 userId를 전달하고 isCurrent 필드가 추가된 세션 목록을 반환해야 한다
			expect(mockAuthService.getActiveSessions).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				sessions: [
					expect.objectContaining({
						id: "session-123",
						isCurrent: true,
					}),
					expect.objectContaining({
						id: "session-456",
						isCurrent: false,
					}),
				],
			});
		});

		it("세션이 없을 때 빈 배열을 반환해야 한다", async () => {
			// Given -활성 세션이 없을 때
			mockAuthService.getActiveSessions.mockResolvedValue([]);

			// When -getSessions를 호출하면
			const result = await controller.getSessions(mockUser);

			// Then -빈 세션 배열을 반환해야 한다
			expect(result).toEqual({ sessions: [] });
		});
	});

	describe("revokeSession", () => {
		it("특정 세션 종료 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -종료할 세션 ID와 서비스 응답이 준비되었을 때
			const sessionId = "session-456";
			const serviceResult = { message: "세션이 종료되었습니다." };
			mockAuthService.revokeSession.mockResolvedValue(serviceResult);

			// When -revokeSession을 호출하면
			const result = await controller.revokeSession(
				mockUser,
				sessionId,
				mockRequest,
			);

			// Then -서비스에 userId, sessionId, metadata를 전달하고 결과를 반환해야 한다
			expect(mockAuthService.revokeSession).toHaveBeenCalledWith(
				mockUser.userId,
				sessionId,
				expect.objectContaining({
					ip: "127.0.0.1",
					userAgent: "TestAgent/1.0",
				}),
			);
			expect(result).toEqual(serviceResult);
		});
	});
});
