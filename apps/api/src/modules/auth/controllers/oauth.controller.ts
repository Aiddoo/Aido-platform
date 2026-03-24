import { randomBytes } from "node:crypto";
import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import {
	ApiConflictError,
	ApiDoc,
	ApiErrorResponse,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { AuthMapper } from "../auth.mapper";
import { CurrentUser, type CurrentUserPayload, Public } from "../decorators";
import {
	AppleMobileCallbackDto,
	AuthTokensDto,
	ExchangeCodeDto,
	GoogleMobileCallbackDto,
	KakaoMobileCallbackDto,
	LinkSocialAccountDto,
	MessageResponseDto,
	NaverMobileCallbackDto,
} from "../dtos";
import { OAuthService } from "../services/oauth.service";
import {
	buildOAuthErrorParams,
	extractMetadata,
} from "./auth-controller.utils";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller("auth")
export class OAuthController {
	readonly #logger = new Logger(OAuthController.name);

	constructor(private readonly oauthService: OAuthService) {}

	async #resolveOAuthErrorRedirectUri(
		state: string,
		defaultRedirectUri: string,
	): Promise<string> {
		try {
			const redirectUri = await this.oauthService.getRedirectUriByState(state);
			return redirectUri || defaultRedirectUri;
		} catch {
			return defaultRedirectUri;
		}
	}

	@Post("exchange")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "교환 코드로 토큰 획득",
		operationId: "exchangeOAuthCode",
		description: `OAuth Web 콜백에서 발급된 **일회용 교환 코드**를 JWT 토큰으로 교환합니다.

딥링크(\`aido://auth/callback?code=xxx&state=xxx\`)에서 받은 code를 전송하세요.

📝 **요청 Body**
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`code\` | string | ✅ | 일회용 교환 코드 (10분 내 사용) |

⚠️ **에러 케이스**
| 코드 | 상황 |
|------|------|
| \`AUTH_0107\` | 유효하지 않거나 만료/사용된 교환 코드 |

### 🔄 탈퇴 유예 계정 복구
탈퇴 후 **30일 이내**에 동일 소셜 계정으로 로그인하면 자동 복구됩니다.
- 응답의 \`accountRestored: true\`로 복구 여부 확인
- 클라이언트는 이 플래그를 확인하여 "계정이 복구되었습니다" 안내 표시`,
	})
	@ApiSuccessResponse({
		description: "토큰 교환 성공",
		type: AuthTokensDto,
	})
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async exchangeCode(@Body() dto: ExchangeCodeDto): Promise<AuthTokensDto> {
		const result = await this.oauthService.exchangeCodeForTokens(dto.code);
		return AuthMapper.toExchangeCodeResponse(result);
	}

	@Post("apple/callback")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Apple 로그인 (모바일 네이티브)",
		operationId: "appleCallback",
		description: `## 🍎 Apple 로그인 (모바일 네이티브)

\`expo-apple-authentication\`으로 Apple Sign In 후 Identity Token을 전송합니다.
시스템 인증 다이얼로그를 사용하므로 Redirect URI가 불필요합니다.

> 📖 상세 구현 가이드: \`apps/mobile/.claude/oauth-client-guide.md\`

### 🔄 플로우
1. 클라이언트: \`AppleAuthentication.signInAsync()\` 호출
2. Apple 시스템: 사용자 인증 후 Identity Token 반환
3. 클라이언트: Identity Token을 이 엔드포인트로 전송
4. 백엔드: Token 검증 → 사용자 생성/업데이트 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`idToken\` | string | ✅ | Apple Identity Token (JWT) |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인 시만 제공) |
| \`deviceName\` | string | ❌ | 디바이스 이름 |
| \`deviceType\` | string | ❌ | 디바이스 타입 |
| \`nonce\` | string | ❌ | CSRF 방지용 (선택) |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 요청 |

### 💡 참고
- Apple은 **최초 로그인 시에만** email/name을 제공합니다
- "Hide My Email" 선택 시 \`random@privaterelay.appleid.com\` 형식 제공`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	async appleCallback(
		@Body() dto: AppleMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		const result = await this.oauthService.handleAppleMobileLogin(
			dto.idToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
			dto.nonce,
		);

		return AuthMapper.toAuthTokensResponse(result);
	}

	@Post("google/callback")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Google 로그인 (모바일 네이티브)",
		operationId: "googleMobileCallback",
		description: `## 🔵 Google 로그인 (모바일 네이티브)

\`expo-auth-session\`의 Google OAuth 제공자를 통해 ID Token을 받은 후 백엔드로 전송합니다.
시스템 브라우저를 사용하여 보안 인증 UI를 제공합니다.

> 📖 상세 구현 가이드: \`apps/mobile/.claude/oauth-client-guide.md\`

### 🔄 플로우
1. 클라이언트: \`Google.useAuthRequest()\`로 인증 요청
2. Google 서버: 시스템 브라우저 인증 후 ID Token 반환
3. 클라이언트: ID Token을 이 엔드포인트로 전송
4. 백엔드: JWT 서명 검증 → 사용자 조회/생성 → 토큰 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`idToken\` | string | ✅ | Google ID Token (JWT) |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인 시 권장) |
| \`deviceName\` | string | ❌ | 디바이스 이름 |
| \`deviceType\` | string | ❌ | 디바이스 유형 (iOS, Android) |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- ID Token은 1시간 유효, 만료 후 재인증 필요
- 웹/iOS/Android별 Client ID가 다르므로 정확히 구분 필요`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	async googleCallback(
		@Body() dto: GoogleMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		const result = await this.oauthService.handleGoogleMobileLogin(
			dto.idToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return AuthMapper.toAuthTokensResponse(result);
	}

	@Get("google/start")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 시작 (웹 브라우저)",
		operationId: "googleOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 구글 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /google/start\` → 구글 로그인 → \`GET /google/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: "인증 완료 후 리다이렉트될 URI (기본: aido://auth/callback)",
		example: "aido://auth/callback",
	})
	@ApiQuery({
		name: "mode",
		required: false,
		description: "OAuth 모드 (login: 로그인, link: 계정 연동). 기본값은 login",
		enum: ["login", "link"],
		example: "link",
	})
	@ApiQuery({
		name: "user_hint",
		required: false,
		description: "계정 연동 시 사용자 이메일 힌트",
	})
	async googleOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Query("mode") mode: "login" | "link" | undefined,
		@Query("user_hint") userHint: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateGoogleAuthUrlWithState(
			effectiveState,
			redirectUri,
			mode,
			userHint,
		);
		res.redirect(authUrl);
	}

	@Get("google/web-callback")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 콜백 (웹 브라우저)",
		operationId: "googleOAuthCallback",
		description: `구글 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /google/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`code\` | ✅ | 구글 authorization code |
| \`state\` | ✅ | CSRF 검증용 state |

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "구글 Authorization Code (인증 완료 후 발급)",
		example: "4/0AbcDefGhiJkl",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
		example: "550e8400-e29b-41d4-a716-446655440000",
	})
	async googleOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = extractMetadata(req);

			const result =
				await this.oauthService.handleGoogleWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			this.#logger.error(
				`Google OAuth callback error: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
			const params = buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.#resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	@Post("kakao/callback")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Kakao 로그인 (모바일 네이티브)",
		operationId: "kakaoMobileCallback",
		description: `
## 🟡 Kakao 로그인 (모바일 네이티브)

\`expo-auth-session\`을 사용하여 Kakao OAuth 인증 후 Access Token으로 사용자 정보를 조회하고 전송합니다.
서버는 Access Token으로 Kakao API를 직접 호출하여 프로필을 검증합니다.

> 📖 상세 구현 가이드: \`apps/mobile/.claude/oauth-client-guide.md\`

### 🔄 플로우
1. 클라이언트: \`expo-auth-session\`으로 Authorization Code → Access Token 교환
2. 클라이언트: Kakao API(\`/v2/user/me\`)로 사용자 정보 조회
3. 클라이언트: 프로필 정보를 이 엔드포인트로 전송
4. 백엔드: Access Token으로 Kakao API 직접 호출하여 검증 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`profile.id\` | string | ✅ | Kakao 고유 사용자 ID (**문자열로 변환**) |
| \`profile.email\` | string | ❌ | 이메일 (사용자 동의 시에만) |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 (기본: false) |
| \`profile.name\` | string | ❌ | 카카오 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- Kakao API는 \`id\`를 숫자로 반환하지만, 백엔드에는 **문자열**로 전송 필수
- 이메일은 사용자가 동의해야만 제공됨
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	async kakaoCallback(
		@Body() dto: KakaoMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		const result = await this.oauthService.handleKakaoMobileLogin(
			dto.accessToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return AuthMapper.toAuthTokensResponse(result);
	}

	@Get("kakao/start")
	@Public()
	@ApiDoc({
		summary: "Kakao OAuth 시작 (웹 브라우저)",
		operationId: "kakaoOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 카카오 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /kakao/start\` → 카카오 로그인 → \`GET /kakao/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: "인증 완료 후 리다이렉트될 URI (기본: aido://auth/callback)",
		example: "aido://auth/callback",
	})
	@ApiQuery({
		name: "mode",
		required: false,
		description: "OAuth 모드 (login: 로그인, link: 계정 연동). 기본값은 login",
		enum: ["login", "link"],
		example: "link",
	})
	@ApiQuery({
		name: "user_hint",
		required: false,
		description: "계정 연동 시 사용자 이메일 힌트",
	})
	async kakaoOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Query("mode") mode: "login" | "link" | undefined,
		@Query("user_hint") userHint: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateKakaoAuthUrlWithState(
			effectiveState,
			redirectUri,
			mode,
			userHint,
		);
		res.redirect(authUrl);
	}

	@Get("kakao/web-callback")
	@Public()
	@ApiDoc({
		summary: "Kakao OAuth 콜백 (웹 브라우저)",
		operationId: "kakaoOAuthCallback",
		description: `카카오 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /kakao/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`code\` | ✅ | 카카오 authorization code |
| \`state\` | ✅ | CSRF 검증용 state |

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "카카오 authorization code",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
	})
	async kakaoOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = extractMetadata(req);

			const result =
				await this.oauthService.handleKakaoWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			const params = buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.#resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	@Post("naver/callback")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Naver 로그인 (모바일 네이티브)",
		operationId: "naverMobileCallback",
		description: `
