import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";

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
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/guards";

import { CheerMapper } from "./cheer.mapper";
import { CheerService } from "./cheer.service";
import {
	CheerCooldownResponseDto,
	CheerLimitInfoDto,
	CreateCheerResponseDto,
	MarkCheerReadResponseDto,
	MarkCheersReadDto,
	ReceivedCheersResponseDto,
	SendCheerDto,
	SentCheersResponseDto,
} from "./dtos";

/**
 * Cheer API 컨트롤러
 *
 * ## 🎉 응원하기 API
 *
 * 친구에게 응원 메시지를 보내고 관리하는 API입니다.
 *
 * ### 응원 보내기
 * - POST /cheers - 응원 보내기
 *
 * ### 목록 조회
 * - GET /cheers/received - 받은 응원 목록
 * - GET /cheers/sent - 보낸 응원 목록
 *
 * ### 제한 정보
 * - GET /cheers/limit - 오늘 남은 응원 횟수
 * - GET /cheers/cooldown/:userId - 특정 친구에 대한 쿨다운 상태
 *
 * ### 읽음 처리
 * - PATCH /cheers/:id/read - 응원 읽음 처리
 * - PATCH /cheers/read - 여러 응원 읽음 처리
 */
@ApiTags(SWAGGER_TAGS.CHEERS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cheers")
export class CheerController {
	private readonly logger = new Logger(CheerController.name);

	constructor(private readonly cheerService: CheerService) {}

	// ============================================
	// 응원 보내기
	// ============================================

	@Post()
	@ApiDoc({
		summary: "응원 보내기",
		operationId: "sendCheer",
		description: `
## 🎉 응원 보내기

친구에게 응원 메시지를 보냅니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 본문
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`receiverId\` | string | ✅ | 응원할 친구의 ID (CUID) |
| \`message\` | string | ❌ | 응원 메시지 (최대 200자) |

### 💡 동작 방식
1. 친구 관계 확인 (상호 팔로우)
2. 일일 제한 체크 (FREE: 3회, ACTIVE: 무제한)
3. 쿨다운 체크 (동일 친구에게 24시간)
4. 응원 생성 및 푸시 알림 발송

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| CHEER_1201 | 일일 응원 횟수 초과 |
| CHEER_1202 | 쿨다운 기간 (24시간 후 다시 시도) |
| CHEER_1203 | 친구 관계가 아님 |
| CHEER_1204 | 자신에게 응원 불가 |

### 💬 콕 찌르기와의 차이
- **콕 찌르기**: 특정 할 일에 대한 독촉 (todoId 필요)
- **응원하기**: 친구 자체에 대한 응원 (메시지만)
    `,
	})
	@ApiCreatedResponse({ type: CreateCheerResponseDto })
	@ApiUnauthorizedError()
	@ApiBadRequestError(ErrorCode.CHEER_1204)
	@ApiForbiddenError(ErrorCode.CHEER_1203)
	@ApiConflictError(ErrorCode.CHEER_1201)
	async sendCheer(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: SendCheerDto,
	): Promise<CreateCheerResponseDto> {
		this.logger.debug(
			`응원 보내기: senderId=${user.userId}, receiverId=${dto.receiverId}`,
		);

		const cheer = await this.cheerService.sendCheer({
			senderId: user.userId,
			receiverId: dto.receiverId,
			message: dto.message,
		});

		this.logger.log(
			`응원 완료: id=${cheer.id}, senderId=${user.userId}, receiverId=${dto.receiverId}`,
		);

		return {
			message: "응원을 보냈어요! 🎉",
			cheer: CheerMapper.toDto(cheer),
		};
	}

	// ============================================
	// 목록 조회
	// ============================================

	@Get("received")
	@ApiDoc({
		summary: "받은 응원 목록 조회",
		operationId: "getReceivedCheers",
		description: `
## 📥 받은 응원 목록 조회

내가 받은 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`limit\` | number | 20 | 조회할 개수 (1-50) |
| \`cursor\` | number | - | 페이지네이션 커서 (마지막 ID) |

### 📤 응답 구조
- \`cheers\`: 응원 목록 (발신자 정보 포함)
  - \`sender.id\`: 발신자 ID
  - \`sender.userTag\`: 발신자 태그 (8자리)
  - \`sender.name\`: 발신자 이름
  - \`sender.profileImage\`: 발신자 프로필 이미지
- \`totalCount\`: 조회된 응원 수
- \`unreadCount\`: 읽지 않은 응원 수
- \`hasMore\`: 다음 페이지 존재 여부
    `,
	})
	@ApiSuccessResponse({ type: ReceivedCheersResponseDto })
	@ApiUnauthorizedError()
	async getReceivedCheers(
		@CurrentUser() user: CurrentUserPayload,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<ReceivedCheersResponseDto> {
		this.logger.debug(`받은 응원 목록 조회: userId=${user.userId}`);

		const result = await this.cheerService.getReceivedCheers({
			userId: user.userId,
			cursor: cursor ? Number(cursor) : undefined,
			size: limit ? Number(limit) : undefined,
		});

		return {
			cheers: CheerMapper.toDetailDtoList(result.items),
			totalCount: result.items.length,
			unreadCount: result.items.filter((c) => !c.readAt).length,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("sent")
	@ApiDoc({
		summary: "보낸 응원 목록 조회",
		operationId: "getSentCheers",
		description: `
## 📤 보낸 응원 목록 조회

내가 보낸 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`limit\` | number | 20 | 조회할 개수 (1-50) |
| \`cursor\` | number | - | 페이지네이션 커서 (마지막 ID) |

### 📤 응답 구조
- \`cheers\`: 응원 목록 (발신자 정보 포함)
  - \`sender.id\`: 발신자 ID
  - \`sender.userTag\`: 발신자 태그 (8자리)
  - \`sender.name\`: 발신자 이름
  - \`sender.profileImage\`: 발신자 프로필 이미지
- \`totalCount\`: 조회된 응원 수
- \`hasMore\`: 다음 페이지 존재 여부
    `,
	})
	@ApiSuccessResponse({ type: SentCheersResponseDto })
	@ApiUnauthorizedError()
	async getSentCheers(
		@CurrentUser() user: CurrentUserPayload,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<SentCheersResponseDto> {
		this.logger.debug(`보낸 응원 목록 조회: userId=${user.userId}`);

		const result = await this.cheerService.getSentCheers({
			userId: user.userId,
			cursor: cursor ? Number(cursor) : undefined,
			size: limit ? Number(limit) : undefined,
		});

		return {
			cheers: CheerMapper.toDetailDtoList(result.items),
			totalCount: result.items.length,
			hasMore: result.pagination.hasNext,
		};
	}

	// ============================================
	// 제한 정보
	// ============================================

	@Get("limit")
	@ApiDoc({
		summary: "일일 응원 제한 정보 조회",
		operationId: "getCheerLimitInfo",
		description: `
## 📊 일일 응원 제한 정보 조회

오늘 사용한 응원 횟수와 남은 횟수를 확인합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📤 응답 구조
| 필드 | 타입 | 설명 |
|------|------|------|
| \`dailyLimit\` | number | null | 하루 제한 횟수 (null = 무제한) |
| \`usedToday\` | number | 오늘 사용한 횟수 |
| \`remainingToday\` | number | null | 오늘 남은 횟수 (null = 무제한) |
| \`isUnlimited\` | boolean | 무제한 여부 (ACTIVE 구독) |

### 💡 제한 정책
- FREE 구독: 하루 3회
- ACTIVE 구독: 무제한
    `,
	})
	@ApiSuccessResponse({ type: CheerLimitInfoDto })
	@ApiUnauthorizedError()
	async getLimitInfo(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<CheerLimitInfoDto> {
		const limitInfo = await this.cheerService.getLimitInfo(user.userId);

		return CheerMapper.toLimitInfoDto(limitInfo);
	}

	@Get("cooldown/:userId")
	@ApiParam({
		name: "userId",
		description:
			"쿨다운 상태를 확인할 친구의 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
		example: "clz7x5p8k0005qz0z8z8z8z8z",
	})
	@ApiDoc({
		summary: "특정 친구에 대한 쿨다운 상태 조회",
		operationId: "getCheerCooldownInfo",
		description: `
## ⏱️ 쿨다운 상태 조회

특정 친구에게 마지막으로 응원한 후 쿨다운 상태를 확인합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 확인할 친구의 ID (CUID)

### 📤 응답 구조
| 필드 | 타입 | 설명 |
|------|------|------|
| \`canCheer\` | boolean | 응원 가능 여부 |
| \`remainingSeconds\` | number | 남은 쿨다운 시간 (초) |
| \`cooldownEndsAt\` | string | null | 다시 응원할 수 있는 시각 |

### 💡 쿨다운 정책
- 동일 친구에게 24시간 내 재응원 불가
    `,
	})
	@ApiSuccessResponse({ type: CheerCooldownResponseDto })
	@ApiUnauthorizedError()
	async getCooldownInfo(
		@CurrentUser() user: CurrentUserPayload,
		@Param("userId") targetUserId: string,
	): Promise<CheerCooldownResponseDto> {
		const cooldownInfo = await this.cheerService.getCooldownInfoForUser(
			user.userId,
			targetUserId,
		);

		return {
			userId: targetUserId,
			canCheer: !cooldownInfo.isActive,
			remainingSeconds: cooldownInfo.remainingSeconds,
			cooldownEndsAt: cooldownInfo.canCheerAt ?? null,
		};
	}

	// ============================================
	// 읽음 처리
	// ============================================

	@Patch(":id/read")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "응원 읽음 처리",
		operationId: "markCheerAsRead",
		description: `
## ✅ 응원 읽음 처리

받은 응원을 읽음 상태로 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 읽음 처리할 응원 ID (number)

### 💡 동작 방식
1. 응원 존재 확인
2. 수신자 본인 확인
3. 읽음 시각 기록

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| CHEER_1205 | 응원을 찾을 수 없음 |
    `,
	})
	@ApiSuccessResponse({ type: MarkCheerReadResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.CHEER_1205)
	async markAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Param("id", ParseIntPipe) id: number,
	): Promise<MarkCheerReadResponseDto> {
		this.logger.debug(`응원 읽음 처리: userId=${user.userId}, id=${id}`);

		await this.cheerService.markAsRead(user.userId, id);

		return {
			message: "확인했습니다.",
			readCount: 1,
		};
	}

	@Patch("read")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "여러 응원 읽음 처리",
		operationId: "markManyCheersAsRead",
		description: `
## ✅ 여러 응원 읽음 처리

여러 개의 받은 응원을 한 번에 읽음 상태로 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 본문
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`cheerIds\` | number[] | ✅ | 읽음 처리할 응원 ID 목록 |

### 💡 동작 방식
1. 수신자 본인의 응원만 필터링
2. 아직 읽지 않은 응원만 읽음 처리
3. 실제 처리된 개수 반환
    `,
	})
	@ApiSuccessResponse({ type: MarkCheerReadResponseDto })
	@ApiUnauthorizedError()
	async markManyAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: MarkCheersReadDto,
	): Promise<MarkCheerReadResponseDto> {
		this.logger.debug(
			`여러 응원 읽음 처리: userId=${user.userId}, count=${dto.cheerIds.length}`,
		);

		const count = await this.cheerService.markManyAsRead(
			user.userId,
			dto.cheerIds,
		);

		return {
			message: `${count}개의 응원을 확인했습니다.`,
			readCount: count,
		};
	}
}
