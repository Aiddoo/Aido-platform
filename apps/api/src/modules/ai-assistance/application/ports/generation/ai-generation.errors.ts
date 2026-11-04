import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import type { AiProviderId } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

export const AI_FAILURE_KINDS = [
  "QUOTA_EXHAUSTED",
  "AUTH",
  "RATE_LIMITED",
  "OVERLOADED",
  "UPSTREAM",
  "TIMEOUT",
  "BAD_REQUEST",
  "BLOCKED",
  "TRUNCATED",
  "INVALID_OUTPUT",
  "UNAVAILABLE",
  "HALTED",
  "USER_SPEND_LIMITED",
] as const;

/**
 * 생성 실패를 폴백·회로·응답 코드 판단에 필요한 종류로만 나눈다.
 * UNAVAILABLE은 설정·동의·회로 때문에 시도할 업체가 없다는 뜻이다.
 * HALTED는 킬 스위치나 전역 비용 예산으로, USER_SPEND_LIMITED는 사용자 일 비용 예산으로
 * 업체를 부르지 않고 멈췄다는 뜻이다.
 */
export type AiFailureKind = (typeof AI_FAILURE_KINDS)[number];

export type AiCircuitBreakerKind = "billing" | "health";

export interface AiFailureRule {
  /** 다음 업체로 넘어가는지 */
  readonly fallback: boolean;
  /** 같은 업체를 한 번 더 부르는지(스키마 불일치는 다시 부르면 맞는 경우가 많다) */
  readonly retrySameProvider: boolean;
  readonly breaker: AiCircuitBreakerKind | null;
  /** 모든 업체가 실패했을 때 사용자에게 주는 코드 */
  readonly errorCode: ErrorCodeType;
}

const unavailable = { breaker: null, errorCode: ErrorCode.AI_1301 } as const;

/** 실패 종류별 처리 규칙의 단일 표. */
export function resolveAiFailureRule(kind: AiFailureKind): AiFailureRule {
  return match(kind)
    .returnType<AiFailureRule>()
    .with("QUOTA_EXHAUSTED", "AUTH", () => ({
      fallback: true,
      retrySameProvider: false,
      breaker: "billing",
      errorCode: ErrorCode.AI_1301,
    }))
    .with("RATE_LIMITED", () => ({
      fallback: true,
      retrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1310,
    }))
    .with("OVERLOADED", "UPSTREAM", "TIMEOUT", () => ({
      fallback: true,
      retrySameProvider: false,
      breaker: "health",
      errorCode: ErrorCode.AI_1301,
    }))
    .with("BAD_REQUEST", () => ({
      fallback: true,
      retrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("BLOCKED", "TRUNCATED", () => ({
      fallback: false,
      retrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("INVALID_OUTPUT", () => ({
      fallback: true,
      retrySameProvider: true,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("UNAVAILABLE", () => ({ fallback: true, retrySameProvider: false, ...unavailable }))
    .with("HALTED", () => ({ fallback: false, retrySameProvider: false, ...unavailable }))
    .with("USER_SPEND_LIMITED", () => ({
      fallback: false,
      retrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1310,
    }))
    .exhaustive();
}

/**
 * 업체를 부르지 않고 멈춘 실패(보낼 업체 없음·킬 스위치·예산). 잡은 다시 시도하지 않고
 * 리포트는 템플릿으로 저장하며 제안은 건너뛴다.
 */
export function isWithheldAiFailure(kind: AiFailureKind): boolean {
  return kind === "UNAVAILABLE" || kind === "HALTED" || kind === "USER_SPEND_LIMITED";
}

/** 잡이 나중에 다시 시도하면 회복될 수 있는 실패(요청 과다·일시 장애) */
export function isTransientAiFailure(kind: AiFailureKind): boolean {
  return kind === "RATE_LIMITED" || resolveAiFailureRule(kind).breaker === "health";
}

/**
 * 운영 로그로 원인을 좁히는 데 쓰는 공급자 실패 식별자. 오류 이름·공급자 상태 기호·HTTP 상태·
 * 네트워크 오류 코드처럼 고정된 기호만 담고, 원문 message·응답 본문·프롬프트는 담지 않는다.
 */
export interface AiUpstreamCause {
  readonly errorType: string;
  readonly statusCode?: number;
  readonly providerStatus?: string;
  readonly networkCode?: string;
}

interface AiGenerationErrorOptions extends ErrorOptions {
  readonly provider: AiProviderId | null;
  readonly attempts: number;
  readonly fallbackFrom: AiProviderId | null;
  readonly estimatedCostMicroUsd: number | null;
  readonly upstream: AiUpstreamCause | null;
}

/** 생성이 끝내 실패했을 때 던진다. kind는 마지막 시도의 실패 종류다. 원문 message는 담지 않는다. */
export class AiGenerationError extends Error {
  readonly provider: AiProviderId | null;
  readonly attempts: number;
  readonly fallbackFrom: AiProviderId | null;
  readonly estimatedCostMicroUsd: number | null;
  readonly upstream: AiUpstreamCause | null;

  constructor(
    readonly kind: AiFailureKind,
    options: AiGenerationErrorOptions,
  ) {
    super(kind, options);
    this.name = AiGenerationError.name;
    this.provider = options.provider;
    this.attempts = options.attempts;
    this.fallbackFrom = options.fallbackFrom;
    this.estimatedCostMicroUsd = options.estimatedCostMicroUsd;
    this.upstream = options.upstream;
  }

  get errorCode(): ErrorCodeType {
    return resolveAiFailureRule(this.kind).errorCode;
  }
}
