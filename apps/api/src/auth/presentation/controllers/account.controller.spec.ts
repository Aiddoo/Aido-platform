/**
 * AccountController 단위 테스트
 *
 * @description
 * 계정 컨트롤러의 프로필 조회/수정, 소셜 연동/해제, 탈퇴 엔드포인트를 검증한다.
 * 서비스 위임과 AuthMapper를 통한 응답 변환을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test account.controller.spec.ts
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Request } from "express";

import { GetCurrentUserQuery, ListLinkedAccountsQuery } from "@/auth/application/queries";
import {
	DeleteAccountUseCase,
	UnlinkOAuthAccountUseCase,
	UpdateProfileUseCase,
} from "@/auth/application/use-cases";
import { AuthMapper } from "@/auth/presentation/auth.mapper";
import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import type { DeleteAccountDto, UpdateProfileDto } from "../dtos";
import { AccountController } from "./account.controller";

describe("AccountController — 계정 컨트롤러", () => {
	let controller: AccountController;
	let getCurrentUserQuery: Mocked<GetCurrentUserQuery>;
	let updateProfileUseCase: Mocked<UpdateProfileUseCase>;
	let listLinkedAccountsQuery: Mocked<ListLinkedAccountsQuery>;
	let unlinkOAuthAccountUseCase: Mocked<UnlinkOAuthAccountUseCase>;
	let deleteAccountUseCase: Mocked<DeleteAccountUseCase>;

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
		const { unit, unitRef } = await TestBed.solitary(AccountController).compile();

		controller = unit;
		getCurrentUserQuery = unitRef.get(GetCurrentUserQuery);
		updateProfileUseCase = unitRef.get(UpdateProfileUseCase);
		listLinkedAccountsQuery = unitRef.get(ListLinkedAccountsQuery);
		unlinkOAuthAccountUseCase = unitRef.get(UnlinkOAuthAccountUseCase);
		deleteAccountUseCase = unitRef.get(DeleteAccountUseCase);
	});

	describe("getMe", () => {
		it("현재 사용자 정보를 서비스에서 조회하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -사용자 정보 서비스 응답이 준비되었을 때
			const serviceResult = {
				userId: "user-123",
				email: "test@example.com",
				sessionId: "session-123",
				role: "USER" as const,
				userTag: "user#1234",
				status: "ACTIVE" as const,
				emailVerifiedAt: "2026-01-01T00:00:00.000Z",
				subscriptionStatus: "FREE" as const,
				subscriptionExpiresAt: null,
				name: "테스트",
				profileImage: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				providers: ["CREDENTIAL" as const],
			};
			getCurrentUserQuery.execute.mockResolvedValue(serviceResult);
			const expectedResponse = AuthMapper.toCurrentUserResponse(serviceResult);

			// When -getMe를 호출하면
			const result = await controller.getMe(mockUser);

			// Then -서비스에 userId, email, sessionId를 전달하고 매핑된 결과를 반환해야 한다
			expect(getCurrentUserQuery.execute).toHaveBeenCalledWith(
				mockUser.userId,
				mockUser.email,
				mockUser.sessionId,
			);
			expect(result).toEqual(expectedResponse);
		});
	});

	describe("updateProfile", () => {
		it("프로필 수정 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -프로필 수정 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				name: "새이름",
			} as unknown as UpdateProfileDto;
			const serviceResult = {
				message: "프로필이 수정되었습니다.",
				name: "새이름",
				profileImage: null,
			};
			updateProfileUseCase.execute.mockResolvedValue(serviceResult);
			const expectedResponse = AuthMapper.toUpdateProfileResponse(serviceResult);

			// When -updateProfile을 호출하면
			const result = await controller.updateProfile(mockUser, dto);

			// Then -서비스에 userId와 DTO를 전달하고 매핑된 결과를 반환해야 한다
			expect(updateProfileUseCase.execute).toHaveBeenCalledWith(mockUser.userId, dto);
			expect(result).toEqual(expectedResponse);
		});
	});

	describe("getLinkedAccounts", () => {
		it("연동된 소셜 계정 목록을 서비스에서 조회하고 결과를 반환해야 한다", async () => {
			// Given -연동 계정 서비스 응답이 준비되었을 때
			const serviceResult = {
				accounts: [
					{
						provider: "APPLE" as const,
						linked: false,
						providerAccountId: null,
						linkedAt: null,
					},
					{
						provider: "GOOGLE" as const,
						linked: true,
						providerAccountId: "102938475647382910",
						linkedAt: new Date("2026-01-15T10:30:00.000Z"),
					},
					{
						provider: "KAKAO" as const,
						linked: false,
						providerAccountId: null,
						linkedAt: null,
					},
					{
						provider: "NAVER" as const,
						linked: false,
						providerAccountId: null,
						linkedAt: null,
					},
				],
				canUnlink: true,
			};
			listLinkedAccountsQuery.execute.mockResolvedValue(serviceResult);

			// When -getLinkedAccounts를 호출하면
			const result = await controller.getLinkedAccounts(mockUser);

			// Then -서비스에 userId를 전달하고 서비스 결과를 직접 반환해야 한다
			expect(listLinkedAccountsQuery.execute).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual(serviceResult);
		});
	});

	describe("unlinkAccount", () => {
		it("소셜 계정 연동 해제 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -연동 해제 서비스 응답이 준비되었을 때
			const provider = "GOOGLE" as const;
			const serviceResult = { message: "소셜 계정이 연결 해제되었습니다." };
			unlinkOAuthAccountUseCase.execute.mockResolvedValue(serviceResult);

			// When -unlinkAccount를 호출하면
			const result = await controller.unlinkAccount(mockUser, provider, mockRequest);

			// Then -서비스에 userId, provider, metadata를 전달하고 결과를 반환해야 한다
			expect(unlinkOAuthAccountUseCase.execute).toHaveBeenCalledWith(
				mockUser.userId,
				provider,
				expect.objectContaining({
					ip: "127.0.0.1",
					userAgent: "TestAgent/1.0",
				}),
			);
			expect(result).toEqual(serviceResult);
		});
	});

	describe("deleteAccount", () => {
		it("회원 탈퇴 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -회원 탈퇴 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				reason: "사용하지 않아서",
			} as unknown as DeleteAccountDto;
			const serviceResult = {
				message: "회원 탈퇴가 완료되었습니다.",
				deletedAt: "2026-03-01T00:00:00.000Z",
				gracePeriodDays: 30,
			};
			deleteAccountUseCase.execute.mockResolvedValue(serviceResult);

			// When -deleteAccount를 호출하면
			const result = await controller.deleteAccount(mockUser, dto, mockRequest);

			// Then -서비스에 userId, sessionId, dto, metadata를 전달하고 결과를 반환해야 한다
			expect(deleteAccountUseCase.execute).toHaveBeenCalledWith(
				mockUser.userId,
				mockUser.sessionId,
				dto,
				expect.objectContaining({
					ip: "127.0.0.1",
					userAgent: "TestAgent/1.0",
				}),
			);
			expect(result).toEqual(serviceResult);
		});
	});
});
