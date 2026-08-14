import type {
	OAuthIdentityProvider,
	OAuthIdentityProviderRegistry,
} from "@/auth/application/ports/oauth-identity-provider.port";

import { FakeOAuthProviderRegistry } from "../mocks/fake-oauth-provider-registry";

function createGoogleProvider(): OAuthIdentityProvider {
	return {
		provider: "GOOGLE",
		failureEmail: "google_unknown@social.aido.kr",
		generateAuthUrl: jest.fn().mockResolvedValue("https://accounts.google.com"),
		exchangeCode: jest.fn().mockRejectedValue(new Error("real exchange called")),
		verifyToken: jest.fn().mockResolvedValue({
			id: "google-user",
			emailVerified: true,
		}),
		buildLoginOptions: jest.fn().mockReturnValue({ emailVerified: true }),
	};
}

describe("FakeOAuthProviderRegistry", () => {
	it("설정한 authorization code를 외부 호출 없이 token으로 교환해야 한다", async () => {
		// Given - 실제 exchangeCode가 호출되면 실패하는 delegate
		const delegate = createGoogleProvider();
		const delegates: OAuthIdentityProviderRegistry = new Map([["GOOGLE", delegate]]);
		const fakeRegistry = new FakeOAuthProviderRegistry(delegates);
		fakeRegistry.setExchangeToken("GOOGLE", "success-code", "fake-id-token");

		// When - fake registry에서 code 교환
		const result = await fakeRegistry.registry.get("GOOGLE")?.exchangeCode("success-code");

		// Then - 결정적인 token을 반환하고 delegate의 네트워크 경로는 미호출
		expect(result).toEqual({ token: "fake-id-token" });
		expect(delegate.exchangeCode).not.toHaveBeenCalled();
	});

	it("설정한 authorization code 실패를 결정적으로 반환해야 한다", async () => {
		// Given - 실패하도록 설정한 code
		const fakeRegistry = new FakeOAuthProviderRegistry(
			new Map([["GOOGLE", createGoogleProvider()]]),
		);
		fakeRegistry.simulateExchangeFailure("GOOGLE", "invalid-code", new Error("exchange rejected"));

		// When & Then - 벤더 호출 없이 설정한 실패 반환
		await expect(fakeRegistry.registry.get("GOOGLE")?.exchangeCode("invalid-code")).rejects.toThrow(
			"exchange rejected",
		);
	});
});
