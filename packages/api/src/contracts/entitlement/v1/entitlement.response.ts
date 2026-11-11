import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";
import {
  ACCESS_TIERS,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PLAN_QUOTA_PERIODS,
  type PlanFeature,
} from "../../../vocabulary/plan-catalog.constants.js";

const planFeatureSchema = z.enum(PLAN_FEATURE_KEYS).describe("PLAN_CATALOG 기능 키");

export const accessTierSchema = z
  .enum(ACCESS_TIERS)
  .describe(
    "권한 주체 (FREE: 무료, PREMIUM: 구독·보상 기간, ADMIN: 관리자. ADMIN의 기능·한도는 PREMIUM과 같다)",
  );

const featurePerUseLimitSchema = z
  .object({
    maxSeconds: z
      .number()
      .int()
      .positive()
      .describe("말로 메모하기 한 번의 최대 길이(초). 앱 타이머가 이 시간에 멈춘다"),
    maxCharacters: z
      .number()
      .int()
      .positive()
      .describe("한 번에 보낼 수 있는 최대 글자 수. 서버가 이 상한으로 다시 막는다"),
  })
  .describe("한 번 쓸 때의 길이 상한 (현재 등급 기준)");

export const featureQuotaSchema = z
  .object({
    feature: planFeatureSchema,
    allowed: z
      .boolean()
      .describe(
        "이 기능을 쓸 수 있는지입니다. 횟수·개수 기능은 한도가 0보다 크거나 무제한이면 true입니다(남은 횟수가 0이어도 true).",
      ),
    limit: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "서버가 실제로 막는 한도입니다. 프리미엄의 넉넉한 한도도 숫자로 오고(isFairUse=true), null은 flag나 상한 없는 기능처럼 정말 무제한일 때만입니다.",
      ),
    used: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "횟수 기능은 지금 초기화 창(period)에서 쓴 횟수, 개수 기능(resource)은 지금 가진 개수입니다(친구 맺기·카테고리 만들기 한도 검사와 같은 값). 무제한 resource와 flag는 null입니다.",
      ),
    remaining: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe("limit - used (0 이상). limit이나 used가 null이면 null입니다."),
    period: z
      .enum(PLAN_QUOTA_PERIODS)
      .nullable()
      .describe(
        "used가 다시 0이 되는 주기입니다. month는 KST 매월 1일 00:00, day는 요청 X-Timezone 자정입니다. 횟수 기능이 아니면 null입니다.",
      ),
    resetsAt: datetimeSchema
      .nullable()
      .describe("used가 0으로 돌아가는 다음 시각 (ISO 8601 UTC). period가 null이면 null입니다."),
    isFairUse: z
      .boolean()
      .describe(
        "프리미엄의 공정 사용 한도인지입니다. true면 앱은 '넉넉하게(월 N회까지)'로 보여 줍니다.",
      ),
    perUse: featurePerUseLimitSchema
      .nullable()
      .describe("한 번 쓸 때의 길이 상한입니다. 길이 제한이 없는 기능은 null입니다."),
  })
  .describe(
    "서버가 계산한 기능 하나의 한도와 사용량. 앱은 이 값을 그대로 보여 주고 직접 계산하지 않는다",
  )
  .meta({
    example: {
      feature: "VOICE_NOTE",
      allowed: true,
      limit: PLAN_CATALOG.VOICE_NOTE.free,
      used: 1,
      remaining: PLAN_CATALOG.VOICE_NOTE.free - 1,
      period: "month",
      resetsAt: "2026-11-30T15:00:00.000Z",
      isFairUse: false,
      perUse: {
        maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free,
        maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.free,
      },
    },
  });

export type FeatureQuota = z.infer<typeof featureQuotaSchema>;

const featureQuotasShape = {
  AI_PARSE: featureQuotaSchema,
  CHEER: featureQuotaSchema,
  NUDGE: featureQuotaSchema,
  FRIEND: featureQuotaSchema,
  TODO_CATEGORY: featureQuotaSchema,
  AI_REPORT: featureQuotaSchema,
  AI_SUGGESTION: featureQuotaSchema,
  CUSTOM_REMINDER_TIME: featureQuotaSchema,
  APP_ICON: featureQuotaSchema,
  VOICE_NOTE: featureQuotaSchema,
} satisfies Record<PlanFeature, typeof featureQuotaSchema>;

export const entitlementSnapshotSchema = z
  .object({
    isPremium: z
      .boolean()
      .describe("유효한 스토어 구독이나 보상 기간이 있는지. ADMIN role은 반영하지 않는다"),
    tier: accessTierSchema,
    /** 새 서버가 기능을 더해도 이전 앱이 응답을 거절하지 않도록 모르는 키를 허용한다. */
    features: z
      .looseObject(featureQuotasShape)
      .describe("PLAN_CATALOG 모든 기능의 현재 한도·사용량. 키 순서는 PLAN_FEATURE_KEYS다"),
  })
  .describe("서버가 계산한 현재 권한 전체 (GET /v1/entitlements)");

export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;
