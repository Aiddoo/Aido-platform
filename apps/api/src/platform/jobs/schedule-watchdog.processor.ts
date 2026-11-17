import { Injectable, type OnModuleInit } from "@nestjs/common";
import { zip } from "es-toolkit";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { JobQueueRegistry } from "./job-queue.registry.js";
import { deadLetterAlert, scheduleFailingAlert, scheduleOverdueAlert } from "./jobs.alerts.js";
import {
  PgBossScheduleRunReader,
  type ScheduleRunWindow,
  type WatchedSchedule,
} from "./pg-boss-schedule-run.reader.js";
import {
  type DueRuns,
  findDueRuns,
  judgeScheduleRuns,
  scheduleRunWindowStart,
} from "./schedule-watchdog.domain-service.js";
import {
  SCHEDULE_WATCHDOG_HEARTBEAT,
  SCHEDULE_WATCHDOG_INTERVAL_MINUTES,
  SCHEDULE_WATCHDOG_QUEUE,
} from "./schedule-watchdog.queue.js";

interface DueScheduleWindow extends ScheduleRunWindow {
  readonly due: DueRuns;
}

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
    const windows: DueScheduleWindow[] = [];
    for (const schedule of await this.#reader.listSchedules()) {
      // 감시 작업 자신이 멈추면 생존 신호가 끊겨 바깥 감시자가 알린다
      if (schedule.queue === SCHEDULE_WATCHDOG_QUEUE.name) {
        continue;
      }
      const window = await this.#dueWindowOf(schedule, now);
      if (window != null) {
        windows.push(window);
      }
    }
    // 스케줄마다 따로 세면 감시 한 번에 job 표 조회가 스케줄 수만큼 나가 연결을 오래 잡는다(Sentry NODE-NESTJS-2K)
    const counted = await this.#reader.countRuns(windows);
    for (const [{ schedule, due }, runs] of zip(windows, counted)) {
      const verdict = judgeScheduleRuns({ now, runs });
      if (verdict === "failing") {
        this.#alerts.raise(scheduleFailingAlert(schedule, runs.failed));
      } else if (verdict === "overdue") {
        this.#alerts.raise(scheduleOverdueAlert(schedule, due.latest));
      }
    }
  }

  async #dueWindowOf(
    schedule: WatchedSchedule,
    now: Temporal.Instant,
  ): Promise<DueScheduleWindow | null> {
    const due = await findDueRuns({ now, preview: this.#reader.occurrencesOf(schedule) });
    if (due == null) {
      return null;
    }
    const since = scheduleRunWindowStart({
      now,
      due,
      registeredAt: schedule.registeredAt,
      finishedRunRetentionSeconds: schedule.finishedRunRetentionSeconds,
    });
    return since == null ? null : { schedule, due, since };
  }

  async #watchDeadLetters(now: Temporal.Instant): Promise<void> {
    const since = now.subtract({ minutes: SCHEDULE_WATCHDOG_INTERVAL_MINUTES });
    const queues = this.#registry.deadLetterQueueNames();
    const arrivalsByQueue = await this.#reader.countDeadLetterArrivals(queues, since);
    for (const queue of queues) {
      const arrivals = arrivalsByQueue.get(queue) ?? 0;
      if (arrivals > 0) {
        this.#alerts.raise(
          deadLetterAlert({ queue, arrivals, windowMinutes: SCHEDULE_WATCHDOG_INTERVAL_MINUTES }),
        );
      }
    }
  }
}
