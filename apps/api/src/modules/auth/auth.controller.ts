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
import type { Request, Response } from "express";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import {
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
 * ### 비밀번호 재설정 플로우
 * ```
 * 1. POST /auth/forgot-password → 재설정 코드 이메일 발송
 * 2. POST /auth/reset-password  → 새 비밀번호 설정
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
		let errorMessage = "Unknown error";

		if (error instanceof BusinessException) {
			errorCode = error.errorCode;
			errorMessage = error.message;
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}

		return new URLSearchParams({
			error: errorCode,
			error_description: errorMessage,
			state,
		});
	}

	// ============================================
	// 회원가입 및 인증
	// ============================================

	@Post("register")
	@Public()
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
		summary: "이메일 인증",
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
| USER_0602 | 존재하지 않는 사용자 |
| USER_0604 | 이미 인증 완료된 사용자 |
| USER_0605 | 인증 요청 정보 없음 |
| VERIFY_0753 | 재발송 쿨다운 (1분) |
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
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
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "로그인",
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
		summary: "로그아웃",
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
		summary: "모든 기기에서 로그아웃",
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
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 찾기",
		operationId: "forgotPassword",
		description: `
## 🔑 비밀번호 찾기 (1/2)
비밀번호 재설정용 6자리 인증 코드를 이메일로 발송합니다.

### 📝 요청 Body
- \`email\`: 가입된 이메일

### 🔄 다음 단계
\`POST /auth/reset-password\`로 새 비밀번호 설정 (10분 내)

### 🔒 보안
존재하지 않는 이메일도 동일 응답 (이메일 노출 방지)
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
		summary: "비밀번호 재설정",
		operationId: "resetPassword",
		description: `
## 🔑 비밀번호 재설정 (2/2)
인증 코드 확인 후 새 비밀번호를 설정합니다.

### 📝 요청 Body
- \`email\`: 이메일
- \`code\`: 6자리 인증 코드
- \`newPassword\`: 새 비밀번호 (8자+, 영문+숫자)

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| EMAIL_0504 | 잘못된 인증 코드 |
| EMAIL_0505 | 만료된 인증 코드 |
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0504 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0505 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	async resetPassword(@Body() dto: ResetPasswordDto) {
		const result = await this.authService.resetPassword(
			dto.email,
			dto.code,
			dto.newPassword,
		);
		return result;
	}

	@Patch("password")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 변경",
		operationId: "changePassword",
		description: `
## 🔐 비밀번호 변경
로그인 상태에서 비밀번호를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
- \`currentPassword\`: 현재 비밀번호
- \`newPassword\`: 새 비밀번호 (8자+, 영문+숫자)

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| USER_0602 | 현재 비밀번호 불일치 |
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
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
		);
		return result;
	}

	// ============================================
	// 사용자 정보
	// ============================================

	@Get("me")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "현재 사용자 정보 조회",
		operationId: "getCurrentUser",
		description: `
## 👤 내 정보 조회
현재 로그인된 사용자 정보를 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 필드
\`userId\`, \`email\`, \`sessionId\`, \`name\`, \`profileImage\`
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
- \`profileImage\`: 이미지 URL (500자 이내, null=삭제)
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
		summary: "푸시 알림 설정 조회",
		operationId: "getPushPreference",
		description: `
## 🔔 푸시 알림 설정 조회
현재 사용자의 푸시 알림 설정을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean | 푸시 알림 전체 ON/OFF |
| \`nightPushEnabled\` | boolean | 야간 푸시 동의 (21:00-08:00) |
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
		summary: "푸시 알림 설정 수정",
		operationId: "updatePushPreference",
		description: `
## 🔔 푸시 알림 설정 수정
푸시 알림 설정을 수정합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body (최소 1개 필수)
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean? | 푸시 알림 전체 ON/OFF |
| \`nightPushEnabled\` | boolean? | 야간 푸시 동의 (21:00-08:00) |

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
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "OAuth 교환 코드로 토큰 획득",
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
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Apple 로그인 콜백",
		operationId: "appleCallback",
		description: `\`expo-apple-authentication\`으로 Apple Sign In 후 credential을 전송합니다.

## 📦 라이브러리 설치

\`\`\`bash
npx expo install expo-apple-authentication
\`\`\`

## 🔐 보안 특성

Apple Sign In은 **시스템 인증 다이얼로그**를 사용하므로 다른 OAuth 제공자와 다릅니다.

| 특성 | 설명 | 보안 이점 |
|------|------|----------|
| **인증 방식** | 시스템 수준 API 호출 | WebView 우회 → XSS 불가능 |
| **Token 유형** | Identity Token (JWT) | 서명 검증 필수, 발급자 확인 가능 |
| **사용자 정보** | **최초 로그인 시만** 제공 | 중복 계정 방지, 개인정보 보호 |
| **Redirect URI** | 불필요 | URL Scheme 공격 최소화 |

## 📱 클라이언트 구현

### App.json 설정
\`\`\`json
{
  "expo": {
    "ios": { "usesAppleSignIn": true },
    "plugins": ["expo-apple-authentication"]
  }
}
\`\`\`

### 로그인 플로우 (TypeScript)
\`\`\`typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import { api } from './api';

const handleAppleLogin = async () => {
  try {
    // 1️⃣ 시스템 인증 다이얼로그 표시
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // 2️⃣ credential.identityToken 획득 (JWT 형식)
    const idToken = credential.identityToken;

    // 3️⃣ 서버로 전송 (최초 로그인 시 사용자 정보도 함께)
    const response = await api.post('/auth/apple/callback', {
      idToken,
      // ❌ 최초 로그인 이후 재로그인 시 아래는 undefined
      userName: credential.user?.name || undefined,
      deviceName: credential.user?.name || undefined, // 사용 가능한 경우
      deviceType: 'iOS', // 명시적으로 설정
    });

    // 4️⃣ 토큰 저장
    await saveTokens(response.data);
  } catch (e) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      console.log('사용자가 로그인 취소');
    } else {
      console.error('Apple 로그인 실패', e);
    }
  }
};
\`\`\`

## 🔄 API 플로우

| Step | 역할 | 작업 |
|------|------|------|
| 1️⃣ | 클라이언트 | \`AppleAuthentication.signInAsync()\` 호출 |
| 2️⃣ | Apple 시스템 | 사용자 인증 후 Identity Token 반환 |
| 3️⃣ | 클라이언트 | Identity Token을 서버로 전송 |
| 4️⃣ | 백엔드 | Token 검증 → 사용자 생성/업데이트 → JWT 발급 |

## 📝 요청 Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|:----:|------|------|
| \`idToken\` | string | ✅ | Apple Identity Token (JWT) | \`eyJhbGc...\` |
| \`userName\` | string | ❌ | 사용자 이름 | \`김영민\` |
| \`deviceName\` | string | ❌ | 디바이스 이름 | \`iPhone 15 Pro\` |
| \`deviceType\` | string | ❌ | 디바이스 타입 | \`iOS\` |

### Identity Token 예시 (JWT 디코드)
\`\`\`json
{
  "iss": "https://appleid.apple.com",
  "aud": "com.example.aido",
  "sub": "001234.abcd1234e.0987",
  "nonce_supported": true,
  "email": "user@example.com",
  "email_verified": "true",
  "auth_time": 1704067200,
  "iat": 1704067200,
  "exp": 1704067260
}
\`\`\`

## ✅ 성공 응답 (200)
\`\`\`json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "nickname": "김영민",
      "profileImage": null
    }
  }
}
\`\`\`

## ❌ 에러 케이스

| 에러 코드 | HTTP | 메시지 | 클라이언트 처리 |
|----------|------|--------|----------------|
| \`SOCIAL_0202\` | 401 | 소셜 인증 토큰이 유효하지 않습니다 | 재로그인 요청 |
| \`USER_0601\` | 400 | 이미 다른 계정으로 가입됨 | 계정 연동 화면 또는 가입 재시도 |
| \`USER_0602\` | 400 | 가입 불가능한 이메일 | 고객 지원 안내 |

## 🔐 백엔드 검증 프로세스

서버는 다음과 같이 Identity Token을 검증합니다:

\`\`\`typescript
// 1️⃣ Token 서명 검증 (Apple 공개키 사용)
const publicKeySet = await fetchApplePublicKeys();
const decoded = jwt.verify(idToken, publicKeySet);

// 2️⃣ 필드 검증
if (decoded.iss !== 'https://appleid.apple.com') {
  throw new InvalidTokenError();
}
if (decoded.aud !== process.env.APPLE_BUNDLE_ID) {
  throw new InvalidTokenError();
}
if (decoded.exp < Date.now()) {
  throw new ExpiredTokenError();
}

// 3️⃣ 사용자 정보 추출
const { sub: appleUserId, email } = decoded;

// 4️⃣ 사용자 조회 또는 생성
const user = await findOrCreateUser(appleUserId, email);
\`\`\`

## ⚠️ 주의사항

### 1️⃣ 최초 로그인 시에만 사용자 정보 제공
Apple은 **보안 정책**으로 최초 로그인 시에만 \`email\`과 \`name\`을 제공합니다.
- ✅ 1차: Apple 시스템 다이얼로그 → 이메일, 이름 전달
- ❌ 2차 이후: 다시 로그인하면 이메일, 이름 전달 안 함 (서버의 기존 기록 사용)

**클라이언트 처리**: Identity Token의 \`sub\` 필드(사용자 고유 ID)로만 식별

### 2️⃣ Email Masking 사용 가능
Apple 개인정보 보호 정책으로 사용자가 "Hide My Email" 옵션을 선택할 수 있습니다.
- 실제 이메일 대신 \`random@privaterelay.appleid.com\` 형식 제공
- 이 경우 실제 이메일 주소를 얻을 수 없음 (사용자의 선택)
- **처리 방법**: 닉네임을 다시 입력받도록 유도

### 3️⃣ Team ID와 Bundle ID 설정
Apple Developer Account에서 다음 설정 필수:
- **Team ID**: 앱 서명에 필요
- **Bundle ID**: 요청 시 \`aud\` 필드와 일치해야 함

### 4️⃣ Sub 값 저장 필수
Apple의 \`sub\` 값(예: \`001234.abcd1234e.0987\`)은 **영구 사용자 ID**입니다.
- 향후 Apple 로그인 시 동일한 \`sub\` 값으로 사용자 식별
- 데이터베이스에 \`appleUserId\` 컬럼으로 저장 필수

### 5️⃣ Nonce 검증 (선택사항)
CSRF 공격 방지를 위해 Nonce 사용 권장:
\`\`\`typescript
// 클라이언트
const nonce = generateRandomString();
const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [...],
  nonce, // 추가
});

// 서버
const decoded = jwt.verify(idToken, publicKey);
if (decoded.nonce !== expectedNonce) {
  throw new SecurityError('Nonce mismatch');
}
\`\`\`

## 🔄 플로우 다이어그램

\`\`\`
┌─────────────┐                        ┌──────────────┐
│   클라이언트   │                        │  Apple 시스템  │
└─────────────┘                        └──────────────┘
      │                                      │
      │──────────────────────────────────────>│
      │  signInAsync(scopes)                 │
      │                                      │
      │  ┌──────────────────────────┐        │
      │  │ 사용자 인증 다이얼로그      │        │
      │  │ (생체인증/암호)          │        │
      │  └──────────────────────────┘        │
      │                                      │
      │<──────────────────────────────────────│
      │  credential {                        │
      │    identityToken: JWT,               │
      │    user: {                           │
      │      name: string? (최초만),         │
      │      email: string? (최초만)         │
      │    }                                 │
      │  }                                   │
      │                                      │
      ├─────────────────────────────────────>│
      │  POST /auth/apple/callback           │
      │  { idToken, userName?, ... }         │
      │                                      │
      │  ┌──────────────────────────┐        │
      │  │ 1. Token 서명 검증         │        │
      │  │ 2. 필드 검증              │        │
      │  │ 3. 사용자 조회/생성       │        │
      │  │ 4. JWT 토큰 발급          │        │
      │  └──────────────────────────┘        │
      │                                      │
      │<─────────────────────────────────────│
      │  200 OK {                            │
      │    accessToken, refreshToken, user   │
      │  }                                   │
      │                                      │
\`\`\`

## 📚 Apple Developer 설정 체크리스트

- [ ] Apple Developer Team에 등록
- [ ] App ID 생성 (Sign In with Apple 활성화)
- [ ] Certificates 및 Identifiers 설정
- [ ] app.json에 \`usesAppleSignIn: true\` 추가
- [ ] Privacy Policy 페이지에 Apple 로그인 명시
- [ ] 약관에 Apple ID 사용 동의 포함`,
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
		);

		return AuthMapper.toAuthTokensResponse(result);
	}

	@Post("google/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Google 로그인 콜백 (모바일)",
		operationId: "googleMobileCallback",
		description: `**expo-auth-session**의 Google OAuth 제공자를 통해 ID Token을 받은 후 백엔드로 전송합니다.

## 📦 필수 라이브러리

\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 라이브러리별 역할

| 라이브러리 | 목적 | 역할 | 보안성 |
|-----------|------|------|--------|
| \`expo-auth-session\` | OAuth 2.0 프로토콜 | Google 인증 요청/응답 관리 | ✅ HTTPS + 시스템 브라우저 |
| \`expo-crypto\` | PKCE 지원 | Code challenge 생성 (선택) | ✅ 로컬 암호화 |
| \`expo-web-browser\` | 시스템 브라우저 | 보안 인증 UI 제공 | ✅ 시스템 관리 |
| \`expo-linking\` | Deep link 처리 | Redirect URI 수신 | ✅ 네이티브 통합 |

### 보안 특성

- **인증 UI**: 시스템 브라우저 사용 (앱 내 WebView 불가)
- **토큰 전달**: ID Token만 전송 (Access Token 노출 방지)
- **토큰 검증**: JWT 서명 검증 필수
- **만료**: ID Token은 1시간 유효

---

## ⚙️ Google Developers Console 설정

### Step 1: OAuth 2.0 클라이언트 생성
1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. **OAuth 동의 화면** → \`외부\` 선택 → 기본 정보 입력
3. **사용자 인증 정보** → \`OAuth 2.0 클라이언트 ID\` 생성
4. **애플리케이션 유형**: iOS 또는 Android 선택

### Step 2: iOS 설정
1. Bundle ID 입력 (예: \`com.aido.mobile\`)
2. 팀 ID 입력 (Apple Developer 계정에서 확인)
3. **클라이언트 ID** 복사

### Step 3: Android 설정
1. Package name 입력 (예: \`com.aido.mobile\`)
2. SHA-1 지문 입력 (앱 서명 인증서에서 확인)
3. **클라이언트 ID** 복사

---

## 🔄 OAuth 플로우 (Step별)

### Step 1: 인증 요청 (클라이언트)
\`\`\`javascript
// Google.useAuthRequest() 설정
const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
});

// 로그인 버튼 클릭 시
const handleGoogleLogin = async () => {
  const result = await promptAsync();
  if (result?.type === 'success') {
    // Step 2로 진행
  }
};
\`\`\`

### Step 2: ID Token 획득 (클라이언트)
\`\`\`javascript
// response에서 ID Token 추출
if (response?.type === 'success') {
  const { id_token: idToken } = response.params;

  // Step 3: 백엔드로 전송
  await api.post('/auth/google/callback', {
    idToken,
    userName: '사용자명', // 최초 로그인 시만
    deviceName: '디바이스명',
    deviceType: 'iOS' | 'Android',
  });
}
\`\`\`

### Step 3: ID Token 검증 (백엔드)
\`\`\`
클라이언트로부터 받은 idToken:
├─ JWT 서명 검증 (Google 공개 키로)
├─ aud 클레임 검증 (클라이언트 ID 일치)
├─ iss 클레임 검증 (https://accounts.google.com)
├─ exp 검증 (만료 시간 확인)
└─ sub 추출 (Google 사용자 ID)
\`\`\`

### Step 4: 사용자 정보 저장 및 토큰 발급 (백엔드)
\`\`\`
ID Token 검증 성공
├─ 기존 사용자 확인 (sub로)
├─ 없으면 신규 생성 (이메일은 필수)
├─ 디바이스 정보 저장
└─ Access Token + Refresh Token 발급
\`\`\`

---

## 📱 클라이언트 구현 예제

\`\`\`typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export const GoogleLoginScreen = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Google Cloud Console에서 생성한 Client IDs
    clientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',

    // OAuth 2.0 설정
    scopes: ['profile', 'email'],
    responseType: ResponseType.IdToken,
    usePKCE: true, // PKCE 사용 권장
  });

  const handleGoogleLogin = async () => {
    try {
      // Step 1: 인증 프롬프트 표시
      const result = await promptAsync();

      if (result?.type !== 'success') {
        console.log('Google 로그인 취소됨');
        return;
      }

      // Step 2: ID Token 추출
      const { id_token: idToken } = result.params;
      if (!idToken) {
        throw new Error('ID Token을 받지 못했습니다');
      }

      // Step 3: 백엔드로 전송
      const response = await api.post('/auth/google/callback', {
        idToken,
        userName: 'User Display Name', // 최초 로그인 시 권장
        deviceName: 'My Device',
        deviceType: Platform.os === 'ios' ? 'iOS' : 'Android',
      });

      // Step 4: 토큰 저장 및 로그인 완료
      if (response.data.success) {
        await secureStorage.setItem('accessToken', response.data.data.accessToken);
        await secureStorage.setItem('refreshToken', response.data.data.refreshToken);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    } catch (error) {
      console.error('Google 로그인 실패:', error.message);
      // 에러 처리
    }
  };

  return (
    <Button
      title="Google로 로그인"
      onPress={handleGoogleLogin}
      disabled={!request}
    />
  );
};
\`\`\`

---

## 🔐 ID Token JWT 형식

Google의 ID Token은 다음과 같은 클레임을 포함합니다:

\`\`\`json
{
  "iss": "https://accounts.google.com",
  "aud": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "sub": "110123456789...",
  "email": "user@gmail.com",
  "email_verified": true,
  "name": "User Name",
  "picture": "https://...",
  "given_name": "User",
  "family_name": "Name",
  "iat": 1704067200,
  "exp": 1704070800,
  "nonce": "random-string"
}
\`\`\`

### 핵심 클레임 검증

| 클레임 | 검증 방법 | 필수 |
|--------|----------|:----:|
| \`iss\` | \`=== "https://accounts.google.com"\` | ✅ |
| \`aud\` | \`=== 클라이언트 ID\` | ✅ |
| \`sub\` | Google 사용자 ID (고유값 보관) | ✅ |
| \`exp\` | 현재 시각 < exp | ✅ |
| \`email\` | 선택적 사용자 이메일 | ❌ |
| \`nonce\` | PKCE 사용 시 검증 | ⚠️ |

---

## 📝 API 스펙

### 요청 (Request)
\`\`\`json
POST /auth/google/callback
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
  "userName": "사용자 이름",
  "deviceName": "iPhone 15",
  "deviceType": "iOS"
}
\`\`\`

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|:----:|------|------|
| \`idToken\` | string | ✅ | Google ID Token (JWT) | \`eyJhbGciOi...\` |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인) | \`John Doe\` |
| \`deviceName\` | string | ❌ | 디바이스 이름 | \`iPhone 15 Pro\` |
| \`deviceType\` | string | ❌ | 디바이스 유형 | \`iOS\`, \`Android\` |

### 응답 (Response) - 성공 (200 OK)
\`\`\`json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@gmail.com",
      "nickname": "사용자",
      "profileImage": "https://..."
    }
  },
  "timestamp": 1704067200000
}
\`\`\`

### 응답 (Response) - 실패 (401 Unauthorized)
\`\`\`json
{
  "success": false,
  "error": {
    "code": "SOCIAL_0202",
    "message": "소셜 인증 토큰이 유효하지 않습니다.",
    "details": {
      "reason": "Invalid token",
      "hint": "토큰이 유효하지 않거나 만료되었습니다"
    }
  },
  "timestamp": 1704067200000
}
\`\`\`

---

## 🎯 백엔드 검증 프로세스

\`\`\`typescript
// 1. ID Token 검증 (GoogleAuth 라이브러리 사용)
const ticket = await client.verifyIdToken({
  idToken,
  audience: clientIds, // 설정된 모든 Client ID
});

const payload = ticket.getPayload();

// 2. 필수 클레임 검증
if (!payload.email) {
  throw new BadRequestException('Email 정보가 없습니다');
}

// 3. Google 사용자 ID 추출
const googleId = payload.sub;
const email = payload.email;

// 4. 사용자 찾기 또는 생성
let user = await userService.findByGoogleId(googleId);
if (!user) {
  user = await userService.create({
    email,
    googleId,
    nickname: payload.name,
    profileImage: payload.picture,
  });
}

// 5. 토큰 발급
const tokens = await authService.generateTokens(user.id);
return { accessToken: tokens.access, refreshToken: tokens.refresh };
\`\`\`

---

## ⚠️ Google 특화 주의사항

### 1️⃣ **클라이언트 ID 관리**
- **웹 클라이언트 ID**: 프론트엔드 환경 변수에 저장
- **iOS/Android 클라이언트 ID**: 앱 설정에 포함
- 각 플랫폼별 ID가 다르므로 정확히 구분

\`\`\`typescript
// ❌ 잘못된 예
const clientId = 'MY_WEB_CLIENT_ID'; // 모든 플랫폼에 동일

// ✅ 올바른 예
const clientId = {
  web: 'WEB_CLIENT_ID.apps.googleusercontent.com',
  ios: 'IOS_CLIENT_ID.apps.googleusercontent.com',
  android: 'ANDROID_CLIENT_ID.apps.googleusercontent.com',
};
\`\`\`

### 2️⃣ **ID Token만 사용**
- Access Token을 받으면 서버에서 **절대 노출하지 말 것**
- ID Token만 검증하여 사용자 신원 확인
- Access Token은 클라이언트에서만 Google API 호출 시 사용

### 3️⃣ **PKCE 권장 (선택사항)**
- \`usePKCE: true\`로 설정하면 추가 보안 제공
- Code challenge/verifier 자동 생성
- Nonce 값도 함께 검증

### 4️⃣ **만료 토큰 처리**
- ID Token은 1시간 유효
- 클라이언트에서 만료 후 재인증 필요
- 백엔드에서는 \`exp\` 클레임으로 검증

### 5️⃣ **이메일 선택사항 처리**
- Google 계정의 이메일이 공개되지 않을 수 있음
- 최초 로그인 시 사용자로부터 이메일 입력 받기
- 또는 Google+ API로 사용자 정보 추가 요청

---

## 🔍 에러 처리

| 에러 코드 | HTTP | 상황 | 클라이언트 액션 |
|---------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 소셜 인증 토큰이 유효하지 않습니다 | 재로그인 유도 |
| \`SOCIAL_0203\` | 401 | 소셜 인증 토큰이 만료되었습니다 | 재로그인 유도 |
| \`USER_0601\` | 409 | 이미 가입된 이메일 | 로그인 화면 이동 |

---

## 📊 전체 흐름도

\`\`\`
┌─────────────┐                    ┌──────────────────┐
│   클라이언트    │                    │   Google 서버      │
└──────┬──────┘                    └────────┬─────────┘
       │                                   │
       │  1. Google.useAuthRequest()       │
       │─────────────────────────────────> │
       │                                   │
       │<──────────────────────────────────│
       │  2. 시스템 브라우저 인증 UI 표시  │
       │                                   │
       │  (사용자 Google 로그인)            │
       │                                   │
       │<──────────────────────────────────│
       │  3. ID Token + 사용자 정보       │
       │                                   │
       ├──────────────────────────────────┐│
       │  4. ID Token 추출                ││
       │     + 디바이스 정보               ││
       └──────────────────────────────────┘│
                                           │
       ┌───────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  Aido 백엔드      │
└────────┬─────────┘
         │
         ├─ 1. ID Token 검증
         │    └─ JWT 서명 검증 (Google 공개 키)
         │    └─ aud, iss, exp 클레임 검증
         │
         ├─ 2. Google 사용자 ID (sub) 추출
         │
         ├─ 3. 기존 사용자 조회 또는 신규 생성
         │
         ├─ 4. 디바이스 정보 저장
         │
         └─ 5. 토큰 발급 및 응답
                └─ Access Token
                └─ Refresh Token
                └─ 사용자 정보
\`\`\`

---

## ✅ 개발자 체크리스트

- [ ] Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
- [ ] iOS Bundle ID / Android Package Name 등록
- [ ] 각 플랫폼별 Client ID 환경 변수 설정
- [ ] expo-auth-session 라이브러리 설치 및 설정
- [ ] Google.useAuthRequest() 구현
- [ ] ID Token 추출 및 백엔드로 전송
- [ ] 백엔드 token 검증 로직 구현 (GoogleAuth 라이브러리)
- [ ] 에러 처리 (SOCIAL_0202, SOCIAL_0203) 구현
- [ ] 테스트 디바이스에서 전체 로그인 플로우 검증
- [ ] Swagger 문서에서 요청/응답 형식 확인`,
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
		summary: "Kakao OAuth 시작 (웹 브라우저 기반)",
		operationId: "kakaoOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 카카오 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /kakao/start\` → 카카오 로그인 → \`GET /kakao/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\``,
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
	async kakaoOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		// state가 없으면 서버에서 자동 생성
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateKakaoAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("kakao/web-callback")
	@Public()
	@ApiDoc({
		summary: "Kakao OAuth 콜백 (웹 브라우저 기반)",
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

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Google 웹 OAuth (웹 브라우저 기반)
	// ============================================

	@Get("google/start")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 시작 (웹 브라우저 기반)",
		operationId: "googleOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 구글 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /google/start\` → 구글 로그인 → \`GET /google/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\``,
	})
	async googleOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateGoogleAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("google/web-callback")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 콜백 (웹 브라우저 기반)",
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

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Naver 웹 OAuth (웹 브라우저 기반)
	// ============================================

	@Get("naver/start")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 시작 (웹 브라우저 기반)",
		operationId: "naverOAuthStart",
		description: `\`expo-web-browser\`로 브라우저를 열어 네이버 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /naver/start\` → 네이버 로그인 → \`GET /naver/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

📝 **쿼리 파라미터**
| 파라미터 | 필수 | 설명 |
|----------|:----:|------|
| \`state\` | ✅ | CSRF 방지용 랜덤 문자열 |
| \`redirect_uri\` | ❌ | 콜백 URI (기본: \`aido://auth/callback\`) |

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\``,
	})
	async naverOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateNaverAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("naver/web-callback")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 콜백 (웹 브라우저 기반)",
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

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Kakao 모바일 OAuth (기존 토큰 기반)
	// ============================================

	@Post("kakao/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Kakao 로그인 콜백 (모바일)",
		operationId: "kakaoMobileCallback",
		description: `
## 🟡 Kakao 소셜 로그인 (Expo 모바일 앱용)

Expo 앱에서 \`expo-auth-session\`을 사용하여 Kakao OAuth 인증 완료 후,
사용자 프로필 정보를 전송하는 엔드포인트입니다.

---

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 🔐 각 라이브러리가 필요한 이유

#### 1. expo-crypto - PKCE 및 CSRF 보안
**왜 필요한가?**
- **PKCE (Proof Key for Code Exchange)**: 모바일 앱에서 Authorization Code가 탈취되어도 토큰 교환 불가
- **state 파라미터**: CSRF(Cross-Site Request Forgery) 공격 방지
- 암호학적으로 안전한 난수 생성으로 예측 불가능한 값 보장

**보안적 이점:**
| 공격 유형 | expo-crypto 없이 | expo-crypto 사용 시 |
|----------|-----------------|-------------------|
| Code 가로채기 | ❌ 악성 앱이 code 탈취 후 토큰 획득 | ✅ code_verifier 없이는 토큰 교환 불가 |
| CSRF 공격 | ❌ 공격자가 악의적 OAuth 요청 주입 | ✅ state 불일치로 즉시 거부 |
| 세션 고정 | ❌ 공격자 세션으로 사용자 연결 가능 | ✅ 랜덤 state로 세션 고정 불가 |

\`\`\`typescript
import * as Crypto from 'expo-crypto';
const state = Crypto.randomUUID(); // CSRF 토큰 - 콜백에서 반드시 검증
const codeVerifier = Crypto.randomUUID(); // PKCE용 - 토큰 교환 시 필요
\`\`\`

#### 2. expo-linking - 딥링크 및 콜백 URL 처리
**왜 필요한가?**
- Kakao OAuth 콜백 URL을 네이티브 앱으로 정확히 라우팅
- Custom URL Scheme 생성 및 파싱 (\`aido://auth/kakao/callback\`)
- Universal Links(iOS) / App Links(Android) 지원

**보안적 이점:**
| 기능 | 설명 |
|------|------|
| 정확한 앱 라우팅 | Kakao 인증 완료 후 정확한 앱으로만 콜백 전달 |
| URL 파싱 | code, state 파라미터를 안전하게 추출하여 검증 |
| 토큰 보호 | Access Token이 URL에 직접 노출되지 않음 (code 교환 방식) |

\`\`\`typescript
import * as Linking from 'expo-linking';
const returnUrl = Linking.createURL('auth/kakao/callback', { scheme: 'aido' });
// 결과: aido://auth/kakao/callback

// 콜백 URL에서 code와 state 추출
const parsed = Linking.parse(callbackUrl);
const { code, state: returnedState } = parsed.queryParams;
// state 검증 후 code로 토큰 교환
\`\`\`

#### 3. expo-web-browser - 보안 OAuth 브라우저 세션
**왜 필요한가?**
- **RFC 8252 준수**: 네이티브 앱에서는 시스템 브라우저 사용 권장
- 카카오 계정 로그인을 안전한 환경에서 진행
- 기존 카카오 로그인 세션 재사용으로 UX 향상

**WebView vs 시스템 브라우저 비교:**
| 항목 | 인앱 WebView | expo-web-browser |
|------|-------------|-----------------|
| 자격증명 접근 | ❌ 앱이 카카오 비밀번호 가로채기 가능 | ✅ 시스템이 보호 |
| 피싱 방지 | ❌ 가짜 카카오 로그인 UI 표시 가능 | ✅ 진짜 카카오 도메인 주소창 표시 |
| 세션 재사용 | ❌ 매번 카카오 로그인 필요 | ✅ 기존 카카오 로그인 세션 활용 |
| 카카오톡 연동 | ❌ 지원 불가 | ✅ 카카오톡 앱 인증 가능 |

\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 앱 시작 시 호출 - 딥링크로 돌아왔을 때 세션 정리
WebBrowser.maybeCompleteAuthSession();

// Kakao OAuth 브라우저 열기
const result = await WebBrowser.openAuthSessionAsync(kakaoAuthUrl, returnUrl);
\`\`\`

### 🔒 서버 측 Access Token 검증이 필요한 이유

**왜 클라이언트가 보낸 profile을 그대로 신뢰하지 않는가?**

서버에서는 클라이언트가 보낸 Access Token으로 Kakao API(\`/v2/user/me\`)를 **직접 호출**하여 검증합니다.

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 프로필 위조 | ❌ 타인의 카카오 ID로 사칭 가능 | ✅ Kakao API가 실제 토큰 소유자 반환 |
| 토큰 위조 | ❌ 가짜 토큰으로 로그인 시도 | ✅ Kakao API 호출 실패로 탐지 |
| 만료된 토큰 | ❌ 이전에 탈취한 토큰 재사용 | ✅ Kakao가 만료 토큰 거부 |
| 권한 확인 | ❌ 동의하지 않은 정보 조작 | ✅ Kakao가 실제 동의 범위 반환 |

**서버 검증 방식:**
\`\`\`typescript
// 서버에서 Access Token으로 Kakao API 직접 호출
const userInfo = await axios.get('https://kapi.kakao.com/v2/user/me', {
  headers: { Authorization: \`Bearer \${accessToken}\` }
});
// Kakao가 반환한 정보만 신뢰하여 사용자 생성/로그인 처리
\`\`\`

---

### 🔧 Kakao Developers 설정
1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션 생성
2. **앱 키** 발급 (REST API 키 사용)
3. **플랫폼** 등록:
   - **iOS**: 번들 ID 등록
   - **Android**: 패키지명 + 키 해시 등록
4. **카카오 로그인** 활성화
5. **Redirect URI** 등록: \`https://auth.expo.io/@username/appname\`
6. **동의 항목** 설정:
   - 닉네임 (필수)
   - 프로필 사진 (선택)
   - 이메일 (선택 - 사용자 동의 필요)

---

### 🌐 호출해야 하는 API 목록

| 단계 | API | 메서드 | 설명 |
|------|-----|--------|------|
| 1 | \`https://kauth.kakao.com/oauth/authorize\` | GET | 사용자 인증 페이지 (expo-auth-session이 처리) |
| 2 | \`https://kauth.kakao.com/oauth/token\` | POST | Access Token 교환 (expo-auth-session이 처리) |
| 3 | \`https://kapi.kakao.com/v2/user/me\` | GET | 사용자 정보 조회 (**직접 호출**) |
| 4 | \`POST /v1/auth/kakao/callback\` | POST | 백엔드로 프로필 전송 (**직접 호출**) |

---

### 📋 Step 1-2: OAuth 인증 (expo-auth-session 처리)

Kakao는 \`expo-auth-session\`의 기본 provider가 없으므로 **수동 설정**이 필요합니다.

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = 'YOUR_KAKAO_REST_API_KEY';

// Kakao OAuth Discovery 문서
const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // app.json의 scheme과 일치
});

// Step 1: Authorization Code 요청
const authRequest = new AuthSession.AuthRequest({
  clientId: KAKAO_REST_API_KEY,
  scopes: ['profile_nickname', 'profile_image', 'account_email'],
  redirectUri,
});

const authResult = await authRequest.promptAsync(discovery);
// authResult.type === 'success' 시 authResult.params.code 획득

// Step 2: Access Token 교환
const tokenResult = await AuthSession.exchangeCodeAsync(
  {
    clientId: KAKAO_REST_API_KEY,
    code: authResult.params.code,
    redirectUri,
  },
  discovery
);
// tokenResult.accessToken 획득
\`\`\`

---

### 📋 Step 3: 사용자 정보 조회 API

**엔드포인트**: \`GET https://kapi.kakao.com/v2/user/me\`

**요청 헤더**:
\`\`\`
Authorization: Bearer {accessToken}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "id": 1234567890,
  "connected_at": "2024-01-15T10:30:00Z",
  "kakao_account": {
    "profile_needs_agreement": false,
    "profile": {
      "nickname": "홍길동",
      "thumbnail_image_url": "https://k.kakaocdn.net/...",
      "profile_image_url": "https://k.kakaocdn.net/...",
      "is_default_image": false
    },
    "has_email": true,
    "email_needs_agreement": false,
    "is_email_valid": true,
    "is_email_verified": true,
    "email": "user@example.com"
  }
}
\`\`\`

**응답 필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | number | Kakao 고유 사용자 ID (숫자) |
| \`kakao_account.email\` | string | 이메일 주소 (동의 시에만) |
| \`kakao_account.is_email_verified\` | boolean | 이메일 인증 여부 |
| \`kakao_account.profile.nickname\` | string | 카카오 닉네임 |
| \`kakao_account.profile.profile_image_url\` | string | 프로필 사진 URL (원본) |
| \`kakao_account.profile.thumbnail_image_url\` | string | 프로필 사진 URL (썸네일) |

---

### 📋 Step 4: 백엔드 API 호출

**엔드포인트**: \`POST /v1/auth/kakao/callback\`

**요청 헤더**:
\`\`\`
Content-Type: application/json
\`\`\`

**요청 바디**:
\`\`\`json
{
  "profile": {
    "id": "1234567890",
    "email": "user@example.com",
    "emailVerified": true,
    "name": "홍길동",
    "picture": "https://k.kakaocdn.net/..."
  }
}
\`\`\`

**⚠️ 주의**: \`id\`는 **문자열**로 변환해서 전송해야 합니다 (\`String(userInfo.id)\`)

**응답 예시**:
\`\`\`json
{
  "userId": "clx123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "name": "홍길동",
  "profileImage": "https://k.kakaocdn.net/..."
}
\`\`\`

---

### 🔄 전체 구현 예시

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = 'YOUR_KAKAO_REST_API_KEY';

const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export const useKakaoLogin = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'your-app-scheme',
  });

  const handleKakaoLogin = async () => {
    try {
      // Step 1: Authorization Code 요청
      const authRequest = new AuthSession.AuthRequest({
        clientId: KAKAO_REST_API_KEY,
        scopes: ['profile_nickname', 'profile_image', 'account_email'],
        redirectUri,
      });

      const authResult = await authRequest.promptAsync(discovery);

      if (authResult.type !== 'success') {
        throw new Error('Kakao OAuth cancelled or failed');
      }

      // Step 2: Access Token 교환
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: KAKAO_REST_API_KEY,
          code: authResult.params.code,
          redirectUri,
        },
        discovery
      );

      // Step 3: Kakao API로 사용자 정보 조회
      const userInfoResponse = await fetch(
        'https://kapi.kakao.com/v2/user/me',
        {
          headers: { Authorization: \`Bearer \${tokenResult.accessToken}\` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Kakao user info');
      }

      const userInfo = await userInfoResponse.json();
      const kakaoAccount = userInfo.kakao_account;

      // Step 4: 백엔드로 프로필 전송
      const backendResponse = await fetch(
        'https://your-api.com/v1/auth/kakao/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              id: String(userInfo.id), // 숫자를 문자열로 변환!
              email: kakaoAccount?.email,
              emailVerified: kakaoAccount?.is_email_verified ?? false,
              name: kakaoAccount?.profile?.nickname,
              picture: kakaoAccount?.profile?.profile_image_url,
            },
          }),
        }
      );

      if (!backendResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const { accessToken: jwtAccessToken, refreshToken } =
        await backendResponse.json();

      // 토큰 저장 (SecureStore 권장)
      await SecureStore.setItemAsync('accessToken', jwtAccessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error };
    }
  };

  return { handleKakaoLogin };
};
\`\`\`

---

### 🔄 인증 플로우 다이어그램
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │    Kakao    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ [Step 1] promptAsync()                  │
       │ (kauth.kakao.com/oauth/authorize)       │
       │───────────────────▶│                    │
       │                    │                    │
       │ [Step 2] exchangeCodeAsync()            │
       │ (kauth.kakao.com/oauth/token)           │
       │───────────────────▶│                    │
       │                    │                    │
       │ accessToken        │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 3] GET /v2/user/me                │
       │ (kapi.kakao.com)   │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │ userInfo (JSON)    │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 4] POST /v1/auth/kakao/callback   │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

---

### 📝 백엔드 요청 데이터 상세
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Kakao 고유 사용자 ID (**문자열로 변환**) |
| \`profile.email\` | string | ❌ | 이메일 (사용자 동의 시에만) |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 (기본: false) |
| \`profile.name\` | string | ❌ | 카카오 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### 🔒 권한 범위 (Scopes)
- \`profile_nickname\`: 닉네임 (필수)
- \`profile_image\`: 프로필 사진 (선택)
- \`account_email\`: 이메일 주소 (사용자 동의 필요)

### ⚠️ Kakao OAuth 주의사항
- **이메일**: 사용자가 동의해야만 제공됨 (필수 아님)
- **ID 타입**: Kakao API는 숫자로 반환하지만, 백엔드에는 문자열로 전송
- **Redirect URI**: Kakao Developers에서 등록한 URI와 정확히 일치해야 함
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
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Naver 로그인 콜백 (모바일)",
		operationId: "naverMobileCallback",
		description: `
## 🟢 Naver 소셜 로그인 (Expo 모바일 앱용)

Expo 앱에서 \`expo-auth-session\`을 사용하여 Naver OAuth 인증 완료 후,
사용자 프로필 정보를 전송하는 엔드포인트입니다.

---

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 🔐 각 라이브러리가 필요한 이유

#### 1. expo-crypto - PKCE 및 CSRF 보안
**왜 필요한가?**
- **state 파라미터 생성**: CSRF(Cross-Site Request Forgery) 공격 방지의 핵심
- 암호학적으로 안전한 난수 생성 (\`randomUUID()\`)
- 예측 불가능한 값으로 세션 고정 공격 방지

**보안적 이점:**
| 공격 유형 | expo-crypto 없이 | expo-crypto 사용 시 |
|----------|-----------------|-------------------|
| CSRF 공격 | ❌ 공격자가 악의적 OAuth 요청 주입 가능 | ✅ 랜덤 state 불일치로 즉시 거부 |
| 세션 고정 | ❌ 공격자 세션으로 사용자 연결 가능 | ✅ 예측 불가능한 state로 방지 |
| 리플레이 공격 | ❌ 이전 인증 요청 재사용 가능 | ✅ 일회성 state로 재사용 방지 |

\`\`\`typescript
import * as Crypto from 'expo-crypto';
// CSRF 방지 토큰 - 콜백에서 반드시 검증 필요!
const state = Crypto.randomUUID();
// 저장 후, 콜백에서 returnedState === state 검증
\`\`\`

#### 2. expo-linking - 딥링크 및 콜백 URL 처리
**왜 필요한가?**
- Naver OAuth 콜백 URL을 네이티브 앱으로 정확히 라우팅
- Custom URL Scheme 생성 및 파싱 (\`aido://auth/naver/callback\`)
- Universal Links(iOS) / App Links(Android) 지원

**보안적 이점:**
| 기능 | 설명 |
|------|------|
| 정확한 앱 라우팅 | Naver 인증 완료 후 정확한 앱으로만 콜백 전달 |
| URL 파싱 | code, state, error 파라미터를 안전하게 추출 |
| state 검증 | 저장된 state와 반환된 state 비교로 CSRF 방지 |

\`\`\`typescript
import * as Linking from 'expo-linking';
const returnUrl = Linking.createURL('auth/naver/callback', { scheme: 'aido' });
// 결과: aido://auth/naver/callback

// 콜백 URL에서 code와 state 추출
const parsed = Linking.parse(callbackUrl);
const { code, state: returnedState, error } = parsed.queryParams;

// 필수! state 검증
if (returnedState !== savedState) {
  throw new Error('CSRF attack detected!');
}
\`\`\`

#### 3. expo-web-browser - 보안 OAuth 브라우저 세션
**왜 필요한가?**
- **RFC 8252 준수**: 네이티브 앱에서는 시스템 브라우저 사용 권장
- 네이버 계정 로그인을 안전한 환경에서 진행
- 기존 네이버 로그인 세션 재사용으로 UX 향상

**WebView vs 시스템 브라우저 비교:**
| 항목 | 인앱 WebView | expo-web-browser |
|------|-------------|-----------------|
| 자격증명 접근 | ❌ 앱이 네이버 비밀번호 가로채기 가능 | ✅ 시스템이 보호 |
| 피싱 방지 | ❌ 가짜 네이버 로그인 UI 표시 가능 | ✅ 진짜 nid.naver.com 주소창 표시 |
| 세션 재사용 | ❌ 매번 네이버 로그인 필요 | ✅ 기존 네이버 로그인 세션 활용 |
| 2단계 인증 | ❌ 지원 불안정 | ✅ 네이버 앱 OTP 연동 가능 |

\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 앱 시작 시 호출 - 딥링크로 돌아왔을 때 세션 정리
WebBrowser.maybeCompleteAuthSession();

// Naver OAuth 브라우저 열기
const result = await WebBrowser.openAuthSessionAsync(naverAuthUrl, returnUrl);
\`\`\`

### 🔒 서버 측 검증 및 client_secret 보호가 필요한 이유

**Naver OAuth의 특수성: client_secret 필요**

Naver는 토큰 교환 시 \`client_secret\`이 필수입니다. 이 비밀키는 **절대로 클라이언트에 저장하면 안 됩니다**.

| 위치 | client_secret 노출 시 위험 |
|------|--------------------------|
| 모바일 앱 | ❌ 앱 디컴파일로 탈취 → 다른 앱이 우리 앱 사칭 가능 |
| 서버 | ✅ 환경변수로 안전하게 관리, 외부 접근 불가 |

**왜 클라이언트가 보낸 profile을 그대로 신뢰하지 않는가?**

서버에서는 클라이언트가 보낸 Access Token으로 Naver API(\`/v1/nid/me\`)를 **직접 호출**하여 검증합니다.

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 프로필 위조 | ❌ 타인의 네이버 ID로 사칭 가능 | ✅ Naver API가 실제 토큰 소유자 반환 |
| 토큰 위조 | ❌ 가짜 토큰으로 로그인 시도 | ✅ Naver API 호출 실패로 탐지 |
| 만료된 토큰 | ❌ 이전에 탈취한 토큰 재사용 | ✅ Naver가 만료 토큰 거부 |
| 권한 확인 | ❌ 동의하지 않은 정보 조작 | ✅ Naver가 실제 동의 범위 반환 |

**서버 검증 방식:**
\`\`\`typescript
// 서버에서 Access Token으로 Naver API 직접 호출
const userInfo = await axios.get('https://openapi.naver.com/v1/nid/me', {
  headers: { Authorization: \`Bearer \${accessToken}\` }
});
// Naver가 반환한 response.id, response.email 등만 신뢰
\`\`\`

---

### 🔧 Naver Developers 설정
1. [Naver Developers](https://developers.naver.com)에서 애플리케이션 등록
2. **사용 API**: 네이버 로그인 선택
3. **서비스 환경** 추가:
   - **iOS**: URL Scheme 등록 (예: \`naverlogin\`)
   - **Android**: 패키지명 + 다운로드 마켓 URL 등록
4. **Callback URL** 등록: \`https://auth.expo.io/@username/appname\`
5. **API 권한** 설정 (제공 정보 선택):
   - 회원이름 (필수)
   - 이메일 (필수)
   - 프로필 사진 (선택)
   - 닉네임 (선택)

---

### 🌐 호출해야 하는 API 목록

| 단계 | API | 메서드 | 설명 |
|------|-----|--------|------|
| 1 | \`https://nid.naver.com/oauth2.0/authorize\` | GET | 사용자 인증 페이지 (expo-auth-session이 처리) |
| 2 | \`https://nid.naver.com/oauth2.0/token\` | POST | Access Token 교환 (**직접 호출** - client_secret 필요) |
| 3 | \`https://openapi.naver.com/v1/nid/me\` | GET | 사용자 정보 조회 (**직접 호출**) |
| 4 | \`POST /v1/auth/naver/callback\` | POST | 백엔드로 프로필 전송 (**직접 호출**) |

---

### 📋 Step 1: Authorization Code 요청 (expo-auth-session 처리)

Naver는 \`expo-auth-session\`의 기본 provider가 없으므로 **수동 설정**이 필요합니다.

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';

// Naver OAuth Discovery 문서
const discovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // app.json의 scheme과 일치
});

// Authorization Code 요청
const authRequest = new AuthSession.AuthRequest({
  clientId: NAVER_CLIENT_ID,
  redirectUri,
  responseType: AuthSession.ResponseType.Code,
  state: 'random-state-string', // CSRF 방지용
});

const authResult = await authRequest.promptAsync(discovery);
// authResult.type === 'success' 시 authResult.params.code 획득
\`\`\`

---

### 📋 Step 2: Access Token 교환 API

**⚠️ 중요**: Naver는 \`client_secret\`이 필수입니다. expo-auth-session의 \`exchangeCodeAsync\`를 사용할 수 없으므로 **직접 호출**해야 합니다.

**엔드포인트**: \`POST https://nid.naver.com/oauth2.0/token\`

**요청 파라미터** (URL Query String):
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| \`grant_type\` | ✅ | \`authorization_code\` (고정값) |
| \`client_id\` | ✅ | 애플리케이션 Client ID |
| \`client_secret\` | ✅ | 애플리케이션 Client Secret |
| \`code\` | ✅ | Authorization Code (Step 1에서 획득) |
| \`state\` | ❌ | CSRF 검증용 state 값 |

**요청 예시**:
\`\`\`
POST https://nid.naver.com/oauth2.0/token
  ?grant_type=authorization_code
  &client_id=YOUR_CLIENT_ID
  &client_secret=YOUR_CLIENT_SECRET
  &code=AUTHORIZATION_CODE
  &state=RANDOM_STATE
\`\`\`

**응답 예시**:
\`\`\`json
{
  "access_token": "AAAAOLtP40eH...",
  "refresh_token": "c8ceMEJisO4Se7...",
  "token_type": "bearer",
  "expires_in": "3600"
}
\`\`\`

**응답 필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| \`access_token\` | string | 사용자 정보 조회용 Access Token |
| \`refresh_token\` | string | Access Token 갱신용 |
| \`token_type\` | string | 토큰 타입 (bearer) |
| \`expires_in\` | string | 만료 시간 (초) |

---

### 📋 Step 3: 사용자 정보 조회 API

**엔드포인트**: \`GET https://openapi.naver.com/v1/nid/me\`

**요청 헤더**:
\`\`\`
Authorization: Bearer {access_token}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "resultcode": "00",
  "message": "success",
  "response": {
    "id": "32742776",
    "nickname": "홍길동",
    "profile_image": "https://ssl.pstatic.net/static/pwe/address/img_profile.png",
    "email": "user@naver.com",
    "name": "홍길동",
    "birthday": "01-01",
    "birthyear": "1990",
    "gender": "M",
    "mobile": "010-1234-5678"
  }
}
\`\`\`

**응답 필드 설명** (\`response\` 객체 내부):
| 필드 | 타입 | 설명 | 동의 필요 |
|------|------|------|----------|
| \`id\` | string | 네이버 고유 사용자 ID | 필수 제공 |
| \`email\` | string | 이메일 주소 | 이메일 동의 |
| \`name\` | string | 사용자 실명 | 이름 동의 |
| \`nickname\` | string | 네이버 닉네임 | 닉네임 동의 |
| \`profile_image\` | string | 프로필 사진 URL | 프로필 사진 동의 |
| \`gender\` | string | 성별 (M/F) | 성별 동의 |
| \`birthday\` | string | 생일 (MM-DD) | 생일 동의 |
| \`birthyear\` | string | 출생연도 (YYYY) | 출생연도 동의 |
| \`mobile\` | string | 휴대전화 번호 | 휴대전화 동의 |

---

### 📋 Step 4: 백엔드 API 호출

**엔드포인트**: \`POST /v1/auth/naver/callback\`

**요청 헤더**:
\`\`\`
Content-Type: application/json
\`\`\`

**요청 바디**:
\`\`\`json
{
  "profile": {
    "id": "32742776",
    "email": "user@naver.com",
    "name": "홍길동",
    "picture": "https://ssl.pstatic.net/static/pwe/address/img_profile.png"
  }
}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "userId": "clx123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "name": "홍길동",
  "profileImage": "https://ssl.pstatic.net/static/pwe/address/img_profile.png"
}
\`\`\`

---

### 🔄 전체 구현 예시

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';
const NAVER_CLIENT_SECRET = 'YOUR_NAVER_CLIENT_SECRET'; // ⚠️ 보안 주의

const discovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
};

export const useNaverLogin = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'your-app-scheme',
  });

  const handleNaverLogin = async () => {
    try {
      // Step 1: Authorization Code 요청
      const state = Math.random().toString(36).substring(7);
      const authRequest = new AuthSession.AuthRequest({
        clientId: NAVER_CLIENT_ID,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        extraParams: { state },
      });

      const authResult = await authRequest.promptAsync(discovery);

      if (authResult.type !== 'success') {
        throw new Error('Naver OAuth cancelled or failed');
      }

      // Step 2: Access Token 교환 (직접 호출 - client_secret 필요)
      const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
      tokenUrl.searchParams.set('grant_type', 'authorization_code');
      tokenUrl.searchParams.set('client_id', NAVER_CLIENT_ID);
      tokenUrl.searchParams.set('client_secret', NAVER_CLIENT_SECRET);
      tokenUrl.searchParams.set('code', authResult.params.code);
      tokenUrl.searchParams.set('state', state);

      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Token exchange failed');
      }

      // Step 3: Naver API로 사용자 정보 조회
      const userInfoResponse = await fetch(
        'https://openapi.naver.com/v1/nid/me',
        {
          headers: { Authorization: \`Bearer \${tokenData.access_token}\` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Naver user info');
      }

      const userInfoResult = await userInfoResponse.json();

      if (userInfoResult.resultcode !== '00') {
        throw new Error(userInfoResult.message || 'Failed to get user info');
      }

      const naverProfile = userInfoResult.response;

      // Step 4: 백엔드로 프로필 전송
      const backendResponse = await fetch(
        'https://your-api.com/v1/auth/naver/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              id: naverProfile.id,
              email: naverProfile.email,
              name: naverProfile.name || naverProfile.nickname,
              picture: naverProfile.profile_image,
            },
          }),
        }
      );

      if (!backendResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const { accessToken: jwtAccessToken, refreshToken } =
        await backendResponse.json();

      // 토큰 저장 (SecureStore 권장)
      await SecureStore.setItemAsync('accessToken', jwtAccessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Naver login error:', error);
      return { success: false, error };
    }
  };

  return { handleNaverLogin };
};
\`\`\`

---

### 🔄 인증 플로우 다이어그램
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │    Naver    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ [Step 1] promptAsync()                  │
       │ (nid.naver.com/oauth2.0/authorize)      │
       │───────────────────▶│                    │
       │                    │                    │
       │ code + state       │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 2] POST /oauth2.0/token           │
       │ (nid.naver.com - client_secret 포함)    │
       │───────────────────▶│                    │
       │                    │                    │
       │ access_token       │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 3] GET /v1/nid/me                 │
       │ (openapi.naver.com)│                    │
       │───────────────────▶│                    │
       │                    │                    │
       │ userInfo (JSON)    │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 4] POST /v1/auth/naver/callback   │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

---

### 📝 백엔드 요청 데이터 상세
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Naver 고유 사용자 ID |
| \`profile.email\` | string | ❌ | 이메일 주소 (사용자 동의 시) |
| \`profile.name\` | string | ❌ | 이름 또는 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### 🔒 API 권한 (제공 정보 선택)
- **회원이름** (이름): 사용자 실명
- **이메일**: 네이버 이메일 주소
- **프로필 사진**: 프로필 이미지 URL
- **닉네임**: 네이버 닉네임 (이름 대신 사용 가능)

### ⚠️ Naver OAuth 주의사항
- **client_secret 필수**: 토큰 교환 시 반드시 필요 (Kakao, Google과 다름)
- **보안**: client_secret을 앱에 직접 넣으면 보안 위험 → 프록시 서버 사용 권장
- **state 파라미터**: CSRF 공격 방지용으로 권장
- **Redirect URI**: Naver Developers에 등록한 Callback URL과 정확히 일치해야 함
- **동의 항목**: 사용자가 거부하면 해당 정보는 null로 반환됨
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
		summary: "소셜 계정 연동",
		operationId: "linkSocialAccount",
		description: `
## 🔗 소셜 계정 연동

로그인된 사용자 계정에 소셜 계정을 추가로 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 방법
- **Apple/Google**: idToken 제공
- **Kakao/Naver**: accessToken 제공

### ⚠️ 주의사항
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다
- 동일한 소셜 계정을 중복 연동하면 "이미 연결된 계정입니다" 메시지를 반환합니다
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.APPLE_0355 })
	async linkSocialAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: LinkSocialAccountDto,
	) {
		return this.oauthService.linkSocialAccountWithToken(user.userId, dto);
	}

	@Get("linked-accounts")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "연결된 소셜 계정 목록",
		operationId: "getLinkedAccounts",
		description: `
## 🔗 연결된 소셜 계정 조회

현재 사용자에 연결된 소셜 계정 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터
- \`provider\`: 소셜 제공자 (APPLE, GOOGLE, KAKAO 등)
- \`linkedAt\`: 연결 일시
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
- 마지막 로그인 수단은 해제할 수 없습니다
- 비밀번호 또는 다른 소셜 계정이 있어야 해제 가능
		`,
	})
	@ApiParam({
		name: "provider",
		description: "소셜 로그인 제공자",
		enum: ["APPLE", "GOOGLE", "KAKAO", "NAVER"],
		example: "GOOGLE",
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0610 })
	async unlinkAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Param("provider") provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
	) {
		return this.oauthService.unlinkAccount(user.userId, provider);
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
