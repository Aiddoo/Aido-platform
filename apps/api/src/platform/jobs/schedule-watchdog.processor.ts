import { Injectable, type OnModuleInit } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { JobQueueRegistry } from "./job-queue.registry.js";
import { deadLetterAlert, scheduleFailingAlert, scheduleOverdueAlert } from "./jobs.alerts.js";
import { PgBossScheduleRunReader, type WatchedSchedule } from "./pg-boss-schedule-run.reader.js";
import {
  findDueRuns,
  judgeScheduleRuns,
  scheduleRunWindowStart,
} from "./schedule-watchdog.domain-service.js";
import {
  SCHEDULE_WATCHDOG_HEARTBEAT,
  SCHEDULE_WATCHDOG_INTERVAL_MINUTES,
  SCHEDULE_WATCHDOG_QUEUE,
} from "./schedule-watchdog.queue.js";

/**
 * pg-boss에 등록된 모든 스케줄이 제때 끝나는지와 DLQ 유입을 보고, 실행마다 worker 생존 신호를 보낸다.
 * 스케줄마다 Cron 모니터를 두는 대신 이 작업 하나만 바깥 감시자(무료 1개)에 걸어 둔다.
 */
@Injectable()
export class ScheduleWatchdogProcessor implements OnModuleInit {
  readonly #jobQueue: JobQueuePort;
  readonly #reader: PgBossScheduleRunReader;
  readonly #registry: JobQueueRegistry;
  readonly #alerts: OperationalAlertPort;
  readonly #heartbeat: JobHeartbeatPort;
  readonly #clock: ClockPort;

  constructor(
    jobQueue: JobQueuePort,
    reader: PgBossScheduleRunReader,
    registry: JobQueueRegistry,
    alerts: OperationalAlertPort,
    heartbeat: JobHeartbeatPort,
    clock: ClockPort,
  ) {
    this.#jobQueue = jobQueue;
    this.#reader = reader;
    this.#registry = registry;
    this.#alerts = alerts;
    this.#heartbeat = heartbeat;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(SCHEDULE_WATCHDOG_QUEUE, async () => this.run());
  }

  async run(): Promise<void> {
    await this.#heartbeat.monitor(SCHEDULE_WATCHDOG_HEARTBEAT, async () => {
      const now = this.#clock.now();
      await this.#watchSchedules(now);
      await this.#watchDeadLetters(now);
    });
  }

  async #watchSchedules(now: Temporal.Instant): Promise<void> {
    const schedules = await this.#reader.listSchedules();
    for (const schedule of schedules) {
      // 감시 작업 자신이 멈추면 생존 신호가 끊겨 바깥 감시자가 알린다
      if (schedule.queue === SCHEDULE_WATCHDOG_QUEUE.name) {
        continue;
      }
      await this.#watchSchedule(schedule, now);
    }
  }

  async #watchSchedule(schedule: WatchedSchedule, now: Temporal.Instant): Promise<void> {
    const due = await findDueRuns({ now, preview: this.#reader.occurrencesOf(schedule) });
    if (due == null) {
      return;
    }
    const since = scheduleRunWindowStart({
      now,
      due,
      registeredAt: schedule.registeredAt,
      finishedRunRetentionSeconds: schedule.finishedRunRetentionSeconds,
    });
    if (since == null) {
      return;
    }
    const runs = await this.#reader.countRuns(schedule, since);
    const verdict = judgeScheduleRuns({ now, runs });
    if (verdict === "failing") {
      this.#alerts.raise(scheduleFailingAlert(schedule, runs.failed));
    } else if (verdict === "overdue") {
      this.#alerts.raise(scheduleOverdueAlert(schedule, due.latest));
    }
  }

  async #watchDeadLetters(now: Temporal.Instant): Promise<void> {
    const since = now.subtract({ minutes: SCHEDULE_WATCHDOG_INTERVAL_MINUTES });
    for (const queue of this.#registry.deadLetterQueueNames()) {
      const arrivals = await this.#reader.countDeadLetterArrivals(queue, since);
      if (arrivals > 0) {
        this.#alerts.raise(
          deadLetterAlert({ queue, arrivals, windowMinutes: SCHEDULE_WATCHDOG_INTERVAL_MINUTES }),
        );
      }
    }
  }
}
