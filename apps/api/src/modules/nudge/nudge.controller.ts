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
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

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

import {
	CreateNudgeResponseDto,
	MarkNudgeReadResponseDto,
	NudgeCooldownResponseDto,
	NudgeLimitInfoDto,
	ReceivedNudgesResponseDto,
	SendNudgeDto,
	SentNudgesResponseDto,
} from "./dtos";
import { NudgeMapper } from "./nudge.mapper";
import { NudgeService } from "./nudge.service";

/**
 * Nudge API 컨트롤러
 *
 * ## 👆 콕 찌르기 API
 *
 * 친구의 할 일을 독촉(콕 찌르기)하고 관리하는 API입니다.
 *
 * ### 콕 찌르기
 * - POST /nudges - 콕 찌르기
 *
 * ### 목록 조회
 * - GET /nudges/received - 받은 콕 찌름 목록
 * - GET /nudges/sent - 보낸 콕 찌름 목록
 *
 * ### 제한 정보
 * - GET /nudges/limit - 오늘 남은 콕 찌르기 횟수
 * - GET /nudges/cooldown/:userId - 특정 친구에 대한 쿨다운 상태
 *
 * ### 읽음 처리
 * - PATCH /nudges/:id/read - 콕 찌름 읽음 처리
 */
@ApiTags(SWAGGER_TAGS.NUDGES)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("nudges")
export class NudgeController {
	private readonly logger = new Logger(NudgeController.name);

	constructor(private readonly nudgeService: NudgeService) {}

	// ============================================
	// 콕 찌르기
	// ============================================

	@Post()
	@ApiDoc({
		summary: "콕 찌르기",
		description: `
## 👆 콕 찌르기

친구의 할 일을 독촉합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 본문
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`receiverId\` | string | ✅ | 콕 찌를 친구의 ID (CUID) |
| \`todoId\` | number | ✅ | 찔러줄 할 일의 ID |
| \`message\` | string | ❌ | 응원 메시지 (최대 200자) |

### 💡 동작 방식
1. 친구 관계 확인 (상호 팔로우)
2. Todo 존재 및 소유자 확인
3. 일일 제한 체크 (FREE: 10회, ACTIVE: 무제한)
4. 쿨다운 체크 (동일 Todo에 24시간)
5. 콕 찌르기 생성 및 푸시 알림 발송

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| NUDGE_1101 | 일일 독촉 횟수 초과 |
| NUDGE_1102 | 쿨다운 기간 (24시간 후 다시 시도) |
| NUDGE_1103 | 친구 관계가 아님 |
| NUDGE_1104 | 자신에게 독촉 불가 |
| TODO_0801 | 할 일을 찾을 수 없음 |
    `,
	})
	@ApiCreatedResponse({ type: CreateNudgeResponseDto })
	@ApiUnauthorizedError()
	@ApiBadRequestError(ErrorCode.NUDGE_1104)
	@ApiForbiddenError(ErrorCode.NUDGE_1103)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiConflictError(ErrorCode.NUDGE_1101)
	async sendNudge(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: SendNudgeDto,
	): Promise<CreateNudgeResponseDto> {
		this.logger.debug(
			`콕 찌르기: senderId=${user.userId}, receiverId=${dto.receiverId}, todoId=${dto.todoId}`,
		);

		const nudge = await this.nudgeService.sendNudge({
			senderId: user.userId,
			receiverId: dto.receiverId,
			todoId: dto.todoId,
			message: dto.message,
		});

		this.logger.log(
			`콕 찌르기 완료: id=${nudge.id}, senderId=${user.userId}, receiverId=${dto.receiverId}`,
		);

		return {
			message: "콕! 찔렀습니다 👆",
			nudge: NudgeMapper.toDto(nudge),
		};
	}

	// ============================================
	// 목록 조회
	// ============================================

