import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { premiumAccessCondition } from "#api/modules/access/entitlements/access-entitlements.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { instantToDate } from "#api/shared/domain/time/instant";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { AiJobLogEvent } from "../../../reports/infrastructure/jobs/ai-job.log-events.js";
import { toUserTimeZone } from "../../../shared/domain/user-calendar.domain-service.js";
import {
  isInSuggestionDispatchWindow,
  suggestionDispatchLocalDate,
} from "../../domain/suggestion-dispatch-window.domain-service.js";
import {
  AI_SUGGESTION_QUEUE,
  type AiSuggestionAnalyzeData,
  AiSuggestionJobKey,
  AiSuggestionJobName,
} from "./ai-suggestion.queue.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/** 분석에 쓰는 최근 기록 기간. 이 안에 단건 할 일이 있는 사용자만 고른다 */
const RECENT_ACTIVITY_DAYS = 14;

/**
 * 매시 정각 디스패치가 현지 07시대인 유료 사용자마다 분석 작업을 하나씩 등록한다.
 * 같은 사용자의 같은 현지 날짜 작업은 멱등 키로 한 번만 등록된다.
 */
@Injectable()
export class SuggestionAnalysisScheduler implements OnModuleInit {
  readonly #logger = new Logger(SuggestionAnalysisScheduler.name);

  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    jobQueue: JobQueuePort,
    clock: ClockPort,
  ) {
    this.#txHost = txHost;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
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
        this.#logger.log({ event: AiJobLogEvent.SCHEDULED, queueName: AI_SUGGESTION_QUEUE.name });
      },
    );
  }

  async dispatchAnalysis(): Promise<void> {
    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_STARTED,
      queueName: AI_SUGGESTION_QUEUE.name,
    });

    const at = this.#clock.now();
    const atDate = instantToDate(at);
    // planning Todo.startDate는 달력 날짜 칸이라 지금처럼 그 순간의 UTC 날짜와 비교한다
    const recentFrom = at
      .subtract({ hours: RECENT_ACTIVITY_DAYS * 24 })
      .toZonedDateTimeISO("UTC")
      .toPlainDate();
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.#txHost.tx.query.user.findMany({
          columns: { id: true },
          with: {
            preference: { columns: { timezone: true } },
            location: { columns: { gridX: true, gridY: true, latitude: true, longitude: true } },
          },
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
        const due = batch.flatMap((user) => {
          const timeZone = toUserTimeZone(user.preference?.timezone ?? TimeZone.SEOUL.value).value;
          return isInSuggestionDispatchWindow({ at, timeZone }) ? [{ user, timeZone }] : [];
        });
        if (due.length === 0) {
          return;
        }
        await this.#jobQueue.enqueueMany(
          AI_SUGGESTION_QUEUE,
          due.map(({ user, timeZone }) => ({
            payload: {
              name: AiSuggestionJobName.ANALYZE,
              data: {
                userId: user.id,
                timezone: timeZone,
                weatherGrid: toWeatherGrid(user.location),
              } satisfies AiSuggestionAnalyzeData,
            },
            idempotencyKey: AiSuggestionJobKey.analyze(
              user.id,
              suggestionDispatchLocalDate({ at, timeZone }),
            ),
          })),
        );
        totalEnqueued += due.length;
      },
    });

    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_COMPLETED,
      queueName: AI_SUGGESTION_QUEUE.name,
      enqueuedCount: totalEnqueued,
    });
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
