import { HttpNetworkError, HttpTimeoutError } from "@nestjs/http-client";
import {
  BrokenCircuitError,
  bulkhead,
  type BulkheadPolicy,
  type CircuitBreakerPolicy,
  CircuitState,
  circuitBreaker,
  ConsecutiveBreaker,
  handleWhen,
  type IPolicy,
  IsolatedCircuitError,
  BulkheadRejectedError,
  noop,
  TaskCancelledError,
  timeout,
  type TimeoutPolicy,
  TimeoutStrategy,
  wrap,
} from "cockatiel";

import type { AlertDefinition } from "#api/shared/application/alerts/define-alerts";

import { OutboundRejectedError, OutboundTimeoutError } from "./outbound-policy.errors.js";

/** 연속 실패로 여는 회로 하나. 실패로 셀 오류·결과는 정책 주인이 정한다. */
export interface OutboundBreakerSpec {
  /** 로그·상태에 남는 이름(예: health, billing) */
  readonly name: string;
  readonly consecutiveFailures: number;
  readonly halfOpenAfterMs: number;
  readonly handles: (error: unknown) => boolean;
  /** 던지지 않고 돌아온 실패 결과(예: 5xx 응답)를 실패로 셀지 */
  readonly handlesResult?: (result: unknown) => boolean;
  /** 열릴 때 사람이 확인해야 하면 이 경보로 올린다. 업체 이름은 정책 이름 태그(policy)로 간다 */
  readonly alert?: AlertDefinition;
}

/**
 * 외부 호출 하나의 보호 정책. 재시도는 전송 계층(SDK·http-client)이나 pg-boss 한 층에만 두므로
 * 여기에는 없다. 순서는 bulkhead → 회로 → 시도별 timeout(Aggressive)이다.
 */
export interface OutboundPolicySpec {
  readonly name: string;
  /** signal을 받지 못하는 SDK 호출을 기다리는 상한. signal을 받는 호출은 호출부 timeout을 쓴다. */
  readonly timeoutMs?: number;
  readonly bulkhead?: { readonly limit: number; readonly queue: number };
  readonly breakers?: readonly OutboundBreakerSpec[];
  /** 회로를 연 실패를 고정 기호 필드로 설명한다(로그·경보 태그). 원문 message는 넣지 않는다. */
  readonly describeFailure?: (failure: unknown) => Readonly<Record<string, string>>;
}

export interface OutboundPolicyState {
  readonly openBreakers: readonly string[];
  readonly bulkhead: { readonly executionSlots: number; readonly queueSlots: number } | null;
}

export interface OutboundCircuitEvent {
  readonly policy: string;
  readonly breaker: OutboundBreakerSpec;
  readonly failure: Readonly<Record<string, string>>;
}

/** 정책 상태 변화를 받는 쪽(레지스트리가 로그·경보로 남긴다). */
export interface OutboundPolicyEvents {
  onOpened(event: OutboundCircuitEvent): void;
  onHalfOpened(policy: string, breaker: string): void;
  onClosed(policy: string, breaker: string): void;
  onBulkheadRejected(policy: string): void;
}

interface Breaker {
  readonly spec: OutboundBreakerSpec;
  readonly policy: CircuitBreakerPolicy;
  openedAt: number | null;
}

/** 시간 초과·네트워크 단절처럼 공급자 전체 장애를 뜻하는 전송 실패 */
export function isTransportFailure(error: unknown): boolean {
  return (
    error instanceof OutboundTimeoutError ||
    error instanceof HttpTimeoutError ||
    error instanceof HttpNetworkError
  );
}

export class OutboundPolicy {
  readonly name: string;
  readonly #breakers: readonly Breaker[];
  readonly #bulkhead: BulkheadPolicy | null;
  readonly #timeout: TimeoutPolicy | null;
  readonly #timeoutMs: number;
  readonly #admission: IPolicy;
  readonly #circuits: IPolicy;
  readonly #events: OutboundPolicyEvents;

