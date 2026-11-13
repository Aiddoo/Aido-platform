import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { ErrorCode } from "@aido/api/errors";
import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { ListLinkedAccountsUseCase } from "#api/modules/identity/auth/application/use-cases/list-linked-accounts.use-case";
import { UnlinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/unlink-oauth-account.use-case";
import { CurrentUser } from "#api/modules/identity/auth/presentation/http/decorators/current-user.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/auth/presentation/http/decorators/request-source.decorator";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { toRequestMetadata } from "./auth-request.mapper.js";
import { toLinkedAccountsResponse } from "./auth-response.mapper.js";
import { LinkedAccountsResponseDto, MessageResponseDto, UnlinkAccountDto } from "./auth.dto.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@ApiBearerAuth()
@Controller({ path: "auth", version: API_VERSION.V1 })
export class AccountController {
  readonly #listLinkedAccountsQuery: ListLinkedAccountsUseCase;
  readonly #unlinkOAuthAccountUseCase: UnlinkOAuthAccountUseCase;

  constructor(
    listLinkedAccountsQuery: ListLinkedAccountsUseCase,
    unlinkOAuthAccountUseCase: UnlinkOAuthAccountUseCase,
  ) {
    this.#listLinkedAccountsQuery = listLinkedAccountsQuery;
    this.#unlinkOAuthAccountUseCase = unlinkOAuthAccountUseCase;
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
    return toLinkedAccountsResponse(
      await this.#listLinkedAccountsQuery.execute({ userId: user.userId }),
    );
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
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    return this.#unlinkOAuthAccountUseCase.execute({
      userId: user.userId,
      provider: params.provider,
      metadata,
    });
  }
}
