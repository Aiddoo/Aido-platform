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
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";

import { UserIdParamDto } from "@/shared/presentation/dtos";
import {
	ApiBadRequestError,
	ApiConflictError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "../../auth/presentation/decorators";
import { FollowFacade } from "../application/facades/follow.facade";
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
	SendFriendRequestResponseDto,
	SentRequestsResponseDto,
	UserTagParamDto,
} from "./dtos";
import { FollowMapper } from "./follow.mapper";

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
@Controller("follows")
export class FollowController {
	readonly #logger = new Logger(FollowController.name);

	constructor(private readonly followFacade: FollowFacade) {}

	@Post(":userTag")
	@ApiParam({
		name: "userTag",
		description:
			"친구 요청을 보낼 대상 사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)",
		example: "JOHN2026",
		schema: { type: "string", pattern: "^[A-Z0-9]{8}$" },
	})
	@ApiDoc({
		summary: "친구 요청 보내기",
		operationId: "sendFriendRequest",
		description: `특정 사용자에게 친구 요청을 보냅니다.

상대방이 이미 나에게 친구 요청을 보낸 상태라면 자동으로 친구가 됩니다 (\`autoAccepted: true\`).`,
	})
	@ApiCreatedResponse({ type: SendFriendRequestResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.FOLLOW_0904)
	@ApiNotFoundError(ErrorCode.FOLLOW_0905)
	@ApiConflictError(ErrorCode.FOLLOW_0901)
	@ApiConflictError(ErrorCode.FOLLOW_0902)
	@ApiForbiddenError(ErrorCode.FOLLOW_0909)
	async sendRequest(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserTagParamDto,
	): Promise<SendFriendRequestResponseDto> {
		this.#logger.debug(`친구 요청 보내기: ${user.userId} -> ${params.userTag}`);

		const result = await this.followFacade.sendRequestByTag(
			user.userId,
			params.userTag,
		);

		const message = result.autoAccepted
			? "친구가 되었습니다."
			: "친구 요청을 보냈습니다.";

		this.#logger.log(
			`친구 요청 완료: ${user.userId} -> ${params.userTag}, autoAccepted=${result.autoAccepted}`,
		);

		return {
			message,
			follow: FollowMapper.toResponse(result.follow),
			autoAccepted: result.autoAccepted,
		};
	}

	@Patch(":userId/accept")
	@HttpCode(HttpStatus.OK)
	@ApiParam({
		name: "userId",
		description:
			"수락할 친구 요청의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
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
		@Param() params: UserIdParamDto,
	): Promise<AcceptFriendRequestResponseDto> {
		this.#logger.debug(`친구 요청 수락: ${params.userId} -> ${user.userId}`);

		const result = await this.followFacade.acceptRequest(
			user.userId,
			params.userId,
		);

		this.#logger.log(
			`친구 요청 수락 완료: ${params.userId} <-> ${user.userId}`,
		);

		return {
			message: "친구 요청을 수락했습니다.",
			friend: FollowMapper.toFriendUser(result),
		};
	}

	@Patch(":userId/reject")
	@HttpCode(HttpStatus.OK)
	@ApiParam({
		name: "userId",
		description:
			"거절할 친구 요청의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
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
		@Param() params: UserIdParamDto,
	): Promise<RejectFriendRequestResponseDto> {
		this.#logger.debug(`친구 요청 거절: ${params.userId} -> ${user.userId}`);

		await this.followFacade.rejectRequest(user.userId, params.userId);

		this.#logger.log(`친구 요청 거절 완료: ${params.userId} X ${user.userId}`);

		return { message: "친구 요청을 거절했습니다." };
	}

	@Delete(":userId")
	@HttpCode(HttpStatus.OK)
	@ApiParam({
		name: "userId",
		description:
			"삭제할 친구의 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
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
		@Param() params: UserIdParamDto,
	): Promise<RemoveFriendResponseDto> {
		this.#logger.debug(
			`친구 삭제/요청 철회: ${user.userId} X ${params.userId}`,
		);

		await this.followFacade.remove(user.userId, params.userId);

		this.#logger.log(
			`친구 삭제/요청 철회 완료: ${user.userId} X ${params.userId}`,
		);

		return { message: "친구를 삭제했습니다." };
	}

	@Patch("friends/:followId/reorder")
	@HttpCode(HttpStatus.OK)
	@ApiParam({
		name: "followId",
		description:
			"순서를 변경할 친구의 팔로우 관계 ID (CUID 25자, 예: clz7x5p8k0010qz0z8z8z8z8z)",
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
		@Body() dto: ReorderFriendDto,
	): Promise<ReorderFriendResponseDto> {
		this.#logger.debug(
			`친구 순서 변경: user=${user.userId}, followId=${followId}`,
		);

		const result = await this.followFacade.reorder(followId, user.userId, dto);

		this.#logger.log(`친구 순서 변경 완료: followId=${followId}`);

		return {
			message: "친구 순서가 변경되었습니다.",
			friend: FollowMapper.toFriendUser(result),
		};
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
		return this.followFacade.getResourceLimitInfo(user.userId);
	}

	@Get("friends")
	@ApiDoc({
		summary: "친구 목록 조회",
		operationId: "getFriends",
		description: `나와 맞팔 관계인 친구 목록을 조회합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)
- \`search\`: 사용자 태그로 검색`,
	})
	@ApiSuccessResponse({ type: FriendsListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getFriends(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetFriendsQueryDto,
	): Promise<FriendsListResponseDto> {
		this.#logger.debug(`친구 목록 조회: user=${user.userId}`);

		const [result, totalCount] = await Promise.all([
			this.followFacade.getFriends({
				userId: user.userId,
				cursor: query.cursor,
				size: query.limit,
				search: query.search,
			}),
			this.followFacade.countFriends(user.userId),
		]);

		return {
			friends: result.items.map(FollowMapper.toFriendUser),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("requests/received")
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
		@Query() query: GetFollowsQueryDto,
	): Promise<ReceivedRequestsResponseDto> {
		this.#logger.debug(`받은 친구 요청 목록 조회: user=${user.userId}`);

		const [result, totalCount] = await Promise.all([
			this.followFacade.getReceivedRequests({
				userId: user.userId,
				cursor: query.cursor,
				size: query.limit,
			}),
			this.followFacade.countReceivedRequests(user.userId),
		]);

		return {
			requests: result.items.map(FollowMapper.toReceivedRequest),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("requests/sent")
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
		@Query() query: GetFollowsQueryDto,
	): Promise<SentRequestsResponseDto> {
		this.#logger.debug(`보낸 친구 요청 목록 조회: user=${user.userId}`);

		const [result, totalCount] = await Promise.all([
			this.followFacade.getSentRequests({
				userId: user.userId,
				cursor: query.cursor,
				size: query.limit,
			}),
			this.followFacade.countSentRequests(user.userId),
		]);

		return {
			requests: result.items.map(FollowMapper.toSentRequest),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}
}
