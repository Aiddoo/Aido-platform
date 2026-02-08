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
import { ApiBearerAuth, ApiHeader, ApiParam, ApiTags } from "@nestjs/swagger";
import { Timezone } from "@/common/decorators";
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
	GetNudgesQueryDto,
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
 * 친구의 할 일을 콕 찌르고 관리하는 API입니다.
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
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "콕 찌르기",
		operationId: "sendNudge",
		description: `친구의 할 일을 콕 찌릅니다.

**요청 필드**
- \`receiverId\` (필수): 콕 찌를 친구 ID
- \`todoId\` (필수): 찔러줄 할 일 ID
- \`message\` (선택): 메시지 (최대 200자)

**제한**
- FREE: 일 10회, ACTIVE: 무제한
- 동일 Todo에 24시간 쿨다운`,
	})
	@ApiCreatedResponse({ type: CreateNudgeResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.NUDGE_1104)
	@ApiForbiddenError(ErrorCode.NUDGE_1103)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiConflictError(ErrorCode.NUDGE_1101)
	async sendNudge(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: SendNudgeDto,
		@Timezone() tz: string,
	): Promise<CreateNudgeResponseDto> {
		this.logger.debug(
			`콕 찌르기: senderId=${user.userId}, receiverId=${dto.receiverId}, todoId=${dto.todoId}`,
		);

		const nudge = await this.nudgeService.sendNudge(
			{
				senderId: user.userId,
				receiverId: dto.receiverId,
				todoId: dto.todoId,
				message: dto.message,
			},
			tz,
		);

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
		operationId: "getReceivedNudges",
		description: `받은 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
	})
	@ApiSuccessResponse({ type: ReceivedNudgesResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getReceivedNudges(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetNudgesQueryDto,
	): Promise<ReceivedNudgesResponseDto> {
		this.logger.debug(`받은 콕 찌름 목록 조회: userId=${user.userId}`);

		const result = await this.nudgeService.getReceivedNudges({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
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
		operationId: "getSentNudges",
		description: `보낸 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
	})
	@ApiSuccessResponse({ type: SentNudgesResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getSentNudges(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetNudgesQueryDto,
	): Promise<SentNudgesResponseDto> {
		this.logger.debug(`보낸 콕 찌름 목록 조회: userId=${user.userId}`);

		const result = await this.nudgeService.getSentNudges({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
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
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "일일 콕 찌르기 제한 정보 조회",
		operationId: "getNudgeLimitInfo",
		description: `오늘 사용한 콕 찌르기 횟수와 남은 횟수를 확인합니다.

**제한 정책**: FREE 일 10회, ACTIVE 무제한`,
	})
	@ApiSuccessResponse({ type: NudgeLimitInfoDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getLimitInfo(
		@CurrentUser() user: CurrentUserPayload,
		@Timezone() tz: string,
	): Promise<NudgeLimitInfoDto> {
		const limitInfo = await this.nudgeService.getLimitInfo(user.userId, tz);

		return NudgeMapper.toLimitInfoDto(limitInfo);
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
		operationId: "getNudgeCooldownInfo",
		description: `특정 친구에게 콕 찌르기 가능 여부와 남은 쿨다운 시간을 확인합니다.

**쿨다운 정책**: 동일 친구에게 24시간 내 재콕 찌르기 불가`,
	})
	@ApiSuccessResponse({ type: NudgeCooldownResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getCooldownInfo(
		@CurrentUser() user: CurrentUserPayload,
		@Param("userId") targetUserId: string,
	): Promise<NudgeCooldownResponseDto> {
		const cooldownInfo = await this.nudgeService.getCooldownInfoForUser(
			user.userId,
			targetUserId,
		);

		return {
			canNudge: !cooldownInfo.isActive,
			cooldownEndsAt: cooldownInfo.cooldownEndsAt?.toISOString() ?? null,
			remainingSeconds:
				cooldownInfo.remainingSeconds > 0
					? cooldownInfo.remainingSeconds
					: null,
		};
	}

	// ============================================
	// 읽음 처리
	// ============================================

	@Patch(":id/read")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "콕 찌름 읽음 처리",
		operationId: "markNudgeAsRead",
		description: `받은 콕 찌름을 읽음 상태로 변경합니다.`,
	})
	@ApiSuccessResponse({ type: MarkNudgeReadResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
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
