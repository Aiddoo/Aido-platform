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
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetFriendResourceLimitUseCase } from "../../../application/use-cases/get-friend-resource-limit.use-case.js";
import { GetFriendsUseCase } from "../../../application/use-cases/get-friends.use-case.js";
import { RemoveFriendUseCase } from "../../../application/use-cases/remove-friend.use-case.js";
import { ReorderFriendUseCase } from "../../../application/use-cases/reorder-friend.use-case.js";
import { SearchUsersUseCase } from "../../../application/use-cases/search-users.use-case.js";
import {
  FOLLOW_RESPONSE_MESSAGES,
  toFriendsListResponse,
  toReorderFriendResponse,
  toSearchUsersResponse,
} from "./follow-response.mapper.js";
import {
  FollowResourceLimitResponseDto,
  FriendsListResponseDto,
  GetFriendsQueryDto,
  RemoveFriendResponseDto,
  ReorderFriendDto,
  ReorderFriendResponseDto,
  SearchUsersQueryDto,
  SearchUsersResponseDto,
  FollowIdParamDto,
} from "./follow.dto.js";

// 친구 목록·순서·끊기와 사용자 검색이다. 친구 요청 주고받기는 FriendRequestController가 같은 경로 아래에 둔다
@ApiTags(SWAGGER_TAGS.FOLLOWS)
@ApiBearerAuth()
@Controller({ path: "follows", version: API_VERSION.V1 })
export class FollowController {
  readonly #removeFriendUseCase: RemoveFriendUseCase;
  readonly #reorderFriendUseCase: ReorderFriendUseCase;
  readonly #searchUsersUseCase: SearchUsersUseCase;
  readonly #getFriendsUseCase: GetFriendsUseCase;
  readonly #getFriendResourceLimitUseCase: GetFriendResourceLimitUseCase;

  constructor(
    removeFriendUseCase: RemoveFriendUseCase,
    reorderFriendUseCase: ReorderFriendUseCase,
    searchUsersUseCase: SearchUsersUseCase,
    getFriendsUseCase: GetFriendsUseCase,
    getFriendResourceLimitUseCase: GetFriendResourceLimitUseCase,
  ) {
    this.#removeFriendUseCase = removeFriendUseCase;
    this.#reorderFriendUseCase = reorderFriendUseCase;
    this.#searchUsersUseCase = searchUsersUseCase;
    this.#getFriendsUseCase = getFriendsUseCase;
    this.#getFriendResourceLimitUseCase = getFriendResourceLimitUseCase;
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
  @ApiAppVersionHeader()
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
    @Param({ schema: FollowIdParamDto }) params: FollowIdParamDto,
    @Body({ schema: ReorderFriendDto }) dto: ReorderFriendDto,
    @AppVersion() appVersion?: string,
  ): Promise<ReorderFriendResponseDto> {
    const friend = await this.#reorderFriendUseCase.execute({
      userId: user.userId,
      friendshipId: params.followId,
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
  @ApiAppVersionHeader()
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
  @ApiAppVersionHeader()
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
}
