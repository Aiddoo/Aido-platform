import { randomBytes } from "node:crypto";
import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import {
	ApiBadRequestError,
	ApiConflictError,
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { AuthMapper } from "./auth.mapper";
import { CurrentUser, type CurrentUserPayload, Public } from "./decorators";
import {
	AppleMobileCallbackDto,
	AuthTokensDto,
	ChangePasswordDto,
	ConsentResponseDto,
	CurrentUserDto,
	DeleteAccountDto,
	DeleteAccountResponseDto,
	ExchangeCodeDto,
	ForgotPasswordDto,
	GoogleMobileCallbackDto,
	KakaoMobileCallbackDto,
	LinkedAccountsResponseDto,
	LinkSocialAccountDto,
	LoginDto,
	MessageResponseDto,
	NaverMobileCallbackDto,
	PreferenceResponseDto,
	RefreshTokensDto,
	RegisterDto,
	ResendVerificationDto,
	ResetPasswordDto,
	SessionListDto,
	SetPasswordDto,
	UpdateMarketingConsentDto,
	UpdateMarketingConsentResponseDto,
	UpdatePreferenceDto,
	UpdatePreferenceResponseDto,
	UpdateProfileDto,
	UpdateProfileResponseDto,
	VerifyEmailDto,
} from "./dtos";
import { JwtAuthGuard, JwtRefreshGuard } from "./guards";
import { AuthService, type RequestMetadata } from "./services/auth.service";
import { OAuthService } from "./services/oauth.service";
import { UserSettingsService } from "./services/user-settings.service";
import type { RefreshTokenPayload } from "./strategies/jwt-refresh.strategy";

/**
 * 인증 API 컨트롤러
 *
 * ## 🔐 인증 플로우 개요
 *
 * ### 신규 회원가입 플로우
 * ```
 * 1. POST /auth/register     → 계정 생성 + 인증 코드 이메일 발송
 * 2. POST /auth/verify-email → 이메일 인증 완료 + 토큰 발급
 * ```
 *
 * ### 로그인 플로우
 * ```
 * 1. POST /auth/login   → Access Token + Refresh Token 발급
 * 2. GET /auth/me       → 사용자 정보 조회 (Access Token 필요)
 * 3. POST /auth/refresh → 토큰 갱신 (Refresh Token 필요)
 * 4. POST /auth/logout  → 로그아웃 (Access Token 필요)
 * ```
 *
 * ### 비밀번호 관리 플로우
 *
 * #### 비밀번호 재설정 (비로그인, 이메일 계정 전용)
 * ```
 * 1. POST /auth/forgot-password    → 재설정 코드 이메일 발송
 * 2. POST /auth/reset-password     → 새 비밀번호 설정
 * ```
 *
 * #### 비밀번호 설정 (로그인, 소셜 계정 전용)
 * ```
 * 1. POST /auth/password/setup-code → 설정 코드 이메일 발송
 * 2. POST /auth/password            → 비밀번호 생성
 * ```
 *
 * #### 비밀번호 변경 (로그인, 이메일 계정 전용)
 * ```
 * PATCH /auth/password → 현재 비밀번호 확인 후 변경
 * ```
 */
@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly oauthService: OAuthService,
		private readonly userSettingsService: UserSettingsService,
	) {}

	/**
	 * OAuth 콜백 에러를 URLSearchParams로 변환
	 * BusinessException인 경우 에러 코드를 포함
	 */
	private buildOAuthErrorParams(
		error: unknown,
		state: string,
	): URLSearchParams {
		let errorCode = "authentication_failed";
		let errorMessage = "인증 처리 중 오류가 발생했습니다.";

		if (error instanceof BusinessException) {
			errorCode = error.errorCode;
			errorMessage = error.message;
		}

		return new URLSearchParams({
			error: errorCode,
			error_description: errorMessage,
			state,
		});
	}

	private async resolveOAuthErrorRedirectUri(
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

	// ============================================
	// 회원가입 및 인증
	// ============================================

	@Post("register")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 5 } })
	@ApiDoc({
		summary: "회원가입",
		operationId: "register",
		description: `
## 📋 회원가입
이메일/비밀번호로 계정 생성 후 인증 코드가 발송됩니다.

### 📝 요청 Body
- \`email\`: 이메일 주소
- \`password\`: 비밀번호 (8자 이상, 영문+숫자)
- \`nickname\`: 닉네임
- \`termsAgreed\`: 이용약관 동의 (필수)
- \`privacyAgreed\`: 개인정보처리방침 동의 (필수)
- \`marketingAgreed\`: 마케팅 수신 동의 (선택)

### 🔄 다음 단계
\`POST /auth/verify-email\`로 인증 코드 확인 (10분 내)

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| EMAIL_0501 | 이미 가입된 이메일 |
		`,
	})
	@ApiCreatedResponse({ type: MessageResponseDto })
	@ApiConflictError(ErrorCode.EMAIL_0501)
	async register(@Body() dto: RegisterDto) {
		const result = await this.authService.register(dto);
		return AuthMapper.toRegisterResponse(result);
	}

	@Post("verify-email")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "이메일 인증 코드 확인",
		operationId: "verifyEmail",
		description: `
## ✉️ 이메일 인증
회원가입 시 발송된 6자리 인증 코드를 검증합니다. 성공 시 토큰이 발급됩니다.

### 📝 요청 Body
- \`email\`: 가입한 이메일 주소
- \`code\`: 6자리 인증 코드

### 🎫 응답 토큰
| 토큰 | 유효기간 |
|------|----------|
| accessToken | 15분 |
| refreshToken | 7일 |

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| EMAIL_0502 | 잘못된 인증 코드 |
| EMAIL_0504 | 만료된 인증 코드 |
| EMAIL_0505 | 인증 코드 시도 횟수 초과 |
| USER_0604 | 이미 인증 완료된 사용자 |
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0502 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0504 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0505 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
	async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.verifyEmail(dto, metadata);
		return AuthMapper.toAuthTokensResponse(result);
	}

	@Post("resend-verification")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "인증 코드 재발송",
		operationId: "resendVerificationCode",
		description: `