	@Get("received")
	@ApiDoc({
		summary: "받은 콕 찌름 목록 조회",
		description: `
## 📥 받은 콕 찌름 목록 조회

내가 받은 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`limit\` | number | 20 | 조회할 개수 (1-50) |
| \`cursor\` | number | - | 페이지네이션 커서 (마지막 ID) |

### 📤 응답 구조
- \`nudges\`: 콕 찌름 목록 (발신자, 할 일 정보 포함)
  - \`sender.id\`: 발신자 ID
  - \`sender.userTag\`: 발신자 태그 (8자리)
  - \`sender.name\`: 발신자 이름
  - \`sender.profileImage\`: 발신자 프로필 이미지
- \`totalCount\`: 전체 받은 콕 찌름 수
- \`unreadCount\`: 읽지 않은 콕 찌름 수
- \`hasMore\`: 다음 페이지 존재 여부
    `,
	})
	@ApiSuccessResponse({ type: ReceivedNudgesResponseDto })
	@ApiUnauthorizedError()
	@ApiQuery({
		name: "limit",
		required: false,
		type: Number,
		description: "조회할 개수 (1-50, 기본값: 20)",
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		type: Number,
		description: "페이지네이션 커서",
	})
	async getReceivedNudges(
		@CurrentUser() user: CurrentUserPayload,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<ReceivedNudgesResponseDto> {
		this.logger.debug(`받은 콕 찌름 목록 조회: userId=${user.userId}`);

		const result = await this.nudgeService.getReceivedNudges({
			userId: user.userId,
			cursor: cursor ? Number(cursor) : undefined,
			size: limit ? Number(limit) : undefined,
		});

		return {
			nudges: NudgeMapper.toDetailDtoList(result.items),
			totalCount: result.items.length,
			unreadCount: result.items.filter((n) => !n.readAt).length,
			hasMore: result.pagination.hasNext,
		};
	}

	@Get("sent")
	@ApiDoc({
		summary: "보낸 콕 찌름 목록 조회",
		description: `
## 📤 보낸 콕 찌름 목록 조회

내가 보낸 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`limit\` | number | 20 | 조회할 개수 (1-50) |
| \`cursor\` | number | - | 페이지네이션 커서 (마지막 ID) |

### 📤 응답 구조
- \`nudges\`: 콕 찌름 목록 (발신자, 할 일 정보 포함)
  - \`sender.id\`: 발신자 ID
  - \`sender.userTag\`: 발신자 태그 (8자리)
  - \`sender.name\`: 발신자 이름
  - \`sender.profileImage\`: 발신자 프로필 이미지
- \`totalCount\`: 전체 보낸 콕 찌름 수
- \`hasMore\`: 다음 페이지 존재 여부
    `,
	})
	@ApiSuccessResponse({ type: SentNudgesResponseDto })
	@ApiUnauthorizedError()
	@ApiQuery({
		name: "limit",
		required: false,
		type: Number,
		description: "조회할 개수 (1-50, 기본값: 20)",
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		type: Number,
		description: "페이지네이션 커서",
	})
	async getSentNudges(
		@CurrentUser() user: CurrentUserPayload,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	): Promise<SentNudgesResponseDto> {
		this.logger.debug(`보낸 콕 찌름 목록 조회: userId=${user.userId}`);

		const result = await this.nudgeService.getSentNudges({
			userId: user.userId,
			cursor: cursor ? Number(cursor) : undefined,
			size: limit ? Number(limit) : undefined,
		});

		return {
			nudges: NudgeMapper.toDetailDtoList(result.items),
			totalCount: result.items.length,
			hasMore: result.pagination.hasNext,
		};
	}

	// ============================================
	// 제한 정보
	// ============================================

	@Get("limit")
	@ApiDoc({
		summary: "일일 콕 찌르기 제한 정보 조회",
		description: `
## 📊 일일 콕 찌르기 제한 정보 조회

오늘 사용한 콕 찌르기 횟수와 남은 횟수를 확인합니다.

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
- FREE 구독: 하루 10회
- ACTIVE 구독: 무제한
    `,
	})
	@ApiSuccessResponse({ type: NudgeLimitInfoDto })
	@ApiUnauthorizedError()
	async getLimitInfo(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<NudgeLimitInfoDto> {
		const limitInfo = await this.nudgeService.getLimitInfo(user.userId);

		return NudgeMapper.toLimitInfoDto(limitInfo);
	}

	@Get("cooldown/:userId")
	@ApiDoc({
		summary: "특정 친구에 대한 쿨다운 상태 조회",
		description: `
## ⏱️ 쿨다운 상태 조회

특정 친구에게 마지막으로 콕 찌른 후 쿨다운 상태를 확인합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`userId\`: 확인할 친구의 ID (CUID)

### 📤 응답 구조
| 필드 | 타입 | 설명 |
|------|------|------|
| \`isOnCooldown\` | boolean | 쿨다운 중 여부 |
| \`remainingSeconds\` | number | 남은 쿨다운 시간 (초) |
| \`canNudgeAt\` | string | null | 다시 찌를 수 있는 시각 |

### 💡 쿨다운 정책
- 동일 친구에게 24시간 내 재독촉 불가
    `,
	})
	@ApiSuccessResponse({ type: NudgeCooldownResponseDto })
	@ApiUnauthorizedError()
	async getCooldownInfo(
		@CurrentUser() user: CurrentUserPayload,
		@Param("userId") targetUserId: string,
	): Promise<NudgeCooldownResponseDto> {
		const cooldownInfo = await this.nudgeService.getCooldownInfoForUser(
			user.userId,
			targetUserId,
		);

		return {
			isOnCooldown: cooldownInfo.isActive,
			remainingSeconds: cooldownInfo.remainingSeconds,
			canNudgeAt: cooldownInfo.canNudgeAt?.toISOString() ?? null,
		};
	}

	// ============================================
	// 읽음 처리
	// ============================================

	@Patch(":id/read")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "콕 찌름 읽음 처리",
		description: `
## ✅ 콕 찌름 읽음 처리

받은 콕 찌름을 읽음 상태로 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 읽음 처리할 콕 찌름 ID (number)

### 💡 동작 방식
1. 콕 찌름 존재 확인
2. 수신자 본인 확인
3. 읽음 시각 기록

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| NUDGE_1105 | 콕 찌름을 찾을 수 없음 |
    `,
	})
	@ApiSuccessResponse({ type: MarkNudgeReadResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	async markAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Param("id", ParseIntPipe) id: number,
	): Promise<MarkNudgeReadResponseDto> {
		this.logger.debug(`콕 찌름 읽음 처리: userId=${user.userId}, id=${id}`);

		await this.nudgeService.markAsRead(user.userId, id);

		return {
			message: "확인했습니다.",
			readCount: 1,
		};
	}
}
