import { Logger } from "@nestjs/common";
import type {
	OAuthIdentityProvider,
	OAuthIdentityProviderRegistry,
	OAuthTokenVerifier,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "@/auth/domain/types";
import type { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { AppleOAuthProvider } from "./apple.oauth-provider";
import { GoogleOAuthProvider } from "./google.oauth-provider";
import { KakaoOAuthProvider } from "./kakao.oauth-provider";
import { NaverOAuthProvider } from "./naver.oauth-provider";

export function createOAuthProviderRegistry(
	configService: TypedConfigService,
	tokenVerifier: OAuthTokenVerifier,
): OAuthIdentityProviderRegistry {
	const logger = new Logger("OAuthIdentityProvider");
	return new Map<AccountProvider, OAuthIdentityProvider>([
		["APPLE", new AppleOAuthProvider(tokenVerifier)],
		[
			"GOOGLE",
			new GoogleOAuthProvider(
				() => configService.googleOAuth,
				tokenVerifier,
				logger,
			),
		],
		[
			"KAKAO",
			new KakaoOAuthProvider(
				() => configService.kakaoOAuth,
				tokenVerifier,
				logger,
			),
		],
		[
			"NAVER",
			new NaverOAuthProvider(
				() => configService.naverOAuth,
				tokenVerifier,
				logger,
			),
		],
	]);
}
