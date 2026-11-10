import { ErrorCode } from "@aido/api/errors";
import {
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PLANS,
  type Plan,
  type PlanFeature,
  type PlanQuotaPeriod,
} from "@aido/api/vocabulary";
import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { Timezone } from "#api/platform/http/decorators/index";
import {
  ApiDoc,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";

import { GetEntitlementSnapshotUseCase } from "../../../application/use-cases/get-entitlement-snapshot.use-case.js";
import { toEntitlementSnapshotResponse } from "./entitlement-response.mapper.js";
import { EntitlementSnapshotDto } from "./entitlement.dto.js";

const PERIOD_LABEL = { day: "하루", month: "월" } as const satisfies Record<
  PlanQuotaPeriod,
  string
>;

function describeCount(feature: PlanFeature, plan: Plan): string {
  const definition = PLAN_CATALOG[feature];
  if (definition.kind === "flag") {
    return definition[plan] ? "사용" : "-";
  }
  const value = definition[plan];
  if (definition.kind === "resource") {
    return value == null ? "무제한" : `${value}개`;
  }
  const period = PERIOD_LABEL[definition.period];
  if (value != null) {
    return `${period} ${value.toLocaleString("ko-KR")}회`;
  }
  return "fairUse" in definition
    ? `넉넉하게(${period} ${definition.fairUse.premium.toLocaleString("ko-KR")}회까지)`
    : "무제한";
}

/** 카탈로그 숫자를 그대로 보여 주는 표. 숫자는 PLAN_CATALOG에서만 고친다. */
const PLAN_CATALOG_TABLE = PLAN_FEATURE_KEYS.map(
  (feature) =>
    `| \`${feature}\` | ${PLAN_CATALOG[feature].kind} | ${PLANS.map((plan) => describeCount(feature, plan)).join(" | ")} |`,
).join("\n");

@ApiTags(SWAGGER_TAGS.ENTITLEMENTS)
@ApiBearerAuth()
@Controller("entitlements")
export class EntitlementController {
  readonly #getEntitlementSnapshot: GetEntitlementSnapshotUseCase;

  constructor(getEntitlementSnapshot: GetEntitlementSnapshotUseCase) {
    this.#getEntitlementSnapshot = getEntitlementSnapshot;
  }

  @Get()
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "응원·찌르기 일간 사용량의 하루 기준 (IANA). 미전송 시 UTC입니다.",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "내 권한·한도·사용량 조회",
    operationId: "getEntitlements",
    description: `PLAN_CATALOG 모든 기능의 현재 권한과 한도·사용량을 서버가 계산해 돌려줍니다. 앱은 이 값을 그대로 보여 주고 직접 계산하지 않습니다.

## 📋 기능별 플랜
ADMIN 주체도 프리미엄 열의 값을 받습니다.

| 기능 | 종류 | 무료 | 프리미엄 |
|------|------|------|----------|
${PLAN_CATALOG_TABLE}

## 📊 featureQuota
- \`limit\`: 서버가 실제로 막는 한도입니다. 프리미엄의 넉넉한 한도도 숫자로 오고 \`isFairUse=true\`입니다(앱은 "넉넉하게(월 N회까지)"로 보여 줍니다). \`null\`은 flag나 상한 없는 기능처럼 정말 무제한일 때만입니다.
- \`used\`·\`remaining\`: 횟수 기능은 이번 창에서 쓴 횟수와 남은 횟수입니다. 개수 기능(FRIEND·TODO_CATEGORY)은 지금 가진 개수와 남은 자리이고, 친구 맺기·카테고리 만들기가 막는 값과 같습니다(친구는 초대 보상 자리 포함). 무제한 개수 기능과 flag는 null입니다. \`remaining=0\`이면 앱은 입력을 받기 전에 막습니다.
- \`resetsAt\`: 횟수 기능만 있습니다(resource·flag는 null). 월간(AI_PARSE·VOICE_NOTE)은 KST 매월 1일 00:00, 일간(CHEER·NUDGE)은 \`X-Timezone\` 자정에 0으로 돌아갑니다.
- \`perUse\`: 한 번 쓸 때의 길이 상한(말로 메모하기, VOICE_NOTE)입니다.
- AI 할 일 만들기(AI_PARSE)는 할 일·메모 정리와 빠른 계획이 함께 씁니다.

출시 앱(1.14 이하)의 \`/v1/auth/me\`·\`/v1/ai/usage\`는 이전 모양을 유지합니다.`,
  })
  @ApiSuccessResponse({ type: EntitlementSnapshotDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getEntitlements(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone() timezone: string,
  ): Promise<EntitlementSnapshotDto> {
    const snapshot = await this.#getEntitlementSnapshot.execute({
      userId: user.userId,
      timeZone: timezone,
    });
    return toEntitlementSnapshotResponse(snapshot);
  }
}
