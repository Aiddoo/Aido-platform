import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AiDataSharingConsentGuard } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { ClientAbortSignal } from "#api/platform/http/decorators/client-abort-signal.decorator";
import { IdempotencyKey } from "#api/platform/http/decorators/idempotency-key.decorator";
import { Locale } from "#api/platform/http/decorators/locale.decorator";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiServiceUnavailableError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { CreateQuickPlanUseCase } from "../../../application/use-cases/create-quick-plan.use-case.js";
import { ApiIdempotencyKeyHeader, ApiPlanningLocaleHeaders } from "../plan-request.decorator.js";
import { toQuickPlanResponse } from "./action-plan-response.mapper.js";
import { QuickPlanRequestDto, QuickPlanResponseDto } from "./action-plan.dto.js";

const QUICK_PLAN_THROTTLE = { default: { ttl: 60_000, limit: 20 } } as const;

@ApiTags(SWAGGER_TAGS.VOICE)
@ApiBearerAuth()
@Controller("quick-plans")
export class QuickPlanController {
  readonly #createQuickPlan: CreateQuickPlanUseCase;

  constructor(createQuickPlan: CreateQuickPlanUseCase) {
    this.#createQuickPlan = createQuickPlan;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiDataSharingConsentGuard)
  @ThrottleByUser()
  @Throttle(QUICK_PLAN_THROTTLE)
  @ApiIdempotencyKeyHeader()
  @ApiPlanningLocaleHeaders()
  @ApiDoc({
    summary: "짧은 말·글을 실행 계획으로 정리",
    operationId: "createQuickPlan",
    description: `기기가 전사한 말이나 적은 글을 할 일·메모 계획으로 정리합니다. 저장하지 않으며 사용자가 확인한 행동만 \`POST /v1/action-plans/apply\`로 저장합니다.

## 🚫 사용량
AI 할 일 만들기(글·말·메모 공통): 무료 월 ${PLAN_CATALOG.AI_PARSE.free}회, 프리미엄 넉넉하게(월 ${PLAN_CATALOG.AI_PARSE.fairUse.premium.toLocaleString("ko-KR")}회까지). 할 일을 찾지 못하거나 실패하면 차감하지 않습니다(\`charged\`).

## 🔁 재시도
같은 \`Idempotency-Key\`는 한 번만 차감합니다. 처리 중이면 AI_1314, 결과를 잃었으면 추가 차감 없이 다시 만들고, 내용이 다르면 AI_1318입니다.`,
  })
  @ApiSuccessResponse({ type: QuickPlanResponseDto })
  @ApiBadRequestError(ErrorCode.AI_1316)
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1311)
  @ApiConflictError(ErrorCode.AI_1314)
  @ApiErrorCodesResponse(HttpStatus.UNPROCESSABLE_ENTITY, [ErrorCode.AI_1302, ErrorCode.AI_1318])
  @ApiErrorCodesResponse(HttpStatus.TOO_MANY_REQUESTS, [ErrorCode.AI_1303, ErrorCode.AI_1310])
  @ApiServiceUnavailableError(ErrorCode.AI_1301)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: QuickPlanRequestDto }) dto: QuickPlanRequestDto,
    @IdempotencyKey() idempotencyKey: string,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
    @Locale() locale: SupportedLocale | undefined,
    @ClientAbortSignal() signal: AbortSignal,
  ): Promise<QuickPlanResponseDto> {
    const created = await this.#createQuickPlan.execute({
      userId: user.userId,
      text: dto.text,
      source: dto.source,
      idempotencyKey,
      timezone,
      locale,
      signal,
    });
    return toQuickPlanResponse(created);
  }
}
