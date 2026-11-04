import { Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

/**
 * 외부 호출 회로가 열린 정책 이름을 알린다. 회로가 열려도 각 기능은 폴백·거절로 계속 응답하므로
 * 503을 만들지 않고 up에 degraded만 붙인다.
 */
@Injectable()
export class OutboundHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly registry: OutboundPolicyRegistry,
  ) {}

  isHealthy(key: string): HealthIndicatorResult {
    const openCircuits = Object.entries(this.registry.states())
      .filter(([_name, state]) => state.openBreakers.length > 0)
      .map(([name]) => name);
    return this.healthIndicatorService
      .check(key)
      .up({ degraded: openCircuits.length > 0, openCircuits });
  }
}
