import { AI_REPORT_TYPES, resolveSupportedLocale } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, asc, eq, gt } from "drizzle-orm";

import { premiumAccessCondition } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { userDeliveryPreference } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { userAccessSubjects } from "#api/modules/identity/users/identity-users-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { forEachBatch } from "#api/platform/database/utils/batch-cursor.util";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { instantToDate, toIsoString } from "#api/shared/domain/time/instant";
import { resolveTimezone } from "#api/shared/domain/time/timezone-name";
import { Timezone } from "#api/shared/domain/time/timezone.vo";

import { AiGenerationLogEvent } from "../../../ai-generations/application/ai-generations.log-events.js";
import type { ReportType } from "../../domain/ai-reports.constants.js";
import {
  isInReportDispatchWindow,
  reportDispatchPeriodId,
} from "../../domain/report-dispatch-window.domain-service.js";
import { AI_REPORT_QUEUE, AiReportJobKey, AiReportJobName } from "./ai-report.queue.js";
import { ReportGenerationProcessor } from "./report-generation.processor.js";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

@Injectable()
export class ReportGenerationScheduler implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationScheduler.name);

  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #jobQueue: Pick<JobQueuePort, "registerSchedules" | "enqueue" | "enqueueMany">;
  readonly #processor: ReportGenerationProcessor;
  readonly #clock: ClockPort;

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    jobQueue: JobQueuePort,
    processor: ReportGenerationProcessor,
    clock: ClockPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#jobQueue = jobQueue;
    this.#processor = processor;
    this.#clock = clock;
  }

  onModuleInit(): void {
    // Processor에 자신을 등록 (순환 참조 방지)
    this.#processor.setReportJob(this);

    // 작업 저장소 장애 중에도 부팅은 진행한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Report generation scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(AI_REPORT_QUEUE);
        this.#logger.log({
          event: AiGenerationLogEvent.JOB_SCHEDULED,
          queueName: AI_REPORT_QUEUE.name,
        });

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
      event: AiGenerationLogEvent.JOB_DISPATCH_STARTED,
      queueName: AI_REPORT_QUEUE.name,
      reportType: type,
    });

    const dispatchedAt = instantToDate(this.#clock.now());
    let totalEnqueued = 0;

    await forEachBatch({
      batchSize: ENQUEUE_BATCH_SIZE,
      fetchPage: (cursor, take) => this.#findRecipientPage(cursor, take),
      onBatch: async (batch) => {
        const due = batch.flatMap((user) => {
          const timezone = resolveTimezone(user.timezone ?? Timezone.SEOUL.value);
          return isInReportDispatchWindow(type, dispatchedAt, timezone) ? [{ user, timezone }] : [];
        });
        if (due.length === 0) {
          return;
        }
        await this.#jobQueue.enqueueMany(
          AI_REPORT_QUEUE,
          due.map(({ user, timezone }) => ({
            payload: {
              name: AiReportJobName.GENERATE,
              data: {
                userId: user.id,
                timezone,
                locale: resolveSupportedLocale(user.locale),
                reportType: type,
              },
            },
            idempotencyKey: AiReportJobKey.generate(
              type,
              user.id,
              reportDispatchPeriodId(type, dispatchedAt, timezone),
            ),
          })),
        );
        totalEnqueued += due.length;
      },
    });

    this.#logger.log({
      event: AiGenerationLogEvent.JOB_DISPATCH_COMPLETED,
      queueName: AI_REPORT_QUEUE.name,
      reportType: type,
      enqueuedCount: totalEnqueued,
    });
  }

  /** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
  get #db() {
    return this.#transactionHost.tx;
  }

  /**
   * 재시작으로 놓친 매시 디스패치를 보정한다.
   * 같은 UTC 시각의 보정은 한 번만 등록되고, 사용자별 중복은 생성 잡의 멱등 키가 막는다.
   */
  async #catchUpIfNeeded(): Promise<void> {
    const hourId = toIsoString(this.#clock.now()).slice(0, 13);
    for (const reportType of AI_REPORT_TYPES) {
      this.#logger.log({
        event: AiGenerationLogEvent.JOB_CATCH_UP,
        queueName: AI_REPORT_QUEUE.name,
        reportType,
      });
      await this.#jobQueue.enqueue(
        AI_REPORT_QUEUE,
        { name: AiReportJobName.DISPATCH, data: { reportType } },
        { idempotencyKey: AiReportJobKey.dispatch(reportType, hourId) },
      );
    }
  }

  // 활성 유료 사용자를 id 순서로 한 쪽씩 읽는다. 유료 판단은 쪽마다 지금 시각으로 한다
  #findRecipientPage(cursor: string | undefined, take: number) {
    const subject = userAccessSubjects({ activeOnly: true });
    const preference = userDeliveryPreference();
    return this.#db
      .select({ id: subject.id, timezone: preference.timezone, locale: preference.locale })
      .from(subject)
      .leftJoin(preference, eq(preference.userId, subject.id))
      .where(
        and(
          cursor == null ? undefined : gt(subject.id, cursor),
          premiumAccessCondition(subject, instantToDate(this.#clock.now())),
        ),
      )
      .orderBy(asc(subject.id))
      .limit(take);
  }
}
