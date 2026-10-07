import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";
import dayjs from "dayjs";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { decodeRecord } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toIsoMonthId, toIsoWeekId } from "#api/shared/domain/date/utils/format";

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

/** 크론 스케줄 + jobId 계산에 사용하는 기준 타임존 */
const CRON_TZ = "Asia/Seoul";

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
          "0 1 * * 1",
          AI_REPORT_QUEUE,
          { name: AiReportJobName.DISPATCH, data: { reportType: "WEEKLY" } },
          this.#jobOptions(),
        );
        await this.runtime.schedule(
          AiReportSchedulerName.MONTHLY,
          "0 2 1 * *",
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
   * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
   */
  async dispatchReports(
    type: "WEEKLY" | "MONTHLY",
    dispatchJob?: { updateProgress(progress: object): Promise<unknown> },
  ): Promise<void> {
    this.#logger.log({
      event: AiJobLogEvent.DISPATCH_STARTED,
      queueName: AI_REPORT_QUEUE,
      reportType: type,
    });

    const periodId = this.#getJobDeduplicationId(type);
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
        await Promise.all(
          batch.map((user) =>
            this.runtime.enqueue(
              AI_REPORT_QUEUE,
              {
                name: AiReportJobName.GENERATE,
                data: {
                  userId: user.id,
                  timezone: user.preference?.timezone ?? "Asia/Seoul",
                  locale: user.preference?.locale ?? "ko",
                  reportType: type,
                } satisfies AiReportGenerateData,
              },
              {
                ...this.#jobOptions(),
                idempotencyKey: AiReportJobKey.generate(type, user.id, periodId),
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
      queueName: AI_REPORT_QUEUE,
      reportType: type,
      enqueuedCount: totalEnqueued,
    });
  }

  /**
   * 서버 재시작 시 놓친 크론 스케줄을 보정합니다.
   *
   * 현재 KST 시각이 크론 트리거 윈도우 내에 있으면 dispatch 잡을 큐에 추가합니다.
   * 동일 기간의 enqueue 중복은 runtime key로 줄이고 저장 중복은 Application에서 확인한다.
   */
  async #catchUpIfNeeded(): Promise<void> {
    const kstNow = dayjs().tz(CRON_TZ);
    const dayOfWeek = kstNow.day(); // 0=일, 1=월, ...
    const dayOfMonth = kstNow.date();
    const hour = kstNow.hour();
    const now = kstNow.toDate();

    // 주간: 월요일 01:00 이후
    if (dayOfWeek === 1 && hour >= 1) {
      const weekId = toIsoWeekId(now, CRON_TZ);
      this.#logger.log({
        event: AiJobLogEvent.CATCH_UP,
        queueName: AI_REPORT_QUEUE,
        reportType: "WEEKLY",
      });
      await this.runtime.enqueue(
        AI_REPORT_QUEUE,
        { name: AiReportJobName.DISPATCH, data: { reportType: "WEEKLY" } },
        { ...this.#jobOptions(), idempotencyKey: AiReportJobKey.dispatch("WEEKLY", weekId) },
      );
    }

    // 월간: 1일 01:00 이후
    if (dayOfMonth === 1 && hour >= 1) {
      const monthId = toIsoMonthId(now, CRON_TZ);
      this.#logger.log({
        event: AiJobLogEvent.CATCH_UP,
        queueName: AI_REPORT_QUEUE,
        reportType: "MONTHLY",
      });
      await this.runtime.enqueue(
        AI_REPORT_QUEUE,
        { name: AiReportJobName.DISPATCH, data: { reportType: "MONTHLY" } },
        { ...this.#jobOptions(), idempotencyKey: AiReportJobKey.dispatch("MONTHLY", monthId) },
      );
    }
  }

  /**
   * jobId 중복 방지용 기간 식별자 생성 (KST 기준)
   *
   * 크론 스케줄과 동일한 타임존으로 주차/월을 계산하여
   * UTC ↔ KST 날짜 경계 불일치로 인한 jobId 충돌을 방지합니다.
   */
  #getJobDeduplicationId(type: "WEEKLY" | "MONTHLY"): string {
    const now = new Date();
    return type === "WEEKLY" ? toIsoWeekId(now, CRON_TZ) : toIsoMonthId(now, CRON_TZ);
  }

  #jobOptions() {
    return {
      retryLimit: 2,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 10 * 60,
      retentionSeconds: 7 * 24 * 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      timezone: CRON_TZ,
    };
  }
}