## 🔄 인증 코드 재발송
인증 코드를 다시 발송합니다. 이전 코드는 무효화됩니다.

### 📝 요청 Body
- \`email\`: 가입한 이메일 주소

### ⏱️ 제한사항
- 마지막 발송 후 **1분 이내** 재요청 불가

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| USER_0604 | 이미 인증 완료된 사용자 |
| VERIFY_0753 | 재발송 쿨다운 (1분) |
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0753 })
	async resendVerification(@Body() dto: ResendVerificationDto) {
		const result = await this.authService.resendVerification(dto.email);
		return result;
	}

	// ============================================
	// 로그인 및 로그아웃
	// ============================================

	@Post("login")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "이메일 로그인",
		operationId: "login",
		description: `
## 🔑 로그인
이메일/비밀번호로 로그인 후 토큰을 발급받습니다.

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`email\` | string | ✅ | 이메일 주소 |
| \`password\` | string | ✅ | 비밀번호 |
| \`deviceName\` | string | ❌ | 기기 이름 (선택, 세션 구분용, 예: iPhone 15 Pro) |
| \`deviceType\` | enum | ❌ | 디바이스 타입 (IOS, ANDROID, WEB) |

### 🎫 응답 토큰
| 토큰 | 유효기간 | 저장 위치 |
|------|----------|-----------|
| Access Token | 15분 | 메모리 |
| Refresh Token | 7일 | Secure Storage |

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| USER_0602 | 이메일/비밀번호 불일치 | 재입력 요청 |
| USER_0605 | 계정 잠금 (5회 실패) | 15분 대기 안내 |
| USER_0608 | 이메일 미인증 | 인증 화면 이동 + resend-verification 호출 |
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0607 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0608 })
	async login(@Body() dto: LoginDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.login(dto, metadata);
		return AuthMapper.toAuthTokensResponse(result);
	}

	@Post("logout")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "로그아웃 (현재 기기)",
		operationId: "logout",
		description: `
## 🚪 로그아웃

