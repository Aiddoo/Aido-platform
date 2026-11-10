import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { IdempotencyKey, Timezone } from "#api/platform/http/decorators/index";
import {
  ApiBadRequestError,
  ApiDoc,
  ApiErrorCodesResponse,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";

import { ApplyActionPlanUseCase } from "../../../application/use-cases/apply-action-plan.use-case.js";
import { ApiIdempotencyKeyHeader } from "../plan-request.decorator.js";
import { toApplyActionPlanResponse } from "./action-plan-response.mapper.js";
import { ApplyActionPlanRequestDto, ApplyActionPlanResponseDto } from "./action-plan.dto.js";

const ACTION_PLAN_THROTTLE = { default: { ttl: 60_000, limit: 10 } } as const;

@ApiTags(SWAGGER_TAGS.VOICE)
@ApiBearerAuth()
@Controller("action-plans")
export class ActionPlanController {
  readonly #applyActionPlan: ApplyActionPlanUseCase;

  constructor(applyActionPlan: ApplyActionPlanUseCase) {
    this.#applyActionPlan = applyActionPlan;
  }

  @Post("apply")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle(ACTION_PLAN_THROTTLE)
  @ApiIdempotencyKeyHeader()
  @ApiDoc({
    summary: "사용자가 확인한 계획 저장",
    operationId: "applyActionPlan",
    description: `사용자가 확인한 행동만 손으로 만든 것과 같은 경로로 저장합니다(알림·위젯·카테고리 한도가 같게 동작합니다). 사용 횟수를 차감하지 않고 AI도 부르지 않습니다.

\`source\`가 \`MEMO\`면 \`sourceMemoId\`가 필수이고 저장에 성공하면 그 메모를 지웁니다(없거나 내 메모가 아니면 MEMO_2001).

하나라도 실패하면 아무것도 저장하지 않습니다. 같은 \`Idempotency-Key\`의 재요청은 새로 만들지 않고 처음 저장한 결과를 돌려주며, 내용이 다르면 AI_1318입니다.`,
  })
  @ApiSuccessResponse({ type: ApplyActionPlanResponseDto })
  @ApiBadRequestError(ErrorCode.AI_1316)
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.MEMO_2001)
  @ApiErrorCodesResponse(HttpStatus.UNPROCESSABLE_ENTITY, [ErrorCode.AI_1315, ErrorCode.AI_1318])
  async apply(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: ApplyActionPlanRequestDto }) dto: ApplyActionPlanRequestDto,
    @IdempotencyKey() idempotencyKey: string,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<ApplyActionPlanResponseDto> {
    const applied = await this.#applyActionPlan.execute({
      userId: user.userId,
      timezone,
      source: dto.source,
      sourceMemoId: dto.sourceMemoId,
      actions: dto.actions,
      idempotencyKey,
    });
    return toApplyActionPlanResponse(applied);
  }
}
