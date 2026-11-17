import { ErrorCode } from "@aido/api/errors";
import { USER_TAG_LENGTH } from "@aido/api/vocabulary";
import {
  Header,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { AcceptFriendRequestUseCase } from "../../../application/use-cases/accept-friend-request.use-case.js";
import { GetReceivedFriendRequestsUseCase } from "../../../application/use-cases/get-received-friend-requests.use-case.js";
import { GetSentFriendRequestsUseCase } from "../../../application/use-cases/get-sent-friend-requests.use-case.js";
import { RejectFriendRequestUseCase } from "../../../application/use-cases/reject-friend-request.use-case.js";
import { SendFriendRequestByTagUseCase } from "../../../application/use-cases/send-friend-request-by-tag.use-case.js";
import { FriendshipRateLimits } from "../friendships.rate-limits.js";
import {
  FOLLOW_RESPONSE_MESSAGES,
  toAcceptFriendRequestResponse,
  toReceivedRequestsResponse,
  toSendFriendRequestResponse,
  toSentRequestsResponse,
} from "./follow-response.mapper.js";
import {
  AcceptFriendRequestResponseDto,
  GetFollowsQueryDto,
  ReceivedRequestsResponseDto,
  RejectFriendRequestResponseDto,
  SendFriendRequestResponseDto,
  SentRequestsResponseDto,
  UserTagParamDto,
} from "./follow.dto.js";

/**
 * ### 친구 요청 상태 전이 다이어그램
 * ```
 *   [없음]  --POST /:userTag-->  [PENDING]  --PATCH /:userId/accept-->  [ACCEPTED]
 *   PENDING --PATCH /:userId/reject--> [삭제]
 *   PENDING --DELETE /:userId--> [철회]
 *   ACCEPTED --DELETE /:userId--> [친구 삭제(양방향)]
 *
 *   자동 수락: A→B(PENDING) + B→A(POST) = A↔B(ACCEPTED)
 * ```
 */
@ApiTags(SWAGGER_TAGS.FOLLOWS)
@ApiBearerAuth()
@Controller({ path: "follows", version: API_VERSION.V1 })
export class FriendRequestController {
  readonly #sendFriendRequestByTagUseCase: SendFriendRequestByTagUseCase;
  readonly #acceptFriendRequestUseCase: AcceptFriendRequestUseCase;
  readonly #rejectFriendRequestUseCase: RejectFriendRequestUseCase;
  readonly #getReceivedFriendRequestsUseCase: GetReceivedFriendRequestsUseCase;
  readonly #getSentFriendRequestsUseCase: GetSentFriendRequestsUseCase;

  constructor(
    sendFriendRequestByTagUseCase: SendFriendRequestByTagUseCase,
    acceptFriendRequestUseCase: AcceptFriendRequestUseCase,
    rejectFriendRequestUseCase: RejectFriendRequestUseCase,
    getReceivedFriendRequestsUseCase: GetReceivedFriendRequestsUseCase,
    getSentFriendRequestsUseCase: GetSentFriendRequestsUseCase,
  ) {
    this.#sendFriendRequestByTagUseCase = sendFriendRequestByTagUseCase;
    this.#acceptFriendRequestUseCase = acceptFriendRequestUseCase;
    this.#rejectFriendRequestUseCase = rejectFriendRequestUseCase;
    this.#getReceivedFriendRequestsUseCase = getReceivedFriendRequestsUseCase;
    this.#getSentFriendRequestsUseCase = getSentFriendRequestsUseCase;
  }

  @Post(":userTag")
  @RateLimit(FriendshipRateLimits.sendRequest)
  @ApiParam({
    name: "userTag",
    description: "친구 요청을 보낼 대상 Aido ID (8자 영문 대문자·숫자, 예: JOHN2026)",
    example: "JOHN2026",
    schema: { type: "string", pattern: `^[A-Z0-9]{${USER_TAG_LENGTH}}$` },
  })
  @ApiDoc({
    summary: "친구 요청 보내기",
    operationId: "sendFriendRequest",
    description: `특정 사용자에게 친구 요청을 보냅니다.

상대방이 이미 나에게 친구 요청을 보낸 상태라면 자동으로 친구가 됩니다 (\`autoAccepted: true\`).

내가 차단한 사용자에게는 보낼 수 없습니다(\`BLOCK_2203\`). 나를 차단한 사용자는 찾을 수 없는 사용자와 같게 응답합니다(\`FOLLOW_0905\`).

사용자마다 분당 30회까지 보낼 수 있고, 넘으면 429(SYS_0001)를 돌려줍니다.`,
  })
  @ApiCreatedSuccessResponse({ type: SendFriendRequestResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.FOLLOW_0904)
  @ApiNotFoundError(ErrorCode.FOLLOW_0905)
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [ErrorCode.FOLLOW_0901, ErrorCode.FOLLOW_0902])
  @ApiForbiddenError(ErrorCode.FOLLOW_0909)
  @ApiForbiddenError(ErrorCode.BLOCK_2203)
  async sendRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserTagParamDto }) params: UserTagParamDto,
  ): Promise<SendFriendRequestResponseDto> {
    const result = await this.#sendFriendRequestByTagUseCase.execute({
      userId: user.userId,
      targetUserTag: params.userTag,
    });
    return toSendFriendRequestResponse(result);
  }

  @Patch(":userId/accept")
  @HttpCode(HttpStatus.OK)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiParam({
    name: "userId",
    description: "수락할 친구 요청의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
    example: "clz7x5p8k0005qz0z8z8z8z8z",
  })
  @ApiDoc({
    summary: "친구 요청 수락",
    operationId: "acceptFriendRequest",
    description: `받은 친구 요청을 수락합니다.

수락 시 양방향 친구 관계가 성립됩니다.`,
  })
  @ApiSuccessResponse({ type: AcceptFriendRequestResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.FOLLOW_0903)
  async acceptRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
    @AppVersion() appVersion?: string,
  ): Promise<AcceptFriendRequestResponseDto> {
    const friend = await this.#acceptFriendRequestUseCase.execute({
      userId: user.userId,
      requesterUserId: params.userId,
    });
    return toAcceptFriendRequestResponse(friend, appVersion);
  }

  @Patch(":userId/reject")
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: "userId",
    description: "거절할 친구 요청의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
    example: "clz7x5p8k0005qz0z8z8z8z8z",
  })
  @ApiDoc({
    summary: "친구 요청 거절",
    operationId: "rejectFriendRequest",
    description: `받은 친구 요청을 거절합니다.

거절된 요청은 삭제되며 상대방은 다시 요청을 보낼 수 있습니다.`,
  })
  @ApiSuccessResponse({ type: RejectFriendRequestResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.FOLLOW_0903)
  async rejectRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<RejectFriendRequestResponseDto> {
    await this.#rejectFriendRequestUseCase.execute({
      userId: user.userId,
      requesterUserId: params.userId,
    });

    return { message: FOLLOW_RESPONSE_MESSAGES.REQUEST_REJECTED };
  }

  @Get("requests/received")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "받은 친구 요청 목록",
    operationId: "getReceivedFriendRequests",
    description: `나에게 친구 요청을 보낸 사용자 목록을 조회합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)`,
  })
  @ApiSuccessResponse({ type: ReceivedRequestsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getReceivedRequests(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetFollowsQueryDto }) query: GetFollowsQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<ReceivedRequestsResponseDto> {
    const result = await this.#getReceivedFriendRequestsUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toReceivedRequestsResponse(result, appVersion);
  }

  @Get("requests/sent")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "보낸 친구 요청 목록",
    operationId: "getSentFriendRequests",
    description: `내가 친구 요청을 보낸 사용자 목록을 조회합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)`,
  })
  @ApiSuccessResponse({ type: SentRequestsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getSentRequests(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetFollowsQueryDto }) query: GetFollowsQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<SentRequestsResponseDto> {
    const result = await this.#getSentFriendRequestsUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toSentRequestsResponse(result, appVersion);
  }
}
