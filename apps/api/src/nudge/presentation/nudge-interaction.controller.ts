import { ErrorCode } from "@aido/errors";
import { Body, Controller, Get, Header, Headers, Param, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import { CurrentUser, type CurrentUserPayload } from "#api/auth/presentation/decorators/index";
import {
	ApiConflictError,
	ApiDoc,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "#api/shared/presentation/swagger/index";

import { GetNudgeInteractionAvailabilityUseCase } from "../application/queries/get-nudge-interaction-availability/get-nudge-interaction-availability.use-case.js";
import { GetNudgeInteractionUseCase } from "../application/queries/get-nudge-interaction/get-nudge-interaction.use-case.js";
import { GetNudgeInteractionsUseCase } from "../application/queries/get-nudge-interactions/get-nudge-interactions.use-case.js";
import { GetNudgeThanksPreviewUseCase } from "../application/queries/get-nudge-thanks-preview/get-nudge-thanks-preview.use-case.js";
import { ReplyToNudgeUseCase } from "../application/use-cases/reply-to-nudge/reply-to-nudge.use-case.js";
import { SendNudgeThanksUseCase } from "../application/use-cases/send-nudge-thanks/send-nudge-thanks.use-case.js";
import { NudgeIdParamDto } from "./dtos/request/nudge-id-param.dto.js";
import {
	GetNudgeInteractionsQueryDto,
	GetNudgeThanksPreviewQueryDto,
	NudgeTodoIdParamDto,
	ReplyToNudgeDto,
	SendNudgeThanksDto,
} from "./dtos/request/nudge-interaction.dto.js";
import {
	NudgeInteractionAvailabilityResponseDto,
	NudgeInteractionResponseDto,
	NudgeInteractionsResponseDto,
	NudgeThanksPreviewResponseDto,
	SendNudgeThanksResponseDto,
} from "./dtos/response/nudge-interaction.response.dto.js";
import { NudgeInteractionMapper } from "./nudge-interaction.mapper.js";

@ApiTags(SWAGGER_TAGS.NUDGES)
@ApiBearerAuth()
@ApiHeader({ name: "X-App-Version", required: false, description: "설치된 앱 버전" })
@Controller("nudges")
export class NudgeInteractionController {
	constructor(
		private readonly getNudgeInteractionAvailabilityUseCase: GetNudgeInteractionAvailabilityUseCase,
		private readonly getNudgeInteractionsUseCase: GetNudgeInteractionsUseCase,
		private readonly getNudgeInteractionUseCase: GetNudgeInteractionUseCase,
		private readonly getNudgeThanksPreviewUseCase: GetNudgeThanksPreviewUseCase,
		private readonly replyToNudgeUseCase: ReplyToNudgeUseCase,
		private readonly sendNudgeThanksUseCase: SendNudgeThanksUseCase,
	) {}

	@Get("interactions/availability")
	@ApiDoc({
		summary: "콕 주고받기 기능 사용 가능 여부",
		operationId: "getNudgeInteractionAvailability",
	})
	@ApiSuccessResponse({ type: NudgeInteractionAvailabilityResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	getAvailability(): NudgeInteractionAvailabilityResponseDto {
		return this.getNudgeInteractionAvailabilityUseCase.execute();
	}

	@Get("interactions")
	@Header("Vary", "Origin, X-App-Version")
	@ApiDoc({ summary: "주고받은 콕 목록 조회", operationId: "getNudgeInteractions" })
	@ApiSuccessResponse({ type: NudgeInteractionsResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	async getInteractions(
		@CurrentUser() user: CurrentUserPayload,
		@Query({ schema: GetNudgeInteractionsQueryDto }) query: GetNudgeInteractionsQueryDto,
		@Headers("x-app-version") appVersion?: string,
	): Promise<NudgeInteractionsResponseDto> {
		const page = await this.getNudgeInteractionsUseCase.execute({
			userId: user.userId,
			direction: query.direction,
			cursor: query.cursor,
			size: query.limit,
		});
		return {
			...page,
			items: page.items.map((nudge) =>
				NudgeInteractionMapper.toDto(nudge, user.userId, appVersion),
			),
		};
	}

	@Get(":id/interaction")
	@Header("Vary", "Origin, X-App-Version")
	@ApiDoc({ summary: "콕 답장·감사 상태 조회", operationId: "getNudgeInteraction" })
	@ApiSuccessResponse({ type: NudgeInteractionResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	async getInteraction(
		@CurrentUser() user: CurrentUserPayload,
		@Param({ schema: NudgeIdParamDto }) params: NudgeIdParamDto,
		@Headers("x-app-version") appVersion?: string,
	): Promise<NudgeInteractionResponseDto> {
		const nudge = await this.getNudgeInteractionUseCase.execute({
			userId: user.userId,
			nudgeId: params.id,
		});
		return NudgeInteractionMapper.toDto(nudge, user.userId, appVersion);
	}

	@Put(":id/reply")
	@Header("Vary", "Origin, X-App-Version")
	@ApiDoc({
		summary: "받은 콕에 답장",
		operationId: "replyToNudge",
		description:
			"첫 답장에만 알림을 보냅니다. 답장을 변경해도 알림을 반복하지 않으며 할 일 완료 상태를 바꾸지 않습니다.",
	})
	@ApiSuccessResponse({ type: NudgeInteractionResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	@ApiConflictError(ErrorCode.NUDGE_1109)
	async reply(
		@CurrentUser() user: CurrentUserPayload,
		@Param({ schema: NudgeIdParamDto }) params: NudgeIdParamDto,
		@Body({ schema: ReplyToNudgeDto }) body: ReplyToNudgeDto,
		@Headers("x-app-version") appVersion?: string,
	): Promise<NudgeInteractionResponseDto> {
		const nudge = await this.replyToNudgeUseCase.execute({
			userId: user.userId,
			nudgeId: params.id,
			replyKind: body.replyKind,
		});
		return NudgeInteractionMapper.toDto(nudge, user.userId, appVersion);
	}

	@Get("todos/:todoId/thanks")
	@Header("Vary", "Origin, X-App-Version")
	@ApiDoc({ summary: "감사를 받을 친구 미리보기", operationId: "getNudgeThanksPreview" })
	@ApiSuccessResponse({ type: NudgeThanksPreviewResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	@ApiConflictError(ErrorCode.NUDGE_1110)
	async getThanksPreview(
		@CurrentUser() user: CurrentUserPayload,
		@Param({ schema: NudgeTodoIdParamDto }) params: NudgeTodoIdParamDto,
		@Query({ schema: GetNudgeThanksPreviewQueryDto }) query: GetNudgeThanksPreviewQueryDto,
		@Headers("x-app-version") appVersion?: string,
	): Promise<NudgeThanksPreviewResponseDto> {
		const preview = await this.getNudgeThanksPreviewUseCase.execute({
			userId: user.userId,
			todoId: params.todoId,
			...query,
		});
		return NudgeInteractionMapper.toThanksPreviewDto(preview, appVersion);
	}

	@Put("todos/:todoId/thanks")
	@ApiDoc({
		summary: "완료한 할 일의 콕에 감사 전하기",
		operationId: "sendNudgeThanks",
		description:
			"미리보기 시점까지 콕을 보낸 현재 친구에게 감사를 전합니다. 같은 할 일·친구에게 한 번만 보내며 재요청은 성공한 결과 sentCount: 0을 반환합니다.",
	})
	@ApiSuccessResponse({ type: SendNudgeThanksResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.NUDGE_1105)
	@ApiConflictError(ErrorCode.NUDGE_1109)
	@ApiConflictError(ErrorCode.NUDGE_1110)
	sendThanks(
		@CurrentUser() user: CurrentUserPayload,
		@Param({ schema: NudgeTodoIdParamDto }) params: NudgeTodoIdParamDto,
		@Body({ schema: SendNudgeThanksDto }) body: SendNudgeThanksDto,
	): Promise<SendNudgeThanksResponseDto> {
		return this.sendNudgeThanksUseCase.execute({
			userId: user.userId,
			todoId: params.todoId,
			throughNudgeId: body.throughNudgeId,
		});
	}
}
