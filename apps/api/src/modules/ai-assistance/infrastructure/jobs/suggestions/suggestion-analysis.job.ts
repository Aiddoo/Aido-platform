import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";

import { premiumAccessCondition } from "#api/modules/access/access-entitlement-sql.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/date/utils/timezone";

import { AiJobLogEvent } from "../../observability/jobs/ai-job-log.events.js";
import { SuggestionAnalysisProcessor } from "../../processors/suggestions/suggestion-analysis.processor.js";
import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service.js";
import {
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  AiSuggestionJobName,
  AiSuggestionSchedulerName,
  AiSuggestionJobKey,
} from "./ai-suggestion-queue.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/** 일일 제안 배치는 사용자별 시간대가 아니라 한국 아침 07:30 운영 일정으로 돈다 */
const DISPATCH_CRON_TZ = "Asia/Seoul";

@Injectable()
export class SuggestionAnalysisJob implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisJob.name);

  constructor(
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    private readonly processor: SuggestionAnalysisProcessor,
    private readonly queueMaintenance: AiSuggestionQueueMaintenanceService,
  ) {}

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // Processor에 자신을 등록 (순환 참조 방지)
    this.processor.setSuggestionJob(this);

    // 작업 저장소 장애 중에도 부팅은 진행한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Suggestion analysis scheduler registration",
      async () => {
        await this.runtime.schedule(
          AiSuggestionSchedulerName.DAILY,
          "30 7 * * *",
          AI_SUGGESTION_QUEUE,
          { name: AiSuggestionJobName.DISPATCH, data: {} },
          this.#jobOptions(),
        );

        this.#logger.log({ event: AiJobLogEvent.SCHEDULED, queueName: AI_SUGGESTION_QUEUE });

        await this.#catchUpIfNeeded();
      },
    );
  }

  async dispatchAnalysis(): Promise<void> {
    this.#logger.log({ event: AiJobLogEvent.DISPATCH_STARTED, queueName: AI_SUGGESTION_QUEUE });
    await this.queueMaintenance.cleanExpiredFailures();

    const twoWeeksAgo = subtractDays(14);

    const periodId = this.#getJobDeduplicationId();
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.txHost.tx.query.user.findMany({
          columns: { id: true },
          with: {
            preference: { columns: { timezone: true } },
            location: { columns: { gridX: true, gridY: true, latitude: true, longitude: true } },
          },
          where: {
            id: cursor != null ? { gt: cursor } : undefined,
            RAW: (target) => premiumAccessCondition(target, now()),
            status: "ACTIVE",
            deletedAt: { isNull: true },
            todos: {
              startDate: { gte: twoWeeksAgo },
              seriesId: { isNull: true },
            },
          },
          orderBy: { id: "asc" },
          limit: take,
        }),
      onBatch: async (batch) => {
        await this.runtime.enqueueMany(
          AI_SUGGESTION_QUEUE,
          batch.map((user) => ({
            data: {
              name: AiSuggestionJobName.ANALYZE,
              data: {
                userId: user.id,
                timezone: user.preference?.timezone ?? DEFAULT_DELIVERY_TIMEZONE,
                weatherGrid: toWeatherGrid(user.location),
              } satisfies AiSuggestionAnalyzeData,
            },
            options: {
              ...this.#jobOptions(),
              idempotencyKey: AiSuggestionJobKey.analyze(user.id, periodId),
            },
          })),
        );
        totalEnqueued += batch.length;
      },
    });

    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_COMPLETED,
      queueName: AI_SUGGESTION_QUEUE,
      enqueuedCount: totalEnqueued,
    });
  }

  async #catchUpIfNeeded(): Promise<void> {
    const kstNow = dayjs().tz(DISPATCH_CRON_TZ);
    const hour = kstNow.hour();

    if (hour > 7 || (hour === 7 && kstNow.minute() >= 30)) {
      this.#logger.log({ event: AiJobLogEvent.CATCH_UP, queueName: AI_SUGGESTION_QUEUE });
      await this.runtime.enqueue(
        AI_SUGGESTION_QUEUE,
        { name: AiSuggestionJobName.DISPATCH, data: {} },
        {
          ...this.#jobOptions(),
          idempotencyKey: AiSuggestionJobKey.dispatch(kstNow.format("YYYY-MM-DD")),
        },
      );
    }
  }

  #getJobDeduplicationId(): string {
    return dayjs().tz(DISPATCH_CRON_TZ).format("YYYY-MM-DD");
  }

  #jobOptions() {
    return {
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 10 * 60,
      retentionSeconds: 24 * 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      timezone: DISPATCH_CRON_TZ,
    };
  }
}

/** 제안의 날씨 문맥은 KMA 격자 예보만 쓰므로 격자 없는 해외 위치는 날씨 없이 분석한다. */
function toWeatherGrid(
  location: {
    readonly gridX: number | null;
    readonly gridY: number | null;
    readonly latitude: number;
    readonly longitude: number;
  } | null,
): AiSuggestionAnalyzeData["weatherGrid"] {
  if (location == null || location.gridX == null || location.gridY == null) {
    return null;
  }
  return {
    gridX: location.gridX,
    gridY: location.gridY,
    lat: location.latitude,
    lon: location.longitude,
  };
}
