import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";
import { z } from "zod";

/** Gemini API 키 형식. 기존 `AIza…`와 새 `AQ.…` 키를 모두 받도록 접두사 없이 문자 집합과 길이만 본다. */
const GOOGLE_GENERATIVE_AI_API_KEY_PATTERN = /^[A-Za-z0-9._-]{30,}$/;
/** Anthropic(sk-ant-…)·OpenAI(sk-proj-…) 키. 형식이 바뀌어도 받도록 공백 없는 길이만 본다. */
const SECRET_API_KEY_PATTERN = /^\S{20,}$/;

export const AI_THINKING_LEVELS = ["minimal", "low", "medium"] as const;

export type AiThinking = (typeof AI_THINKING_LEVELS)[number];

/** 킬 스위치. interactive-only는 리포트·제안 같은 배경 생성만 멈춘다. 바꾸면 재시작해야 반영된다. */
const AI_GENERATION_MODES = ["on", "interactive-only", "off"] as const;

const thinkingLevel = (fallback: AiThinking) => z.enum(AI_THINKING_LEVELS).default(fallback);
const milliseconds = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const usd = (fallback: number) => z.coerce.number().nonnegative().default(fallback);
const modelId = (fallback: string) => z.string().trim().min(1).default(fallback);
const secretApiKey = (name: string) =>
  z
    .string()
    .optional()
    .refine((value) => !value || SECRET_API_KEY_PATTERN.test(value), {
      message: `${name} must be at least 20 characters without whitespace`,
    });

const DEFAULT_PROVIDER_ORDER = AI_PROVIDER_IDS.join(",");

function parseProviderOrder(value: string): AiProviderId[] | null {
  const order = value.split(",").map((id) => AI_PROVIDER_IDS.find((known) => known === id.trim()));
  const known = order.filter((id) => id != null);
  if (known.length === 0 || known.length !== order.length || new Set(known).size !== known.length) {
    return null;
  }
  return known;
}

/**
 * AI 공급자 키·순서·모델과 작업별 운영 설정. 키가 있는 업체만 쓰고, 빈 문자열은 미설정이다.
 * thinking 기본값은 parse-todo만 minimal이고 나머지는 low다. 2026-10-26 live eval에서 parse-todo는
 * minimal이 low와 정확도가 같고 지연이 짧았지만, parse-memo는 minimal에서 남은 할 일 수를 잘못 셌다.
 * 업체 순서·모델 교체·제한 시간·회로 차단 시간·킬 스위치·비용 예산을 배포 없이 env로만 바꿀 수 있게 한다.
 */
export const aiSchema = z.object({
  ANTHROPIC_API_KEY: secretApiKey("ANTHROPIC_API_KEY"),
  // Google이 키 형식을 바꾼 적이 있어(AIza… → AQ.…) 접두사는 검사하지 않는다.
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .refine((value) => !value || GOOGLE_GENERATIVE_AI_API_KEY_PATTERN.test(value), {
      message:
        "GOOGLE_GENERATIVE_AI_API_KEY must be at least 30 characters of [A-Za-z0-9._-] without whitespace",
    }),
  OPENAI_API_KEY: secretApiKey("OPENAI_API_KEY"),
  AI_PROVIDER_ORDER: z
    .string()
    .default(DEFAULT_PROVIDER_ORDER)
    .refine((value) => parseProviderOrder(value) != null, {
      message: `AI_PROVIDER_ORDER must be a comma-separated list of distinct providers (${DEFAULT_PROVIDER_ORDER})`,
    }),
  AI_MODEL_ANTHROPIC: modelId("claude-haiku-5-5"),
  AI_MODEL_GOOGLE: modelId("gemini-3.1-flash-lite"),
  AI_MODEL_OPENAI: modelId("gpt-6-luna"),
  AI_THINKING_PARSE_TODO: thinkingLevel("minimal"),
  AI_THINKING_PARSE_MEMO: thinkingLevel("low"),
  AI_THINKING_REPORT: thinkingLevel("low"),
  AI_THINKING_SUGGESTION: thinkingLevel("low"),
  AI_THINKING_QUICK_PLAN: thinkingLevel("low"),
  AI_THINKING_VOICE_NOTE_DIGEST: thinkingLevel("low"),
  // 업체를 바꿔 가며 시도하는 전체 체인의 제한 시간
  AI_DEADLINE_PARSE_TODO_MS: milliseconds(12_000),
  AI_DEADLINE_PARSE_MEMO_MS: milliseconds(25_000),
  AI_DEADLINE_REPORT_MS: milliseconds(60_000),
  AI_DEADLINE_SUGGESTION_MS: milliseconds(60_000),
  AI_DEADLINE_QUICK_PLAN_MS: milliseconds(24_000),
  AI_DEADLINE_VOICE_NOTE_DIGEST_MS: milliseconds(45_000),
  // 결제·인증 실패(크레딧 소진·키 오류)는 바로 열고, 사람이 고칠 시간을 준 뒤 한 번 다시 시도한다
  AI_BREAKER_BILLING_COOLDOWN_MS: milliseconds(15 * 60_000),
  AI_BREAKER_HEALTH_THRESHOLD: z.coerce.number().int().positive().default(5),
  AI_BREAKER_HEALTH_COOLDOWN_MS: milliseconds(30_000),
  AI_GENERATION_MODE: z.enum(AI_GENERATION_MODES).default("on"),
  // 추정 비용(USD, UTC 일·월). 경고 → 배경 작업 중단 → 전체 중단 순서이고, 사용자 일 예산은 남용 방어선이다.
  AI_BUDGET_DAILY_ALERT_USD: usd(1),
  AI_BUDGET_MONTHLY_ALERT_USD: usd(10),
  AI_BUDGET_DAILY_BACKGROUND_USD: usd(2),
  AI_BUDGET_MONTHLY_BACKGROUND_USD: usd(20),
  AI_BUDGET_DAILY_USD: usd(3),
  AI_BUDGET_MONTHLY_USD: usd(30),
  AI_BUDGET_USER_DAILY_USD: usd(0.25),
});

