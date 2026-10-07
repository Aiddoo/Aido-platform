import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import {
  ADMIN_NOTIFICATION_QUEUE,
  AdminNotificationJobName,
  DAILY_SIGNUP_SUMMARY_SCHEDULE,
} from "./admin-notification-queue.constants.js";

/**
 * 일일 가입 요약 스케줄러 등록기.
 *
 * 매일 KST 00:10의 잡을 등록하며 부팅을 블로킹하지 않는다.
 * 자정 직전 가입 transaction의 지연을 고려한 시각이며 집계는 전일 KST 범위다.
 */
@Injectable()
export class DailySignupSummaryScheduler implements OnModuleInit {
  readonly #logger = new Logger(DailySignupSummaryScheduler.name);

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: Pick<JobRuntimePort, "schedule">) {}

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    this.schedulerRegistration = this.#registerSchedule();
  }

  async #registerSchedule(): Promise<void> {
    try {
      await this.runtime.schedule(
        DAILY_SIGNUP_SUMMARY_SCHEDULE.key,
        DAILY_SIGNUP_SUMMARY_SCHEDULE.cron,
        ADMIN_NOTIFICATION_QUEUE,
        { name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
        {
          ...DAILY_SIGNUP_SUMMARY_SCHEDULE.jobPolicy,
          timezone: DAILY_SIGNUP_SUMMARY_SCHEDULE.timezone,
        },
      );
      this.#logger.log({
        event: AdminNotificationInfraEvent.SCHEDULE_REGISTERED,
        queueName: ADMIN_NOTIFICATION_QUEUE,
      });
    } catch {
      this.#logger.error({
        event: AdminNotificationInfraEvent.SCHEDULE_FAILED,
        queueName: ADMIN_NOTIFICATION_QUEUE,
        errorType: "schedule",
      });
    }
  }
}