  constructor(spec: OutboundPolicySpec, events: OutboundPolicyEvents) {
    this.name = spec.name;
    this.#events = events;
    this.#bulkhead =
      spec.bulkhead == null ? null : bulkhead(spec.bulkhead.limit, spec.bulkhead.queue);
    this.#timeoutMs = spec.timeoutMs ?? 0;
    this.#timeout =
      spec.timeoutMs == null ? null : timeout(spec.timeoutMs, TimeoutStrategy.Aggressive);
    this.#breakers = (spec.breakers ?? []).map((breakerSpec) =>
      this.#createBreaker(spec, breakerSpec),
    );
    this.#admission = this.#bulkhead ?? noop;
    const [first, ...rest] = this.#breakers.map((breaker) => breaker.policy);
    this.#circuits = first == null ? noop : wrap(first, ...rest);
  }

  /**
   * 정책 안에서 호출한다. 회로가 열렸거나 시험 호출이 진행 중이거나 대기열이 가득 차면 호출하지 않고
   * OutboundRejectedError, 시도별 제한 시간이 지나면 OutboundTimeoutError를 던진다. signal은 호출부 취소다.
   */
  async execute<T>(call: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    try {
      return await this.#admission.execute(({ signal: admitted }) => {
        // cockatiel은 시험 호출이 끝날 때까지 다른 호출을 취소 신호 없이 세워 두므로 먼저 거절한다.
        if (this.#isProbing()) {
          throw new OutboundRejectedError(this.name, "circuit-open");
        }
        return this.#circuits.execute(({ signal: inner }) => this.#attempt(call, inner), admitted);
      }, signal);
    } catch (error) {
      if (error instanceof BrokenCircuitError || error instanceof IsolatedCircuitError) {
        throw new OutboundRejectedError(this.name, "circuit-open");
      }
      if (error instanceof BulkheadRejectedError) {
        this.#events.onBulkheadRejected(this.name);
        throw new OutboundRejectedError(this.name, "bulkhead-full");
      }
      throw error;
    }
  }

  /** 차단 시간 안이거나 시험 호출 중이라 지금 부르면 바로 거절되는 회로가 있는지 */
  isOpen(): boolean {
    return this.#openBreakers().length > 0;
  }

  getState(): OutboundPolicyState {
    return {
      openBreakers: this.#openBreakers(),
      bulkhead:
        this.#bulkhead == null
          ? null
          : {
              executionSlots: this.#bulkhead.executionSlots,
              queueSlots: this.#bulkhead.queueSlots,
            },
    };
  }

  async #attempt<T>(call: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
    if (this.#timeout == null) {
      return call(signal);
    }
    try {
      return await this.#timeout.execute(({ signal: attempt }) => call(attempt), signal);
    } catch (error) {
      if (error instanceof TaskCancelledError && !signal.aborted) {
        throw new OutboundTimeoutError(this.name, this.#timeoutMs);
      }
      throw error;
    }
  }

  #isProbing(): boolean {
    return this.#breakers.some(({ policy }) => policy.state === CircuitState.HalfOpen);
  }

  #openBreakers(): string[] {
    // cockatiel이 halfOpenAfter를 Date.now()로 재므로 열린 시각도 같은 시계로 잰다
    const at = Date.now();
    return this.#breakers
      .filter(
        ({ policy, openedAt, spec }) =>
          policy.state === CircuitState.Isolated ||
          policy.state === CircuitState.HalfOpen ||
          (policy.state === CircuitState.Open &&
            openedAt != null &&
            at - openedAt < spec.halfOpenAfterMs),
      )
      .map(({ spec }) => spec.name);
  }

  #createBreaker(policySpec: OutboundPolicySpec, spec: OutboundBreakerSpec): Breaker {
    // cockatiel은 세지 않는 오류를 성공으로 봐 시험 호출에서 회로를 닫는다. 시험 호출은 어떤 오류든 실패로 본다.
    let circuit: CircuitBreakerPolicy | null = null;
    const handled = handleWhen(
      (error) => circuit?.state === CircuitState.HalfOpen || spec.handles(error),
    );
    const policy = circuitBreaker(
      spec.handlesResult == null ? handled : handled.orWhenResult(spec.handlesResult),
      {
        halfOpenAfter: spec.halfOpenAfterMs,
        breaker: new ConsecutiveBreaker(spec.consecutiveFailures),
      },
    );
    circuit = policy;
    const breaker: Breaker = { spec, policy, openedAt: null };
    policy.onBreak((reason) => {
      breaker.openedAt = Date.now();
      const failure = "error" in reason ? reason.error : "value" in reason ? reason.value : null;
      this.#events.onOpened({
        policy: policySpec.name,
        breaker: spec,
        failure: policySpec.describeFailure?.(failure) ?? {},
      });
    });
    policy.onHalfOpen(() => {
      breaker.openedAt = null;
      this.#events.onHalfOpened(policySpec.name, spec.name);
    });
    policy.onReset(() => {
      breaker.openedAt = null;
      this.#events.onClosed(policySpec.name, spec.name);
    });
    return breaker;
  }
}
