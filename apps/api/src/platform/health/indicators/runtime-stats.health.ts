import { Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { RuntimeStatsSampler } from "#api/platform/observability/runtime-stats.sampler";

/**
 * 마지막 런타임 표본(이벤트 루프 p99·힙·RSS·DB 풀)을 싣는다. 포화는 경보로 알리고 프로세스 재시작으로
 * 풀리지 않으므로 503을 만들지 않고 항상 up이다.
 */
@Injectable()
export class RuntimeStatsHealthIndicator {
  readonly #health: HealthIndicatorService;
  readonly #sampler: RuntimeStatsSampler;

  constructor(health: HealthIndicatorService, sampler: RuntimeStatsSampler) {
    this.#health = health;
    this.#sampler = sampler;
  }

  isHealthy(key: string): HealthIndicatorResult {
    const latest = this.#sampler.latest();
    const indicator = this.#health.check(key);
    if (latest == null) {
      return indicator.up({ sampled: false });
    }
    const { sampledAtMs, ...stats } = latest;
    return indicator.up({
      sampled: true,
      sampledAt: new Date(sampledAtMs).toISOString(),
      ...stats,
    });
  }
}
