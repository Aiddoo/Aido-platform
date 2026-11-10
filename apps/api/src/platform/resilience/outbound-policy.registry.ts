import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { PlatformLogEvent } from "../logging/platform.log-events.js";
import {
  type OutboundCircuitEvent,
  OutboundPolicy,
  type OutboundPolicyEvents,
  type OutboundPolicySpec,
  type OutboundPolicyState,
} from "./outbound-policy.js";

/**
 * 이름별 정책 싱글턴. 같은 이름을 쓰는 호출부는 회로·bulkhead를 함께 쓴다(처음 받은 spec이 이긴다).
 * API 컨테이너가 하나라 상태는 프로세스 메모리에만 두고 재시작하면 닫힌 상태로 시작한다.
 */
@Injectable()
export class OutboundPolicyRegistry {
  readonly #logger = new Logger(OutboundPolicy.name);
  readonly #policies = new Map<string, OutboundPolicy>();
  readonly #events: OutboundPolicyEvents;

  constructor(@Inject(OPERATIONAL_ALERT) alert: OperationalAlertPort) {
    this.#events = {
      onOpened: (event) => this.#opened(event, alert),
      onHalfOpened: (policy, breaker) =>
        this.#logger.log({ event: PlatformLogEvent.OUTBOUND_CIRCUIT_HALF_OPEN, policy, breaker }),
      onClosed: (policy, breaker) =>
        this.#logger.log({ event: PlatformLogEvent.OUTBOUND_CIRCUIT_CLOSED, policy, breaker }),
      onBulkheadRejected: (policy) =>
        this.#logger.warn({ event: PlatformLogEvent.OUTBOUND_BULKHEAD_REJECTED, policy }),
    };
  }

  get(spec: OutboundPolicySpec): OutboundPolicy {
    const existing = this.#policies.get(spec.name);
    if (existing != null) {
      return existing;
    }
    const policy = new OutboundPolicy(spec, this.#events);
    this.#policies.set(spec.name, policy);
    return policy;
  }

  getStates(): Readonly<Record<string, OutboundPolicyState>> {
    return Object.fromEntries(
      [...this.#policies.entries()].map(([name, policy]) => [name, policy.getState()]),
    );
  }

  #opened(event: OutboundCircuitEvent, alert: OperationalAlertPort): void {
    const { policy, breaker, failure } = event;
    this.#logger.warn({
      event: PlatformLogEvent.OUTBOUND_CIRCUIT_OPENED,
      policy,
      breaker: breaker.name,
      cooldownMs: breaker.halfOpenAfterMs,
      ...failure,
    });
    if (breaker.alert != null) {
      alert.raise({
        ...breaker.alert,
        tags: { policy, breaker: breaker.name, ...failure },
        details: { cooldownMs: breaker.halfOpenAfterMs },
      });
    }
  }
}
