import { Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

/**
 * 외부 호출 회로가 열렸는지 알린다. 회로가 열려도 각 기능은 폴백·거절로 계속 응답하므로 503을 만들지
 * 않고 up에 degraded만 붙인다. 공개 응답이라 정책 이름은 싣지 않고 outbound.circuit.* 로그로만 남긴다.
 */
@Injectable()
export class OutboundHealthIndicator {
  readonly #healthIndicatorService: HealthIndicatorService;
  readonly #registry: OutboundPolicyRegistry;

  constructor(healthIndicatorService: HealthIndicatorService, registry: OutboundPolicyRegistry) {
    this.#healthIndicatorService = healthIndicatorService;
    this.#registry = registry;
  }

  isHealthy(key: string): HealthIndicatorResult {
    const degraded = Object.values(this.#registry.getStates()).some(
      (state) => state.openBreakers.length > 0,
    );
    return this.#healthIndicatorService.check(key).up({ degraded });
  }
}