현재 세션을 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 현재 세션만 종료됩니다
- 다른 기기의 세션은 유지됩니다
- 해당 Refresh Token도 무효화됩니다

### 💡 전체 로그아웃
모든 기기에서 로그아웃하려면:
\`POST /auth/logout-all\` 사용
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async logout(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		await this.authService.logout(user.userId, user.sessionId, metadata);
		return AuthMapper.toMessageResponse("로그아웃되었습니다.");
	}

	@Post("logout-all")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "전체 로그아웃 (모든 기기)",
		operationId: "logoutAll",
		description: `
## 🚪 전체 로그아웃

모든 기기의 세션을 한 번에 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 현재 기기 포함 **모든 세션**이 종료됩니다
- 모든 Refresh Token이 무효화됩니다
- 다른 기기에서 즉시 로그아웃됩니다

### 💡 사용 케이스
- 계정 보안 의심 시
- 기기 분실 시
- 비밀번호 변경 후 전체 재로그인 유도 시
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async logoutAll(@CurrentUser() user: CurrentUserPayload) {
		await this.authService.logoutAll(user.userId);
		return AuthMapper.toMessageResponse("모든 기기에서 로그아웃되었습니다.");
	}

	// ============================================
	// 토큰 관리
	// ============================================

	@Post("refresh")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 20 } })
	@UseGuards(JwtRefreshGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "토큰 갱신",
		operationId: "refreshTokens",
		description: `
## 🔄 토큰 갱신
Refresh Token으로 새 토큰 쌍을 발급받습니다. (Token Rotation 적용)

### 🔐 인증
\`Authorization: Bearer {refreshToken}\` (**Access Token 아님!**)

### 📋 동작
- 새 Access + Refresh Token 발급
- 기존 Refresh Token 즉시 무효화

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| AUTH_0104 | 유효하지 않은 토큰 | 재로그인 |
| SESSION_0704 | 토큰 재사용 감지 | 전체 세션 무효화, 재로그인 |
		`,
	})
	@ApiSuccessResponse({ type: RefreshTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.AUTH_0104 })
	@ApiErrorResponse({ errorCode: ErrorCode.SESSION_0704 })
	async refresh(@Req() req: Request) {
		const payload = req.user as RefreshTokenPayload;
		const result = await this.authService.refreshTokens(payload.refreshToken);
		return AuthMapper.toRefreshTokensResponse(result);
	}

	// ============================================
	// 비밀번호 관리
	// ============================================

	@Post("forgot-password")
	@Public()
	@Throttle({ default: { ttl: 60000, limit: 5 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 재설정 - 코드 요청",
		operationId: "forgotPassword",
		description: `
## 🔑 비밀번호 재설정 — 1단계: 인증 코드 발송

> **인증**: 불필요
> **대상**: 이메일 계정 (비밀번호 분실)
> **플로우**: 2단계 중 1단계

### 📝 요청 Body
- \`email\`: 가입된 이메일

### 🔄 다음 단계
\`POST /auth/reset-password\`로 새 비밀번호 설정 (10분 내)

### 💡 참고
- 보안상 등록되지 않은 이메일이어도 동일한 성공 응답을 반환합니다 (이메일 존재 여부 노출 방지)
- 소셜 로그인 사용자가 비밀번호를 **새로 설정**하려면 → \`POST /auth/password/setup-code\` (로그인 필요)
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		const result = await this.authService.forgotPassword(dto.email);
		return result;
	}

	@Post("reset-password")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 재설정 - 새 비밀번호 설정",
		operationId: "resetPassword",
		description: `
## 🔑 비밀번호 재설정 — 2단계: 새 비밀번호 설정

> **인증**: 불필요
> **대상**: 이메일 계정 (비밀번호 분실)
> **플로우**: 2단계 중 2단계
> **전제**: \`POST /auth/forgot-password\`로 발송된 인증 코드 필요

### 📝 요청 Body
- \`email\`: 이메일
- \`code\`: 6자리 인증 코드
- \`newPassword\`: 새 비밀번호 (8자+, 영문+숫자)

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| VERIFY_0751 | 잘못된 인증 코드 | 재입력 요청 |
| VERIFY_0752 | 만료된 인증 코드 | 코드 재발송 안내 |
| VERIFY_0754 | 인증 시도 횟수 초과 | 코드 재발송 안내 |
| USER_0606 | 탈퇴한 계정 | 재가입 안내 |
| USER_0613 | 소셜 전용 계정 | "소셜 로그인을 이용해주세요" 안내 |

### 🔒 보안
- 성공 시 모든 기존 세션이 무효화됩니다 (재로그인 필요)
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0751 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0752 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0754 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0613 })
	async resetPassword(@Body() dto: ResetPasswordDto) {
		const result = await this.authService.resetPassword(
			dto.email,
			dto.code,
			dto.newPassword,
		);
		return result;
	}

	@Post("password/setup-code")
	@ApiBearerAuth()
	@Throttle({ default: { ttl: 60000, limit: 5 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 최초 설정 - 코드 요청",
		operationId: "requestPasswordSetupCode",
		description: `
## 🔑 비밀번호 설정 — 1단계: 인증 코드 발송

> **인증**: Bearer 토큰 필요
> **대상**: 소셜 계정 (이메일 로그인 추가)
> **플로우**: 2단계 중 1단계

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔄 다음 단계
\`POST /auth/password\`로 비밀번호 설정 (10분 내)

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| USER_0614 | 이미 비밀번호가 설정된 계정 | 비밀번호 변경 화면으로 안내 |
| VERIFY_0753 | 재발송 쿨다운 (1분) | 대기 안내 |

### 💡 참고
- 이미 비밀번호가 있는 사용자가 비밀번호를 **변경**하려면 → \`PATCH /auth/password\` (로그인 필요)
- 비밀번호를 잊어버렸다면 → \`POST /auth/forgot-password\` (로그인 불필요)
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0614 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0753 })
	async requestPasswordSetupCode(@CurrentUser() user: CurrentUserPayload) {
		return this.authService.requestPasswordSetupCode(user.userId);
	}

	@Post("password")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 최초 설정 - 비밀번호 생성",
		operationId: "setPassword",
		description: `
## 🔑 비밀번호 설정 — 2단계: 비밀번호 생성

> **인증**: Bearer 토큰 필요
> **대상**: 소셜 계정 (이메일 로그인 추가)
> **플로우**: 2단계 중 2단계
> **전제**: \`POST /auth/password/setup-code\`로 발송된 인증 코드 필요
> **결과**: 이메일/비밀번호 로그인 수단이 추가됨

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
- \`code\`: 6자리 인증 코드
- \`newPassword\`: 새 비밀번호 (8자+, 영문+숫자)
- \`newPasswordConfirm\`: 비밀번호 확인

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| USER_0614 | 이미 비밀번호가 설정된 계정 | 비밀번호 변경 화면으로 안내 |
| VERIFY_0751 | 잘못된 인증 코드 | 재입력 요청 |
| VERIFY_0754 | 인증 시도 횟수 초과 | 코드 재발송 안내 |

### 🔒 보안
- 기존 세션이 유지됩니다 (재로그인 불필요)
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0614 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0751 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0754 })
	async setPassword(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: SetPasswordDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		return this.authService.setPassword(
			user.userId,
			dto.code,
			dto.newPassword,
			metadata,
		);
	}

	@Patch("password")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 변경",
		operationId: "changePassword",
		description: `
## 🔐 비밀번호 변경

> **인증**: Bearer 토큰 필요
> **대상**: 이메일 계정 (현재 비밀번호 알고 있음)
> **플로우**: 단일 단계

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
- \`currentPassword\`: 현재 비밀번호
- \`newPassword\`: 새 비밀번호 (8자+, 영문+숫자)

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| USER_0602 | 현재 비밀번호 불일치 | 재입력 요청 |
| USER_0613 | 소셜 전용 계정 | 비밀번호 설정 화면으로 안내 |

### 💡 참고
- 비밀번호를 잊어버렸다면 → \`POST /auth/forgot-password\` (로그인 불필요)
- 소셜 계정에 비밀번호를 **처음 설정**하려면 → \`POST /auth/password/setup-code\`
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0613 })
	async changePassword(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: ChangePasswordDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.changePassword(
			user.userId,
			dto.currentPassword,
			dto.newPassword,
			metadata,
			user.sessionId,
		);
		return result;
	}

	// ============================================
	// 사용자 정보
	// ============================================

	@Get("me")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "내 정보 조회",
		operationId: "getCurrentUser",
		description: `
## 👤 내 정보 조회
현재 로그인된 사용자 정보를 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 필드
\`userId\`, \`email\`, \`sessionId\`, \`name\`, \`profileImage\`, \`providers\`

### 📋 providers 필드
연결된 로그인 제공자 목록 (예: \`["CREDENTIAL", "KAKAO"]\`)
- \`CREDENTIAL\`: 이메일/비밀번호 로그인
- \`APPLE\`, \`GOOGLE\`, \`KAKAO\`, \`NAVER\`: 소셜 로그인
		`,
	})
	@ApiSuccessResponse({ type: CurrentUserDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getMe(@CurrentUser() user: CurrentUserPayload) {
		const result = await this.authService.getCurrentUser(
			user.userId,
			user.email,
			user.sessionId,
		);
		return AuthMapper.toCurrentUserResponse(result);
	}

	@Patch("profile")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "프로필 수정",
		operationId: "updateProfile",
		description: `
## 👤 프로필 수정
이름/프로필 이미지를 수정합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body (최소 1개 필수)
- \`name\`: 이름 (100자 이내, null=삭제)
- \`profileImage\`: 아이콘 키 또는 이미지 URL (500자 이내, null=삭제)
		`,
	})
	@ApiSuccessResponse({ type: UpdateProfileResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updateProfile(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateProfileDto,
	) {
		const result = await this.authService.updateProfile(user.userId, dto);
		return AuthMapper.toUpdateProfileResponse(result);
	}

	// ============================================
	// 푸시 알림 설정
	// ============================================

	@Get("preference")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "알림 설정 조회",
		operationId: "getPushPreference",
		description: `
## 🔔 푸시 알림 설정 조회
현재 사용자의 푸시 알림 설정을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 알림 설정 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean | 야간 푸시 동의 (21:00-08:00 사용자 로컬 시간) |
| \`timezone\` | string | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number | 아침 리마인더 시간 (0-23, 기본 8) |
| \`eveningReminderHour\` | number | 저녁 리마인더 시간 (0-23, 기본 18) |

### 🌏 타임존
- 앱 실행 시 푸시 토큰 등록과 함께 자동 설정됩니다
- 수동 변경도 가능합니다

### ⏰ 리마인더 시간 커스텀
- 사용자의 로컬 타임존 기준으로 동작합니다
- 예: timezone="Asia/Seoul", morningReminderHour=7 → KST 07:00에 아침 알림
		`,
	})
	@ApiSuccessResponse({ type: PreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getPreference(@CurrentUser() user: CurrentUserPayload) {
		return this.userSettingsService.getPreference(user.userId);
	}

	@Patch("preference")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "알림 설정 수정",
		operationId: "updatePushPreference",
		description: `
## 🔔 푸시 알림 설정 수정
푸시 알림 설정을 수정합니다. 최소 1개 필드 필수.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body (최소 1개 필수)
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean? | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean? | 야간 푸시 동의 (21:00-08:00 사용자 로컬 시간) |
| \`timezone\` | string? | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number? | 아침 리마인더 시간 (0-23, 기본 8) |
| \`eveningReminderHour\` | number? | 저녁 리마인더 시간 (0-23, 기본 18) |

### 🌏 타임존
- 앱 실행 시 푸시 토큰 등록과 함께 자동 설정됩니다
- 수동 변경도 가능합니다

### ⏰ 리마인더 시간 커스텀
- 사용자의 로컬 타임존 기준으로 동작합니다
- 예: timezone="Asia/Seoul", morningReminderHour=7 → KST 07:00에 아침 알림

### ⚠️ 주의
- 야간 푸시를 허용하려면 먼저 \`pushEnabled\`가 true여야 합니다.
		`,
	})
	@ApiSuccessResponse({ type: UpdatePreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updatePreference(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdatePreferenceDto,
	) {
		return this.userSettingsService.updatePreference(user.userId, dto);
	}

	// ============================================
	// 약관 동의 상태
	// ============================================

	@Get("consent")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "약관 동의 상태 조회",
		operationId: "getConsent",
		description: `
## 📜 약관 동의 상태 조회
현재 사용자의 약관 동의 상태를 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`termsAgreedAt\` | string? | 서비스 이용약관 동의 시점 |
| \`privacyAgreedAt\` | string? | 개인정보처리방침 동의 시점 |
| \`agreedTermsVersion\` | string? | 동의한 약관 버전 |
| \`marketingAgreedAt\` | string? | 마케팅 수신 동의 시점 (null = 미동의/철회) |
		`,
	})
	@ApiSuccessResponse({ type: ConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getConsent(@CurrentUser() user: CurrentUserPayload) {
		return this.userSettingsService.getConsent(user.userId);
	}

	@Patch("consent/marketing")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "마케팅 수신 동의 변경",
		operationId: "updateMarketingConsent",
		description: `
## 📢 마케팅 수신 동의 변경
마케팅 수신 동의를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
| 필드 | 타입 | 설명 |
|------|------|------|
| \`agreed\` | boolean | true=동의, false=철회 |

### 📋 응답
| 필드 | 타입 | 설명 |
|------|------|------|
| \`marketingAgreedAt\` | string? | 동의 시 현재 시점, 철회 시 null |
		`,
	})
	@ApiSuccessResponse({ type: UpdateMarketingConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updateMarketingConsent(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateMarketingConsentDto,
	) {
		return this.userSettingsService.updateMarketingConsent(
			user.userId,
			dto.agreed,
		);
	}

	// ============================================
	// 세션 관리
	// ============================================

	@Get("sessions")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "활성 세션 목록 조회",
		operationId: "getActiveSessions",
		description: `
## 📱 활성 세션 목록

현재 로그인되어 있는 모든 기기/세션 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터 (세션별)
| 필드 | 설명 |
|------|------|
| \`id\` | 세션 고유 ID |
| \`deviceName\` | 기기명 (예: iPhone 15) |
| \`deviceType\` | 기기 타입 (mobile/desktop/tablet) |
| \`ipAddress\` | 접속 IP |
| \`lastActiveAt\` | 마지막 활동 시간 |
| \`isCurrent\` | 현재 세션 여부 |

### 💡 사용 케이스
- 로그인된 기기 확인
- 의심스러운 세션 발견 시 종료
- 보안 점검
		`,
	})
	@ApiSuccessResponse({ type: SessionListDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getSessions(@CurrentUser() user: CurrentUserPayload) {
		const sessions = await this.authService.getActiveSessions(user.userId);

		// 현재 세션 표시
		const sessionsWithCurrent = sessions.map((session) => ({
			...session,
			isCurrent: session.id === user.sessionId,
		}));

		return { sessions: sessionsWithCurrent };
	}

	@Delete("sessions/:sessionId")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "특정 세션 종료",
		operationId: "revokeSession",
		description: `
## 🔌 세션 종료

특정 기기의 세션을 원격으로 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 지정된 세션이 즉시 종료됩니다
- 해당 기기의 Access Token이 무효화됩니다
- 해당 기기의 Refresh Token도 무효화됩니다

### 💡 사용 케이스
- 분실한 기기 로그아웃
- 공용 PC에서 로그아웃 깜빡했을 때
- 의심스러운 접속 차단

### ⚠️ 에러 케이스
- \`SESSION_NOT_FOUND\`: 존재하지 않는 세션 ID
		`,
	})
	@ApiParam({
		name: "sessionId",
		description: "종료할 세션 ID (UUID)",
		example: "550e8400-e29b-41d4-a716-446655440000",
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.SESSION_0701)
	async revokeSession(
		@CurrentUser() user: CurrentUserPayload,
		@Param("sessionId") sessionId: string,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.revokeSession(
			user.userId,
			sessionId,
			metadata,
		);
		return result;
	}

	// ============================================
	// OAuth 교환 코드 (Exchange Code)
	// ============================================

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
| \`AUTH_0107\` | 유효하지 않거나 만료/사용된 교환 코드 |`,
	})
	@ApiCreatedResponse({
		description: "토큰 교환 성공",
		type: AuthTokensDto,
	})
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async exchangeCode(@Body() dto: ExchangeCodeDto): Promise<AuthTokensDto> {
		const result = await this.oauthService.exchangeCodeForTokens(dto.code);
		return AuthMapper.toExchangeCodeResponse(result);
	}

	// ============================================
	// OAuth (소셜 로그인)
	// ============================================

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

