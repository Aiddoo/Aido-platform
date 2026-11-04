import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BrokenCircuitError,
  type CircuitBreakerPolicy,
  circuitBreaker,
  ConsecutiveBreaker,
  handleWhen,
  type IPolicy,
  wrap,
} from "cockatiel";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { now } from "#api/shared/domain/date/utils/core";

import {
  type AiCircuitBreakerKind,
  type AiFailureKind,
  resolveAiFailureRule,
} from "../../../application/ports/generation/ai-generation.errors.js";
import type { AiTaskId } from "../../../application/ports/generation/ai-generator.port.js";
import {
  AI_PROVIDER_ALERT,
  type AiProviderAlertPort,
} from "../../../application/ports/generation/ai-provider-alert.port.js";
import { AiProviderLogEvent } from "../../observability/generation/ai-provider-log.events.js";

/** 한 업체 호출의 실패. 회로가 종류로 열지 말지를 정한다. */
export class AiAttemptFailure extends Error {
  constructor(
    readonly kind: AiFailureKind,
    readonly task: AiTaskId,
    options: ErrorOptions,
  ) {
    super(kind, options);
    this.name = AiAttemptFailure.name;
  }
}

/** 회로가 열려 이번 요청에서 그 업체를 건너뛴다. */
export class AiCircuitOpenError extends Error {
  constructor(readonly provider: AiProviderId) {
    super("AI_CIRCUIT_OPEN");
    this.name = AiCircuitOpenError.name;
  }
}

interface ProviderCircuit {
  readonly policy: IPolicy;
  readonly breakers: Readonly<Record<AiCircuitBreakerKind, CircuitBreakerPolicy>>;
  /** 열린 시각. 차단 시간이 지나면 다음 요청이 시험 호출(half-open)로 다시 시도한다. */
  readonly openedAt: Map<AiCircuitBreakerKind, number>;
}

const BREAKER_KINDS = ["billing", "health"] as const satisfies readonly AiCircuitBreakerKind[];

/**
 * 업체별 회로(cockatiel). 결제·인증 실패는 한 번에 열고, 일시 장애는 연속으로 쌓이면 연다.
 * API 컨테이너가 하나라 프로세스 메모리에만 둔다(재시작하면 닫힌 상태로 시작).
 */
@Injectable()
export class AiProviderCircuitRegistry {
  readonly #logger = new Logger(AiProviderCircuitRegistry.name);
  readonly #circuits: ReadonlyMap<AiProviderId, ProviderCircuit>;
  readonly #cooldownMs: Readonly<Record<AiCircuitBreakerKind, number>>;

  constructor(
    config: TypedConfigService,
    @Inject(AI_PROVIDER_ALERT) private readonly alert: AiProviderAlertPort,
  ) {
    const { billingCooldownMs, healthThreshold, healthCooldownMs } = config.ai.breaker;
    this.#cooldownMs = { billing: billingCooldownMs, health: healthCooldownMs };
    const thresholds = { billing: 1, health: healthThreshold };
    this.#circuits = new Map(
      AI_PROVIDER_IDS.map((provider) => {
        const openedAt = new Map<AiCircuitBreakerKind, number>();
        const create = (kind: AiCircuitBreakerKind) =>
          this.#createBreaker(provider, kind, thresholds[kind], openedAt);
        const breakers = { billing: create("billing"), health: create("health") };
        return [
          provider,
          { policy: wrap(breakers.billing, breakers.health), breakers, openedAt },
        ] as const;
      }),
    );
  }

  /** 차단 시간 안이라 이번 요청에서 건너뛸 업체 */
  openProviders(): ReadonlySet<AiProviderId> {
    const at = now().getTime();
    return new Set(
      AI_PROVIDER_IDS.filter((provider) => {
        const circuit = this.#circuit(provider);
        return BREAKER_KINDS.some((kind) => {
          const openedAt = circuit.openedAt.get(kind);
          return openedAt != null && at - openedAt < this.#cooldownMs[kind];
        });
      }),
    );
  }

  /** 업체 호출을 회로로 감싼다. 열린 회로면 호출하지 않고 AiCircuitOpenError를 던진다. */
  async execute<R>(provider: AiProviderId, call: () => Promise<R>): Promise<R> {
    try {
      return await this.#circuit(provider).policy.execute(call);
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        throw new AiCircuitOpenError(provider);
      }
      throw error;
    }
  }

  #circuit(provider: AiProviderId): ProviderCircuit {
    const circuit = this.#circuits.get(provider);
    if (circuit == null) {
      throw new Error(`Unknown AI provider ${provider}`);
    }
    return circuit;
  }

  #createBreaker(
    provider: AiProviderId,
    kind: AiCircuitBreakerKind,
    threshold: number,
    openedAt: Map<AiCircuitBreakerKind, number>,
  ): CircuitBreakerPolicy {
    const breaker = circuitBreaker(
      handleWhen(
        (error) =>
          error instanceof AiAttemptFailure && resolveAiFailureRule(error.kind).breaker === kind,
      ),
      { halfOpenAfter: this.#cooldownMs[kind], breaker: new ConsecutiveBreaker(threshold) },
    );
    breaker.onBreak((reason) => {
      openedAt.set(kind, now().getTime());
      const failure =
        "error" in reason && reason.error instanceof AiAttemptFailure ? reason.error : null;
      const event = {
        event: AiProviderLogEvent.CIRCUIT_OPENED,
        provider,
        breaker: kind,
        reason: failure?.kind ?? null,
        cooldownMs: this.#cooldownMs[kind],
      };
      if (kind === "billing") {
        this.#logger.error(event);
        this.#reportBillingOpened(provider, failure);
        return;
      }
      this.#logger.warn(event);
    });
    breaker.onHalfOpen(() => {
      openedAt.delete(kind);
      this.#logger.log({ event: AiProviderLogEvent.CIRCUIT_HALF_OPEN, provider, breaker: kind });
    });
    breaker.onReset(() => {
      openedAt.delete(kind);
      this.#logger.log({ event: AiProviderLogEvent.CIRCUIT_CLOSED, provider, breaker: kind });
    });
    return breaker;
  }

  #reportBillingOpened(provider: AiProviderId, failure: AiAttemptFailure | null): void {
    if (failure == null || (failure.kind !== "QUOTA_EXHAUSTED" && failure.kind !== "AUTH")) {
      return;
    }
    this.alert.reportBillingCircuitOpened({
      provider,
      task: failure.task,
      reason: failure.kind,
      cooldownMs: this.#cooldownMs.billing,
    });
  }
}
