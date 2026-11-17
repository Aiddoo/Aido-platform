import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { premiumAccessCondition } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { AiGenerationLogEvent } from "../../../ai-generations/application/ai-generations.log-events.js";
import { DispatchSuggestionAnalysesUseCase } from "../../application/use-cases/dispatch-suggestion-analyses.use-case.js";
import {
  isInSuggestionDispatchWindow,
  resolveSuggestionTimeZone,
} from "../../domain/suggestion-dispatch-window.domain-service.js";
import { SUGGESTION_ANALYSIS_PERIOD_DAYS } from "../../domain/suggestions.constants.js";
import { AI_SUGGESTION_QUEUE } from "./ai-suggestion.queue.js";

const ENQUEUE_BATCH_SIZE = 50;

@Injectable()
export class SuggestionAnalysisScheduler implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisScheduler.name);

  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;
  readonly #dispatchAnalyses: Pick<DispatchSuggestionAnalysesUseCase, "execute">;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    jobQueue: JobQueuePort,
    clock: ClockPort,
    @Inject(DispatchSuggestionAnalysesUseCase)
    dispatchAnalyses: Pick<DispatchSuggestionAnalysesUseCase, "execute">,
  ) {
    this.#transactionHost = transactionHost;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
    this.#dispatchAnalyses = dispatchAnalyses;
  }

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // 작업 저장소 장애 중에도 부팅은 진행한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Suggestion analysis scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(AI_SUGGESTION_QUEUE);
        this.#logger.log({
          event: AiGenerationLogEvent.JOB_SCHEDULED,
          queueName: AI_SUGGESTION_QUEUE.name,
        });
      },
    );
  }

  async dispatchAnalysis(): Promise<void> {
    this.#logger.log({
      event: AiGenerationLogEvent.JOB_DISPATCH_STARTED,
      queueName: AI_SUGGESTION_QUEUE.name,
    });

    const at = this.#clock.now();
    const atDate = instantToDate(at);
    // planning Todo.startDate는 달력 날짜 칸이라 지금처럼 그 순간의 UTC 날짜와 비교한다
    const recentFrom = at
      .subtract({ hours: SUGGESTION_ANALYSIS_PERIOD_DAYS * 24 })
      .toZonedDateTimeISO("UTC")
      .toPlainDate();
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.#transactionHost.tx.query.user.findMany({
          columns: { id: true },
          with: { preference: { columns: { timezone: true } } },
          where: {
            // Drizzle 1.0 RC는 undefined 조건을 거절하므로 첫 페이지에서는 조건을 빼야 한다
            ...(cursor != null && { id: { gt: cursor } }),
            RAW: (target) => premiumAccessCondition(target, atDate),
            status: "ACTIVE",
            deletedAt: { isNull: true },
            todos: {
              startDate: { gte: recentFrom },
              seriesId: { isNull: true },
            },
          },
          orderBy: { id: "asc" },
          limit: take,
        }),
      onBatch: async (batch) => {
        const targets = batch.flatMap((user) => {
          const timeZone = resolveSuggestionTimeZone(user.preference?.timezone);
          return isInSuggestionDispatchWindow({ at, timeZone })
            ? [{ userId: UserId.reconstitute(user.id), timeZone }]
            : [];
        });
        totalEnqueued += await this.#dispatchAnalyses.execute({ targets });
      },
    });

    this.#logger.log({
      event: AiGenerationLogEvent.JOB_DISPATCH_COMPLETED,
      queueName: AI_SUGGESTION_QUEUE.name,
      enqueuedCount: totalEnqueued,
    });
  }
}
