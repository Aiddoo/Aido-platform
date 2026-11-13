import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import type { AiProviderId } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";

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
  "CIRCUIT_OPEN",
  "HALTED",
  "USER_SPEND_LIMITED",
] as const;

/**
 * 생성 실패를 폴백·회로·응답 코드 판단에 필요한 종류로만 나눈다.
 * UNAVAILABLE은 키·동의 범위에 시도할 업체가 없다는 뜻이고, CIRCUIT_OPEN은 업체는 있지만 회로가 열려
 * 지금은 부를 수 없다는 뜻이다(잡은 나중에 다시 시도한다).
 * HALTED는 킬 스위치나 전역 비용 예산으로, USER_SPEND_LIMITED는 사용자 일 비용 예산으로
 * 업체를 부르지 않고 멈췄다는 뜻이다.
 */
export type AiFailureKind = (typeof AI_FAILURE_KINDS)[number];

const AI_CIRCUIT_BREAKER_KINDS = ["billing", "auth", "health"] as const;

export type AiCircuitBreakerKind = (typeof AI_CIRCUIT_BREAKER_KINDS)[number];

export interface AiFailureRule {
  /** 다음 업체로 넘어가는지 */
  readonly shouldFallback: boolean;
  /** 같은 업체를 한 번 더 부르는지(스키마 불일치는 다시 부르면 맞는 경우가 많다) */
  readonly shouldRetrySameProvider: boolean;
  readonly breaker: AiCircuitBreakerKind | null;
  /** 모든 업체가 실패했을 때 사용자에게 주는 코드 */
  readonly errorCode: ErrorCodeType;
}

const unavailable = { breaker: null, errorCode: ErrorCode.AI_1301 } as const;

export function resolveAiFailureRule(kind: AiFailureKind): AiFailureRule {
  return match(kind)
    .returnType<AiFailureRule>()
    .with("QUOTA_EXHAUSTED", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      breaker: "billing",
      errorCode: ErrorCode.AI_1301,
    }))
    .with("AUTH", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      breaker: "auth",
      errorCode: ErrorCode.AI_1301,
    }))
    .with("RATE_LIMITED", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1310,
    }))
    .with("OVERLOADED", "UPSTREAM", "TIMEOUT", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      breaker: "health",
      errorCode: ErrorCode.AI_1301,
    }))
    .with("BAD_REQUEST", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("BLOCKED", "TRUNCATED", () => ({
      shouldFallback: false,
      shouldRetrySameProvider: false,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("INVALID_OUTPUT", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: true,
      breaker: null,
      errorCode: ErrorCode.AI_1302,
    }))
    .with("UNAVAILABLE", "CIRCUIT_OPEN", () => ({
      shouldFallback: true,
      shouldRetrySameProvider: false,
      ...unavailable,
    }))
    .with("HALTED", () => ({
      shouldFallback: false,
      shouldRetrySameProvider: false,
      ...unavailable,
    }))
    .with("USER_SPEND_LIMITED", () => ({
      shouldFallback: false,
      shouldRetrySameProvider: false,
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

/** 잡이 나중에 다시 시도하면 회복될 수 있는 실패(요청 과다·일시 장애·열린 회로) */
export function isTransientAiFailure(kind: AiFailureKind): boolean {
  return (
    kind === "RATE_LIMITED" ||
    kind === "CIRCUIT_OPEN" ||
    resolveAiFailureRule(kind).breaker === "health"
  );
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

  readonly kind: AiFailureKind;

  constructor(kind: AiFailureKind, options: AiGenerationErrorOptions) {
    super(kind, options);
    this.kind = kind;
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

/**
 * 생성이 끝내 실패해 사용자에게 줄 코드다. 호출부가 예약을 환불하므로 앱이 "횟수는 차감되지 않았어요"를
 * 보여 줄 수 있고(환불에 실패하면 호출부가 charged를 뗀다), 원래 실패는 cause로 예외 보고에 남는다.
 */
export function generationFailed(errorCode: ErrorCodeType, cause: unknown): ApplicationException {
  return new ApplicationException(errorCode, { charged: false }, { cause });
}
