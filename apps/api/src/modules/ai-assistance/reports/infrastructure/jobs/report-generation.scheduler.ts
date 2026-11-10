import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { premiumAccessCondition } from "#api/modules/access/entitlements/access-entitlements.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { instantToDate, toIsoString } from "#api/shared/domain/time/instant";
import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import type { ReportType } from "../../domain/ai-report.constants.js";
import {
  isInReportDispatchWindow,
  reportDispatchPeriodId,
} from "../../domain/report-dispatch-window.domain-service.js";
import { AiJobLogEvent } from "./ai-job.log-events.js";
import {
  AI_REPORT_JOB_RETRY_POLICY,
  AI_REPORT_QUEUE,
  type AiReportGenerateData,
  AiReportJobName,
  AiReportSchedulerName,
  AiReportJobKey,
} from "./ai-report.queue.js";
import { ReportGenerationProcessor } from "./report-generation.processor.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/**
 * 매시 5분에 디스패치하고 사용자 로컬 기준 새 주기 시작 직후인 사용자만 등록한다.
 * KST 고정 cron은 서쪽 시간대 사용자에게 아직 끝나지 않은 주기를 "지난 주기"로 만들었다.
 */
const HOURLY_DISPATCH_CRON = "5 * * * *";
const DISPATCH_CRON_TZ = "UTC";

@Injectable()
export class ReportGenerationScheduler implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationScheduler.name);

  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #runtime: JobRuntimePort;
  readonly #processor: ReportGenerationProcessor;
  readonly #clock: ClockPort;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    runtime: JobRuntimePort,
    processor: ReportGenerationProcessor,
    clock: ClockPort,
  ) {
    this.#txHost = txHost;
    this.#runtime = runtime;
    this.#processor = processor;
    this.#clock = clock;
  }

  /** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
  get #db() {
    return this.#txHost.tx;
  }

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // Processor에 자신을 등록 (순환 참조 방지)
    this.#processor.setReportJob(this);

    // 작업 저장소 장애 중에도 부팅은 진행한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Report generation scheduler registration",
      async () => {
        await this.#runtime.schedule(
          AiReportSchedulerName.WEEKLY,
          HOURLY_DISPATCH_CRON,
          AI_REPORT_QUEUE,
          { name: AiReportJobName.DISPATCH, data: { reportType: "WEEKLY" } },
          { ...this.#jobOptions(), missed: "once" },
        );
        await this.#runtime.schedule(
          AiReportSchedulerName.MONTHLY,
          HOURLY_DISPATCH_CRON,
          AI_REPORT_QUEUE,
          { name: AiReportJobName.DISPATCH, data: { reportType: "MONTHLY" } },
          { ...this.#jobOptions(), missed: "once" },
        );

        this.#logger.log({ event: AiJobLogEvent.SCHEDULED, queueName: AI_REPORT_QUEUE });

        await this.#catchUpIfNeeded();
      },
    );
  }

  /**
   * 로컬 디스패치 창에 든 대상 사용자만 per-user 잡으로 등록한다.
   * 창 안에서 매시 다시 실행돼도 사용자 로컬 주기의 멱등 키가 중복 등록을 막는다.
   */
  async dispatchReports(type: ReportType): Promise<void> {
    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_STARTED,
      queueName: AI_REPORT_QUEUE,
      reportType: type,
    });

    const dispatchedAt = instantToDate(this.#clock.now());
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.#db.query.user.findMany({
          columns: { id: true },
          with: { preference: { columns: { timezone: true, locale: true } } },
          where: {
            // Drizzle 1.0 RC는 undefined 조건을 거절하므로 첫 페이지에서는 조건을 빼야 한다
            ...(cursor != null && { id: { gt: cursor } }),
            RAW: (target) => premiumAccessCondition(target, instantToDate(this.#clock.now())),
            status: "ACTIVE",
            deletedAt: { isNull: true },
          },
          orderBy: { id: "asc" },
          limit: take,
        }),
      onBatch: async (batch) => {
        const due = batch.flatMap((user) => {
          const timezone = resolveTimezone(user.preference?.timezone ?? TimeZone.SEOUL.value);
          return isInReportDispatchWindow(type, dispatchedAt, timezone) ? [{ user, timezone }] : [];
        });
        if (due.length === 0) {
          return;
        }
        await this.#runtime.enqueueMany(
          AI_REPORT_QUEUE,
          due.map(({ user, timezone }) => ({
            data: {
              name: AiReportJobName.GENERATE,
              data: {
                userId: user.id,
                timezone,
                locale: user.preference?.locale ?? "ko",
                reportType: type,
              } satisfies AiReportGenerateData,
            },
            options: {
              ...this.#jobOptions(),
              idempotencyKey: AiReportJobKey.generate(
                type,
                user.id,
                reportDispatchPeriodId(type, dispatchedAt, timezone),
              ),
            },
          })),
        );
        totalEnqueued += due.length;
      },
    });

    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_COMPLETED,
      queueName: AI_REPORT_QUEUE,
      reportType: type,
      enqueuedCount: totalEnqueued,
    });
  }

  /**
   * 재시작으로 놓친 매시 디스패치를 보정한다.
   * 같은 UTC 시각의 보정은 한 번만 등록되고, 사용자별 중복은 생성 잡의 멱등 키가 막는다.
   */
  async #catchUpIfNeeded(): Promise<void> {
    const hourId = toIsoString(this.#clock.now()).slice(0, 13);
    for (const reportType of ["WEEKLY", "MONTHLY"] as const) {
      this.#logger.log({ event: AiJobLogEvent.CATCH_UP, queueName: AI_REPORT_QUEUE, reportType });
      await this.#runtime.enqueue(
        AI_REPORT_QUEUE,
        { name: AiReportJobName.DISPATCH, data: { reportType } },
        { ...this.#jobOptions(), idempotencyKey: AiReportJobKey.dispatch(reportType, hourId) },
      );
    }
  }

  #jobOptions() {
    return {
      ...AI_REPORT_JOB_RETRY_POLICY,
      expireInSeconds: 10 * 60,
      retentionSeconds: 7 * 24 * 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      timezone: DISPATCH_CRON_TZ,
    };
  }
}
