import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import { ApiHeader, ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import { DeleteAccount } from "#api/modules/identity/auth/application/use-cases/delete-account.use-case";
import { GetCurrentUser } from "#api/modules/identity/auth/application/use-cases/get-current-user.use-case";
import { ListLinkedAccounts } from "#api/modules/identity/auth/application/use-cases/list-linked-accounts.use-case";
import { UnlinkOAuthAccount } from "#api/modules/identity/auth/application/use-cases/unlink-oauth-account.use-case";
import { UpdateProfile } from "#api/modules/identity/auth/application/use-cases/update-profile.use-case";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/auth/presentation/http/decorators/current-user.decorator";
import { AuthMapper } from "#api/modules/identity/auth/presentation/http/v1/auth-response.mapper";
import { Timezone } from "#api/platform/http/decorators/index";
import {
  AppVersion,
  CurrentRequestClient,
  type RequestClient,
} from "#api/platform/http/request-client/index";
import {
  ApiBadRequestError,
  ApiDoc,
  ApiErrorResponse,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";

import { DeleteAccountDto, UnlinkAccountDto, UpdateProfileDto } from "./auth-request.dto.js";
import { extractMetadata } from "./auth-request.mapper.js";
import {
  CurrentUserDto,
  DeleteAccountResponseDto,
  LinkedAccountsResponseDto,
  MessageResponseDto,
  UpdateProfileResponseDto,
} from "./auth-response.dto.js";
import { AUTH_THROTTLE } from "./auth-throttle.constants.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@ApiBearerAuth()
@Controller("auth")
export class AccountController {
  readonly #getCurrentUserQuery: GetCurrentUser;
  readonly #updateProfileUseCase: UpdateProfile;
  readonly #listLinkedAccountsQuery: ListLinkedAccounts;
  readonly #unlinkOAuthAccountUseCase: UnlinkOAuthAccount;
  readonly #deleteAccountUseCase: DeleteAccount;

  constructor(
    getCurrentUserQuery: GetCurrentUser,
    updateProfileUseCase: UpdateProfile,
    listLinkedAccountsQuery: ListLinkedAccounts,
    unlinkOAuthAccountUseCase: UnlinkOAuthAccount,
    deleteAccountUseCase: DeleteAccount,
  ) {
    this.#getCurrentUserQuery = getCurrentUserQuery;
    this.#updateProfileUseCase = updateProfileUseCase;
    this.#listLinkedAccountsQuery = listLinkedAccountsQuery;
    this.#unlinkOAuthAccountUseCase = unlinkOAuthAccountUseCase;
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

  @Get("linked-accounts")
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
| \`canUnlink\` | boolean | 소셜 계정 연결 해제 가능 여부 (계정이 2개 이상일 때 true) |

### 💡 응답 예시
\`\`\`json
{
  "accounts": [
    { "provider": "APPLE", "linked": false, "providerAccountId": null, "linkedAt": null },
    { "provider": "GOOGLE", "linked": true, "providerAccountId": "102938475647382910", "linkedAt": "2026-01-15T10:30:00.000Z" },
    { "provider": "KAKAO", "linked": true, "providerAccountId": "3456789012", "linkedAt": "2026-02-01T14:00:00.000Z" },
    { "provider": "NAVER", "linked": false, "providerAccountId": null, "linkedAt": null }
  ],
  "canUnlink": true
}
\`\`\`
		`,
  })
  @ApiSuccessResponse({ type: LinkedAccountsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getLinkedAccounts(@CurrentUser() user: CurrentUserPayload) {
    return this.#listLinkedAccountsQuery.execute({ userId: user.userId });
  }

  @Delete("linked-accounts/:provider")
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
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.USER_0610)
  @ApiNotFoundError(ErrorCode.USER_0603)
  async unlinkAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UnlinkAccountDto }) params: UnlinkAccountDto,
    @Req() req: Request,
    @CurrentRequestClient() client: RequestClient,
  ) {
    const metadata = extractMetadata(req, client);
    return this.#unlinkOAuthAccountUseCase.execute({
      userId: user.userId,
      provider: params.provider,
      metadata,
    });
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
    @Req() req: Request,
    @CurrentRequestClient() client: RequestClient,
  ) {
    const metadata = extractMetadata(req, client);
    return this.#deleteAccountUseCase.execute({
      userId: user.userId,
      password: dto.password,
      reason: dto.reason,
      metadata,
    });
  }
}