> 📖 상세 구현 가이드: \`.claude/oauth-client-guide.md\`

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
		const metadata = this.extractMetadata(req);
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

> 📖 상세 구현 가이드: \`.claude/oauth-client-guide.md\`

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
		const metadata = this.extractMetadata(req);
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

	// ============================================
	// Kakao 웹 OAuth (모바일 앱 브라우저 기반)
	// ============================================

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
	async kakaoOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Query("mode") mode: "login" | "link" | undefined,
		@Query("user_hint") userHint: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		// state가 없으면 서버에서 자동 생성
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
		// 기본 redirect_uri (state가 없거나 조회 실패 시 사용)
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = this.extractMetadata(req);

			// 토큰 생성 + 교환 코드 발급 (토큰은 DB에 임시 저장)
			// OAuthState에서 redirect_uri도 함께 반환
			const result =
				await this.oauthService.handleKakaoWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			// 성공 시 저장된 redirect_uri로 교환 코드 전달 (토큰 노출 방지)
			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			// 에러 시 기본 redirect_uri로 에러 정보 전달 (BusinessException인 경우 에러 코드 포함)
			const params = this.buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Google 웹 OAuth (웹 브라우저 기반)
	// ============================================

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
			const metadata = this.extractMetadata(req);

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
			this.logger.error(
				`Google OAuth callback error: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
			const params = this.buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Naver 웹 OAuth (웹 브라우저 기반)
	// ============================================

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
			const metadata = this.extractMetadata(req);

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
			const params = this.buildOAuthErrorParams(error, state);
			const errorRedirectUri = await this.resolveOAuthErrorRedirectUri(
				state,
				defaultRedirectUri,
			);

			res.redirect(`${errorRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Kakao 모바일 OAuth (기존 토큰 기반)
	// ============================================

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

> 📖 상세 구현 가이드: \`.claude/oauth-client-guide.md\`

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
		const metadata = this.extractMetadata(req);
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

> 📖 상세 구현 가이드: \`.claude/oauth-client-guide.md\`

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
		const metadata = this.extractMetadata(req);
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

	// ============================================
	// 소셜 계정 연동 관리
	// ============================================

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
	@ApiConflictError(ErrorCode.KAKAO_0306)
	@ApiConflictError(ErrorCode.APPLE_0355)
	@ApiConflictError(ErrorCode.GOOGLE_0405)
	@ApiConflictError(ErrorCode.NAVER_0455)
	async linkSocialAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: LinkSocialAccountDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
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
	@ApiConflictError(ErrorCode.KAKAO_0306)
	@ApiConflictError(ErrorCode.APPLE_0355)
	@ApiConflictError(ErrorCode.GOOGLE_0405)
	@ApiConflictError(ErrorCode.NAVER_0455)
	async linkWithExchangeCode(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: ExchangeCodeDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		return this.oauthService.linkAccountWithExchangeCode(
			user.userId,
			dto.code,
			metadata,
		);
	}

	@Get("linked-accounts")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "소셜 계정 연결 상태 조회",
		operationId: "getLinkedAccounts",
		description: `
## 🔗 소셜 계정 연결 상태 조회

현재 사용자의 소셜 계정 연결 상태를 조회합니다.
4개 OAuth 제공자(APPLE, GOOGLE, KAKAO, NAVER) 모두의 연결 여부를 반환합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터
| 필드 | 타입 | 설명 |
|------|------|------|
| \`provider\` | string | 소셜 제공자 (APPLE, GOOGLE, KAKAO, NAVER) |
| \`linked\` | boolean | 연결 여부 |
| \`providerAccountId\` | string \\| null | 제공자 측 계정 고유 ID (미연결 시 null) |
| \`linkedAt\` | string \\| null | 계정 연결 시각 (ISO 8601 UTC, 미연결 시 null) |

### 💡 응답 예시
\`\`\`json
{
  "accounts": [
    { "provider": "APPLE", "linked": false, "providerAccountId": null, "linkedAt": null },
    { "provider": "GOOGLE", "linked": true, "providerAccountId": "102938475647382910", "linkedAt": "2026-01-15T10:30:00.000Z" },
    { "provider": "KAKAO", "linked": true, "providerAccountId": "3456789012", "linkedAt": "2026-02-01T14:00:00.000Z" },
    { "provider": "NAVER", "linked": false, "providerAccountId": null, "linkedAt": null }
  ]
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: LinkedAccountsResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getLinkedAccounts(@CurrentUser() user: CurrentUserPayload) {
		const accounts = await this.oauthService.getLinkedAccounts(user.userId);
		return { accounts };
	}

	@Delete("linked-accounts/:provider")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "소셜 계정 연결 해제",
		operationId: "unlinkSocialAccount",
		description: `
## 🔓 소셜 계정 연결 해제

연결된 소셜 계정을 해제합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### ⚠️ 제한사항
- 마지막 로그인 수단은 해제할 수 없습니다 (400)
- 비밀번호 또는 다른 소셜 계정이 있어야 해제 가능
- 연결되지 않은 provider를 해제하면 404

### ⚠️ 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| \`AUTH_0107\` | 401 | 인증이 필요합니다 |
| \`USER_0610\` | 400 | 마지막 로그인 수단은 해제할 수 없습니다 |
| \`USER_0603\` | 404 | 연결된 계정을 찾을 수 없습니다 |
		`,
	})
	@ApiParam({
		name: "provider",
		description: "연결 해제할 소셜 로그인 제공자",
		enum: ["APPLE", "GOOGLE", "KAKAO", "NAVER"],
		example: "GOOGLE",
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.USER_0610)
	@ApiNotFoundError(ErrorCode.USER_0603)
	async unlinkAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Param("provider") provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		return this.oauthService.unlinkAccount(user.userId, provider, metadata);
	}

	// ============================================
	// 회원 탈퇴
	// ============================================

	@Delete("account")
	@ApiBearerAuth()
	@Throttle({ default: { ttl: 3600000, limit: 3 } })
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "회원 탈퇴",
		operationId: "deleteAccount",
		description: `
## 👋 회원 탈퇴
계정을 탈퇴 처리합니다 (30일 복구 기간).

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| password | string | 이메일 계정만 | 현재 비밀번호 |
| reason | string | 선택 | 탈퇴 사유 (최대 500자) |

### 📋 처리 내용
1. 본인 확인 (이메일 계정: 비밀번호, 소셜 계정: 세션)
2. Soft delete (deletedAt 설정)
3. 모든 세션 즉시 폐기
4. 30일 후 데이터 완전 삭제
		`,
	})
	@ApiSuccessResponse({ type: DeleteAccountResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0612 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	async deleteAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: DeleteAccountDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		return this.authService.deleteAccount(
			user.userId,
			user.sessionId,
			dto,
			metadata,
		);
	}

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * 요청에서 메타데이터 추출
	 */
	private extractMetadata(req: Request): RequestMetadata {
		const forwarded = req.headers["x-forwarded-for"];
		const ip = Array.isArray(forwarded)
			? forwarded[0]
			: forwarded?.split(",")[0] || req.ip;

		return {
			ip: ip || undefined,
			userAgent: req.headers["user-agent"],
			deviceName: req.headers["x-device-name"] as string | undefined,
			deviceType: req.headers["x-device-type"] as string | undefined,
		};
	}
}