## 🟢 Naver 로그인 (모바일 네이티브)

\`expo-auth-session\`을 사용하여 Naver OAuth 인증 후 Access Token으로 사용자 정보를 조회하고 전송합니다.
서버는 Access Token으로 Naver API를 직접 호출하여 프로필을 검증합니다.

> 📖 상세 구현 가이드: \`apps/mobile/.claude/oauth-client-guide.md\`

### 🔄 플로우
1. 클라이언트: \`expo-auth-session\`으로 Authorization Code 획득
2. 클라이언트: Access Token 교환 (**client_secret 필수** → 직접 호출)
3. 클라이언트: Naver API(\`/v1/nid/me\`)로 사용자 정보 조회 후 전송
4. 백엔드: Access Token으로 Naver API 직접 호출하여 검증 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`profile.id\` | string | ✅ | Naver 고유 사용자 ID |
| \`profile.email\` | string | ❌ | 이메일 주소 (사용자 동의 시) |
| \`profile.name\` | string | ❌ | 이름 또는 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- Naver는 토큰 교환 시 **client_secret 필수** (Kakao/Google과 다름)
- client_secret을 앱에 직접 넣으면 보안 위험 → 프록시 서버 사용 권장
- 동의 항목을 사용자가 거부하면 해당 정보는 null 반환
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	async naverCallback(
		@Body() dto: NaverMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		const result = await this.oauthService.handleNaverMobileLogin(
			dto.accessToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return AuthMapper.toAuthTokensResponse(result);
	}

	@Get("naver/start")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 시작 (웹 브라우저)",
		operationId: "naverOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 네이버 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /naver/start\` → 네이버 로그인 → \`GET /naver/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: "인증 완료 후 리다이렉트될 URI (기본: aido://auth/callback)",
		example: "aido://auth/callback",
	})
	@ApiQuery({
		name: "mode",
		required: false,
		description: "OAuth 모드 (login: 로그인, link: 계정 연동). 기본값은 login",
		enum: ["login", "link"],
		example: "link",
	})
	@ApiQuery({
		name: "user_hint",
		required: false,
		description: "계정 연동 시 사용자 이메일 힌트",
	})
	async naverOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Query("mode") mode: "login" | "link" | undefined,
		@Query("user_hint") userHint: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateNaverAuthUrlWithState(
			effectiveState,
			redirectUri,
			mode,
			userHint,
		);
		res.redirect(authUrl);
	}

	@Get("naver/web-callback")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 콜백 (웹 브라우저)",
		operationId: "naverOAuthCallback",
		description: `네이버 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /naver/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`code\` | ✅ | 네이버 authorization code |
| \`state\` | ✅ | CSRF 검증용 state |

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "네이버 Authorization Code (인증 완료 후 발급)",
		example: "AbCdEfGh",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값",
		example: "550e8400-e29b-41d4-a716-446655440000",
	})
	async naverOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = extractMetadata(req);

			const result =
				await this.oauthService.handleNaverWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			const params = buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.#resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	@Post("link")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "소셜 계정 연동 (토큰 직접 전송)",
		operationId: "linkSocialAccount",
		description: `
