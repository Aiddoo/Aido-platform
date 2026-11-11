import { type ELDHistogram, monitorEventLoopDelay } from "node:perf_hooks";
import { getHeapStatistics } from "node:v8";

import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";

import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import type { AlertDefinition } from "#api/shared/application/alerts/define-alerts";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";
import {
  evaluateRuntimeSample,
  newlyBreached,
  type PoolStats,
  RUNTIME_STATS_INTERVAL_MS,
  type RuntimeBreachKind,
  type RuntimeSample,
} from "./runtime-stats.js";
import { RuntimeAlerts } from "./runtime.alerts.js";

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

const BREACH_ALERTS = {
  "pool-waiting": RuntimeAlerts.POOL_WAITING_SUSTAINED,
  "event-loop-delay": RuntimeAlerts.EVENT_LOOP_DELAY_HIGH,
  "heap-usage": RuntimeAlerts.HEAP_USAGE_HIGH,
} satisfies Record<RuntimeBreachKind, AlertDefinition>;

/**
 * 60초마다 이벤트 루프 지연 p99·힙·RSS·DB 풀 상태를 재서 `/health` 상세에 싣고 기준을 넘으면 경보한다.
 * 기준을 넘은 상태가 이어지는 동안은 처음 넘은 표본에서만 경보해 같은 상황이 분마다 쌓이지 않는다.
 * 타이머와 지연 측정기는 모듈 시작·종료에서 만들고 해제한다.
 */
@Injectable()
export class RuntimeStatsSampler implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(RuntimeStatsSampler.name);
  readonly #pool: Pool | null;
  readonly #alerts: OperationalAlertPort;
  #histogram: ELDHistogram | null = null;
  #timer: NodeJS.Timeout | null = null;
  #latest: RuntimeSample | null = null;
  #poolWaitingSinceMs: number | null = null;
  #breached: ReadonlySet<RuntimeBreachKind> = new Set();

  constructor(@Inject(DRIZZLE) database: Database, alerts: OperationalAlertPort) {
    // 테스트가 DRIZZLE을 다른 client로 바꾸면 풀 수치는 비운다
    this.#pool = database.$client instanceof Pool ? database.$client : null;
    this.#alerts = alerts;
  }

  onModuleInit(): void {
    this.#histogram = monitorEventLoopDelay();
    this.#histogram.enable();
    this.#timer = setInterval(() => this.sample(), RUNTIME_STATS_INTERVAL_MS);
    this.#timer.unref();
  }

  onModuleDestroy(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#histogram?.disable();
    this.#histogram = null;
  }

  /** 마지막 표본. 시작 뒤 첫 주기 전이면 null이다. */
  latest(): RuntimeSample | null {
    return this.#latest;
  }

  sample(): void {
    try {
      const current = this.#measure();
      const { breaches, poolWaitingSinceMs } = evaluateRuntimeSample(current, {
        poolWaitingSinceMs: this.#poolWaitingSinceMs,
      });
      this.#latest = current;
      this.#poolWaitingSinceMs = poolWaitingSinceMs;
      for (const breach of newlyBreached(this.#breached, breaches)) {
        this.#alerts.raise({ ...BREACH_ALERTS[breach.kind], details: breach.details });
      }
      this.#breached = new Set(breaches.map((breach) => breach.kind));
    } catch (error) {
      this.#logger.warn({
        event: PlatformLogEvent.RUNTIME_STATS_SAMPLE_FAILED,
        errorType: toErrorType(error),
      });
    }
  }

  #measure(): RuntimeSample {
    const histogram = this.#histogram;
    const eventLoopDelayP99Ms =
      histogram == null ? 0 : histogram.percentile(99) / NANOSECONDS_PER_MILLISECOND;
    histogram?.reset();
    const memory = process.memoryUsage();
    return {
      sampledAtMs: Date.now(),
      eventLoopDelayP99Ms,
      heapUsedBytes: memory.heapUsed,
      heapLimitBytes: getHeapStatistics().heap_size_limit,
      rssBytes: memory.rss,
      pool: this.#poolStats(),
    };
  }

  #poolStats(): PoolStats | null {
    const pool = this.#pool;
    return pool == null
      ? null
      : { totalCount: pool.totalCount, idleCount: pool.idleCount, waitingCount: pool.waitingCount };
  }
}
