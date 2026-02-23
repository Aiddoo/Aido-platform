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
	ApiTooManyRequestsError,
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
	GetCheersQueryDto,
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
	readonly #logger = new Logger(CheerController.name);

	constructor(private readonly cheerService: CheerService) {}

	// ============================================
	// 응원 보내기
	// ============================================

	@Post()
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "응원 보내기",
		operationId: "sendCheer",
		description: `친구에게 응원 메시지를 보냅니다.

**요청 필드**
- \`receiverId\` (필수): 응원할 친구 ID
- \`message\` (선택): 응원 메시지 (최대 200자)

**제한**
- FREE: 일 3회, ACTIVE: 무제한
- 동일 친구에게 24시간 쿨다운`,
	})
	@ApiCreatedResponse({ type: CreateCheerResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.CHEER_1204)
	@ApiForbiddenError(ErrorCode.CHEER_1203)
	@ApiConflictError(ErrorCode.CHEER_1201)
	@ApiTooManyRequestsError(ErrorCode.CHEER_1202)
	async sendCheer(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: SendCheerDto,
		@Timezone() tz: string,
	): Promise<CreateCheerResponseDto> {
		this.#logger.debug(
			`응원 보내기: senderId=${user.userId}, receiverId=${dto.receiverId}`,
		);

		const cheer = await this.cheerService.sendCheer(
			{
				senderId: user.userId,
				receiverId: dto.receiverId,
				message: dto.message,
			},
			tz,
		);

		this.#logger.log(
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
		description: `받은 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
	})
	@ApiSuccessResponse({ type: ReceivedCheersResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getReceivedCheers(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetCheersQueryDto,
	): Promise<ReceivedCheersResponseDto> {
		this.#logger.debug(`받은 응원 목록 조회: userId=${user.userId}`);

		const result = await this.cheerService.getReceivedCheers({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
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
		description: `보낸 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
	})
	@ApiSuccessResponse({ type: SentCheersResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getSentCheers(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetCheersQueryDto,
	): Promise<SentCheersResponseDto> {
		this.#logger.debug(`보낸 응원 목록 조회: userId=${user.userId}`);

		const result = await this.cheerService.getSentCheers({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
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
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "일일 응원 제한 정보 조회",
		operationId: "getCheerLimitInfo",
		description: `오늘 사용한 응원 횟수와 남은 횟수를 확인합니다.

**제한 정책**: FREE 일 3회, ACTIVE 무제한`,
	})
	@ApiSuccessResponse({ type: CheerLimitInfoDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getLimitInfo(
		@CurrentUser() user: CurrentUserPayload,
		@Timezone() tz: string,
	): Promise<CheerLimitInfoDto> {
		const limitInfo = await this.cheerService.getLimitInfo(user.userId, tz);

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
		description: `특정 친구에게 응원 가능 여부와 남은 쿨다운 시간을 확인합니다.

**쿨다운 정책**: 동일 친구에게 24시간 내 재응원 불가`,
	})
	@ApiSuccessResponse({ type: CheerCooldownResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
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
			cooldownEndsAt: cooldownInfo.canCheerAt?.toISOString() ?? null,
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
		description: `받은 응원을 읽음 상태로 변경합니다.`,
	})
	@ApiSuccessResponse({ type: MarkCheerReadResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.CHEER_1205)
	async markAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Param("id", ParseIntPipe) id: number,
	): Promise<MarkCheerReadResponseDto> {
		this.#logger.debug(`응원 읽음 처리: userId=${user.userId}, id=${id}`);

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
		description: `여러 응원을 한 번에 읽음 상태로 변경합니다.

**요청 필드**
- \`cheerIds\` (필수): 읽음 처리할 응원 ID 배열`,
	})
	@ApiSuccessResponse({ type: MarkCheerReadResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async markManyAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: MarkCheersReadDto,
	): Promise<MarkCheerReadResponseDto> {
		this.#logger.debug(
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