## 🔗 소셜 계정 연동

로그인된 사용자 계정에 소셜 계정을 추가로 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 방법
provider에 따라 필수 토큰이 다릅니다:
- **Apple/Google**: \`idToken\` 필수
- **Kakao/Naver**: \`accessToken\` 필수

### 📝 요청 예시

**Apple/Google (idToken)**
\`\`\`json
{ "provider": "GOOGLE", "idToken": "eyJhbGciOiJSUzI1NiIs..." }
\`\`\`

**Kakao/Naver (accessToken)**
\`\`\`json
{ "provider": "KAKAO", "accessToken": "aaaabbbbccccdddd..." }
\`\`\`

### ⚠️ 주의사항
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다 (409)
- 동일한 소셜 계정을 중복 연동하면 "이미 연결된 계정입니다" 메시지를 반환합니다

### ⚠️ 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| \`AUTH_0107\` | 401 | 인증이 필요합니다 |
| \`SOCIAL_0202\` | 401 | 소셜 인증 토큰이 유효하지 않습니다 |
| \`KAKAO_0306\` | 409 | 이미 다른 계정에 연동된 카카오 계정 |
| \`APPLE_0355\` | 409 | 이미 다른 계정에 연동된 애플 계정 |
| \`GOOGLE_0405\` | 409 | 이미 다른 계정에 연동된 구글 계정 |
| \`NAVER_0455\` | 409 | 이미 다른 계정에 연동된 네이버 계정 |

### 💡 교환 코드 방식
웹 브라우저 OAuth 플로우를 사용하는 경우 \`POST /auth/link-with-code\` 엔드포인트를 사용하세요.
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	@ApiConflictError(ErrorCode.KAKAO_0306)
	@ApiConflictError(ErrorCode.APPLE_0355)
	@ApiConflictError(ErrorCode.GOOGLE_0405)
	@ApiConflictError(ErrorCode.NAVER_0455)
	async linkSocialAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: LinkSocialAccountDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		return this.oauthService.linkSocialAccountWithToken(
			user.userId,
			dto,
			metadata,
		);
	}

	@Post("link-with-code")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "소셜 계정 연동 (교환 코드)",
		operationId: "linkWithExchangeCode",
		description: `