export type AiConfig = z.infer<typeof aiSchema>;

export const AI_CONFIG_KEYS = aiSchema.keyof().options;

interface AiProviderSettings {
  /** 미설정이면 null이며 그 업체는 쓰지 않는다 */
  readonly apiKey: string | null;
  readonly model: string;
}

export interface AiTaskSettings {
  readonly thinking: AiThinking;
  readonly deadlineMs: number;
}

/** env를 업체·작업 단위로 묶은 AI 설정. 작업 키는 ai-assistance의 AiTaskId와 같다. */
export interface AiSettings {
  readonly providers: Readonly<Record<AiProviderId, AiProviderSettings>>;
  readonly providerOrder: readonly AiProviderId[];
  readonly tasks: Readonly<{
    "parse-todo": AiTaskSettings;
    "parse-memo": AiTaskSettings;
    report: AiTaskSettings;
    suggestion: AiTaskSettings;
    "quick-plan": AiTaskSettings;
    "voice-note-digest": AiTaskSettings;
  }>;
  readonly breaker: Readonly<{
    billingCooldownMs: number;
    healthThreshold: number;
    healthCooldownMs: number;
  }>;
  /** 킬 스위치가 분류별로 생성을 켜 두었는지 */
  readonly enabled: Readonly<{ interactive: boolean; background: boolean }>;
  readonly budget: AiBudgetSettings;
}

interface AiBudgetWindow {
  readonly dailyMicroUsd: number;
  readonly monthlyMicroUsd: number;
}

/** 추정 비용 기준선(micro-USD) */
interface AiBudgetSettings {
  readonly alert: AiBudgetWindow;
  readonly background: AiBudgetWindow;
  readonly halt: AiBudgetWindow;
  readonly userDailyMicroUsd: number;
}

const MICRO_USD_PER_USD = 1_000_000;
const toMicroUsd = (value: number) => Math.round(value * MICRO_USD_PER_USD);

const toApiKey = (value: string | undefined) => (value == null || value === "" ? null : value);

export function toAiSettings(env: AiConfig): AiSettings {
  return {
    providers: {
      anthropic: { apiKey: toApiKey(env.ANTHROPIC_API_KEY), model: env.AI_MODEL_ANTHROPIC },
      google: { apiKey: toApiKey(env.GOOGLE_GENERATIVE_AI_API_KEY), model: env.AI_MODEL_GOOGLE },
      openai: { apiKey: toApiKey(env.OPENAI_API_KEY), model: env.AI_MODEL_OPENAI },
    },
    providerOrder: parseProviderOrder(env.AI_PROVIDER_ORDER) ?? [...AI_PROVIDER_IDS],
    tasks: {
      "parse-todo": {
        thinking: env.AI_THINKING_PARSE_TODO,
        deadlineMs: env.AI_DEADLINE_PARSE_TODO_MS,
      },
      "parse-memo": {
        thinking: env.AI_THINKING_PARSE_MEMO,
        deadlineMs: env.AI_DEADLINE_PARSE_MEMO_MS,
      },
      report: { thinking: env.AI_THINKING_REPORT, deadlineMs: env.AI_DEADLINE_REPORT_MS },
      suggestion: {
        thinking: env.AI_THINKING_SUGGESTION,
        deadlineMs: env.AI_DEADLINE_SUGGESTION_MS,
      },
      "quick-plan": {
        thinking: env.AI_THINKING_QUICK_PLAN,
        deadlineMs: env.AI_DEADLINE_QUICK_PLAN_MS,
      },
      "voice-note-digest": {
        thinking: env.AI_THINKING_VOICE_NOTE_DIGEST,
        deadlineMs: env.AI_DEADLINE_VOICE_NOTE_DIGEST_MS,
      },
    },
    breaker: {
      billingCooldownMs: env.AI_BREAKER_BILLING_COOLDOWN_MS,
      healthThreshold: env.AI_BREAKER_HEALTH_THRESHOLD,
      healthCooldownMs: env.AI_BREAKER_HEALTH_COOLDOWN_MS,
    },
    enabled: {
      interactive: env.AI_GENERATION_MODE !== "off",
      background: env.AI_GENERATION_MODE === "on",
    },
    budget: {
      alert: {
        dailyMicroUsd: toMicroUsd(env.AI_BUDGET_DAILY_ALERT_USD),
        monthlyMicroUsd: toMicroUsd(env.AI_BUDGET_MONTHLY_ALERT_USD),
      },
      background: {
        dailyMicroUsd: toMicroUsd(env.AI_BUDGET_DAILY_BACKGROUND_USD),
        monthlyMicroUsd: toMicroUsd(env.AI_BUDGET_MONTHLY_BACKGROUND_USD),
      },
      halt: {
        dailyMicroUsd: toMicroUsd(env.AI_BUDGET_DAILY_USD),
        monthlyMicroUsd: toMicroUsd(env.AI_BUDGET_MONTHLY_USD),
      },
      userDailyMicroUsd: toMicroUsd(env.AI_BUDGET_USER_DAILY_USD),
    },
  };
}
