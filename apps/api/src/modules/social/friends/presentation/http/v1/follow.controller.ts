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
  Post,
  Query,
} from "@nestjs/common";
import { ApiHeader, ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
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
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { AcceptFriendRequestUseCase } from "../../../application/use-cases/accept-friend-request.use-case.js";
import { GetFriendResourceLimitUseCase } from "../../../application/use-cases/get-friend-resource-limit.use-case.js";
import { GetFriendsUseCase } from "../../../application/use-cases/get-friends.use-case.js";
import { GetReceivedFriendRequestsUseCase } from "../../../application/use-cases/get-received-friend-requests.use-case.js";
import { GetSentFriendRequestsUseCase } from "../../../application/use-cases/get-sent-friend-requests.use-case.js";
import { RejectFriendRequestUseCase } from "../../../application/use-cases/reject-friend-request.use-case.js";
import { RemoveFriendUseCase } from "../../../application/use-cases/remove-friend.use-case.js";
import { ReorderFriendUseCase } from "../../../application/use-cases/reorder-friend.use-case.js";
import { SearchUsersUseCase } from "../../../application/use-cases/search-users.use-case.js";
import { SendFriendRequestByTagUseCase } from "../../../application/use-cases/send-friend-request-by-tag.use-case.js";
import {
  FOLLOW_RESPONSE_MESSAGES,
  toAcceptFriendRequestResponse,
  toFriendsListResponse,
  toReceivedRequestsResponse,
  toReorderFriendResponse,
  toSearchUsersResponse,
  toSendFriendRequestResponse,
  toSentRequestsResponse,
} from "./follow-response.mapper.js";
import {
  AcceptFriendRequestResponseDto,
  FollowResourceLimitResponseDto,
  FriendsListResponseDto,
  GetFollowsQueryDto,
  GetFriendsQueryDto,
  ReceivedRequestsResponseDto,
  RejectFriendRequestResponseDto,
  RemoveFriendResponseDto,
  ReorderFriendDto,
  ReorderFriendResponseDto,
  SearchUsersQueryDto,
  SearchUsersResponseDto,
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
const FRIEND_REQUEST_THROTTLE = { ttl: 60_000, limit: 30 } as const;

@ApiTags(SWAGGER_TAGS.FOLLOWS)
@ApiBearerAuth()
@Controller("follows")
export class FollowController {
  readonly #sendFriendRequestByTagUseCase: SendFriendRequestByTagUseCase;
  readonly #acceptFriendRequestUseCase: AcceptFriendRequestUseCase;
  readonly #rejectFriendRequestUseCase: RejectFriendRequestUseCase;
  readonly #removeFriendUseCase: RemoveFriendUseCase;
  readonly #reorderFriendUseCase: ReorderFriendUseCase;
  readonly #searchUsersUseCase: SearchUsersUseCase;
  readonly #getFriendsUseCase: GetFriendsUseCase;
  readonly #getReceivedFriendRequestsUseCase: GetReceivedFriendRequestsUseCase;
  readonly #getSentFriendRequestsUseCase: GetSentFriendRequestsUseCase;
  readonly #getFriendResourceLimitUseCase: GetFriendResourceLimitUseCase;

  constructor(
    sendFriendRequestByTagUseCase: SendFriendRequestByTagUseCase,
    acceptFriendRequestUseCase: AcceptFriendRequestUseCase,
    rejectFriendRequestUseCase: RejectFriendRequestUseCase,
    removeFriendUseCase: RemoveFriendUseCase,
    reorderFriendUseCase: ReorderFriendUseCase,
    searchUsersUseCase: SearchUsersUseCase,
    getFriendsUseCase: GetFriendsUseCase,
    getReceivedFriendRequestsUseCase: GetReceivedFriendRequestsUseCase,
    getSentFriendRequestsUseCase: GetSentFriendRequestsUseCase,
    getFriendResourceLimitUseCase: GetFriendResourceLimitUseCase,
  ) {
    this.#sendFriendRequestByTagUseCase = sendFriendRequestByTagUseCase;
    this.#acceptFriendRequestUseCase = acceptFriendRequestUseCase;
    this.#rejectFriendRequestUseCase = rejectFriendRequestUseCase;
    this.#removeFriendUseCase = removeFriendUseCase;
    this.#reorderFriendUseCase = reorderFriendUseCase;
    this.#searchUsersUseCase = searchUsersUseCase;
    this.#getFriendsUseCase = getFriendsUseCase;
    this.#getReceivedFriendRequestsUseCase = getReceivedFriendRequestsUseCase;
    this.#getSentFriendRequestsUseCase = getSentFriendRequestsUseCase;
    this.#getFriendResourceLimitUseCase = getFriendResourceLimitUseCase;
  }

  @Post(":userTag")
  @ThrottleByUser()
  @Throttle({ default: FRIEND_REQUEST_THROTTLE })
  @ApiParam({
    name: "userTag",
    description: "친구 요청을 보낼 대상 Aido ID (8자 영문 대문자·숫자, 예: JOHN2026)",
    example: "JOHN2026",
    schema: { type: "string", pattern: "^[A-Z0-9]{8}$" },
  })
  @ApiDoc({
    summary: "친구 요청 보내기",
    operationId: "sendFriendRequest",
    description: `특정 사용자에게 친구 요청을 보냅니다.

상대방이 이미 나에게 친구 요청을 보낸 상태라면 자동으로 친구가 됩니다 (\`autoAccepted: true\`).

내가 차단한 사용자에게는 보낼 수 없습니다(\`BLOCK_2203\`). 나를 차단한 사용자는 찾을 수 없는 사용자와 같게 응답합니다(\`FOLLOW_0905\`).

사용자마다 분당 30회까지 보낼 수 있고, 넘으면 429(SYS_0001)를 돌려줍니다.`,
  })
  @ApiCreatedResponse({ type: SendFriendRequestResponseDto })
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
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
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

  @Delete(":userId")
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: "userId",
    description: "삭제할 친구의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
    example: "clz7x5p8k0005qz0z8z8z8z8z",
  })
  @ApiDoc({
    summary: "친구 삭제 / 요청 철회",
    operationId: "removeFriend",
    description: `친구 관계를 삭제하거나 보낸 친구 요청을 철회합니다.

친구인 경우 양방향 관계가 모두 삭제되고, 요청만 보낸 상태라면 요청이 철회됩니다.`,
  })
  @ApiSuccessResponse({ type: RemoveFriendResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.FOLLOW_0907)
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<RemoveFriendResponseDto> {
    await this.#removeFriendUseCase.execute({
      userId: user.userId,
      targetUserId: params.userId,
    });

    return { message: FOLLOW_RESPONSE_MESSAGES.REMOVED };
  }

  @Patch("friends/:followId/reorder")
  @HttpCode(HttpStatus.OK)
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiParam({
    name: "followId",
    description: "순서를 변경할 친구의 팔로우 관계 ID (CUID 25자, 예: clz7x5p8k0010qz0z8z8z8z8z)",
    example: "clz7x5p8k0010qz0z8z8z8z8z",
  })
  @ApiDoc({
    summary: "친구 순서 변경",
    operationId: "reorderFriend",
    description: `친구 목록에서 특정 친구의 순서를 변경합니다.

**요청 필드**
- \`targetFollowId\` (선택): 기준이 되는 Follow ID. 생략 시 맨 앞/뒤로 이동
- \`position\` (필수): 기준의 앞(\`before\`) 또는 뒤(\`after\`)`,
  })
  @ApiSuccessResponse({ type: ReorderFriendResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.FOLLOW_0910)
  async reorderFriend(
    @CurrentUser() user: CurrentUserPayload,
    @Param("followId") followId: string,
    @Body({ schema: ReorderFriendDto }) dto: ReorderFriendDto,
    @AppVersion() appVersion?: string,
  ): Promise<ReorderFriendResponseDto> {
    const friend = await this.#reorderFriendUseCase.execute({
      userId: user.userId,
      friendshipId: followId,
      targetFriendshipId: dto.targetFollowId,
      position: dto.position,
    });
    return toReorderFriendResponse(friend, appVersion);
  }

  @Get("resource-limit")
  @ApiDoc({
    summary: "친구 리소스 제한 정보 조회",
    operationId: "getFollowResourceLimit",
    description: `현재 친구 수와 최대 한도를 조회합니다.

**응답 필드**
- \`friendCount\`: 현재 친구 수
- \`maxCount\`: 최대 한도 (null이면 무제한)`,
  })
  @ApiSuccessResponse({ type: FollowResourceLimitResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getResourceLimit(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<FollowResourceLimitResponseDto> {
    return this.#getFriendResourceLimitUseCase.execute({ userId: user.userId });
  }

  @Get("friends")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "친구 목록 조회",
    operationId: "getFriends",
    description: `나와 맞팔 관계인 친구 목록을 조회합니다.

**정렬**
- 사용자가 친구 목록 편집에서 정한 순서(\`sortOrder\` 오름차순)입니다. 피드의 친구 줄도 이 순서를 그대로 씁니다.
- 순서 변경은 \`PATCH /v1/follows/friends/{followId}/reorder\`로 합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서(이전 페이지 마지막 항목의 \`followId\`)
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)
- \`search\`: Aido ID로 검색`,
  })
  @ApiSuccessResponse({ type: FriendsListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getFriends(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetFriendsQueryDto }) query: GetFriendsQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<FriendsListResponseDto> {
    const result = await this.#getFriendsUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
      search: query.search,
    });

    return toFriendsListResponse(result, appVersion);
  }

  @Get("search")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "사용자 검색 (이름 또는 Aido ID)",
    operationId: "searchUsers",
    description: `이름 또는 Aido ID로 전체 사용자를 검색합니다. (인스타그램 스타일 디스커버리)

본인·탈퇴·비활성(ACTIVE 외) 사용자는 제외됩니다. 결과에는 관계 상태
(isFollowing/isFollower/isFriend/requestPending)가 포함되어 동명이인을 Aido ID로 구분할 수 있습니다.

**쿼리 파라미터**
- \`q\`: 검색어 (이름 또는 Aido ID, 2-50자)
- \`cursor\`: 페이지네이션 커서 (불투명 문자열, 이전 응답의 nextCursor)
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)`,
  })
  @ApiSuccessResponse({ type: SearchUsersResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.FOLLOW_0911)
  async searchUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: SearchUsersQueryDto }) query: SearchUsersQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<SearchUsersResponseDto> {
    const result = await this.#searchUsersUseCase.execute({
      viewerId: user.userId,
      query: query.q,
      cursor: query.cursor,
      size: query.limit,
    });

    return toSearchUsersResponse(result, appVersion);
  }

  @Get("requests/received")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
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
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
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
