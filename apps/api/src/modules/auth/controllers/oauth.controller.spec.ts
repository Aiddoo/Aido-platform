import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { OAuthService } from "../services/oauth.service";
import { OAuthController } from "./oauth.controller";

describe("OAuthController", () => {
	let controller: OAuthController;
	let mockOAuthService: Mocked<OAuthService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(OAuthController).compile();

		controller = unit;
		mockOAuthService = unitRef.get(
			OAuthService,
		) as unknown as Mocked<OAuthService>;
	});

	describe("exchangeCode", () => {
		it("교환 코드를 서비스에 위임하고 매퍼를 통해 토큰 응답을 반환해야 한다", async () => {
			// Given: 교환 코드 DTO와 서비스 응답이 준비되었을 때
			const dto = { code: "exchange-code-abc" };
			const serviceResult = {
				userId: "user-123",
				accessToken: "access-token",
				refreshToken: "refresh-token",
				userName: "테스터",
				profileImage: "https://example.com/photo.jpg",
			};
			mockOAuthService.exchangeCodeForTokens.mockResolvedValue(serviceResult);

			// When: exchangeCode를 호출하면
			const result = await controller.exchangeCode(dto as any);

			// Then: 서비스에 code를 전달하고 AuthMapper.toExchangeCodeResponse 형식의 응답을 반환해야 한다
			expect(mockOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(
				dto.code,
			);
			expect(result).toEqual({
				userId: serviceResult.userId,
				accessToken: serviceResult.accessToken,
				refreshToken: serviceResult.refreshToken,
				name: serviceResult.userName,
				profileImage: serviceResult.profileImage,
			});
		});

		it("userName이 없으면 name을 null로 반환해야 한다", async () => {
			// Given: userName이 없는 서비스 응답이 준비되었을 때
			const dto = { code: "exchange-code-xyz" };
			const serviceResult = {
				userId: "user-456",
				accessToken: "access-token-2",
				refreshToken: "refresh-token-2",
				userName: undefined,
				profileImage: undefined,
			};
			mockOAuthService.exchangeCodeForTokens.mockResolvedValue(
				serviceResult as any,
			);

			// When: exchangeCode를 호출하면
			const result = await controller.exchangeCode(dto as any);

			// Then: name과 profileImage가 null로 반환되어야 한다
			expect(result).toEqual({
				userId: serviceResult.userId,
				accessToken: serviceResult.accessToken,
				refreshToken: serviceResult.refreshToken,
				name: null,
				profileImage: null,
			});
		});
	});
});
