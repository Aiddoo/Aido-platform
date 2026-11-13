import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { ErrorCode } from "@aido/api/errors";
import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { ListActiveSessionsUseCase } from "#api/modules/identity/auth/application/use-cases/list-active-sessions.use-case";
import { RevokeSessionUseCase } from "#api/modules/identity/auth/application/use-cases/revoke-session.use-case";
import { CurrentUser } from "#api/modules/identity/auth/presentation/http/decorators/current-user.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/auth/presentation/http/decorators/request-source.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { toRequestMetadata } from "./auth-request.mapper.js";
import { RevokeSessionDto } from "./auth.dto.js";
import { MessageResponseDto, SessionListDto } from "./auth.dto.js";

/**
 * Session API 컨트롤러
 *
 * 사용자 세션(로그인 기기) 관리 API입니다.
 *
 * ### 세션 관리
 * - GET /auth/sessions - 활성 세션 목록 조회
 * - DELETE /auth/sessions/:sessionId - 특정 세션 종료
 */
@ApiTags(SWAGGER_TAGS.USER_AUTH)
@ApiBearerAuth()
@Controller("auth")
export class SessionController {
  readonly #listActiveSessionsQuery: ListActiveSessionsUseCase;
  readonly #revokeSessionUseCase: RevokeSessionUseCase;

  constructor(
    listActiveSessionsQuery: ListActiveSessionsUseCase,
    revokeSessionUseCase: RevokeSessionUseCase,
  ) {
    this.#listActiveSessionsQuery = listActiveSessionsQuery;
    this.#revokeSessionUseCase = revokeSessionUseCase;
  }

  @Get("sessions")
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
    const sessions = await this.#listActiveSessionsQuery.execute({ userId: user.userId });

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      isCurrent: session.id === user.sessionId,
    }));

    return { sessions: sessionsWithCurrent };
  }

  @Delete("sessions/:sessionId")
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
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.SESSION_0701)
  async revokeSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: RevokeSessionDto }) params: RevokeSessionDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    const result = await this.#revokeSessionUseCase.execute({
      userId: user.userId,
      sessionId: params.sessionId,
      metadata,
    });
    return result;
  }
}
