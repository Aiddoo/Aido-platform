import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";
import dayjs from "dayjs";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { decodeRecord } from "#api/platform/database/database-records";
import { databaseDate } from "#api/platform/database/database-values";
import { DatabaseService } from "#api/platform/database/database.service";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import { AiJobLogEvent } from "../../observability/jobs/ai-job-log.events.js";
import { SuggestionAnalysisProcessor } from "../../processors/suggestions/suggestion-analysis.processor.js";
import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service.js";
import {
  AI_SUGGESTION_LEGACY_QUEUE,
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  AiSuggestionJobName,
  AiSuggestionSchedulerName,
  AiSuggestionJobKey,
} from "./ai-suggestion-queue.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

@Injectable()
export class SuggestionAnalysisJob implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisJob.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    private readonly processor: SuggestionAnalysisProcessor,
    private readonly queueMaintenance: AiSuggestionQueueMaintenanceService,
  ) {}

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // Processor에 자신을 등록 (순환 참조 방지)
    this.processor.setSuggestionJob(this);

    // Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Suggestion analysis scheduler registration",
      async () => {
        // 구 weekly 스케줄러 제거 (마이그레이션)
        await this.runtime.unschedule(
          AiSuggestionSchedulerName.LEGACY_WEEKLY,
          AI_SUGGESTION_LEGACY_QUEUE,
        );
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

  /**
   * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
   */
  async dispatchAnalysis(dispatchJob?: {
    updateProgress(progress: object): Promise<unknown>;
  }): Promise<void> {
    this.#logger.log({ event: AiJobLogEvent.DISPATCH_STARTED, queueName: AI_SUGGESTION_QUEUE });
    await this.queueMaintenance.cleanExpiredFailures();

    const twoWeeksAgo = subtractDays(14);

    const periodId = this.#getJobDeduplicationId();
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.database.db.orm.public.User.where((row) =>
          and(
            cursor !== undefined ? row.id.gt(cursor) : all(),
            or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
            row.status.eq("ACTIVE"),
            row.deletedAt.isNull(),
            row.todos.some((related) =>
              and(
                related.startDate.gte(databaseDate(twoWeeksAgo)),
                related.recurrenceGroupId.isNull(),
              ),
            ),
          ),
        )
          .select("id")
          .include("preference", (related) => related.select("timezone"))
          .include("location", (related) =>
            related.select("gridX", "gridY", "latitude", "longitude"),
          )
          .orderBy((row) => row.id.asc())
          .limit(take)
          .all()
          .then((row) => decodeRecord("User", row)),
      onBatch: async (batch) => {
        await Promise.all(
          batch.map((user) =>
            this.runtime.enqueue(
              AI_SUGGESTION_QUEUE,
              {
                name: AiSuggestionJobName.ANALYZE,
                data: {
                  userId: user.id,
                  timezone: user.preference?.timezone ?? "Asia/Seoul",
                  weatherGrid: user.location
                    ? {
                        gridX: user.location.gridX,
                        gridY: user.location.gridY,
                        lat: user.location.latitude,
                        lon: user.location.longitude,
                      }
                    : null,
                } satisfies AiSuggestionAnalyzeData,
              },
              {
                ...this.#jobOptions(),
                idempotencyKey: AiSuggestionJobKey.analyze(user.id, periodId),
              },
            ),
          ),
        );
        totalEnqueued += batch.length;
        await dispatchJob?.updateProgress({ enqueued: totalEnqueued });
      },
    });

    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_COMPLETED,
      queueName: AI_SUGGESTION_QUEUE,
      enqueuedCount: totalEnqueued,
    });
  }

  /**
   * 서버 재시작 시 놓친 크론 스케줄을 보정합니다.
   */
  async #catchUpIfNeeded(): Promise<void> {
    const kstNow = dayjs().tz("Asia/Seoul");
    const hour = kstNow.hour();

    // 매일 07:30 이후
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

  /**
   * jobId 중복 방지용 날짜 식별자 생성
   */
  #getJobDeduplicationId(): string {
    return dayjs().tz("Asia/Seoul").format("YYYY-MM-DD");
  }

  #jobOptions() {
    return {
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 10 * 60,
      retentionSeconds: 24 * 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      timezone: "Asia/Seoul",
    };
  }
}