## 🔗 교환 코드 기반 소셜 계정 연동

웹 브라우저 OAuth 플로우(\`/auth/{provider}/start?mode=link\`)로 발급된 **교환 코드**를 사용하여
로그인된 사용자 계정에 소셜 계정을 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 플로우
1. \`GET /auth/{provider}/start?mode=link&state=xxx&redirect_uri=aido://auth/callback\` 으로 OAuth 시작
2. 사용자가 소셜 계정 인증 완료
3. \`{redirect_uri}?code=xxx&state=xxx\` 로 리다이렉트 (교환 코드 발급)
4. 이 엔드포인트로 교환 코드 전송 → 계정 연동 완료

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`code\` | string | ✅ | 일회용 교환 코드 (10분 내 사용) |

### ⚠️ 제한사항
- 교환 코드는 \`mode=link\`로 시작된 OAuth 플로우에서 발급된 것이어야 합니다
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다 (409)
- 교환 코드는 1회만 사용 가능합니다

### ⚠️ 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| \`AUTH_0107\` | 401 | 인증이 필요합니다 |
| \`SOCIAL_0202\` | 401 | 유효하지 않거나 만료/사용된 교환 코드 |
| \`KAKAO_0306\` | 409 | 이미 다른 계정에 연동된 카카오 계정 |
| \`APPLE_0355\` | 409 | 이미 다른 계정에 연동된 애플 계정 |
| \`GOOGLE_0405\` | 409 | 이미 다른 계정에 연동된 구글 계정 |
| \`NAVER_0455\` | 409 | 이미 다른 계정에 연동된 네이버 계정 |
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
	@ApiConflictError(ErrorCode.KAKAO_0306)
	@ApiConflictError(ErrorCode.APPLE_0355)
	@ApiConflictError(ErrorCode.GOOGLE_0405)
	@ApiConflictError(ErrorCode.NAVER_0455)
	async linkWithExchangeCode(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: ExchangeCodeDto,
		@Req() req: Request,
	) {
		const metadata = extractMetadata(req);
		return this.oauthService.linkAccountWithExchangeCode(
			user.userId,
			dto.code,
			metadata,
		);
	}
}
