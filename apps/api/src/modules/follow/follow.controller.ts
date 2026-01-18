import { ErrorCode } from "@aido/errors";
import {
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
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
	ApiBadRequestError,
	ApiConflictError,
	ApiCreatedResponse,
	ApiDoc,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/guards";

import {
	AcceptFriendRequestResponseDto,
	FriendsListResponseDto,
	GetFollowsQueryDto,
	GetFriendsQueryDto,
	ReceivedRequestsResponseDto,
	RejectFriendRequestResponseDto,
	RemoveFriendResponseDto,
	SendFriendRequestResponseDto,
	SentRequestsResponseDto,
	UserIdParamDto,
} from "./dtos";
import { FollowMapper } from "./follow.mapper";
import { FollowService } from "./follow.service";

/**
 * Follow API 컨트롤러
 *
 * ## 👥 친구 관리 API
 *
 * 친구 요청 및 친구 관계 관리를 위한 API입니다.
 *
 * ### 친구 요청 엔드포인트
 * - POST /follows/:userId - 친구 요청 보내기
 * - PATCH /follows/:userId/accept - 친구 요청 수락
 * - PATCH /follows/:userId/reject - 친구 요청 거절
 * - DELETE /follows/:userId - 친구 삭제 / 요청 철회
 *
 * ### 목록 조회 엔드포인트
 * - GET /follows/friends - 내 친구 목록
 * - GET /follows/requests/received - 받은 친구 요청 목록
 * - GET /follows/requests/sent - 보낸 친구 요청 목록
 *
 * ### 🔄 친구 요청 상태 전이 다이어그램
 * ```
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                        친구 관계 상태 전이                              │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 *   [없음]                    [PENDING]                   [ACCEPTED]
 *     │                          │                            │
 *     │  POST /:userId           │                            │
 *     │  (친구 요청)              │                            │
 *     ├─────────────────────────▶│                            │
 *     │                          │                            │
 *     │                          │  PATCH /:userId/accept     │
 *     │                          │  (요청 수락)                │
 *     │                          ├───────────────────────────▶│
 *     │                          │                            │
 *     │                          │  PATCH /:userId/reject     │
 *     │◀─────────────────────────┤  (요청 거절 → 삭제)         │
 *     │                          │                            │
 *     │                          │  DELETE /:userId           │
 *     │◀─────────────────────────┤  (요청 철회)                │
 *     │                          │                            │
 *     │  DELETE /:userId         │                            │
 *     │◀──────────────────────────────────────────────────────┤
 *     │  (친구 삭제)                                           │
 *     │                                                       │
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                        자동 수락 케이스                               │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 *   A → B (PENDING)    +    B → A (POST 요청)    =    A ↔ B (ACCEPTED)
 *
 *   상대방이 이미 나에게 친구 요청을 보낸 상태에서
 *   내가 그 상대방에게 친구 요청을 보내면 자동으로 친구가 됨
 * ```
 *
 * ### 📊 상태별 설명
 * | 상태 | 설명 |
 * |------|------|
 * | 없음 | 두 사용자 간 아무 관계 없음 |
 * | PENDING | 친구 요청을 보낸 상태 (대기 중) |
 * | ACCEPTED | 양방향 친구 관계 성립 |
 */
@ApiTags(SWAGGER_TAGS.FOLLOWS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("follows")
export class FollowController {
	private readonly logger = new Logger(FollowController.name);

	constructor(private readonly followService: FollowService) {}

	// ============================================
	// 친구 요청 액션
	// ============================================

	@Post(":userId")
	@ApiDoc({
		summary: "친구 요청 보내기",
		description: `
## 👤 친구 요청 보내기

특정 사용자에게 친구 요청을 보냅니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 친구 요청을 보낼 대상 사용자 ID (CUID)

### 💡 동작 방식
1. 대상 사용자에게 친구 요청을 보냅니다 (status: PENDING)
2. 만약 상대방이 이미 나에게 친구 요청을 보낸 상태라면, 자동으로 친구가 됩니다

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| FOLLOW_0901 | 이미 친구 요청을 보낸 상태 |
| FOLLOW_0902 | 이미 친구 관계 |
| FOLLOW_0904 | 자기 자신에게 요청 |
| FOLLOW_0905 | 대상 사용자가 존재하지 않음 |
		`,
	})
	@ApiCreatedResponse({ type: SendFriendRequestResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.FOLLOW_0904)
	@ApiNotFoundError(ErrorCode.FOLLOW_0905)
	@ApiConflictError(ErrorCode.FOLLOW_0901)
	@ApiConflictError(ErrorCode.FOLLOW_0902)
	async sendRequest(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
	): Promise<SendFriendRequestResponseDto> {
		this.logger.debug(`친구 요청 보내기: ${user.userId} -> ${params.userId}`);

		const result = await this.followService.sendRequest(
			user.userId,
			params.userId,
		);

		const message = result.autoAccepted
			? "친구가 되었습니다."
			: "친구 요청을 보냈습니다.";

		this.logger.log(
			`친구 요청 완료: ${user.userId} -> ${params.userId}, autoAccepted=${result.autoAccepted}`,
		);

		return {
			message,
			follow: FollowMapper.toResponse(result.follow),
			autoAccepted: result.autoAccepted,
		};
	}

	@Patch(":userId/accept")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "친구 요청 수락",
		description: `
## ✅ 친구 요청 수락

받은 친구 요청을 수락합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 친구 요청을 보낸 사용자 ID (CUID)

### 💡 동작 방식
1. 상대방의 요청을 ACCEPTED 상태로 변경
2. 내 쪽에서도 ACCEPTED 상태의 Follow 레코드 생성
3. 양방향 친구 관계가 성립됩니다

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| FOLLOW_0903 | 해당 사용자로부터 받은 친구 요청이 없음 |
		`,
	})
	@ApiSuccessResponse({ type: AcceptFriendRequestResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.FOLLOW_0903)
	async acceptRequest(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
	): Promise<AcceptFriendRequestResponseDto> {
		this.logger.debug(`친구 요청 수락: ${params.userId} -> ${user.userId}`);

		const result = await this.followService.acceptRequest(
			user.userId,
			params.userId,
		);

		this.logger.log(`친구 요청 수락 완료: ${params.userId} <-> ${user.userId}`);

		// result는 "나 -> 상대방" Follow 레코드
		// following이 요청을 보낸 사람(상대방)의 정보
		return {
			message: "친구 요청을 수락했습니다.",
			friend: FollowMapper.toFriendUser(result),
		};
	}

	@Patch(":userId/reject")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "친구 요청 거절",
		description: `
## ❌ 친구 요청 거절

받은 친구 요청을 거절합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 친구 요청을 보낸 사용자 ID (CUID)

### 💡 동작 방식
- 상대방이 보낸 친구 요청을 삭제합니다

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| FOLLOW_0903 | 해당 사용자로부터 받은 친구 요청이 없음 |
		`,
	})
	@ApiSuccessResponse({ type: RejectFriendRequestResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.FOLLOW_0903)
	async rejectRequest(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
	): Promise<RejectFriendRequestResponseDto> {
		this.logger.debug(`친구 요청 거절: ${params.userId} -> ${user.userId}`);

		await this.followService.rejectRequest(user.userId, params.userId);

		this.logger.log(`친구 요청 거절 완료: ${params.userId} X ${user.userId}`);

		return {
			message: "친구 요청을 거절했습니다.",
		};
	}

	@Delete(":userId")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "친구 삭제 / 요청 철회",
		description: `
## 🗑️ 친구 삭제 또는 요청 철회

친구 관계를 삭제하거나 보낸 친구 요청을 철회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 친구 삭제할 사용자 또는 요청을 철회할 대상 사용자 ID (CUID)

### 💡 동작 방식
- 친구 관계인 경우: 양방향 친구 관계를 모두 삭제
- 요청만 보낸 경우: 보낸 요청을 삭제 (철회)

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| FOLLOW_0907 | 친구 관계가 아니고 보낸 요청도 없음 |
		`,
	})
	@ApiSuccessResponse({ type: RemoveFriendResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.FOLLOW_0907)
	async remove(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
	): Promise<RemoveFriendResponseDto> {
		this.logger.debug(`친구 삭제/요청 철회: ${user.userId} X ${params.userId}`);

		await this.followService.remove(user.userId, params.userId);

		this.logger.log(
			`친구 삭제/요청 철회 완료: ${user.userId} X ${params.userId}`,
		);

		return {
			message: "친구를 삭제했습니다.",
		};
	}

	// ============================================
	// 목록 조회
	// ============================================

	@Get("friends")
	@ApiDoc({
		summary: "친구 목록 조회",
		description: `
## 👥 친구 목록 조회

나와 맞팔 관계인 친구 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`cursor\` | string | - | 페이지네이션 커서 (CUID) |
| \`limit\` | number | 20 | 페이지 크기 (1-50) |
| \`search\` | string | - | 이름 또는 태그로 검색 |

### 📤 응답 구조
\`\`\`json
{
  "friends": [...],
  "totalCount": 10,
  "hasMore": false
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: FriendsListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getFriends(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetFriendsQueryDto,
	): Promise<FriendsListResponseDto> {
		this.logger.debug(`친구 목록 조회: user=${user.userId}`);

		const result = await this.followService.getFriends({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
		});

		const totalCount = await this.followService.countFriends(user.userId);

		return {
			friends: result.items.map(FollowMapper.toFriendUser),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("requests/received")
	@ApiDoc({
		summary: "받은 친구 요청 목록",
		description: `
## 📥 받은 친구 요청 목록

나에게 친구 요청을 보낸 사용자 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`cursor\` | string | - | 페이지네이션 커서 (CUID) |
| \`limit\` | number | 20 | 페이지 크기 (1-50) |

### 📤 응답 구조
\`\`\`json
{
  "requests": [...],
  "totalCount": 3,
  "hasMore": false
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: ReceivedRequestsResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getReceivedRequests(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetFollowsQueryDto,
	): Promise<ReceivedRequestsResponseDto> {
		this.logger.debug(`받은 친구 요청 목록 조회: user=${user.userId}`);

		const result = await this.followService.getReceivedRequests({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
		});

		const totalCount = await this.followService.countReceivedRequests(
			user.userId,
		);

		return {
			requests: result.items.map(FollowMapper.toReceivedRequest),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("requests/sent")
	@ApiDoc({
		summary: "보낸 친구 요청 목록",
		description: `
## 📤 보낸 친구 요청 목록

내가 친구 요청을 보낸 사용자 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`cursor\` | string | - | 페이지네이션 커서 (CUID) |
| \`limit\` | number | 20 | 페이지 크기 (1-50) |

### 📤 응답 구조
\`\`\`json
{
  "requests": [...],
  "totalCount": 2,
  "hasMore": false
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: SentRequestsResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getSentRequests(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetFollowsQueryDto,
	): Promise<SentRequestsResponseDto> {
		this.logger.debug(`보낸 친구 요청 목록 조회: user=${user.userId}`);

		const result = await this.followService.getSentRequests({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
		});

		const totalCount = await this.followService.countSentRequests(user.userId);

		return {
			requests: result.items.map(FollowMapper.toSentRequest),
			totalCount,
			hasMore: result.pagination.hasNext,
		};
	}
}
