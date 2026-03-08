import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import {
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { AuthMapper } from "../auth.mapper";
import { CurrentUser, type CurrentUserPayload, Public } from "../decorators";
import {
	AuthTokensDto,
	ChangePasswordDto,
	ForgotPasswordDto,
	LoginDto,
	MessageResponseDto,
	RefreshTokensDto,
	RegisterDto,
	ResendVerificationDto,
	ResetPasswordDto,
	SetPasswordDto,
	VerifyEmailDto,
} from "../dtos";
import { JwtRefreshGuard } from "../guards";
import { AuthService } from "../services/auth.service";
import { PasswordManagementService } from "../services/password-management.service";
import type { RefreshTokenPayload } from "../strategies/jwt-refresh.strategy";
import { extractMetadata } from "./auth-controller.utils";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller("auth")
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly passwordManagementService: PasswordManagementService,
	) {}

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
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0501 })
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
		const metadata = extractMetadata(req);
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

### 🔄 탈퇴 유예 계정 복구
탈퇴 후 **30일 이내**에 동일 이메일로 로그인하면 자동 복구됩니다.
- 응답의 \`accountRestored: true\`로 복구 여부 확인
- 클라이언트는 이 플래그를 확인하여 "계정이 복구되었습니다" 안내 표시
- 30일 경과 후에는 복구 불가 (USER_0606 에러)
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0607 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0608 })
	async login(@Body() dto: LoginDto, @Req() req: Request) {
		const metadata = extractMetadata(req);
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
		const metadata = extractMetadata(req);
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
		const result = await this.passwordManagementService.forgotPassword(
			dto.email,
		);
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
		const result = await this.passwordManagementService.resetPassword(
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
		return this.passwordManagementService.requestPasswordSetupCode(user.userId);
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
		const metadata = extractMetadata(req);
		return this.passwordManagementService.setPassword(
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
		const metadata = extractMetadata(req);
		const result = await this.passwordManagementService.changePassword(
			user.userId,
			dto.currentPassword,
			dto.newPassword,
			metadata,
			user.sessionId,
		);
		return result;
	}
}
