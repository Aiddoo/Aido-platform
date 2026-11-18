import type { CurrentUserPayload } from "@aido/api/contracts/auth/v1";
import { ErrorCode } from "@aido/api/errors";
import type { SupportedLocale } from "@aido/api/vocabulary";
import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { ChangePasswordUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/change-password.use-case";
import { RequestPasswordResetUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/request-password-reset.use-case";
import { RequestPasswordSetupCodeUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/request-password-setup-code.use-case";
import { ResetPasswordUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/reset-password.use-case";
import { SetPasswordUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/set-password.use-case";
import { CurrentUser } from "#api/modules/identity/sessions/presentation/http/decorators/current-user.decorator";
import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { ResponseLocale } from "#api/platform/http/decorators/locale.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiErrorResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { MessageResponseDto } from "../../../../sessions/presentation/http/v1/login.dto.js";
import { toRequestMetadata } from "../../../../sessions/presentation/http/v1/request-metadata.mapper.js";
import { LinkedAccountsRateLimits } from "../linked-accounts.rate-limits.js";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SetPasswordDto,
} from "./linked-account.dto.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class PasswordController {
  readonly #requestPasswordResetUseCase: RequestPasswordResetUseCase;
  readonly #resetPasswordUseCase: ResetPasswordUseCase;
  readonly #requestPasswordSetupCodeUseCase: RequestPasswordSetupCodeUseCase;
  readonly #setPasswordUseCase: SetPasswordUseCase;
  readonly #changePasswordUseCase: ChangePasswordUseCase;

  constructor(
    requestPasswordResetUseCase: RequestPasswordResetUseCase,
    resetPasswordUseCase: ResetPasswordUseCase,
    requestPasswordSetupCodeUseCase: RequestPasswordSetupCodeUseCase,
    setPasswordUseCase: SetPasswordUseCase,
    changePasswordUseCase: ChangePasswordUseCase,
  ) {
    this.#requestPasswordResetUseCase = requestPasswordResetUseCase;
    this.#resetPasswordUseCase = resetPasswordUseCase;
    this.#requestPasswordSetupCodeUseCase = requestPasswordSetupCodeUseCase;
    this.#setPasswordUseCase = setPasswordUseCase;
    this.#changePasswordUseCase = changePasswordUseCase;
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(LinkedAccountsRateLimits.forgotPassword)
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
- IP당 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body({ schema: ForgotPasswordDto }) dto: ForgotPasswordDto,
    @CurrentRequestSource() source: RequestSource,
    @ResponseLocale() emailLocale: SupportedLocale,
  ) {
    const result = await this.#requestPasswordResetUseCase.execute({
      email: dto.email,
      metadata: toRequestMetadata(source),
      emailLocale,
    });
    return result;
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(LinkedAccountsRateLimits.resetPassword)
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
| VERIFY_0751 | 잘못되거나 만료·사용된 코드, 가입하지 않은 이메일 | 재입력 요청, 코드 재발송 안내 |
| VERIFY_0754 | 인증 시도 횟수 초과 | 코드 재발송 안내 |
| USER_0606 | 탈퇴한 계정 | 재가입 안내 |
| USER_0613 | 소셜 전용 계정 | "소셜 로그인을 이용해주세요" 안내 |

IP당 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.

### 🔒 보안
- 성공 시 모든 기존 세션이 무효화됩니다 (재로그인 필요)
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.VERIFY_0751, ErrorCode.VERIFY_0752])
  @ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0754 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0613 })
  async resetPassword(@Body({ schema: ResetPasswordDto }) dto: ResetPasswordDto) {
    const result = await this.#resetPasswordUseCase.execute({
      email: dto.email,
      code: dto.code,
      newPassword: dto.newPassword,
    });
    return result;
  }

  @Post("password/setup-code")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(LinkedAccountsRateLimits.requestPasswordSetupCode)
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
| VERIFY_0753 | 재발송 쿨다운 (1분). \`error.details.remainingSeconds\`(정수 1~60)에 남은 초 | 남은 초만큼 대기 안내 |

### 💡 참고
- 이미 비밀번호가 있는 사용자가 비밀번호를 **변경**하려면 → \`PATCH /auth/password\` (로그인 필요)
- 비밀번호를 잊어버렸다면 → \`POST /auth/forgot-password\` (로그인 불필요)
- 사용자마다 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0614 })
  @ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0753 })
  async requestPasswordSetupCode(
    @CurrentUser() user: CurrentUserPayload,
    @ResponseLocale() emailLocale: SupportedLocale,
  ) {
    return this.#requestPasswordSetupCodeUseCase.execute({ userId: user.userId, emailLocale });
  }

  @Post("password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(LinkedAccountsRateLimits.setPassword)
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
- 사용자마다 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.AUTH_0107, ErrorCode.VERIFY_0751])
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0614 })
  @ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0754 })
  async setPassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: SetPasswordDto }) dto: SetPasswordDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    return this.#setPasswordUseCase.execute({
      userId: user.userId,
      code: dto.code,
      newPassword: dto.newPassword,
      metadata,
    });
  }

  @Patch("password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(LinkedAccountsRateLimits.changePassword)
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
- 사용자마다 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.AUTH_0107, ErrorCode.USER_0602])
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0613 })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: ChangePasswordDto }) dto: ChangePasswordDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    const result = await this.#changePasswordUseCase.execute({
      userId: user.userId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      metadata,
      currentSessionId: user.sessionId,
    });
    return result;
  }
}
