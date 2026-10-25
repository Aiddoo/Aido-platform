import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { decodeRecord } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { now } from "#api/shared/domain/date/utils/core";
import { resolveTimezone } from "#api/shared/domain/date/utils/timezone";

import {
  isInReportDispatchWindow,
  reportDispatchPeriodId,
} from "../../../domain/services/reports/report-dispatch-window.js";
import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";
import { AiJobLogEvent } from "../../observability/jobs/ai-job-log.events.js";
import { ReportGenerationProcessor } from "../../processors/reports/report-generation.processor.js";
import {
  AI_REPORT_QUEUE,
  type AiReportGenerateData,
  AiReportJobName,
  AiReportSchedulerName,
  AiReportJobKey,
} from "./ai-report-queue.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/** preference가 없는 사용자의 기존 기본 타임존 */
const DEFAULT_REPORT_TIMEZONE = "Asia/Seoul";

/**
 * 매시 5분에 디스패치하고 사용자 로컬 기준 새 주기 시작 직후인 사용자만 등록한다.
 * KST 고정 cron은 서쪽 시간대 사용자에게 아직 끝나지 않은 주기를 "지난 주기"로 만들었다.
 */
const HOURLY_DISPATCH_CRON = "5 * * * *";
const DISPATCH_CRON_TZ = "UTC";

@Injectable()
export class ReportGenerationJob implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationJob.name);

  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    private readonly processor: ReportGenerationProcessor,
  ) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
  private get database() {
    return this.txHost.tx;
  }

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // Processor에 자신을 등록 (순환 참조 방지)
    this.processor.setReportJob(this);

    // Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Report generation scheduler registration",
      async () => {
        await this.runtime.schedule(
          AiReportSchedulerName.WEEKLY,
          HOURLY_DISPATCH_CRON,
          AI_REPORT_QUEUE,
          { name: AiReportJobName.DISPATCH, data: { reportType: "WEEKLY" } },
          this.#jobOptions(),
        );
        await this.runtime.schedule(
          AiReportSchedulerName.MONTHLY,
          HOURLY_DISPATCH_CRON,
          AI_REPORT_QUEUE,
          { name: AiReportJobName.DISPATCH, data: { reportType: "MONTHLY" } },
          this.#jobOptions(),
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
  async dispatchReports(
    type: ReportType,
    dispatchJob?: { updateProgress(progress: object): Promise<unknown> },
  ): Promise<void> {
    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_STARTED,
      queueName: AI_REPORT_QUEUE,
      reportType: type,
    });

    const dispatchedAt = now();
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) =>
        this.database.orm.public.User.where((row) =>
          and(
            cursor !== undefined ? row.id.gt(cursor) : all(),
            or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
            row.status.eq("ACTIVE"),
            row.deletedAt.isNull(),
          ),
        )
          .select("id")
          .include("preference", (related) => related.select("timezone", "locale"))
          .orderBy((row) => row.id.asc())
          .limit(take)
          .all()
          .then((row) => decodeRecord("User", row)),
      onBatch: async (batch) => {
        const due = batch.flatMap((user) => {
          const timezone = resolveTimezone(user.preference?.timezone ?? DEFAULT_REPORT_TIMEZONE);
          return isInReportDispatchWindow(type, dispatchedAt, timezone) ? [{ user, timezone }] : [];
        });
        if (due.length === 0) return;
        await this.runtime.enqueueMany(
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
        await dispatchJob?.updateProgress({ enqueued: totalEnqueued });
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
    const hourId = now().toISOString().slice(0, 13);
    for (const reportType of ["WEEKLY", "MONTHLY"] as const) {
      this.#logger.log({ event: AiJobLogEvent.CATCH_UP, queueName: AI_REPORT_QUEUE, reportType });
      await this.runtime.enqueue(
        AI_REPORT_QUEUE,
        { name: AiReportJobName.DISPATCH, data: { reportType } },
        { ...this.#jobOptions(), idempotencyKey: AiReportJobKey.dispatch(reportType, hourId) },
      );
    }
  }

  #jobOptions() {
    return {
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 10 * 60,
      retentionSeconds: 7 * 24 * 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      timezone: DISPATCH_CRON_TZ,
    };
  }
}
