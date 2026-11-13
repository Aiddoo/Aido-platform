import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { ErrorCode } from "@aido/api/errors";
import { Header, Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from "@nestjs/common";
import { ApiHeader, ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "#api/modules/identity/auth/presentation/http/decorators/current-user.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/auth/presentation/http/decorators/request-source.decorator";
import { toRequestMetadata } from "#api/modules/identity/auth/presentation/http/v1/auth-request.mapper";
import { AuthMapper } from "#api/modules/identity/auth/presentation/http/v1/auth-response.mapper";
import { AUTH_THROTTLE } from "#api/modules/identity/auth/presentation/http/v1/auth-throttle.constants";
import {
  CurrentUserDto,
  DeleteAccountDto,
  DeleteAccountResponseDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
} from "#api/modules/identity/auth/presentation/http/v1/auth.dto";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { DeleteAccountUseCase } from "../../../application/use-cases/delete-account.use-case.js";
import { GetCurrentUserUseCase } from "../../../application/use-cases/get-current-user.use-case.js";
import { UpdateProfileUseCase } from "../../../application/use-cases/update-profile.use-case.js";

// 출시 경로 /auth/me·/auth/profile·/auth/account를 그대로 두고 사용자 slice가 맡는다
@ApiTags(SWAGGER_TAGS.USER_AUTH)
@ApiBearerAuth()
@Controller("auth")
export class UserAccountController {
  readonly #getCurrentUserQuery: GetCurrentUserUseCase;
  readonly #updateProfileUseCase: UpdateProfileUseCase;
  readonly #deleteAccountUseCase: DeleteAccountUseCase;

  constructor(
    getCurrentUserQuery: GetCurrentUserUseCase,
    updateProfileUseCase: UpdateProfileUseCase,
    deleteAccountUseCase: DeleteAccountUseCase,
  ) {
    this.#getCurrentUserQuery = getCurrentUserQuery;
    this.#updateProfileUseCase = updateProfileUseCase;
    this.#deleteAccountUseCase = deleteAccountUseCase;
  }

  @Get("me")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
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
  async getMe(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone() timezone: string,
    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#getCurrentUserQuery.execute({
      userId: user.userId,
      sessionId: user.sessionId,
      timezone,
    });
    return AuthMapper.toCurrentUserResponse(result, appVersion);
  }

  @Patch("profile")
  @HttpCode(HttpStatus.OK)
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "프로필 수정",
    operationId: "updateProfile",
    description: `
## 👤 프로필 수정
이름/프로필 이미지를 수정합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body (최소 1개 필수)
- \`name\`: 이름 (1~20자, null=삭제)
- \`profileImage\`: 아이콘 키 또는 이미지 URL (500자 이내, null=삭제)
		`,
  })
  @ApiSuccessResponse({ type: UpdateProfileResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: UpdateProfileDto }) dto: UpdateProfileDto,

    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#updateProfileUseCase.execute({ ...dto, userId: user.userId });
    return AuthMapper.toUpdateProfileResponse(result, appVersion);
  }

  @Delete("account")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle({ default: AUTH_THROTTLE.DELETE_ACCOUNT })
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

### 🔄 계정 복구
30일 이내에 **동일 이메일/소셜 계정으로 재로그인**하면 자동 복구됩니다.
- 이메일 계정: \`POST /auth/login\`
- 소셜 계정: \`POST /auth/exchange\` (OAuth 플로우)
- 복구 시 응답에 \`accountRestored: true\` 포함

사용자마다 시간당 3회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.
		`,
  })
  @ApiSuccessResponse({ type: DeleteAccountResponseDto })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0612 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
  async deleteAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: DeleteAccountDto }) dto: DeleteAccountDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    return this.#deleteAccountUseCase.execute({
      userId: user.userId,
      password: dto.password,
      reason: dto.reason,
      metadata,
    });
  }
}
